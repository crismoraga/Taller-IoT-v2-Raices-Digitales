import { describe, expect, it } from "vitest";
import {
  ArduinoUSBSerial,
  identifyUSBBoard,
  type ArduinoBoard,
  type ArduinoUploadProgress,
  type USBPort,
} from "../web/lib/serial";

const HEX = ":0400100001020304E2\n:00000001FF";
function imageHex(image: Uint8Array) {
  const records: string[] = [];
  for (let offset = 0; offset < image.length; offset += 16) {
    const payload = [...image.slice(offset, offset + 16)];
    const record = [payload.length, offset >> 8, offset & 255, 0, ...payload];
    record.push(-record.reduce((sum, byte) => sum + byte, 0) & 255);
    records.push(
      `:${record.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`,
    );
  }
  return [...records, ":00000001FF"].join("\n");
}

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
    [0x0058, "Arduino Nano Every"],
    [0x0057, "Arduino Nano 33 IoT"],
    [0x8057, "Arduino Nano 33 IoT"],
    [0x0074, "Arduino Nano R4"],
    [0x0374, "Arduino Nano R4"],
    [0x004d, "Arduino Zero"],
    [0x804d, "Arduino Zero"],
    [0x824d, "Arduino Zero"],
    [0x024d, "Arduino Zero"],
    [0x004e, "Arduino MKR1000"],
    [0x804e, "Arduino MKR1000"],
    [0x824e, "Arduino MKR1000"],
    [0x024e, "Arduino MKR1000"],
    [0x8054, "Arduino MKR WiFi 1010"],
    [0x0054, "Arduino MKR WiFi 1010"],
    [0x8050, "Arduino MKR FOX 1200"],
    [0x0050, "Arduino MKR FOX 1200"],
    [0x8059, "Arduino MKR WAN"],
    [0x0059, "Arduino MKR WAN"],
    [0x8053, "Arduino MKR WAN"],
    [0x0053, "Arduino MKR WAN"],
    [0x8052, "Arduino MKR GSM 1400"],
    [0x0052, "Arduino MKR GSM 1400"],
    [0x8055, "Arduino MKR NB 1500"],
    [0x0055, "Arduino MKR NB 1500"],
    [0x8056, "Arduino MKR Vidor 4000"],
    [0x0056, "Arduino MKR Vidor 4000"],
    [0x804f, "Arduino MKR Zero"],
    [0x004f, "Arduino MKR Zero"],
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

/**
 * A STK500v1 peer with reset gating, split replies, and serial bridge noise.
 * It keeps the Optiboot timing measured on a genuine Uno: the UART is deaf for
 * about 75 ms after the reset edge, then holds at most three unread bytes while
 * the LED flashes, and the first reply leaves 447 ms after the edge. Every reset
 * restarts that clock; one silent second or a frame without CRC_EOP starts the
 * sketch, which answers nothing.
 */
