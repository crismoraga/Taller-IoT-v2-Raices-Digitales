import type { IncomingMessage, ServerResponse } from "node:http";

/** Cancel only unfinished work when its HTTP consumer disconnects. */
export function compileRequestCancellation(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const controller = new AbortController();
  const disconnect = () => {
    if (!response.writableEnded) controller.abort();
  };
  request.once("aborted", disconnect);
  response.once("close", disconnect);
  if (request.aborted || response.destroyed) disconnect();
  return {
    signal: controller.signal,
    dispose() {
      request.off("aborted", disconnect);
      response.off("close", disconnect);
    },
  };
}
