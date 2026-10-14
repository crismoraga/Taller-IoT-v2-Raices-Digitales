import { describe, expect, it } from "vitest";
import { uploadRecovery } from "../web/shell/upload-guidance";

describe("Arduino recovery preserves the actual failure phase", () => {
  it.each([
    "The operation was aborted due to timeout",
    "El compilador agotó el tiempo de espera",
    "La compilación superó su plazo. Tu código sigue guardado; vuelve a ejecutarlo.",
    "El plazo de compilación terminó antes de comenzar. Vuelve a ejecutar tu programa.",
    "Arduino CLI no está disponible.",
    "Failed to fetch",
    "No hay un compilador disponible en el servidor",
    "El compilador está ocupado; vuelve a intentar",
  ])(
    "does not ask to reset or release USB for a compiler failure: %s",
    (message) => {
      const result = uploadRecovery({
        stage: "error",
        failedStage: "compile",
        message,
      });
      expect(result.action).toBe("retry");
      expect(result.next).toContain("Mantén la placa conectada");
      expect(result.next).not.toContain("Libera");
    },
  );
  it("uses compiler diagnostics for a syntax error", () => {
    expect(
      uploadRecovery({
        stage: "error",
        failedStage: "compile",
        message: "sketch.ino:7: error: expected ';'",
      }).action,
    ).toBe("edit");
  });
  it("uses the HTTP status when a service failure has an unfamiliar message", () => {
    expect(
      uploadRecovery({
        stage: "error",
        failedStage: "compile",
        httpStatus: 503,
        message: "Unavailable",
      }).action,
    ).toBe("retry");
  });
  it("an oversized program is corrected rather than retried as a network failure", () => {
    expect(
      uploadRecovery({
        stage: "error",
        failedStage: "compile",
        httpStatus: 400,
        message: "Código vacío, demasiado largo o inválido.",
      }).action,
    ).toBe("edit");
  });
  it("a wrong MCU is corrected before suggesting another upload", () => {
    const result = uploadRecovery({
      stage: "error",
      failedStage: "sync",
      message:
        "La placa conectada no coincide con Arduino Nano · ATmega168 (firma 1e 95 0f). Elige el modelo y microcontrolador correctos.",
    });
    expect(result.action).toBe("change-model");
    expect(result.next).toContain("elige el modelo escrito en tu placa");
  });
  it.each(["write", "verify"] as const)(
    "a %s timeout requires reconnecting before a complete upload",
    (failedStage) => {
      const result = uploadRecovery({
        stage: "error",
        failedStage,
        message: "Arduino no respondió a tiempo",
      });
      expect(result.action).toBe("reconnect");
      expect(result.next).toContain("comprobarlo completo");
    },
  );
  it("a failed readback is never described as a verified program", () => {
    const result = uploadRecovery({
      stage: "error",
      message: "Verificación flash falló en dirección 128.",
    });
    expect(result.title).toContain("todavía no quedó verificada");
    expect(result.action).toBe("reconnect");
  });
  it("a sync failure explains the automatic reset", () => {
    const result = uploadRecovery({
      stage: "error",
      failedStage: "sync",
      message: "El bootloader STK500v1 respondió con error.",
    });
    expect(result.action).toBe("retry");
    expect(result.next).toContain("reinicia la placa");
  });
  it.each(["sync", "write", "verify"] as const)(
    "a bounded USB writer failure during %s asks to reconnect the physical cable",
    (failedStage) => {
      const result = uploadRecovery({
        stage: "error",
        failedStage,
        message:
          "Arduino no confirmó la operación. No se pudo escribir por USB: El puerto USB no confirmó el envío en 6 segundos. Vuelve a conectar la placa y reintenta la carga. (STK500v1 · uno · 115200 baudios).",
      });
      expect(result.action).toBe("reconnect");
      expect(result.next).toContain(
        "Desconecta el cable USB del PC y vuelve a conectarlo",
      );
      expect(result.next).toContain("Cierra el monitor serial de Arduino IDE");
      expect(result.next).toContain("«Conectar placa»");
    },
  );
  it("a compiler HTTP 408 still keeps USB connected instead of using cable recovery", () => {
    const result = uploadRecovery({
      stage: "error",
      failedStage: "compile",
      httpStatus: 408,
      message: "La compilación superó su plazo.",
    });
    expect(result.action).toBe("retry");
    expect(result.next).toContain("Mantén la placa conectada");
    expect(result.next).not.toContain("cable USB");
  });
  it("a disconnected port has a connection action regardless of its last write phase", () => {
    const result = uploadRecovery({
      stage: "error",
      failedStage: "write",
      message: "La placa se desconectó. Conéctala de nuevo para instalar.",
    });
    expect(result.action).toBe("reconnect");
    expect(result.title).toBe("Recuperemos la conexión USB");
  });
});
