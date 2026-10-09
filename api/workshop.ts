import type { IncomingMessage, ServerResponse } from "node:http";
// The shared gateway also runs under node:test-style HTTP fixtures without the SDK.
// @ts-expect-error The proxy is native ESM JavaScript, shared with deployment tests.
import { workshopProxy } from "../scripts/vercel-proxy.mjs";

export const config = { api: { bodyParser: false } };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return workshopProxy(req, res);
}
