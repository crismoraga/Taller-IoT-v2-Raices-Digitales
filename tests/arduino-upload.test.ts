import { describe, expect, it } from "vitest";
import {
  ArduinoUSBSerial,
  identifyUSBBoard,
  type ArduinoBoard,
  type ArduinoUploadProgress,
  type USBPort,
} from "../web/lib/serial";

const HEX = ":0400100001020304E2\n:00000001FF";

describe("USB models with a different Arduino upload protocol", () => {
  it.each([
    [0x0042, "Arduino Mega"],
    [0x0242, "Arduino Mega"],
    [0x0069, "Arduino Uno R4"],
    [0x0369, "Arduino Uno R4"],
    [0x006d, "Arduino Uno R4"],
    [0x1002, "Arduino Uno R4"],
    [0x0036, "Arduino Leonardo"],
    [0x8036, "Arduino Leonardo"],
    [0x8037, "Arduino Micro"],
  ])(
    "identifies PID %s as %s before opening an incompatible installer",
    (product, model) => {
      for (const vendor of [0x2341, 0x2a03]) {
        expect(
          identifyUSBBoard({
            getInfo: () => ({
              usbVendorId: vendor,
              usbProductId: product as number,
            }),
          }),
        ).toEqual({
          label: model,
          unsupported: model,
        });
      }
    },
  );

  it("recognizes additional official Uno identifiers without guessing a USB bridge", () => {
    for (const product of [0x0243, 0x006a]) {
      expect(
        identifyUSBBoard({
          getInfo: () => ({ usbVendorId: 0x2341, usbProductId: product }),
        }).board,
      ).toBe("uno");
    }
    expect(
      identifyUSBBoard({
        getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }),
      }).unsupported,
    ).toBeUndefined();
  });
});

/** A STK500v1 peer with reset gating, split replies, and serial bridge noise. */
function bootloader(
  options: {
    releaseRequired?: boolean;
    syncNoise?: boolean;
    bootRate?: number;
    signature?: number[];
    unplugOnWrite?: boolean;
    corruptReadback?: boolean;
  } = {},
) {
  let incoming: ReadableStreamDefaultController<Uint8Array>;
  let address = 0,
    resetAsserted = false,
    resetSeen = false,
    active = false;
  const memory = new Uint8Array(32768).fill(255);
  const packets: number[][] = [],
    rates: number[] = [];
  const signals: boolean[] = [];
  const emit = (bytes: number[]) => incoming.enqueue(Uint8Array.from(bytes));
  const port: USBPort = {
    readable: null,
    writable: null,
    async open({ baudRate }) {
      rates.push(baudRate);
      port.readable = new ReadableStream<Uint8Array>({
        start(controller) {
          incoming = controller;
        },
      });
      port.writable = new WritableStream<Uint8Array>({
        write(bytes) {
          const packet = [...bytes];
          packets.push(packet);
          if (!active || (options.bootRate && baudRate !== options.bootRate))
            return;
          if (packet.at(-1) !== 0x20) throw new Error("Missing STK CRC_EOP");
          const command = packet[0];
          if (command === 0x30 && options.syncNoise) {
            // Stale adapter input and a partial previous handshake precede SYNC.
            emit([0x62, 0x6f, 0x6f, 0x74, 0x0a, 0x15, 0x14]);
          }
          let reply: number[] = [];
          if (command === 0x75) reply = options.signature ?? [0x1e, 0x95, 0x0f];
          else if (command === 0x55)
            address = ((packet[2] << 8) | packet[1]) * 2;
          else if (command === 0x64) {
            if (options.unplugOnWrite) {
              incoming.close();
              return;
            }
            memory.set(
              bytes.slice(4, 4 + ((packet[1] << 8) | packet[2])),
              address,
            );
          } else if (command === 0x74) {
            reply = [
              ...memory.slice(
                address,
                address + ((packet[1] << 8) | packet[2]),
              ),
            ];
            if (options.corruptReadback) reply[0] ^= 1;
          }
          // INSYNC, data, and OK may arrive as separate Web Serial reads.
          emit([0x14]);
          if (reply.length) emit(reply);
          emit([0x10]);
        },
      });
    },
    async close() {},
    async setSignals({ dataTerminalReady }) {
      if (dataTerminalReady === undefined) return;
      signals.push(dataTerminalReady);
      resetAsserted = dataTerminalReady;
      if (resetAsserted) {
        resetSeen = true;
        active = !options.releaseRequired;
      } else if (resetSeen) active = true;
    },
  };
  return { port, packets, rates, signals, memory };
}

