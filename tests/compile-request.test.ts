import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import { compileRequestCancellation } from "../server/compile-request";

function connection() {
  const request = Object.assign(new EventEmitter(), { aborted: false });
  const response = Object.assign(new EventEmitter(), {
    writableEnded: false,
    destroyed: false,
  });
  const cancellation = compileRequestCancellation(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );
  return { request, response, cancellation };
}

describe("compile request disconnects", () => {
  it("cancels a consumer when the response socket closes before completion", () => {
    const { response, cancellation } = connection();
    response.emit("close");
    expect(cancellation.signal.aborted).toBe(true);
  });
  it("cancels an aborted incoming request", () => {
    const { request, cancellation } = connection();
    request.emit("aborted");
    expect(cancellation.signal.aborted).toBe(true);
  });
  it("preserves a completed response and removes both disconnect listeners", () => {
    const { request, response, cancellation } = connection();
    response.writableEnded = true;
    response.emit("close");
    expect(cancellation.signal.aborted).toBe(false);
    cancellation.dispose();
    expect(request.listenerCount("aborted")).toBe(0);
    expect(response.listenerCount("close")).toBe(0);
  });
});
