// Explicit virtual devices exercising the same authenticated API as hardware.
const args = process.argv.slice(2),
  option = (key, fallback) => {
    const index = args.indexOf(key);
    return index >= 0 ? args[index + 1] : fallback;
  };
const origin = option("--origin", "http://127.0.0.1:3001"),
  groups = Number(option("--groups", "10")),
  seconds = Number(option("--seconds", "60")),
  scenario = option("--scenario", "normal");
if (
  !Number.isInteger(groups) ||
  !Number.isFinite(seconds) ||
  groups < 1 ||
  groups > 10 ||
  seconds < 5 ||
  seconds > 3600 ||
  ![
    "normal",
    "noise",
    "spike",
    "sensor-failure",
    "offline",
    "threshold",
    "recovery",
  ].includes(scenario)
)
  throw new Error(
    "Usa --groups1..10, --seconds5..3600 y escenario documentado.",
  );
const definitions = [
  ["soil", "%", 55],
  ["soil_temperature", "°C", 20],
  ["air_temperature", "°C", 23],
  ["air_humidity", "%", 60],
  ["light", "%", 65],
  ["water_level", "%", 40],
  ["rain", "0/1", 0],
  ["distance", "cm", 35],
  ["motion", "0/1", 0],
];
async function request(path, body, headers = {}, method = "POST") {
  const r = await fetch(origin + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(`${path}: ${r.status} ${data.message || data.error}`);
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
const stations = [];
for (let i = 1; i <= groups; i++) {
  const session = await request("/session", {
    name: `QA virtual ${String(i).padStart(2, "0")} · ${scenario}`,
    groupNumber: i,
  });
  const headers = { Cookie: session.cookie };
  const pair = await request("/pair", {}, headers);
  const device = await request("/device/pair", { code: pair.data.code });
  await request(
    "/rules",
    { sensor: "soil", min: 25, max: 80, hysteresis: 3, cooldown: 30 },
    headers,
  );
  stations.push({
    token: device.data.token,
    deviceId: device.data.deviceId,
    headers,
    number: i,
  });
}
console.log(
  `${groups} estaciones virtuales creadas; datos etiquetados SIMULACIÓN. Escenario ${scenario}.`,
);
const start = Date.now();
let round = 0;
while (Date.now() - start < seconds * 1000) {
  await Promise.all(
    stations.map(async (station) => {
      if (scenario === "offline" && round >= 3 && station.number % 2 === 0)
        return;
      const readings = definitions.map(([sensor, unit, base]) => {
        let value = base,
          status = "READING";
        if (sensor === "soil") {
          if (scenario === "noise")
            value = base + Math.sin(round + station.number) * 8;
          if (scenario === "spike" && round === 2) value = 99;
          if (scenario === "threshold" && round >= 2) value = 15;
          if (scenario === "recovery")
            value = round >= 2 && round < 5 ? 15 : 55;
          if (scenario === "sensor-failure" && round >= 2) {
            value = null;
            status = "NO_RESPONSE";
          }
        }
        return { sensor, unit, value, status, confidence: "virtual QA device" };
      });
      await request(
        "/device/ingest",
        {
          readings,
          source: "simulation",
          diagnostics: { virtual: true, scenario, round },
        },
        { Authorization: `Bearer ${station.token}` },
      );
    }),
  );
  console.log(`Ronda ${++round}: telemetría virtual recibida.`);
  await new Promise((r) => setTimeout(r, 5000));
}
await Promise.all(
  stations.map(async (station) => {
    const { data } = await request(
      "/dashboard",
      undefined,
      station.headers,
      "GET",
    );
    if (
      data.latest.length !== definitions.length ||
      data.latest.some(
        (reading) =>
          reading.source !== "simulation" ||
          reading.deviceId !== station.deviceId,
      )
    )
      throw new Error(
        `La estación ${station.number} perdió datos o mezcló otra identidad.`,
      );
    if (scenario === "recovery" && round >= 6) {
      if (
        data.latest.find((reading) => reading.sensor === "soil")?.value !==
          55 ||
        !data.alerts.some((alert) => alert.type === "BELOW_MIN") ||
        !data.alerts.some((alert) => alert.type === "RECOVERY")
      )
        throw new Error(
          `La estación ${station.number} no registró umbral y recuperación.`,
        );
    }
  }),
);
console.log(
  "Aislamiento, nueve variables y eventos del escenario verificados por la API.",
);
if (args.includes("--cleanup")) {
  await Promise.all(
    stations.map((s) => request("/session", undefined, s.headers, "DELETE")),
  );
  console.log(
    "Sesiones virtuales eliminadas; sesiones de otros equipos preservadas.",
  );
} else
  console.log(
    "Datos disponibles en el panel docente. Las estaciones quedan sin nuevas lecturas.",
  );
