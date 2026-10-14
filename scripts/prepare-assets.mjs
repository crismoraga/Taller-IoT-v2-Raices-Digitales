import { cp, mkdir } from "node:fs/promises";
await mkdir("public/docs", { recursive: true });
await cp("docs", "public/docs", {
  recursive: true,
  filter: (path) => !path.endsWith("IMPLEMENTATION_CONTRACT.md"),
});
await mkdir("public/downloads", { recursive: true });
await cp(
  "firmware/raspberry-pi/bridge.py",
  "public/downloads/raspberry-pi-bridge.py",
);
await cp(
  "firmware/raspberry-pi/check_sensors.py",
  "public/downloads/check_sensors.py",
);
