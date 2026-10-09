/** Real USB transports. MicroPython raw-paste and AVR STK500v1, no emulation. */
export interface USBPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
  }): Promise<void>;
}
interface USBSerial extends EventTarget {
  requestPort(): Promise<USBPort>;
}
const encoder = new TextEncoder();
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const navigatorSerial = (): USBSerial | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { serial?: USBSerial }).serial;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export class SerialLink {
  onOutput: (text: string) => void = () => {};
  onDisconnect: () => void = () => {};
  protected port: USBPort | null = null;
  protected reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private pump: Promise<void> | null = null;
  protected inbox: number[] = [];
  protected protocol = false;
  protected busy = false;
  protected baudRate = 0;
  private waking = new Set<() => void>();
  private failure: Error | null = null;
  private closing = false;
  private decoder = new TextDecoder();
  private disconnectListener = (event: Event) => {
    if ((event as Event & { target: unknown }).target === this.port)
      void this.disconnect();
  };
  get supported() {
    return Boolean(navigatorSerial());
  }
  get connected() {
    return this.port !== null && this.writer !== null && !this.closing;
  }
  protected wake() {
    for (const notify of this.waking) notify();
  }
  protected consume(bytes: Uint8Array) {
    if (this.protocol) {
      this.inbox.push(...bytes);
      if (this.inbox.length > 262144) {
        this.failure = new Error(
          "Salida USB demasiado grande. Detén el programa.",
        );
        void this.disconnect();
      }
      this.wake();
    } else this.onOutput(this.decoder.decode(bytes, { stream: true }));
  }
  protected async open(baudRate: number, existing?: USBPort) {
    if (this.port) throw new Error("Ya existe una conexión USB.");
    const api = navigatorSerial();
    if (!api && !existing)
      throw new Error(
        "Web Serial necesita Chrome o Edge en escritorio y HTTPS o localhost.",
      );
    const port = existing ?? (await api!.requestPort());
    await port.open({ baudRate, bufferSize: 65536 });
    if (!port.readable || !port.writable) {
      await port.close();
      throw new Error("El puerto USB no ofrece lectura y escritura.");
    }
    this.port = port;
    this.baudRate = baudRate;
    this.failure = null;
    this.closing = false;
    this.inbox = [];
    this.decoder = new TextDecoder();
    this.writer = port.writable.getWriter();
    this.reader = port.readable.getReader();
    api?.addEventListener("disconnect", this.disconnectListener);
    this.pump = this.readLoop();
  }
  private async readLoop() {
    try {
      while (this.reader && !this.closing) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.consume(value);
      }
    } catch (error) {
      if (!this.closing)
        this.failure = new Error(`USB desconectado: ${errorText(error)}`);
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      if (!this.closing) {
        this.failure ??= new Error("Se perdió la conexión USB.");
        this.wake();
        // Close after the reader task exits, avoiding a promise waiting on itself.
        queueMicrotask(() => void this.disconnect());
      }
    }
  }
  protected async send(bytes: Uint8Array | number[]) {
    if (!this.writer || this.closing)
      throw new Error("Conecta la placa por USB primero.");
    await this.writer.write(
      bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes),
    );
  }
  async write(text: string) {
    if (this.protocol || this.busy)
      throw new Error("El transporte está ejecutando una operación.");
    await this.send(encoder.encode(text));
  }
  protected async bytes(count: number, timeout = 6000): Promise<Uint8Array> {
    const deadline = Date.now() + timeout;
    while (this.inbox.length < count) {
      if (this.failure) throw this.failure;
      if (!this.connected) throw new Error("Puerto USB cerrado.");
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new Error(
          "La placa no respondió a tiempo. Comprueba firmware y cable USB.",
        );
      await new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const notify = () => {
          clearTimeout(timer);
          this.waking.delete(notify);
          resolve();
        };
        this.waking.add(notify);
        timer = setTimeout(notify, remaining);
      });
    }
    return Uint8Array.from(this.inbox.splice(0, count));
  }
  protected async until(suffix: string, timeout = 6000): Promise<Uint8Array> {
    const ending = encoder.encode(suffix),
      result: number[] = [];
    const deadline = Date.now() + timeout;
    while (true) {
      result.push((await this.bytes(1, Math.max(1, deadline - Date.now())))[0]);
      if (result.length > 262144)
        throw new Error("Respuesta USB excede 256 KiB.");
      if (
        result.length >= ending.length &&
        ending.every(
          (value, i) => result[result.length - ending.length + i] === value,
        )
      )
        return Uint8Array.from(result.slice(0, -ending.length));
    }
  }
  protected async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.busy)
      throw new Error("Espera a que termine la operación USB actual.");
    this.busy = true;
    try {
      return await work();
    } finally {
      this.busy = false;
    }
  }
  protected async reconfigure(baudRate: number) {
    if (this.baudRate === baudRate) return;
    const port = this.port;
    if (!port) throw new Error("Conecta la placa primero.");
    const onDisconnect = this.onDisconnect;
    this.onDisconnect = () => {};
    try {
      await this.disconnect();
      await this.open(baudRate, port);
    } catch (error) {
      onDisconnect();
      throw error;
    } finally {
      this.onDisconnect = onDisconnect;
    }
  }
  async disconnect() {
    if (this.closing || !this.port) return;
    this.closing = true;
    this.failure ??= new Error("Puerto USB cerrado.");
    this.wake();
    const port = this.port;
    navigatorSerial()?.removeEventListener(
      "disconnect",
      this.disconnectListener,
    );
    try {
      await this.reader?.cancel();
    } catch {
      /* Already unplugged. */
    }
    await this.pump;
    try {
      await this.writer?.abort();
    } catch {
      /* Already unplugged. */
    }
    this.writer?.releaseLock();
    this.writer = null;
    try {
      await port.close();
    } catch {
      /* Already unplugged. */
    }
    this.port = null;
    this.protocol = false;
    this.inbox = [];
    this.closing = false;
    this.onDisconnect();
  }
}

