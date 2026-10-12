export type USBIssue = "https" | "browser" | "embedded" | null;

/** A browser may expose Serial while its embedding page denies permission. */
export function usbCompatibility(environment: {
  secureContext: boolean;
  serialAvailable: boolean;
  serialAllowed?: boolean;
}): { supported: boolean; issue: USBIssue; hint: string | null } {
  if (!environment.secureContext)
    return {
      supported: false,
      issue: "https",
      hint: "Abre la dirección HTTPS del taller para conectar tu placa por USB.",
    };
  if (!environment.serialAvailable)
    return {
      supported: false,
      issue: "browser",
      hint: "Para conectar USB, abre el taller en Chrome o Edge de escritorio.",
    };
  if (environment.serialAllowed === false)
    return {
      supported: false,
      issue: "embedded",
      hint: "Abre el taller en una pestaña propia para conectar tu placa por USB.",
    };
  return { supported: true, issue: null, hint: null };
}

export function browserUSBCompatibility() {
  const permissions = document as Document & {
    permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
    featurePolicy?: { allowsFeature: (feature: string) => boolean };
  };
  const policy = permissions.permissionsPolicy ?? permissions.featurePolicy;
  const serialAvailable = "serial" in navigator;
  return usbCompatibility({
    secureContext: window.isSecureContext,
    serialAvailable,
    serialAllowed: serialAvailable
      ? policy?.allowsFeature("serial")
      : undefined,
  });
}
