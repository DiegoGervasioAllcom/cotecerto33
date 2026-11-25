import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

import { handleQuiverEtapaWebhook } from "@/lib/quiver-etapa-webhook";

const COT = "3f2b8c1e-5a4d-4b7e-9c10-2d6f8a1b7e55";
const TENT = "9a1c2d3e-4b5f-4a6b-8c7d-0e1f2a3b4c5d";
const HEADERS = { "x-client-key": "k", "x-client-secret": "s" };
const req = (body: unknown) =>
  new Request("http://x/api", { method: "POST", headers: HEADERS, body: JSON.stringify(body) });

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: true, error: null });
  process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY = "k";
  process.env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET = "s";
  process.env.VITE_SUPABASE_URL = "http://localhost:54321";
  process.env.SELF_SUPABASE_SERVICE_ROLE_KEY = "svc";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const ok = { fluxo: "transmissao", cotacaoId: COT, tentativaId: TENT };

describe("webhook de etapa — fluxo transmissao", () => {
  test("etapa válida chama registrar_transmissao_etapa", async () => {
    const res = await handleQuiverEtapaWebhook(req({ ...ok, etapa: "abrindo_painel", seq: 2 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aplicado: true });
    expect(rpc).toHaveBeenCalledWith("registrar_transmissao_etapa", {
      p_tentativa_id: TENT,
      p_etapa: "abrindo_painel",
      p_seq: 2,
    });
  });

  test.each([
    ["seq incoerente", { ...ok, etapa: "abrindo_painel", seq: 3 }],
    ["concluido vindo do robô", { ...ok, etapa: "concluido", seq: 9 }],
    ["erro vindo do robô", { ...ok, etapa: "erro", seq: 9 }],
    ["etapa do cálculo", { ...ok, etapa: "login", seq: 1 }],
    ["sem tentativaId", { fluxo: "transmissao", cotacaoId: COT, etapa: "na_fila", seq: 0 }],
    ["tentativaId inválido", { ...ok, tentativaId: "x", etapa: "na_fila", seq: 0 }],
    ["fluxo desconhecido", { ...ok, fluxo: "outro", etapa: "na_fila", seq: 0 }],
  ])("%s responde 400 sem RPC", async (_n, body) => {
    const res = await handleQuiverEtapaWebhook(req(body));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("sem fluxo mantém o caminho do cálculo", async () => {
    const res = await handleQuiverEtapaWebhook(req({ cotacaoId: COT, etapa: "login", seq: 1 }));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("registrar_calculo_etapa", {
      p_cotacao_id: COT,
      p_etapa: "login",
      p_seq: 1,
    });
  });

  test("erro da RPC responde 500", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await handleQuiverEtapaWebhook(req({ ...ok, etapa: "na_fila", seq: 0 }));
    expect(res.status).toBe(500);
  });
});