export class MicroPythonSerial extends SerialLink {
  /** Avisa cuando el programa del estudiante termina, falla o se detiene. */
  onRunEnd: (failed: boolean) => void = () => {};
  private execution: {
    stage: number;
    decoder: TextDecoder;
    error: string;
  } | null = null;
  async connect() {
    await this.open(115200);
  }
  protected override consume(bytes: Uint8Array) {
    if (!this.execution) {
      super.consume(bytes);
      return;
    }
    let start = 0;
    for (let index = 0; index <= bytes.length; index++) {
      const execution = this.execution;
      if (!execution) {
        super.consume(bytes.slice(start));
        return;
      }
      const byte = bytes[index];
      const delimiter = byte === 4 && execution.stage < 2;
      const prompt = execution.stage === 2 && byte === 62;
      if (!delimiter && !prompt && index < bytes.length) continue;
      if (index > start) {
        const text = execution.decoder.decode(bytes.slice(start, index), {
          stream: true,
        });
        if (execution.stage === 1) execution.error += text;
        if (text) this.onOutput(text);
      }
      start = index + 1;
      if (delimiter) {
        const rest = execution.decoder.decode();
        if (rest) this.onOutput(rest);
        execution.decoder = new TextDecoder();
        execution.stage++;
      } else if (prompt) {
        this.execution = null;
        this.protocol = false;
        void this.send([2]).catch(() => {});
        const failed = Boolean(
          execution.error && !execution.error.includes("KeyboardInterrupt"),
        );
        if (failed) this.onOutput(`\n[Programa terminado con error]\n`);
        this.onRunEnd(failed);
        this.wake();
      }
    }
  }
  private async interrupt() {
    await this.send([13, 3, 3]);
    await delay(100);
    this.execution = null;
    this.protocol = true;
    this.inbox = [];
  }
  private async raw() {
    this.protocol = true;
    await this.interrupt();
    await this.send([1]);
    await this.until("raw REPL; CTRL-B to exit\r\n>");
  }
  private async submit(code: string) {
    if (!code.trim())
      throw new Error("Escribe un programa antes de ejecutarlo.");
    if (encoder.encode(code).length > 131072)
      throw new Error("El programa excede 128 KiB.");
    await this.raw();
    await this.send([5, 65, 1]);
    const response = await this.bytes(2);
    const data = encoder.encode(code);
    if (response[0] === 82 && response[1] === 1) {
      const windowBytes = await this.bytes(2);
      const increment = windowBytes[0] | (windowBytes[1] << 8);
      if (!increment) throw new Error("Ventana raw-paste inválida.");
      let window = increment,
        offset = 0;
      while (offset < data.length) {
        while (window === 0 || this.inbox.length > 0) {
          const control = (await this.bytes(1))[0];
          if (control === 1) window += increment;
          else if (control === 4) {
            await this.send([4]);
            throw new Error(
              "MicroPython rechazó el programa durante la carga. Revisa su sintaxis y memoria.",
            );
          } else throw new Error("Respuesta raw-paste inesperada.");
        }
        const size = Math.min(window, 256, data.length - offset);
        await this.send(data.slice(offset, offset + size));
        offset += size;
        window -= size;
      }
      await this.send([4]);
      // Credit bytes can precede the end-of-input acknowledgement.
      for (let i = 0; i < 1024; i++) {
        const ack = (await this.bytes(1))[0];
        if (ack === 4) return;
        if (ack !== 1) throw new Error("Confirmación raw-paste inválida.");
      }
      throw new Error("La placa no confirmó el programa.");
    }
    if (response[0] !== 82 || response[1] !== 0)
      await this.until("w REPL; CTRL-B to exit\r\n>");
    for (let offset = 0; offset < data.length; offset += 256) {
      await this.send(data.slice(offset, offset + 256));
      await delay(10);
    }
    await this.send([4]);
    const ack = await this.bytes(2);
    if (ack[0] !== 79 || ack[1] !== 75)
      throw new Error("MicroPython no confirmó la ejecución.");
  }
  async run(code: string) {
    await this.exclusive(async () => {
      try {
        await this.submit(code);
        this.execution = { stage: 0, decoder: new TextDecoder(), error: "" };
        if (this.inbox.length)
          this.consume(Uint8Array.from(this.inbox.splice(0)));
      } catch (error) {
        await this.recover();
        throw error;
      }
    });
  }
  private async recover() {
    this.execution = null;
    if (this.connected) {
      try {
        await this.send([3, 3, 2]);
      } catch {
        /* Unplugged. */
      }
    }
    this.protocol = false;
    if (this.inbox.length)
      this.onOutput(
        new TextDecoder().decode(Uint8Array.from(this.inbox.splice(0))),
      );
  }
  private async execute(code: string): Promise<string> {
    try {
      await this.submit(code);
      const output = new TextDecoder().decode(await this.until("\x04", 15000));
      const error = new TextDecoder().decode(await this.until("\x04", 6000));
      await this.until(">", 6000);
      if (error) {
        this.onOutput(error);
        throw new Error(error.trim());
      }
      return output;
    } finally {
      await this.recover();
    }
  }
  async exec(code: string) {
    return this.exclusive(() => this.execute(code));
  }
  async stop() {
    if (!this.connected) return;
    // Ctrl-C must remain available even while a finite exec awaits a response.
    if (this.busy) {
      await this.send([3, 3]);
      return;
    }
    await this.exclusive(async () => {
      await this.interrupt();
      await this.send([2]);
      this.protocol = false;
      this.inbox = [];
    });
    this.onRunEnd(false);
  }
  private async save(path: string, content: string) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(path) ||
      path.startsWith("/") ||
      path.split("/").includes("..")
    )
      throw new Error("Ruta de archivo inválida.");
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const directory = parts.slice(0, i).join("/");
      await this.execute(
        `import os\ntry:\n os.mkdir(${JSON.stringify(directory)})\nexcept OSError:\n pass`,
      );
    }
    const temp = `${path}.rdtmp`;
    await this.execute(`_rdfile=open(${JSON.stringify(temp)},'wb')`);
    const data = encoder.encode(content);
    try {
      for (let offset = 0; offset < data.length; offset += 512) {
        const escaped = [...data.slice(offset, offset + 512)]
          .map((byte) => `\\x${byte.toString(16).padStart(2, "0")}`)
          .join("");
        await this.execute(`_rdfile.write(b'${escaped}')`);
      }
      await this.execute(
        `_rdfile.close()\nimport os\nos.rename(${JSON.stringify(temp)},${JSON.stringify(path)})`,
      );
    } catch (error) {
      if (this.connected) {
        try {
          await this.execute(
            `try:\n _rdfile.close()\nexcept Exception:\n pass\ntry:\n os.remove(${JSON.stringify(temp)})\nexcept Exception:\n pass`,
          );
        } catch {
          /* Preserve original error. */
        }
      }
      throw error;
    }
  }
  async saveFile(path: string, content: string) {
    await this.exclusive(() => this.save(path, content));
  }
  async install(files: Record<string, string>) {
    await this.exclusive(async () => {
      // main.py last, so interrupted installations do not boot a partial new main.
      const names = Object.keys(files).sort((a, b) =>
        a === "main.py" ? 1 : b === "main.py" ? -1 : a.localeCompare(b),
      );
      for (const name of names) {
        this.onOutput(`\nInstalando ${name}…\n`);
        await this.save(name, files[name]);
      }
      this.onOutput(
        "\nFirmware guardado. Ejecuta main.py o reinicia la Pico.\n",
      );
    });
  }
  override async disconnect() {
    if (this.execution) this.onRunEnd(false);
    this.execution = null;
    await super.disconnect();
  }
}

