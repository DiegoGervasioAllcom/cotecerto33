import { afterEach, describe, expect, it, vi } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq } from "../helpers/supabase";
import { executarConsultaPlaca } from "../../src/lib/placa.functions";
import { normalizePlaca } from "../../src/lib/masks";

/**
 * Testa a lógica de `consultarPlaca` chamando `executarConsultaPlaca`
 * direto (src/lib/placa.functions.ts) — a função pura por trás do
 * `createServerFn`, extraída porque chamar o `consultarPlaca` exportado
 * fora do plugin de bundler do TanStack Start executa o handler de
 * verdade, mas o wrapper de middleware do framework descarta o valor de
 * retorno nesse caminho (só reconhece uma propriedade `result` explícita).
 * `executarConsultaPlaca` roda a mesma lógica de negócio contra o
 * Supabase local de verdade, sem essa armadilha.
 *
 * Isso NUNCA deve bater na API real do decodificador — mas o Supabase
 * client (auth, queries) TAMBÉM usa `fetch` global por baixo dos panos,
 * então não dá pra stubar `global.fetch` inteiro: quebraria toda chamada
 * ao Supabase local, não só a do decodificador. `stubFetchPlaca`
 * intercepta só requisições cuja URL bate com `SELF_PLACA_API_URL` e
 * repassa qualquer outra coisa pro `fetch` real.
 */

const XML_SUCESSO_MOCK = `<Root><placa>ABC1D23</placa><chassi>9BGJC69Z0FB105973</chassi><Decodificador><DsCategoria>AUTOMOVEL</DsCategoria><DsPlaca>ABC1D23</DsPlaca><DsChassi>9BGJC69Z0FB105973</DsChassi><DsChassiTratado>9BGJC69Z0FB105973</DsChassiTratado><DsMarca>FIAT</DsMarca><DsModelo>MOBI</DsModelo><DsRetorno>Marca/Modelo/Ano Identificados</DsRetorno><NuAnoModelo>2020</NuAnoModelo><NuAnoFabricacao>2019</NuAnoFabricacao><NuCdRetorno>0</NuCdRetorno><PrecificadorI><DsCodigo>001-1</DsCodigo><DsCombustivel>Flex</DsCombustivel><DsMarca>Fiat</DsMarca><DsModelo>Mobi Like 1.0</DsModelo><NuValor>55000</NuValor></PrecificadorI></Decodificador></Root>`;

const fetchReal = globalThis.fetch;
const PLACA_API_HOST = new URL(process.env.SELF_PLACA_API_URL || "https://ws.sisconsulta.com").host;

/**
 * Stuba `global.fetch` interceptando só chamadas ao host do decodificador
 * (mock de resposta), e repassa qualquer outra requisição (Supabase auth,
 * PostgREST) para o fetch real — nunca deixa passar batido pro fornecedor.
 */
function stubFetchPlaca(mockImpl: (url: string | URL, init?: RequestInit) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL, init?: RequestInit) => {
      const host = typeof url === "string" ? new URL(url).host : url.host;
      if (host === PLACA_API_HOST) return mockImpl(url, init);
      return fetchReal(url, init);
    }),
  );
}

async function criarVendedorComToken() {
  const empresa = await criarEmpresa();
  const v = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
  const { data: sess } = await v.client.auth.getSession();
  const token = sess.session?.access_token ?? "";
  if (!token) throw new Error("sessão sem access_token");
  return { ...v, token };
}

