import { describe, expect, it } from "vitest";
import { usbCompatibility } from "../web/lib/usb-support";

describe("USB availability in the actual browser context", () => {
  it("does not offer an unusable USB action on an insecure page", () => {
    expect(
      usbCompatibility({ secureContext: false, serialAvailable: true }),
    ).toMatchObject({ supported: false, issue: "https" });
  });
  it("explains browser support without marking the board as disconnected or broken", () => {
    expect(
      usbCompatibility({ secureContext: true, serialAvailable: false }),
    ).toMatchObject({ supported: false, issue: "browser" });
  });
  it("detects a denied Serial permissions policy even when the API exists", () => {
    expect(
      usbCompatibility({
        secureContext: true,
        serialAvailable: true,
        serialAllowed: false,
      }),
    ).toMatchObject({ supported: false, issue: "embedded" });
  });
  it.each([true, undefined])(
    "allows standalone Serial when policy is %s",
    (serialAllowed) => {
      expect(
        usbCompatibility({
          secureContext: true,
          serialAvailable: true,
          serialAllowed,
        }),
      ).toEqual({ supported: true, issue: null, hint: null });
    },
  );
});