export type ArduinoBoard = "uno" | "nano" | "nano-old";
/** Strict Intel HEX parser: checks every record, address bounds, checksum and EOF. */
export function parseIntelHex(hex: string, maxSize = 32256): Uint8Array {
  let upper = 0,
    highest = -1,
    ended = false;
  const image = new Uint8Array(maxSize).fill(255),
    written = new Set<number>();
  for (const line of hex
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (ended || !/^:[0-9a-fA-F]+$/.test(line) || (line.length - 1) % 2 !== 0)
      throw new Error("Archivo Intel HEX inválido.");
    const bytes = Uint8Array.from(
      line
        .slice(1)
        .match(/../g)!
        .map((value) => parseInt(value, 16)),
    );
    if (
      bytes.length < 5 ||
      bytes.length !== bytes[0] + 5 ||
      bytes.reduce((sum, byte) => sum + byte, 0) % 256 !== 0
    )
      throw new Error("Checksum Intel HEX inválido.");
    const count = bytes[0],
      address = (bytes[1] << 8) | bytes[2],
      type = bytes[3],
      data = bytes.slice(4, 4 + count);
    if (type === 0) {
      for (let i = 0; i < count; i++) {
        const at = upper + address + i;
        if (at >= maxSize || written.has(at))
          throw new Error(
            "HEX supera memoria de aplicación o contiene solapamientos.",
          );
        written.add(at);
        image[at] = data[i];
        highest = Math.max(highest, at);
      }
    } else if (type === 1 && count === 0) ended = true;
    else if (type === 4 && count === 2 && address === 0)
      upper = ((data[0] << 8) | data[1]) * 65536;
    else if (type === 2 && count === 2 && address === 0)
      upper = ((data[0] << 8) | data[1]) * 16;
    else if (!((type === 3 || type === 5) && count === 4))
      throw new Error("Registro Intel HEX no soportado.");
  }
  if (!ended || highest < 0) throw new Error("HEX vacío o sin fin de archivo.");
  return image.slice(0, highest + 1);
}