function bootloader(
  options: {
    releaseRequired?: boolean;
    syncNoise?: boolean;
    bootRate?: number;
    signature?: number[];
    unplugOnWrite?: boolean;
    corruptReadback?: boolean;
    missFirstReset?: boolean;
    duplicateSyncReply?: boolean;
    failTerminalRestore?: boolean;
    signatureNoise?: boolean;
    rejectWrite?: boolean;
    missFirstEnter?: boolean;
    deafFor?: number;
    loseFirstWriteReply?: boolean;
    stallWrite?: boolean;
    truncateReadback?: boolean;
  } = {},
) {
  let incoming: ReadableStreamDefaultController<Uint8Array>;
  let address = 0,
    resetAsserted = false,
    resets = 0,
    boots = 0;
  let enterRequests = 0;
  let writeRequests = 0;
  let releaseWrite!: () => void;
  const blockedWrite = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  let phase: "sketch" | "reset" | "deaf" | "flashing" | "listening" = "sketch";
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let held: number[] = [],
    pending: number[] = [];
  const memory = new Uint8Array(32768).fill(255);
  const packets: number[][] = [],
    rates: number[] = [];
  const signals: boolean[] = [];
  const emit = (bytes: number[]) => {
    try {
      incoming.enqueue(Uint8Array.from(bytes));
    } catch {
      /* The stream was closed by an unplug. */
    }
  };
  const feed = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => (phase = "sketch"), 1000);
  };
  const execute = (packet: number[]) => {
    const command = packet[0];
    if (command === 0x50 && options.missFirstEnter && ++enterRequests === 1)
      return;
    if (command === 0x75 && options.signatureNoise)
      emit([0x72, 0x65, 0x61, 0x64, 0x79, 0x0d, 0x0a, 0x14, 0x10]);
    if (command === 0x30 && options.syncNoise) {
      // Stale adapter input and a partial previous handshake precede SYNC.
      emit([0x62, 0x6f, 0x6f, 0x74, 0x0a, 0x15, 0x14]);
    }
    let reply: number[] = [];
    if (command === 0x75) reply = options.signature ?? [0x1e, 0x95, 0x0f];
    else if (command === 0x55) address = ((packet[2] << 8) | packet[1]) * 2;
    else if (command === 0x64) {
      if (options.rejectWrite) {
        emit([0x14, 0x11]);
        return;
      }
      if (options.unplugOnWrite) {
        incoming.close();
        return;
      }
      memory.set(packet.slice(4, 4 + ((packet[1] << 8) | packet[2])), address);
      if (options.loseFirstWriteReply && ++writeRequests === 1) return;
    } else if (command === 0x74) {
      reply = [
        ...memory.slice(address, address + ((packet[1] << 8) | packet[2])),
      ];
      if (options.corruptReadback) reply[0] ^= 1;
      if (options.truncateReadback) {
        // A USB bridge delivered only part of the binary frame before stalling.
        emit([0x14, ...reply.slice(0, 37)]);
        return;
      }
    }
    // INSYNC, data, and OK may arrive as separate Web Serial reads.
    emit([0x14]);
    if (reply.length) emit(reply);
    emit([0x10]);
    if (command === 0x30 && options.duplicateSyncReply) emit([0x14, 0x10]);
    if (command === 0x51) {
      clearTimeout(watchdog);
      phase = "sketch";
    }
  };
  const receive = (bytes: number[]) => {
    pending.push(...bytes);
    while (phase === "listening" && pending.length) {
      const command = pending[0];
      let length = 2;
      if (command === 0x55) length = 4;
      else if (command === 0x74) length = 5;
      else if (command === 0x64)
        length =
          pending.length < 3 ? Infinity : 5 + ((pending[1] << 8) | pending[2]);
      if (pending.length < length) return;
      const packet = pending.splice(0, length);
      if (packet.at(-1) !== 0x20) {
        // Optiboot gives up on a frame without CRC_EOP and starts the sketch.
        clearTimeout(watchdog);
        phase = "sketch";
        return;
      }
      feed();
      execute(packet);
    }
  };
  const boot = () => {
    const epoch = boots;
    phase = "deaf";
    setTimeout(() => {
      if (epoch === boots) phase = "flashing";
    }, options.deafFor ?? 75);
    setTimeout(() => {
      if (epoch !== boots) return;
      phase = "listening";
      feed();
      receive(held.splice(0));
    }, 447);
  };
  const port: USBPort = {
    readable: null,
    writable: null,
    async open({ baudRate }) {
      rates.push(baudRate);
      if (
        options.failTerminalRestore &&
        baudRate === 115200 &&
        rates.length > 1
      )
        throw new Error("USB: no se pudo restaurar el puerto del programa");
      port.readable = new ReadableStream<Uint8Array>({
        start(controller) {
          incoming = controller;
        },
      });
      port.writable = new WritableStream<Uint8Array>({
        write(bytes) {
          const packet = [...bytes];
          packets.push(packet);
          if (options.stallWrite && packet[0] === 0x64) return blockedWrite;
          if (options.bootRate && baudRate !== options.bootRate) return;
          if (phase === "flashing")
            held.push(...packet.slice(0, 3 - held.length));
          else if (phase === "listening") receive(packet);
        },
      });
    },
    async close() {},
    async setSignals({ dataTerminalReady }) {
      if (dataTerminalReady === undefined) return;
      signals.push(dataTerminalReady);
      if (dataTerminalReady === resetAsserted) return;
      resetAsserted = dataTerminalReady;
      if (resetAsserted) {
        resets++;
        boots++;
        clearTimeout(watchdog);
        held = [];
        pending = [];
        phase = options.releaseRequired ? "reset" : "sketch";
      }
      if (options.missFirstReset && resets < 2) return;
      // A capacitor-coupled reset starts the bootloader on the DTR edge; a
      // direct reset line keeps the AVR stopped until it is released.
      if (resets && resetAsserted !== Boolean(options.releaseRequired)) boot();
    },
  };
  return { port, packets, rates, signals, memory, releaseWrite };
}

