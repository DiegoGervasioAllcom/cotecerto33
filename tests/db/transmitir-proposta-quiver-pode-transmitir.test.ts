import { afterEach, describe, it, expect, vi } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa } from "../helpers/supabase";
import { transmitirPropostaQuiver } from "../../src/lib/quiver.functions";

/**
 * Cobre o check de `profiles.pode_transmitir` adicionado em
 * `transmitirPropostaQuiver` (src/lib/quiver.functions.ts), logo após
 * `assertDonoCotacao` — não há suíte prévia para esta server function,
 * então este arquivo é o único lugar que a testa.
 *
 * Não chama a API do robô: com `pode_transmitir=true`, configura credenciais
 * locais fictícias e usa uma cotação sem identificação. Assim a execução
 * passa pelo check de permissão e para no guard seguinte, antes do `fetch`.
 */
async function criarVendedorComToken() {
  const empresa = await criarEmpresa();
  const v = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
  const { data: sess } = await v.client.auth.getSession();
  const token = sess.session?.access_token ?? "";
  if (!token) throw new Error("sessão sem access_token");
  return { ...v, token };
}

async function criarCotacaoSemDados(empresaId: string, responsavelId: string) {
  const { data, error } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: responsavelId })
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar cotação: ${error?.message}`);
  return data.id as string;
}

describe("transmitirPropostaQuiver — pode_transmitir", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("NEGATIVO: pode_transmitir=false rejeita e não insere em cotacao_transmissoes nem chama o robô", async () => {
    const v = await criarVendedorComToken();
    const cotacaoId = await criarCotacaoSemDados(v.empresaId, v.userId);
    await admin.from("profiles").update({ pode_transmitir: false }).eq("id", v.userId);

    await expect(
      transmitirPropostaQuiver({
        data: {
          cotacaoId,
          caller_token: v.token,
          seguradora: "porto",
          formaPagamento: "boleto",
        },
      }),
    ).rejects.toThrow(/permissão de transmissão está desativada/i);

    const { data: tentativas } = await admin
      .from("cotacao_transmissoes")
      .select("id")
      .eq("cotacao_id", cotacaoId);
    expect(tentativas ?? []).toHaveLength(0);
  });

  it("POSITIVO: pode_transmitir=true (default) segue além do check de permissão", async () => {
    vi.stubEnv("SELF_QUIVER_API_URL", "http://127.0.0.1:1");
    vi.stubEnv("SELF_QUIVER_TRANSMISSAO_CLIENT_KEY", "teste-local");
    vi.stubEnv("SELF_QUIVER_TRANSMISSAO_CLIENT_SECRET", "teste-local");

    const v = await criarVendedorComToken();
    // cotação sem segurado/nome — o próximo guard do fluxo ("sem número do
    // portal e sem nome do cliente") só é alcançado se o check de
    // pode_transmitir já tiver passado.
    const cotacaoId = await criarCotacaoSemDados(v.empresaId, v.userId);

    await expect(
      transmitirPropostaQuiver({
        data: {
          cotacaoId,
          caller_token: v.token,
          seguradora: "porto",
          formaPagamento: "boleto",
        },
      }),
    ).rejects.toThrow(/sem número do portal/i);

    const { data: tentativas } = await admin
      .from("cotacao_transmissoes")
      .select("id")
      .eq("cotacao_id", cotacaoId);
    expect(tentativas ?? []).toHaveLength(0);
  });
});
