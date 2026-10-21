import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const rpc = vi.fn();
const maybeSingle = vi.fn();
const from = () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) });
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc, from }) }));

import { handleQuiverEtapaWebhook } from "@/lib/quiver-etapa-webhook";
import { handleQuiverWebhook } from "@/lib/quiver-webhook";

const ID = "3f2b8c1e-5a4d-4b7e-9c10-2d6f8a1b7e55";
const HEADERS = { "x-client-key": "k", "x-client-secret": "s" };

function req(body: unknown, headers: Record<string, string> = HEADERS, raw = false) {
  return new Request("http://x/api", {
    method: "POST",
    headers,
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  rpc.mockReset();
  maybeSingle.mockReset();
  maybeSingle.mockResolvedValue({ data: { status: "calculada", quiver_mensagem: null } });
  process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY = "k";
  process.env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET = "s";
  process.env.VITE_SUPABASE_URL = "http://localhost:54321";
  process.env.SELF_SUPABASE_SERVICE_ROLE_KEY = "svc";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("webhook de etapa do cálculo", () => {
  test("sem env de credencial responde 500 e não chama a RPC", async () => {
    delete process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY;
    const res = await handleQuiverEtapaWebhook(req({}));
    expect(res.status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ["sem headers", {}],
    ["key errada", { "x-client-key": "x", "x-client-secret": "s" }],
    ["secret errado", { "x-client-key": "k", "x-client-secret": "x" }],
  ])("credencial %s responde 401 sem tocar no banco", async (_n, h) => {
    const res = await handleQuiverEtapaWebhook(
      req({ cotacaoId: ID, etapa: "login", seq: 1 }, h as Record<string, string>),
    );
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("JSON inválido responde 400", async () => {
    const res = await handleQuiverEtapaWebhook(req("{nao-json", HEADERS, true));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  test.each([
    ["uuid ruim", { cotacaoId: "123", etapa: "login", seq: 1 }],
    ["etapa fora da lista", { cotacaoId: ID, etapa: "voando", seq: 1 }],
    ["etapa concluido não é aceita do robô", { cotacaoId: ID, etapa: "concluido", seq: 9 }],
    ["seq que não bate com a etapa", { cotacaoId: ID, etapa: "login", seq: 2 }],
    ["seq acima de 8", { cotacaoId: ID, etapa: "login", seq: 9 }],
    ["seq não inteiro", { cotacaoId: ID, etapa: "login", seq: 1.5 }],
    ["seq negativo", { cotacaoId: ID, etapa: "na_fila", seq: -1 }],
    ["sem campos", {}],
  ])("payload inválido (%s) responde 400", async (_n, body) => {
    const res = await handleQuiverEtapaWebhook(req(body));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("RPC aplicou: 200 {aplicado:true} com args corretos", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await handleQuiverEtapaWebhook(req({ cotacaoId: ID, etapa: "calculando", seq: 5 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aplicado: true });
    expect(rpc).toHaveBeenCalledWith("registrar_calculo_etapa", {
      p_cotacao_id: ID,
      p_etapa: "calculando",
      p_seq: 5,
    });
  });

  test("na_fila (seq 0) é aceita", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await handleQuiverEtapaWebhook(req({ cotacaoId: ID, etapa: "na_fila", seq: 0 }));
    expect(res.status).toBe(200);
  });

  test.each([[false], [null]])("RPC retornou %s: 200 {aplicado:false}", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    const res = await handleQuiverEtapaWebhook(req({ cotacaoId: ID, etapa: "login", seq: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ aplicado: false });
  });

  test("erro da RPC responde 500 genérico sem vazar mensagem do banco", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation secreta violou fk_x" } });
    const res = await handleQuiverEtapaWebhook(req({ cotacaoId: ID, etapa: "login", seq: 1 }));
    expect(res.status).toBe(500);
    const txt = await res.text();
    expect(txt).not.toContain("secreta");
    expect(JSON.parse(txt)).toEqual({ error: "Falha ao registrar etapa." });
  });
});

describe("webhook de cotação: fechamento da etapa", () => {
  test("após registrar prêmios chama registrar_calculo_etapa concluido seq 9, nessa ordem", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const res = await handleQuiverWebhook(req({ cotacaoId: ID, premios: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      "registrar_premios_quiver",
      "registrar_calculo_etapa",
    ]);
    expect(rpc.mock.calls[1][1]).toEqual({
      p_cotacao_id: ID,
      p_etapa: "concluido",
      p_seq: 9,
    });
  });

  test("cotação em erro_quiver fecha a etapa como erro com a mensagem (máx. 500)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    maybeSingle.mockResolvedValue({
      data: { status: "erro_quiver", quiver_mensagem: "x".repeat(600) },
    });
    await handleQuiverWebhook(req({ cotacaoId: ID }));
    expect(rpc.mock.calls[1][1]).toEqual({
      p_cotacao_id: ID,
      p_etapa: "erro",
      p_seq: 9,
      p_erro: "x".repeat(500),
    });
  });

  test("falha ao fechar a etapa não derruba o 200 {ok:true}", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = await handleQuiverWebhook(req({ cotacaoId: ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("falha em registrar prêmios responde 500 e NÃO fecha a etapa", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "falhou" } });
    const res = await handleQuiverWebhook(req({ cotacaoId: ID }));
    expect(res.status).toBe(500);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