export class ArduinoUSBSerial extends SerialLink {
  protected board: ArduinoBoard = "uno";
  async connect(board: ArduinoBoard = "uno") {
    this.board = board;
    await this.open(115200);
  }
  private async command(
    command: number[],
    size = 0,
    timeout = 1200,
  ): Promise<Uint8Array> {
    await this.send([...command, 0x20]);
    const response = await this.bytes(size + 2, timeout);
    if (response[0] !== 0x14 || response[response.length - 1] !== 0x10)
      throw new Error("El bootloader STK500v1 respondió con error.");
    return response.slice(1, -1);
  }
  async upload(hex: string) {
    if (!this.connected)
      throw new Error("Conecta la placa Arduino por USB primero.");
    const data = parseIntelHex(hex, this.board === "uno" ? 32256 : 30720);
    await this.exclusive(async () => {
      // Old Nano bootloader is 57600; the lesson sketches print at 115200.
      // Keep the existing permission and restore terminal speed after uploading.
      await this.reconfigure(this.board === "nano-old" ? 57600 : 115200);
      this.protocol = true;
      this.inbox = [];
      try {
        await this.port!.setSignals({
          dataTerminalReady: false,
          requestToSend: false,
        });
        await delay(250);
        await this.port!.setSignals({
          dataTerminalReady: true,
          requestToSend: true,
        });
        await delay(80);
        let synchronized = false;
        for (let attempt = 0; attempt < 10 && !synchronized; attempt++) {
          this.inbox = [];
          try {
            await this.command([0x30], 0, 180);
            synchronized = true;
          } catch {
            await delay(40);
          }
        }
        if (!synchronized)
          throw new Error(
            "Sin respuesta del bootloader. Selecciona Nano antiguo o presiona RESET al cargar.",
          );
        const signature = await this.command([0x75], 3);
        if (
          signature[0] !== 0x1e ||
          signature[1] !== 0x95 ||
          signature[2] !== 0x0f
        )
          throw new Error(
            "La placa conectada no es ATmega328P (Uno/Nano clásico).",
          );
        await this.command([0x50]);
        const pageSize = 128;
        for (let offset = 0; offset < data.length; offset += pageSize) {
          const page = new Uint8Array(pageSize).fill(255);
          page.set(data.slice(offset, offset + pageSize));
          const word = offset / 2;
          await this.command([0x55, word & 255, word >> 8]);
          await this.command([0x64, 0, pageSize, 0x46, ...page]);
          await this.command([0x55, word & 255, word >> 8]);
          const readback = await this.command(
            [0x74, 0, pageSize, 0x46],
            pageSize,
          );
          if (!page.every((byte, i) => readback[i] === byte))
            throw new Error(`Verificación flash falló en dirección ${offset}.`);
          this.onOutput(
            `\rGrabando y verificando ${Math.min(100, Math.round(((offset + pageSize) * 100) / data.length))}%`,
          );
        }
        await this.command([0x51]);
        this.onOutput("\nPrograma Arduino grabado y verificado.\n");
      } finally {
        this.protocol = false;
        if (this.inbox.length)
          this.onOutput(
            new TextDecoder().decode(Uint8Array.from(this.inbox.splice(0))),
          );
        if (this.connected) await this.reconfigure(115200);
      }
    });
  }
}
export const serial = new MicroPythonSerial();
export const ArduinoSerial = new ArduinoUSBSerial();
