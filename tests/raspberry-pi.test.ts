import { describe, expect, it } from "vitest";
import {
  PI_SENSORS,
  piBridgeCommand,
  piCheckCommand,
} from "../web/lib/raspberry-pi";

describe("Raspberry Pi tools stay separate from Arduino flashing", () => {
  it("keeps analog readings behind an explicit external ADC", () => {
    for (const sensor of ["soil", "light", "water_level"] as const) {
      expect(PI_SENSORS[sensor].adc).toBe(true);
      expect(piCheckCommand(sensor)).toContain("--adc mcp3008");
    }
    expect(piCheckCommand("motion")).not.toContain("--adc");
  });
  it("uses the DHT virtual environment and native GPIO's named sensor", () => {
    expect(piCheckCommand("dht11")).toBe(
      ".venv/bin/python check_sensors.py --sensor dht11",
    );
    expect(piCheckCommand("ds18b20")).toBe(
      "python3 check_sensors.py --sensor ds18b20",
    );
  });
  it("distinguishes BCM numbers from physical header contacts", () => {
    expect(PI_SENSORS.dht11.connections).toContain(
      "DATA / S → BCM22 · pin físico 15",
    );
    expect(PI_SENSORS.ds18b20.connections).toContain(
      "DATA → BCM4 · pin físico 7",
    );
    expect(PI_SENSORS.distance.connections).toContain(
      "ECHO → divisor resistivo → BCM24 · pin físico 18",
    );
    expect(PI_SENSORS.distance.note).toContain("unos 3 V");
  });
  it("assembles a one-use pairing command without shell interpolation", () => {
    expect(
      piBridgeCommand(
        "https://telematica-iot-usm.vercel.app",
        "abcdef012345",
        "/dev/serial/by-id/usb-Arduino_Uno-if00",
      ),
    ).toBe(
      "python3 raspberry-pi-bridge.py --server 'https://telematica-iot-usm.vercel.app' --pair 'ABCDEF012345' --port '/dev/serial/by-id/usb-Arduino_Uno-if00'",
    );
  });
  it.each([
    ["http://server", "abcdef012345", "/dev/ttyACM0"],
    ["https://user:pw@server", "abcdef012345", "/dev/ttyACM0"],
    ["https://server/api", "abcdef012345", "/dev/ttyACM0"],
    ["https://server?token=secret", "abcdef012345", "/dev/ttyACM0"],
    ["https://server", "$(whoami)", "/dev/ttyACM0"],
    ["https://server", "abcdef012345", "/dev/ttyACM0;cat x"],
    ["https://server", "abcdef012345", "/dev/ttyACM0\n"],
    ["https://server", "abcdef012345", "COM2"],
  ])(
    "rejects an unusable or injectable bridge command",
    (origin, code, port) => {
      expect(() => piBridgeCommand(origin, code, port)).toThrow();
    },
  );
});