describe("Arduino upload with a real bootloader lifecycle", () => {
  it("releases the reset line before synchronization instead of holding the AVR in reset", async () => {
    const peer = bootloader({ releaseRequired: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.signals.slice(0, 3)).toEqual([false, true, false]);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.packets.at(-1)?.[0]).toBe(0x51);
    } finally {
      await transport.disconnect();
    }
  });

  it("synchronizes through stale USB bytes and fragmented acknowledgements", async () => {
    const peer = bootloader({ syncNoise: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.packets.filter((packet) => packet[0] === 0x30)).toHaveLength(
        1,
      );
    } finally {
      await transport.disconnect();
    }
  });

  it("refuses a different MCU signature before writing flash", async () => {
    const peer = bootloader({ signature: [0x1e, 0x98, 0x01] });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow("ATmega328P");
      expect(peer.packets.some((packet) => packet[0] === 0x64)).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });

  it("ends a pending upload on USB removal without claiming success", async () => {
    const peer = bootloader({ unplugOnWrite: true });
    const transport = new ArduinoUSBSerial();
    const output: string[] = [];
    transport.onOutput = (line) => output.push(line);
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        /conexión|cerrado|USB/i,
      );
      expect(output.join("")).not.toContain("grabado y verificado");
      expect(peer.packets.some((packet) => packet[0] === 0x51)).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });

  it("reports each flash page and only reports completion after all readbacks and LEAVE_PROGMODE", async () => {
    const image = Uint8Array.from(
      { length: 385 },
      (_, index) => (index * 17) & 255,
    );
    const records: string[] = [];
    for (let offset = 0; offset < image.length; offset += 16) {
      const payload = [...image.slice(offset, offset + 16)];
      const record = [payload.length, offset >> 8, offset & 255, 0, ...payload];
      record.push(-record.reduce((sum, byte) => sum + byte, 0) & 255);
      records.push(
        `:${record.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`,
      );
    }
    records.push(":00000001FF");
    const peer = bootloader();
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => {
      progress.push(event);
      if (event.stage === "complete") {
        expect(peer.packets.at(-1)?.[0]).toBe(0x51);
        expect(
          peer.packets.filter((packet) => packet[0] === 0x74),
        ).toHaveLength(4);
      }
    };
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(records.join("\n"));
      expect(peer.memory.slice(0, image.length)).toEqual(image);
      expect(
        [...peer.memory.slice(image.length, 512)].every((byte) => byte === 255),
      ).toBe(true);
      expect(progress[0]).toEqual({ stage: "sync", percent: 0 });
      expect(progress.filter((event) => event.stage === "write")).toHaveLength(
        4,
      );
      expect(progress.filter((event) => event.stage === "verify")).toHaveLength(
        4,
      );
      expect(progress.at(-1)).toEqual({ stage: "complete", percent: 100 });
    } finally {
      await transport.disconnect();
    }
  });

  it("identifies an old Nano only after MCU verification and before any flash write", async () => {
    const peer = bootloader({ bootRate: 57600, releaseRequired: true });
    const transport = new ArduinoUSBSerial();
    const detected: ArduinoBoard[] = [];
    transport.onBootloaderDetected = (board) => {
      detected.push(board);
      expect(peer.packets.at(-1)?.[0]).toBe(0x75);
      expect(peer.packets.some((packet) => packet[0] === 0x64)).toBe(false);
    };
    await transport.connect("nano", peer.port);
    try {
      await transport.upload(HEX);
      expect(detected).toEqual(["nano-old"]);
      expect(peer.rates).toEqual([115200, 57600, 115200]);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
    } finally {
      await transport.disconnect();
    }
  });

  it("never retries another bootloader speed after flash has been written", async () => {
    const peer = bootloader({ corruptReadback: true });
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    await transport.connect("nano", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow("Verificación flash");
      expect(peer.rates).toEqual([115200]);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
      expect(peer.packets.some((packet) => packet[0] === 0x51)).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });
});
