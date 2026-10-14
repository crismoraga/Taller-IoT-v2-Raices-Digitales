import type { UploadStatus } from "../lib/context";

export interface UploadRecovery {
  title: string;
  next: string;
  action: "retry" | "reconnect" | "change-model" | "edit";
}

/** Keep the next action tied to the failed operation, rather than blaming USB for every error. */
export function uploadRecovery(upload: UploadStatus): UploadRecovery {
  const message = (upload.message ?? "").toLowerCase();
  if (upload.failedStage === "compile") {
    if (
      (upload.httpStatus !== undefined &&
        (upload.httpStatus >= 500 ||
          [408, 425, 429].includes(upload.httpStatus))) ||
      /timeout|timed out|abort|no respondió|agot|conexión|conectar|temporal|espera|ocupad|demasiadas solicitudes|servidor|servicio|fetch|compilaci[oó]n.*plazo|plazo de compil|se canceló la compil|arduino cli no|compilador.*(no |indispon)|502|503|504/.test(
        message,
      )
    ) {
      return {
        title: "La compilación necesita otro intento",
        next: "Mantén la placa conectada. Comprueba tu conexión a internet y vuelve a cargar el mismo programa.",
        action: "retry",
      };
    }
    return {
      title: "Revisa el programa antes de cargar",
      next: "Abre el detalle para encontrar la línea indicada, corrígela en el editor y vuelve a cargar.",
      action: "edit",
    };
  }
  if (
    /no coincide|microcontrolador correct|modelo.*incorrect|firma [0-9a-f]/.test(
      message,
    )
  ) {
    return {
      title: "El modelo elegido no coincide con la placa",
      next: "Desconecta desde aquí y elige el modelo escrito en tu placa en «Tu placa» o «Modelo de placa». Después vuelve a conectar USB.",
      action: "change-model",
    };
  }
  if (
    /no se pudo escribir por usb:|puerto usb no confirmó el envío en \d+ segundos/.test(
      message,
    )
  ) {
    return {
      title: "El puerto USB dejó de responder",
      next: "Desconecta el cable USB del PC y vuelve a conectarlo. Cierra el monitor serial de Arduino IDE y pulsa «Conectar placa» para elegir de nuevo su puerto.",
      action: "reconnect",
    };
  }
  if (/desconect|conexión cambió|puerto.*ocupad|networkerror/.test(message)) {
    return {
      title: "Recuperemos la conexión USB",
      next: "Cierra el monitor serial de Arduino IDE y otras pestañas que usen el puerto. Vuelve a conectar tu placa desde esta página.",
      action: "reconnect",
    };
  }
  if (
    upload.failedStage === "write" ||
    upload.failedStage === "verify" ||
    /verificación|readback|flash/.test(message)
  ) {
    return {
      title: "La memoria todavía no quedó verificada",
      next: "Libera el puerto USB, vuelve a conectarlo y carga el mismo programa para grabarlo y comprobarlo completo.",
      action: "reconnect",
    };
  }
  return {
    title: "Arduino no confirmó el inicio de la carga",
    next: "Cierra el monitor serial de Arduino IDE y vuelve a cargar. La página reinicia la placa y prueba su velocidad automáticamente.",
    action: "retry",
  };
}
