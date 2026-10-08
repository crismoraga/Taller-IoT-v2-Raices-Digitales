import { describe, expect, it } from "vitest";
import {
  ArduinoUSBSerial,
  MicroPythonSerial,
  parseIntelHex,
  type ArduinoBoard,
  type USBPort,
} from "../web/lib/serial";
import { arduinoStationSketch } from "../web/lib/arduino";

const enc = new TextEncoder();
class TestSerial extends MicroPythonSerial {
  attach(port: USBPort) {
    return this.open(115200, port);
  }
}
/** Protocol peer fixture based on the documented raw-paste byte transcript. */
function pico(
  options: {
    fallback?: boolean;
    error?: string;
    output?: string;
    running?: boolean;
    fileWriteError?: boolean;
  } = {},
) {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let mode = "normal",
    code: number[] = [],
    available = 32,
    closed = false;
  const programs: string[] = [],
    saved: number[] = [],
    writes: number[][] = [];
  let fileFailed = false;
  const emit = (bytes: number[] | string) =>
    controller.enqueue(
      typeof bytes === "string" ? enc.encode(bytes) : Uint8Array.from(bytes),
    );
  const port: USBPort = {
    readable: new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(data) {
        const bytes = [...data];
        writes.push(bytes);
        if (bytes.length === 3 && bytes[0] === 13 && bytes[1] === 3) {
          mode = "normal";
          code = [];
          return;
        }
        if (bytes.length === 1 && bytes[0] === 1) {
          mode = "raw";
          emit("raw REPL; CTRL-B to exit\r\n>");
          return;
        }
        if (bytes.join(",") === "5,65,1") {
          mode = "input";
          available = 32;
          emit(options.fallback ? [82, 0] : [82, 1, 16, 0, 1]);
          return;
        }
        if (mode === "input" && bytes.length === 1 && bytes[0] === 4) {
          const source = new TextDecoder().decode(Uint8Array.from(code));
          programs.push(source);
          code = [];
          if (source.includes("_rdfile.write")) {
            for (const token of source.matchAll(/\\x([0-9a-f]{2})/g))
              saved.push(parseInt(token[1], 16));
          }
          mode = "running";
          emit(options.fallback ? "OK" : [4]);
          emit(options.output ?? "¡Hola, planta!\r\n");
          const error =
            options.fileWriteError &&
            source.includes("_rdfile.write") &&
            !fileFailed
              ? "OSError: disk full"
              : options.error;
          if (error && options.fileWriteError) fileFailed = true;
          if (!options.running) {
            emit([4]);
            if (error) emit(error);
            emit([4, 62]);
            mode = "raw";
          }
          return;
        }
        if (mode === "input") {
          code.push(...bytes);
          if (!options.fallback) {
            available -= bytes.length;
            while (available < 16) {
              emit([1]);
              available += 16;
            }
          }
        }
      },
    }),
    async open() {},
    async close() {
      closed = true;
    },
    async setSignals() {},
  };
  return {
    port,
    programs,
    saved,
    writes,
    emit,
    get closed() {
      return closed;
    },
  };
}

describe("MicroPython USB protocol", () => {
  it("flow-controls long UTF8 programs and collects stdout separately from stderr", async () => {
    const peer = pico(),
      transport = new TestSerial();
    await transport.attach(peer.port);
    const source = `print('raíces 🌱')\n${"# comment\n".repeat(500)}`;
    expect(await transport.exec(source)).toBe("¡Hola, planta!\r\n");
    expect(peer.programs[0]).toBe(source);
    await transport.disconnect();
    expect(peer.closed).toBe(true);
  });
  it("supports legacy raw REPL without raw-paste", async () => {
    const peer = pico({ fallback: true }),
      transport = new TestSerial();
    await transport.attach(peer.port);
    expect(await transport.exec("print(123)")).toContain("Hola");
    await transport.disconnect();
  });
  it("surfaces real board exceptions", async () => {
    const peer = pico({
        error:
          "Traceback (most recent call last):\r\nValueError: bad value\r\n",
      }),
      transport = new TestSerial();
    await transport.attach(peer.port);
    await expect(transport.exec("raise ValueError()")).rejects.toThrow(
      "ValueError: bad value",
    );
    await transport.disconnect();
  });
  it("runs indefinite programs without awaiting completion and stops them", async () => {
    const peer = pico({ running: true, output: "sensor=42\r\n" }),
      transport = new TestSerial();
    let output = "";
    transport.onOutput = (value) => {
      output += value;
    };
    await transport.attach(peer.port);
    await transport.run("while True:\n print(42)");
    expect(output).toContain("sensor=42");
    peer.emit("temperatura=23\r\n");
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(output).toContain("temperatura=23");
    await transport.stop();
    expect(peer.writes.some((bytes) => bytes.includes(3))).toBe(true);
    await transport.disconnect();
  });
  it("saves files as UTF8 bytes in bounded chunks and rejects unsafe paths", async () => {
    const peer = pico(),
      transport = new TestSerial();
    await transport.attach(peer.port);
    const content = 'áéñ 🌱 "\\\n'.repeat(150);
    await transport.saveFile("lib/test.py", content);
    expect(new TextDecoder().decode(Uint8Array.from(peer.saved))).toBe(content);
    expect(
      peer.programs.filter((source) => source.includes("_rdfile.write")).length,
    ).toBeGreaterThan(1);
    await expect(transport.saveFile("../boot.py", "x")).rejects.toThrow("Ruta");
    await transport.disconnect();
  });
  it("cancels an outstanding read and releases locks when unplugged", async () => {
    const peer = pico({ running: true }),
      transport = new TestSerial();
    await transport.attach(peer.port);
    const pending = transport.exec("while True: pass");
    await new Promise((resolve) => setTimeout(resolve, 130));
    await transport.disconnect();
    await expect(pending).rejects.toThrow(/cerrado/);
    expect(peer.port.readable!.locked).toBe(false);
    expect(peer.port.writable!.locked).toBe(false);
  });
  it("can reconnect after cancellation without stale protocol bytes", async () => {
    const transport = new TestSerial(),
      first = pico();
    await transport.attach(first.port);
    await transport.exec("print(1)");
    await transport.disconnect();
    const second = pico({ output: "second board\r\n" });
    await transport.attach(second.port);
    expect(await transport.exec("print(2)")).toBe("second board\r\n");
    await transport.disconnect();
  });
  it("cleans temporary files on write failure and never replaces the existing main", async () => {
    const transport = new TestSerial(),
      peer = pico({ fileWriteError: true });
    await transport.attach(peer.port);
    await expect(transport.saveFile("main.py", "print(42)")).rejects.toThrow(
      "disk full",
    );
    expect(
      peer.programs.some((source) =>
        source.includes('os.remove("main.py.rdtmp")'),
      ),
    ).toBe(true);
    expect(peer.programs.some((source) => source.includes("os.rename"))).toBe(
      false,
    );
    await transport.disconnect();
  });
});

