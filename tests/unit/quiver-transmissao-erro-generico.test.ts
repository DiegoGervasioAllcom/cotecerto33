import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const maybeSingle = vi.fn();
const rpc = vi.fn();
const chain: Record<string, unknown> = {};
for (const m of ["select", "eq", "order", "limit"]) chain[m] = () => chain;
chain.maybeSingle = maybeSingle;
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: () => chain, rpc }) }));

import { handleQuiverTransmissaoWebhook } from "@/lib/quiver-transmissao-webhook";

const ID = "9bface8a-57da-4a83-9e58-fbff4987133e";
const req = () =>
  new Request("http://x/api/webhooks/quiver-transmissao", {
    method: "POST",
    headers: { "x-client-key": "k", "x-client-secret": "s", "content-type": "application/json" },
    body: JSON.stringify({ cotacaoId: ID, transmitido: false }),
  });

beforeEach(() => {
  vi.stubEnv("SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY", "k");
  vi.stubEnv("SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET", "s");
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("SELF_SUPABASE_SERVICE_ROLE_KEY", "service");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  maybeSingle.mockReset();
  rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook de transmissão: erro do banco não vaza na resposta", () => {
  test("falha ao buscar a tentativa → 500 genérico", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "relation secreta fk_x" } });
    const res = await handleQuiverTransmissaoWebhook(req());
    expect(res.status).toBe(500);
    const txt = await res.text();
    expect(txt).not.toContain("secreta");
    expect(JSON.parse(txt)).toEqual({ error: "Falha ao buscar a tentativa." });
  });

  test("falha ao registrar o resultado → 500 genérico", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "t1" }, error: null });
    rpc.mockResolvedValue({ data: null, error: { message: "constraint secreta ck_y" } });
    const res = await handleQuiverTransmissaoWebhook(req());
    expect(res.status).toBe(500);
    const txt = await res.text();
    expect(txt).not.toContain("secreta");
    expect(JSON.parse(txt)).toEqual({ error: "Falha ao registrar o resultado." });
  });
});
