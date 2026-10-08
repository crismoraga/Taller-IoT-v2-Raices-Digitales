import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { Config } from "./config.ts";
import type { Store, Alert, Row } from "./database.ts";
import type { Reading, Rule } from "./validation.ts";

export class Telegram {
  constructor(
    private store: Store,
    private config: Config,
  ) {}
  private key() {
    if (!this.config.encryptionKey)
      throw new Error(
        "Configura SECRETS_KEY antes de guardar credenciales Telegram.",
      );
    return Buffer.from(this.config.encryptionKey, "base64");
  }
  save(token: string, chatId: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify({ token, chatId }), "utf8"),
      cipher.final(),
    ]);
    const value = JSON.stringify({
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    });
    this.store.db
      .prepare(
        "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run("telegram", value);
  }
  credentials(): { token: string; chatId: string } | null {
    const row = this.store.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get("telegram") as Row | undefined;
    if (!row) return null;
    const value = JSON.parse(String(row.value));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(value.data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  }
  publicStatus() {
    try {
      const credentials = this.credentials();
      return {
        configured: !!credentials,
        ...(credentials ? { chatId: credentials.chatId } : {}),
      };
    } catch {
      return { configured: false };
    }
  }
  async send(message: string) {
    const credentials = this.credentials();
    if (!credentials) throw new Error("Telegram no está configurado.");
    const response = await fetch(
      `https://api.telegram.org/bot${credentials.token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: credentials.chatId,
          text: message.slice(0, 4000),
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const data = (await response.json()) as {
      ok?: boolean;
      description?: string;
    };
    if (!response.ok || !data.ok)
      throw new Error(
        "Telegram rechazó el mensaje. Revisa el token, el chat y que el bot esté iniciado.",
      );
  }
}

export class Alerts {
  private running?: Promise<void>;
  private stopping = false;
  private nextSend = 0;
  private interval: ReturnType<typeof setInterval>;
  constructor(
    private store: Store,
    private config: Config,
    public telegram: Telegram,
    private notify: (sessionId: string) => void,
  ) {
    // Pending deliveries live in SQLite and survive process restart. One message at
    // a time prevents ten groups from overwhelming a shared Telegram chat.
    this.interval = setInterval(() => this.pump(), 1100);
    this.interval.unref();
  }
  evaluate(sessionId: string, readings: Reading[]) {
    const rules = this.store.rules(sessionId);
    const now = this.config.now();
    for (const reading of readings) {
      if (
        reading.status === "DISABLED" ||
        reading.status === "NEEDS_CALIBRATION" ||
        (reading.status === "UNVERIFIED" && reading.value === null)
      )
        continue;
      for (const rule of rules.filter((r) => r.sensor === reading.sensor))
        this.store.transaction(() => this.rule(sessionId, rule, reading, now));
    }
    this.pump();
  }
  auditDevices(sessionId?: string) {
    const now = this.config.now();
    const devices = this.store.db
      .prepare(
        `SELECT d.*,m.state AS monitor_state FROM devices d JOIN sessions s ON s.id=d.session_id LEFT JOIN device_monitor m ON m.device_id=d.id WHERE d.revoked=0 AND d.source='hardware' AND d.last_seen IS NOT NULL AND s.expires_at>?${sessionId ? " AND d.session_id=?" : ""}`,
      )
      .all(...(sessionId ? [now, sessionId] : [now])) as Row[];
    for (const device of devices) {
      const offline =
        now - Number(device.last_seen) >=
        this.config.deviceOfflineSeconds * 1000;
      const state = offline ? "OFFLINE" : "ONLINE";
      const previous = device.monitor_state;
      if (previous === state) continue;
      const id = String(device.session_id);
      const session = this.store.byId(id)!;
      this.store.transaction(() => {
        if (offline || previous === "OFFLINE") {
          const seconds = Math.floor((now - Number(device.last_seen)) / 1000);
          this.record(
            id,
            "device",
            offline ? "DEVICE_OFFLINE" : "DEVICE_RECOVERY",
            `${session.name} · ${device.name}: ${offline ? `sin telemetría de hardware durante ${seconds} s; revisa alimentación, USB o Wi-Fi` : "la telemetría de hardware se ha recuperado"}.`,
            "hardware",
            String(device.id),
            now,
          );
        }
        this.store.db
          .prepare(
            "INSERT INTO device_monitor VALUES(?,?,?) ON CONFLICT(device_id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at",
          )
          .run(String(device.id), state, now);
      });
      this.notify(id);
    }
    this.pump();
  }
  private record(
    sessionId: string,
    sensor: string,
    type: string,
    message: string,
    source: string,
    deviceId: string,
    now: number,
  ) {
    const delivery =
      source === "simulation"
        ? "simulation"
        : this.telegram.publicStatus().configured
          ? "pending"
          : "not_configured";
    const alert: Alert = {
      id: randomUUID(),
      sensor,
      type,
      message,
      createdAt: new Date(now).toISOString(),
      delivery,
      source,
      deviceId,
    };
    this.store.db
      .prepare("INSERT INTO alerts VALUES(?,?,?,?)")
      .run(alert.id, sessionId, now, JSON.stringify(alert));
    return alert;
  }
  private rule(sessionId: string, rule: Rule, reading: Reading, now: number) {
    const deviceId = reading.deviceId!;
    const source = reading.source!;
    const row = this.store.db
      .prepare(
        "SELECT * FROM rule_states WHERE rule_id=? AND device_id=? AND source=?",
      )
      .get(rule.id, deviceId, source) as Row | undefined;
    const previous = row ? String(row.state) : "NORMAL";
    let state = previous;
    const fault =
      reading.value === null ||
      ["NO_RESPONSE", "ERROR", "OUT_OF_RANGE"].includes(reading.status);
    if (fault) state = "SENSOR_FAULT";
    else if (reading.value !== null) {
      const value = reading.value;
      if (rule.min !== null && value < rule.min) state = "BELOW_MIN";
      else if (rule.max !== null && value > rule.max) state = "ABOVE_MAX";
      else if (
        previous === "BELOW_MIN" &&
        rule.min !== null &&
        value < rule.min + rule.hysteresis
      )
        state = "BELOW_MIN";
      else if (
        previous === "ABOVE_MAX" &&
        rule.max !== null &&
        value > rule.max - rule.hysteresis
      )
        state = "ABOVE_MAX";
      else state = "NORMAL";
    }
    const last = Number(row?.last_alert ?? 0);
    const changed = state !== previous;
    const recovery = state === "NORMAL" && previous !== "NORMAL";
    const shouldAlert =
      recovery ||
      (state !== "NORMAL" &&
        (changed || !row || now - last >= rule.cooldown * 1000));
    let lastAlert = last;
    if (shouldAlert) {
      lastAlert = now;
      const session = this.store.byId(sessionId)!;
      const type = recovery
        ? previous === "SENSOR_FAULT"
          ? "SENSOR_RECOVERY"
          : "RECOVERY"
        : state;
      const prefix = source === "simulation" ? "[SIMULACIÓN] " : "";
      const message = `${prefix}${session.name} · ${rule.sensor}: ${recovery ? "lectura recuperada dentro del rango" : state === "SENSOR_FAULT" ? `fallo de sensor (${reading.status}${reading.error ? ": " + reading.error : ""})` : `${reading.value} ${reading.unit}, ${state === "BELOW_MIN" ? "bajo mínimo " + rule.min : "sobre máximo " + rule.max}`}.`;
      this.record(sessionId, rule.sensor, type, message, source, deviceId, now);
    }
    this.store.db
      .prepare(
        "INSERT INTO rule_states VALUES(?,?,?,?,?) ON CONFLICT(rule_id,device_id,source) DO UPDATE SET state=excluded.state,last_alert=excluded.last_alert",
      )
      .run(rule.id, deviceId, source, state, lastAlert);
  }
  private pump() {
    if (this.stopping || this.running || Date.now() < this.nextSend) return;
    const row = this.store.db
      .prepare(
        "SELECT session_id,data FROM alerts WHERE json_extract(data,'$.delivery')='pending' ORDER BY created_at,rowid LIMIT 1",
      )
      .get() as Row | undefined;
    if (!row) return;
    const sessionId = String(row.session_id);
    const alert: Alert = JSON.parse(String(row.data));
    const operation = (async () => {
      let sent = false;
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        try {
          await this.telegram.send(`🌱 Raíces Digitales\n${alert.message}`);
          sent = true;
        } catch {
          if (attempt < 2)
            await new Promise((resolve) =>
              setTimeout(resolve, (attempt + 1) * 1000),
            );
        }
      }
      alert.delivery = sent ? "delivered" : "failed";
      this.store.db
        .prepare("UPDATE alerts SET data=? WHERE id=?")
        .run(JSON.stringify(alert), alert.id);
      this.notify(sessionId);
    })();
    this.running = operation;
    void operation
      .catch(() => {})
      .finally(() => {
        this.running = undefined;
        this.nextSend = Date.now() + 1100;
      });
  }
  async close() {
    this.stopping = true;
    clearInterval(this.interval);
    if (this.running) await Promise.allSettled([this.running]);
  }
}