describe("Arduino upload with a real bootloader lifecycle", () => {
  it("times out a stalled Windows-style write with its stage and permits a clean new connection", async () => {
    const peer = bootloader({ stallWrite: true });
    const next = bootloader();
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        /grabación de la página.*6 segundos.*STK500v1.*uno.*115200/,
      );
      expect(transport.connected).toBe(false);
      expect(peer.port.readable!.locked).toBe(false);
      expect(peer.port.writable!.locked).toBe(false);
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect(peer.packets.some((packet) => packet[0] === 0x51)).toBe(false);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
      await transport.connect("uno", next.port);
      peer.releaseWrite();
      await transport.upload(HEX);
      expect([...next.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(next.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect(progress.at(-1)).toEqual({ stage: "complete", percent: 100 });
    } finally {
      peer.releaseWrite();
      await transport.disconnect();
    }
  });

  it("never replays a page after a missing ACK and accepts only an explicit fresh retry", async () => {
    const peer = bootloader({ loseFirstWriteReply: true });
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        /grabación de la página.*no respondió a tiempo.*STK500v1/,
      );
      // The board did write the page, but its acknowledgement never reached PC.
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect(peer.packets.some((packet) => packet[0] === 0x74)).toBe(false);
      expect(peer.rates).toEqual([115200]);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
      await transport.upload(HEX);
      expect(peer.signals.filter(Boolean)).toHaveLength(2);
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        2,
      );
      expect(peer.packets.filter((packet) => packet[0] === 0x74)).toHaveLength(
        1,
      );
      expect(progress.at(-1)).toEqual({ stage: "complete", percent: 100 });
    } finally {
      await transport.disconnect();
    }
  });

  it("ends a truncated binary readback on its original deadline without reporting success", async () => {
    const peer = bootloader({ truncateReadback: true });
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        /verificación de la página.*no respondió a tiempo.*STK500v1/,
      );
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect(peer.packets.filter((packet) => packet[0] === 0x74)).toHaveLength(
        1,
      );
      expect(peer.packets.some((packet) => packet[0] === 0x51)).toBe(false);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });

  it("programs and verifies a Nano ATmega168 at 19200 without changing its MCU selection", async () => {
    const peer = bootloader({
      bootRate: 19200,
      signature: [0x1e, 0x94, 0x06],
      releaseRequired: true,
    });
    const transport = new ArduinoUSBSerial();
    const detected: ArduinoBoard[] = [];
    const progress: ArduinoUploadProgress[] = [];
    transport.onBootloaderDetected = (board) => detected.push(board);
    transport.onUploadProgress = (event) => progress.push(event);
    const image = Uint8Array.from(
      { length: 300 },
      (_, index) => (index * 31) & 255,
    );
    await transport.connect("nano-168", peer.port);
    try {
      await transport.upload(imageHex(image));
      expect(peer.rates).toEqual([115200, 19200, 115200]);
      expect(peer.memory.slice(0, image.length)).toEqual(image);
      expect(peer.packets.filter((packet) => packet[0] === 0x74)).toHaveLength(
        3,
      );
      expect(progress.at(-1)).toEqual({ stage: "complete", percent: 100 });
      expect(detected).toEqual([]);
    } finally {
      await transport.disconnect();
    }
  });

  it.each([
    ["nano-168", [0x1e, 0x95, 0x0f], "ATmega168"],
    ["uno", [0x1e, 0x94, 0x06], "ATmega328P"],
  ] as const)(
    "refuses a different MCU for %s without converting the selected board",
    async (board, signature, expected) => {
      const peer = bootloader({ signature: [...signature] });
      const transport = new ArduinoUSBSerial();
      const detected: ArduinoBoard[] = [];
      transport.onBootloaderDetected = (model) => detected.push(model);
      await transport.connect(board, peer.port);
      try {
        await expect(transport.upload(HEX)).rejects.toThrow(expected);
        expect(peer.packets.some((packet) => packet[0] === 0x64)).toBe(false);
        expect(detected).toEqual([]);
      } finally {
        await transport.disconnect();
      }
    },
  );

  it("protects the ATmega168 bootloader before any handshake for an oversized image", async () => {
    const peer = bootloader({ bootRate: 19200, signature: [0x1e, 0x94, 0x06] });
    const transport = new ArduinoUSBSerial();
    await transport.connect("nano-168", peer.port);
    try {
      await expect(
        transport.upload(imageHex(new Uint8Array(14337))),
      ).rejects.toThrow("memoria");
      expect(peer.packets).toEqual([]);
      expect(peer.rates).toEqual([115200]);
    } finally {
      await transport.disconnect();
    }
  });

  it("recovers a failed preparation handshake before writing any flash page", async () => {
    const peer = bootloader({ missFirstEnter: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.packets.filter((packet) => packet[0] === 0x50)).toHaveLength(
        2,
      );
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
    } finally {
      await transport.disconnect();
    }
  });
  it("recognizes a classic Uno clone with a 57600 bootloader without calling it a Nano", async () => {
    const peer = bootloader({ bootRate: 57600 });
    const transport = new ArduinoUSBSerial();
    const detected: ArduinoBoard[] = [];
    transport.onBootloaderDetected = (board) => detected.push(board);
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.rates).toEqual([115200, 57600, 115200]);
      expect(detected).toEqual([]);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
    } finally {
      await transport.disconnect();
    }
  });
  it("does not confuse STK marker bytes in binary firmware with protocol framing", async () => {
    const peer = bootloader();
    const transport = new ArduinoUSBSerial();
    const image = Uint8Array.from(
      { length: 260 },
      (_, i) => [0x14, 0x10, 0x11, 0x15, 0x20][i % 5],
    );
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(imageHex(image));
      expect(peer.memory.slice(0, image.length)).toEqual(image);
    } finally {
      await transport.disconnect();
    }
  });
  it("reports an actual rejected write with its stage and never retries writing automatically", async () => {
    const peer = bootloader({ rejectWrite: true });
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    await transport.connect("uno", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        /grabación de la página.*0x11.*115200/,
      );
      expect(peer.packets.filter((packet) => packet[0] === 0x64)).toHaveLength(
        1,
      );
      expect(peer.rates).toEqual([115200]);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });
  it("protects the larger old Uno bootloader before writing an oversized firmware", async () => {
    const peer = bootloader({ bootRate: 57600 });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await expect(
        transport.upload(imageHex(new Uint8Array(30721))),
      ).rejects.toThrow("30720 bytes");
      expect(peer.packets.some((packet) => packet[0] === 0x64)).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });
  it("separates late SYNC acknowledgements and application bytes from the MCU signature", async () => {
    const peer = bootloader({ signatureNoise: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.packets.at(-1)?.[0]).toBe(0x51);
    } finally {
      await transport.disconnect();
    }
  });
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

  it("waits for the bootloader's start-up flashes with one reset and one sync frame", async () => {
    const peer = bootloader();
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.signals.filter(Boolean)).toHaveLength(1);
      // A second frame sent during the flashes would leave half a frame in the
      // AVR UART and make Optiboot start the sketch on the next command.
      expect(peer.packets.filter((packet) => packet[0] === 0x30)).toHaveLength(
        1,
      );
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.rates).toEqual([115200]);
    } finally {
      await transport.disconnect();
    }
  });

  it("repeats a lost sync frame inside the same bootloader window without another reset", async () => {
    const peer = bootloader({ deafFor: 300 });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.signals.filter(Boolean)).toHaveLength(1);
      expect(peer.packets.filter((packet) => packet[0] === 0x30)).toHaveLength(
        2,
      );
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
    } finally {
      await transport.disconnect();
    }
  });

  it("reopens a missed bootloader window instead of retrying against the sketch", async () => {
    const peer = bootloader({ releaseRequired: true, missFirstReset: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect(peer.signals.filter(Boolean)).toHaveLength(2);
      // Three frames spend the window the first reset never opened; the
      // fourth one is answered after the second reset.
      expect(peer.packets.filter((packet) => packet[0] === 0x30)).toHaveLength(
        4,
      );
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.rates).toEqual([115200]);
    } finally {
      await transport.disconnect();
    }
  });

  it("drains residual sync acknowledgements before reading the MCU signature", async () => {
    const peer = bootloader({ duplicateSyncReply: true });
    const transport = new ArduinoUSBSerial();
    await transport.connect("uno", peer.port);
    try {
      await transport.upload(HEX);
      expect([...peer.memory.slice(16, 20)]).toEqual([1, 2, 3, 4]);
      expect(peer.packets.filter((packet) => packet[0] === 0x75)).toHaveLength(
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
    transport.onUploadProgress = ({ stage }) => {
      if (stage === "complete") {
        expect(peer.rates.at(-1)).toBe(115200);
        expect(transport.connected).toBe(true);
      }
    };
    transport.onBootloaderDetected = (board) => {
      detected.push(board);
      expect(peer.packets.some((packet) => packet[0] === 0x75)).toBe(true);
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

  it("does not claim completion when the Nano terminal cannot be restored", async () => {
    const peer = bootloader({ bootRate: 57600, failTerminalRestore: true });
    const transport = new ArduinoUSBSerial();
    const progress: ArduinoUploadProgress[] = [];
    const output: string[] = [];
    transport.onUploadProgress = (event) => progress.push(event);
    transport.onOutput = (text) => output.push(text);
    await transport.connect("nano-old", peer.port);
    try {
      await expect(transport.upload(HEX)).rejects.toThrow(
        "restaurar el puerto",
      );
      expect(peer.packets.at(-1)?.[0]).toBe(0x51);
      expect(peer.rates).toEqual([115200, 57600, 115200]);
      expect(progress.some((event) => event.stage === "complete")).toBe(false);
      expect(output.join("")).not.toContain("grabado y verificado");
      expect(transport.connected).toBe(false);
    } finally {
      await transport.disconnect();
    }
  });
});
