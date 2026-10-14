import { describe, expect, it } from "vitest";
import { SerialTextBuffer } from "../web/lib/serial-text";

describe("streaming serial monitor", () => {
  it("joins fragmented sensor JSON and CRLF without duplicate blank rows", () => {
    const buffer = new SerialTextBuffer();
    const chunks = [
      " \r",
      "\n\r\n\t \r",
      '\n{"sensor":"soil",',
      '\"value\":null,\"raw\":567,\"note\":\"dos palabras\"}',
      "\r",
      "\n\r\n\r",
      "\n",
    ];
    const frames = chunks.map((chunk) => buffer.push(chunk));
    const lines = frames.flatMap((frame) => frame.lines);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      sensor: "soil",
      value: null,
      raw: 567,
      note: "dos palabras",
    });
    expect(frames.map((frame) => frame.display).join("")).toBe(lines[0] + "\n");
  });

  it("keeps indentation and partial prints/prompts visible before a newline", () => {
    const buffer = new SerialTextBuffer();
    expect(buffer.push("  ").display).toBe("");
    expect(buffer.push("Temperatura: ").display).toBe("  Temperatura: ");
    expect(buffer.push("22.5 °C\r").display).toBe("22.5 °C\n");
    expect(buffer.push("\n>>> ").display).toBe(">>> ");
    expect(buffer.push("print('raíces')").display).toBe("print('raíces')");
  });

  it("does not grow or update the visible monitor for empty control traffic", () => {
    const buffer = new SerialTextBuffer();
    for (let index = 0; index < 200; index++) {
      const { display } = buffer.push("\u0000\t  \r\n\r\n");
      expect(display).toBe("");
    }
    expect(buffer.push("Lectura real: 512\r\n")).toEqual({
      display: "Lectura real: 512\n",
      lines: ["Lectura real: 512"],
    });
  });

  it("preserves the exact parser input instead of repairing invalid JSON", () => {
    const buffer = new SerialTextBuffer();
    const raw = '{"sensor":"soil","value":\u0000567}';
    const frame = buffer.push(raw + "\n");
    expect(frame.lines).toEqual([raw]);
    expect(() => JSON.parse(frame.lines[0])).toThrow();
    expect(frame.display).toBe('{"sensor":"soil","value":567}\n');
  });

  it("forgets a previous device's unfinished line and delimiter on reconnect", () => {
    const buffer = new SerialTextBuffer();
    buffer.push('{"sensor":"old"');
    buffer.reset();
    expect(buffer.push('{"sensor":"soil","raw":512}\r\n')).toEqual({
      display: '{"sensor":"soil","raw":512}\n',
      lines: ['{"sensor":"soil","raw":512}'],
    });
  });
});
