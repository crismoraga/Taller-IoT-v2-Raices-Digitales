import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Config } from "./config.ts";
import { sessionPatchSchema, type Reading, type Rule } from "./validation.ts";

export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export interface Session {
  id: string;
  name: string;
  groupNumber: number;
  progress: string[];
  drafts: Record<string, string>;
  calibrations: Record<string, { dry: number; wet: number }>;
  sensorEnabled: Record<string, boolean>;
  createdAt: string;
  lastRun?: {
    lessonId: string;
    board: "pico" | "uno" | "nano" | "nano-old";
    code: string;
    at: string;
  };
}
export interface Device {
  id: string;
  name: string;
  source: string;
  lastSeen: string | null;
  diagnostics: Record<string, unknown>;
  revoked: boolean;
  online: boolean;
}
export interface Alert {
  id: string;
  sensor: string;
  type: string;
  message: string;
  createdAt: string;
  delivery: string;
  source: string;
  deviceId: string;
}
export type Row = Record<string, string | number | null>;

export class Store {
  db: DatabaseSync;
  constructor(public config: Config) {
    if (config.databasePath !== ":memory:")
      mkdirSync(dirname(config.databasePath), { recursive: true });
    this.db = new DatabaseSync(config.databasePath);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, cookie_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, group_number INTEGER NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS teacher_sessions(cookie_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS pair_codes(code_hash TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, name TEXT NOT NULL, source TEXT NOT NULL, last_seen INTEGER, diagnostics TEXT NOT NULL DEFAULT '{}', revoked INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS readings(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, device_id TEXT NOT NULL, sensor TEXT NOT NULL, received_at INTEGER NOT NULL, source TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS readings_session_time ON readings(session_id, received_at);
      CREATE INDEX IF NOT EXISTS readings_latest ON readings(session_id,sensor,source,id);
      CREATE TABLE IF NOT EXISTS rules(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rule_states(rule_id TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,device_id TEXT NOT NULL,source TEXT NOT NULL,state TEXT NOT NULL,last_alert INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(rule_id,device_id,source));
      CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS alerts_session_time ON alerts(session_id,created_at);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS device_monitor(device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,state TEXT NOT NULL,updated_at INTEGER NOT NULL);
      PRAGMA user_version=2;
    `);
  }
  session(row: Row): Session {
    return {
      id: String(row.id),
      name: String(row.name),
      groupNumber: Number(row.group_number),
      ...JSON.parse(String(row.data)),
      createdAt: new Date(Number(row.created_at)).toISOString(),
    };
  }
  createSession(name?: string, groupNumber = 1) {
    const secret = token();
    const id = randomUUID();
    const now = this.config.now();
    this.db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?,?,?)").run(
      id,
      hash(secret),
      name || `Grupo ${groupNumber}`,
      groupNumber,
      JSON.stringify({
        progress: [],
        drafts: {},
        calibrations: {},
        sensorEnabled: {},
      }),
      now,
      now + this.config.sessionDays * 86400000,
    );
    return { secret, session: this.byId(id)! };
  }
  byCookie(secret?: string) {
    if (!secret) return null;
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE cookie_hash=? AND expires_at>?")
      .get(hash(secret), this.config.now()) as Row | undefined;
    return row ? this.session(row) : null;
  }
  byId(id: string) {
    const row = this.db
      .prepare("SELECT * FROM sessions WHERE id=? AND expires_at>?")
      .get(id, this.config.now()) as Row | undefined;
    return row ? this.session(row) : null;
  }
  patchSession(session: Session, patch: Partial<Session>) {
    // Releer antes de combinar evita reemplazar otro PATCH con el snapshot del middleware.
    // DatabaseSync mantiene esta lectura y escritura en el mismo tramo síncrono del proceso.
    const current = this.byId(session.id);
    if (!current)
      throw Object.assign(new Error("La sesión expiró."), { statusCode: 401 });
    const updated = {
      ...current,
      ...patch,
      drafts: { ...current.drafts, ...patch.drafts },
      calibrations: { ...current.calibrations, ...patch.calibrations },
      sensorEnabled: { ...current.sensorEnabled, ...patch.sensorEnabled },
    };
    const { progress, drafts, calibrations, sensorEnabled, lastRun } = updated;
    // Limits apply to the accumulated session, not just one partial request.
    sessionPatchSchema.parse({
      name: updated.name,
      groupNumber: updated.groupNumber,
      progress,
      drafts,
      calibrations,
      sensorEnabled,
      lastRun,
    });
    this.db
      .prepare("UPDATE sessions SET name=?,group_number=?,data=? WHERE id=?")
      .run(
        updated.name,
        updated.groupNumber,
        JSON.stringify({
          progress,
          drafts,
          calibrations,
          sensorEnabled,
          lastRun,
        }),
        session.id,
      );
    return updated;
  }
  devices(sessionId: string): Device[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM devices WHERE session_id=? ORDER BY last_seen DESC",
        )
        .all(sessionId) as Row[]
    ).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      source: String(row.source),
      lastSeen:
        row.last_seen !== null
          ? new Date(Number(row.last_seen)).toISOString()
          : null,
      diagnostics: JSON.parse(String(row.diagnostics)),
      revoked: !!row.revoked,
      online:
        !row.revoked &&
        row.last_seen !== null &&
        this.config.now() - Number(row.last_seen) <
          this.config.deviceOfflineSeconds * 1000,
    }));
  }
  latest(sessionId: string): Reading[] {
    return (
      this.db
        .prepare(
          "SELECT data FROM readings WHERE id IN (SELECT MAX(id) FROM readings WHERE session_id=? GROUP BY sensor,source) ORDER BY id DESC",
        )
        .all(sessionId) as Row[]
    ).map((row) => JSON.parse(String(row.data)));
  }
  history(sessionId: string, since = 0, limit = 5000): Reading[] {
    return (
      this.db
        .prepare(
          "SELECT data FROM (SELECT id,data FROM readings WHERE session_id=? AND received_at>=? ORDER BY id DESC LIMIT ?) ORDER BY id",
        )
        .all(sessionId, since, limit) as Row[]
    ).map((row) => JSON.parse(String(row.data)));
  }
  rules(sessionId: string): Rule[] {
    return (
      this.db
        .prepare("SELECT id,data FROM rules WHERE session_id=? ORDER BY rowid")
        .all(sessionId) as Row[]
    ).map((row) => ({ id: String(row.id), ...JSON.parse(String(row.data)) }));
  }
  alerts(sessionId: string, limit = 100): Alert[] {
    return (
      this.db
        .prepare(
          "SELECT data FROM alerts WHERE session_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?",
        )
        .all(sessionId, limit) as Row[]
    ).map((row) => JSON.parse(String(row.data)));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  ingest(
    sessionId: string,
    deviceId: string,
    source: "hardware" | "simulation",
    readings: Reading[],
    diagnostics?: Record<string, unknown>,
  ) {
    const now = this.config.now();
    const result = readings.map((reading) => ({
      ...reading,
      timestamp: new Date(now).toISOString(),
      deviceId,
      source,
    }));
    this.transaction(() => {
      const stmt = this.db.prepare(
        "INSERT INTO readings(session_id,device_id,sensor,received_at,source,data) VALUES(?,?,?,?,?,?)",
      );
      for (const reading of result)
        stmt.run(
          sessionId,
          deviceId,
          reading.sensor,
          now,
          source,
          JSON.stringify(reading),
        );
      if (deviceId !== "simulation")
        this.db
          .prepare(
            "UPDATE devices SET last_seen=?,source=?,diagnostics=COALESCE(?,diagnostics) WHERE id=?",
          )
          .run(
            now,
            source,
            diagnostics ? JSON.stringify(diagnostics) : null,
            deviceId,
          );
    });
    return result;
  }
  cleanup() {
    const now = this.config.now();
    this.transaction(() => {
      this.db.prepare("DELETE FROM pair_codes WHERE expires_at<=?").run(now);
      this.db
        .prepare("DELETE FROM teacher_sessions WHERE expires_at<=?")
        .run(now);
      this.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
      this.db
        .prepare("DELETE FROM readings WHERE received_at<?")
        .run(now - this.config.retentionDays * 86400000);
      this.db
        .prepare("DELETE FROM alerts WHERE created_at<?")
        .run(now - this.config.retentionDays * 86400000);
    });
    this.db.exec("PRAGMA wal_checkpoint(PASSIVE)");
  }
  close() {
    this.db.close();
  }
}
