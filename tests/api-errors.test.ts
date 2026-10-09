import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../web/lib/api";
import { isNetworkError } from "../web/lib/offline";

afterEach(() => vi.unstubAllGlobals());

describe("Recuperación del servidor sin perder los borradores locales", () => {
  it.each([408, 429, 500, 502, 503, 504])("conserva estado ante HTTP %i y conserva el diagnóstico", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Vuelve a intentar" }), { status })));
    const error = await api("/session").catch((problem) => problem);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(status);
    expect(error.message).toBe("Vuelve a intentar");
    expect(isNetworkError(error)).toBe(true);
  });
  it.each([400, 401, 403, 404, 422])("distingue HTTP %i de una interrupción temporal", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Acceso o datos inválidos" }), { status })));
    const error = await api("/session").catch((problem) => problem);
    expect(error.status).toBe(status);
    expect(isNetworkError(error)).toBe(false);
  });
  it("una página HTML del proxy no se interpreta como sesión válida", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Servicio no disponible</html>", { status: 200 })));
    const error = await api("/session").catch((problem) => problem);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(isNetworkError(error)).toBe(true);
  });
});