class TestArduino extends ArduinoUSBSerial {
  attach(port: USBPort, board: ArduinoBoard = "uno") {
    this.board = board;
    return this.open(115200, port);
  }
}
function avr(corrupt = false) {
  let controller: ReadableStreamDefaultController<Uint8Array>,
    address = 0;
  const memory = new Uint8Array(32768).fill(255),
    commands: number[] = [],
    rates: number[] = [];
  const port: USBPort = {
    readable: null,
    writable: null,
    async open({ baudRate }) {
      rates.push(baudRate);
      port.readable = new ReadableStream<Uint8Array>({
        start(value) {
          controller = value;
        },
      });
      port.writable = new WritableStream<Uint8Array>({
        write(packet) {
          const command = packet[0];
          commands.push(command);
          if (packet[packet.length - 1] !== 32)
            throw new Error("Missing CRC_EOP");
          let data: number[] = [];
          if (command === 0x75) data = [0x1e, 0x95, 0x0f];
          else if (command === 0x55)
            address = ((packet[2] << 8) | packet[1]) * 2;
          else if (command === 0x64)
            memory.set(
              packet.slice(4, 4 + ((packet[1] << 8) | packet[2])),
              address,
            );
          else if (command === 0x74) {
            data = [
              ...memory.slice(
                address,
                address + ((packet[1] << 8) | packet[2]),
              ),
            ];
            if (corrupt) data[0] ^= 1;
          }
          controller.enqueue(Uint8Array.from([0x14, ...data, 0x10]));
        },
      });
    },
    async close() {},
    async setSignals() {},
  };
  return { port, memory, commands, rates };
}
describe("real AVR protocol peer", () => {
  it("programs flash, reads every page back, and leaves programming mode", async () => {
    const peer = avr(),
      transport = new TestArduino();
    await transport.attach(peer.port);
    await transport.upload(":0400100001020304E2\n:00000001FF");
    expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
    expect(peer.commands).toContain(0x74);
    expect(peer.commands.at(-1)).toBe(0x51);
    await transport.disconnect();
  });
  it("rejects a board that fails flash readback verification", async () => {
    const peer = avr(true),
      transport = new TestArduino();
    await transport.attach(peer.port);
    await expect(
      transport.upload(":0400100001020304E2\n:00000001FF"),
    ).rejects.toThrow("Verificación flash");
    await transport.disconnect();
  });
  it("switches old Nano to bootloader speed and restores USB terminal without disconnect notification", async () => {
    const peer = avr(),
      transport = new TestArduino();
    let disconnects = 0;
    transport.onDisconnect = () => {
      disconnects++;
    };
    await transport.attach(peer.port, "nano-old");
    await transport.upload(":0400100001020304E2\n:00000001FF");
    expect(peer.rates).toEqual([115200, 57600, 115200]);
    expect(transport.connected).toBe(true);
    expect(disconnects).toBe(0);
    await transport.disconnect();
    expect(disconnects).toBe(1);
  });
  it("generates disabled defaults, enables independent DHT values and rejects Pico-scale calibration", () => {
    const code = arduinoStationSketch(
      { soil: { dry: 45000, wet: 12000 }, water_level: { dry: 100, wet: 800 } },
      { soil: true, air_temperature: true },
    );
    expect(code).toContain("const int SOIL_DRY = -1;");
    expect(code).toContain("const int WATER_DRY = 100;");
    expect(code).toContain("const bool ENABLE_DHT = true;");
    expect(code).toContain("const bool ENABLE_AIR_HUMIDITY = false;");
    expect(code).toContain("const bool ENABLE_DISTANCE = false;");
  });
});

describe("Intel HEX validation", () => {
  it("decodes authentic Intel HEX records and fills address gaps with erased flash", () => {
    const image = parseIntelHex(":0400100001020304E2\n:00000001FF");
    expect([...image.slice(16)]).toEqual([1, 2, 3, 4]);
    expect(image[0]).toBe(255);
  });
  it("rejects corruption, missing EOF, overlapping records and bootloader addresses", () => {
    expect(() => parseIntelHex(":0400100001020304E3\n:00000001FF")).toThrow(
      "Checksum",
    );
    expect(() => parseIntelHex(":0400100001020304E2")).toThrow("fin");
    expect(() =>
      parseIntelHex(":0400100001020304E2\n:0400100001020304E2\n:00000001FF"),
    ).toThrow("solapamientos");
    expect(() => parseIntelHex(":047E00000102030474\n:00000001FF")).toThrow();
  });
});