async function criarCotacao(empresaId: string, responsavelId: string) {
  const { data, error } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: responsavelId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar cotação: ${error?.message}`);
  return data.id;
}

describe("consultarPlaca — cache, forçar e posse da cotação", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cache hit: consulta bem-sucedida recente é reaproveitada, sem chamar a API", async () => {
    const fetchEspiao = vi.fn();
    stubFetchPlaca(fetchEspiao);

    const v = await criarVendedorComToken();
    const placa = normalizePlaca(uniq("ABC"));
    await admin.from("consultas_placa").insert({
      placa,
      sucesso: true,
      marca: "FIAT",
      modelo: "MOBI",
      payload: { placa, marca: "FIAT", modelo: "MOBI", fipe: [] },
    });

    const r = await executarConsultaPlaca({ placa, caller_token: v.token, forcar: false });

    expect(r.ok).toBe(true);
    expect(r.cache).toBe(true);
    expect(r.dados?.marca).toBe("FIAT");
    // A garantia central do cache: nenhuma chamada à API paga.
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it("cache miss: sem registro prévio, chama a API (mockada) e grava o resultado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(XML_SUCESSO_MOCK),
    });
    stubFetchPlaca(fetchMock);

    const v = await criarVendedorComToken();
    const placa = normalizePlaca(uniq("MIS"));

    const r = await executarConsultaPlaca({ placa, caller_token: v.token, forcar: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.cache).toBe(false);
    expect(r.dados?.marca).toBe("FIAT");

    const { data: linha } = await admin
      .from("consultas_placa")
      .select("sucesso,marca,consultado_por")
      .eq("placa", placa)
      .single();
    expect(linha?.sucesso).toBe(true);
    expect(linha?.marca).toBe("FIAT");
    expect(linha?.consultado_por).toBe(v.userId);
  });

  it("cache expirado (> 30 dias): não é reaproveitado, API é chamada de novo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(XML_SUCESSO_MOCK),
    });
    stubFetchPlaca(fetchMock);

    const v = await criarVendedorComToken();
    const placa = normalizePlaca(uniq("EXP"));
    const antigo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { data: inserida, error } = await admin
      .from("consultas_placa")
      .insert({ placa, sucesso: true, marca: "ANTIGA", payload: { placa, fipe: [] } })
      .select("id")
      .single();
    if (error || !inserida) throw new Error(`seed: ${error?.message}`);
    // insert usa o default now(); sobrescreve pra fora da janela de 30 dias.
    await admin.from("consultas_placa").update({ criado_em: antigo }).eq("id", inserida.id);

    const r = await executarConsultaPlaca({ placa, caller_token: v.token, forcar: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.cache).toBe(false);
    expect(r.dados?.marca).toBe("FIAT");
  });

  it("forcar:true ignora um cache válido e recente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(XML_SUCESSO_MOCK),
    });
    stubFetchPlaca(fetchMock);

    const v = await criarVendedorComToken();
    const placa = normalizePlaca(uniq("FOR"));
    await admin.from("consultas_placa").insert({
      placa,
      sucesso: true,
      marca: "CACHEADA",
      payload: { placa, marca: "CACHEADA", fipe: [] },
    });

    const r = await executarConsultaPlaca({ placa, caller_token: v.token, forcar: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.cache).toBe(false);
    expect(r.dados?.marca).toBe("FIAT");
  });

  it("cotacaoId de outro usuário não é gravado — a consulta segue, sem vínculo forjado", async () => {
    const fetchEspiao = vi.fn();
    stubFetchPlaca(fetchEspiao);

    const dono = await criarVendedorComToken();
    const cotacaoAlheia = await criarCotacao(dono.empresaId, dono.userId);

    const atacante = await criarVendedorComToken();
    const placa = normalizePlaca(uniq("ATK"));
    await admin.from("consultas_placa").insert({
      placa,
      sucesso: true,
      marca: "FIAT",
      payload: { placa, marca: "FIAT", fipe: [] },
    });

    const r = await executarConsultaPlaca({
      placa,
      caller_token: atacante.token,
      forcar: false,
      cotacaoId: cotacaoAlheia,
    });
    expect(r.ok).toBe(true); // a consulta em si não falha por causa do cotacaoId inválido

    // Como veio do cache, nada novo é gravado — força uma consulta nova
    // (forcar) pra observar o que a próxima gravação faz com o cotacaoId.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(XML_SUCESSO_MOCK),
    });
    stubFetchPlaca(fetchMock);
    await executarConsultaPlaca({
      placa,
      caller_token: atacante.token,
      forcar: true,
      cotacaoId: cotacaoAlheia,
    });

    const { data: linha } = await admin
      .from("consultas_placa")
      .select("cotacao_id,consultado_por")
      .eq("placa", placa)
      .eq("consultado_por", atacante.userId)
      .single();
    expect(linha?.cotacao_id).toBeNull();
  });

  it("cotacaoId do próprio dono é gravado normalmente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(XML_SUCESSO_MOCK),
    });
    stubFetchPlaca(fetchMock);

    const dono = await criarVendedorComToken();
    const cotacaoId = await criarCotacao(dono.empresaId, dono.userId);
    const placa = normalizePlaca(uniq("OWN"));

    await executarConsultaPlaca({ placa, caller_token: dono.token, forcar: false, cotacaoId });

    const { data: linha } = await admin
      .from("consultas_placa")
      .select("cotacao_id")
      .eq("placa", placa)
      .single();
    expect(linha?.cotacao_id).toBe(cotacaoId);
  });
});
