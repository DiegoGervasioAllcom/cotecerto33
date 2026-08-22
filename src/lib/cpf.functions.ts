// Consulta de CPF (localização simples — ws.sisconsulta.com, mesma conta
// usada pelo decodificador de placa). A chamada roda no servidor porque a
// chave da API não pode ir ao bundle e porque a resposta traz dados
// pessoais sensíveis (endereço, telefone, e-mail, renda presumida) — o
// cache e o registro em `consultas_cpf` ficam do lado que o front não
// consegue burlar.
//
// Mesmo padrão de placa.functions.ts: client service_role + validação
// manual do usuário pelo caller_token (a RLS de `consultas_cpf` não se
// aplica ao service_role, que é quem grava).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { onlyDigits } from "@/lib/masks";
import {
  parseLocalizacaoCpfXml,
  type CpfDecodificado,
  type ResultadoConsultaCpf,
} from "@/lib/cpf-decodificador";

function getAdmin() {
  const url =
    import.meta.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Configuração do servidor ausente.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Janela do cache: consulta bem-sucedida do mesmo CPF é reaproveitada. */
const CACHE_DIAS = 30;
const TIMEOUT_MS = 30_000;

export type ConsultaCpfResposta = {
  ok: boolean;
  /** true quando veio de `consultas_cpf` em vez da API. */
  cache: boolean;
  dados: CpfDecodificado | null;
  mensagem: string | null;
};

export type ConsultarCpfPayload = {
  cpf: string;
  caller_token: string;
  cotacaoId?: string | null;
  /** Ignora o cache e força uma chamada nova à API. */
  forcar?: boolean;
};

function colunasDecodificadas(dados: CpfDecodificado | null) {
  return {
    nome: dados?.nome || null,
    sexo: dados?.sexo || null,
    data_nascimento: dados?.dataNascimento || null,
    nome_mae: dados?.nomeMae || null,
    estado_civil: dados?.estadoCivil || null,
    celular: dados?.celular || null,
    email: dados?.email || null,
    endereco_logradouro: dados?.endereco?.logradouro || null,
    endereco_numero: dados?.endereco?.numero || null,
    endereco_complemento: dados?.endereco?.complemento || null,
    endereco_bairro: dados?.endereco?.bairro || null,
    endereco_cidade: dados?.endereco?.cidade || null,
    endereco_uf: dados?.endereco?.uf || null,
    endereco_cep: dados?.endereco?.cep || null,
  };
}

/**
 * Lógica de negócio de `consultarCpf`, separada da fiação do
 * `createServerFn` para poder ser testada direto (mesmo motivo de
 * `executarConsultaPlaca` em placa.functions.ts).
 */
export async function executarConsultaCpf(data: ConsultarCpfPayload): Promise<ConsultaCpfResposta> {
  if (!data?.caller_token) throw new Error("Sem token.");
  const cpf = onlyDigits(data?.cpf ?? "");
  if (cpf.length !== 11) throw new Error("CPF inválido.");

  const admin = getAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(data.caller_token);
  if (userErr || !userData.user) throw new Error("Não autenticado.");
  const userId = userData.user.id;

  // Mesma proteção de assertDonoCotacao usada em placa/quiver: o cotacaoId
  // vem do payload do cliente e não é confiável sem checar posse.
  let cotacaoId: string | null = null;
  if (data.cotacaoId) {
    const { data: cot, error: cotErr } = await admin
      .from("cotacoes")
      .select("id,responsavel_id")
      .eq("id", data.cotacaoId)
      .maybeSingle();
    if (cotErr) throw new Error(cotErr.message);
    if (cot && cot.responsavel_id === userId) cotacaoId = cot.id;
  }

  const { data: perfil, error: perfilErr } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .maybeSingle();
  if (perfilErr) console.error("[cpf] falha ao buscar empresa do usuário:", perfilErr.message);
  const empresaId = (perfil as { empresa_id?: string | null } | null)?.empresa_id ?? null;

  // ---- Cache: última consulta bem-sucedida do CPF na janela ----
  if (!data.forcar) {
    const desde = new Date(Date.now() - CACHE_DIAS * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached, error: cacheErr } = await admin
      .from("consultas_cpf")
      .select("payload")
      .eq("cpf", cpf)
      .eq("sucesso", true)
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cacheErr) console.error("[cpf] falha ao ler cache:", cacheErr.message);
    const payload = (cached as { payload?: CpfDecodificado | null } | null)?.payload;
    if (payload) return { ok: true, cache: true, dados: payload, mensagem: null };
  }

  // ---- Chamada à API (mesma conta do decodificador de placa) ----
  const apiUrl = process.env.SELF_CPF_API_URL;
  const cliente = process.env.SELF_PLACA_API_CLIENTE;
  const chave = process.env.SELF_PLACA_API_CHAVE;
  if (!apiUrl || !cliente || !chave) {
    throw new Error("Integração de CPF não configurada no servidor.");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("documento", cpf);
  url.searchParams.set("tipo", "cpf");
  url.searchParams.set("cliente", cliente);
  url.searchParams.set("chaveKey", chave);

  let xml = "";
  let erroTransporte: string | null = null;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    xml = await res.text();
    if (!res.ok) erroTransporte = `HTTP ${res.status}`;
  } catch (e) {
    erroTransporte = e instanceof Error ? e.message : "Falha de conexão";
  }

  const resultado: ResultadoConsultaCpf = erroTransporte
    ? { ok: false, codigo: null, mensagem: erroTransporte }
    : parseLocalizacaoCpfXml(xml);

  // ---- Registro (sempre, sucesso ou falha) ----
  const linha = {
    cpf,
    cotacao_id: cotacaoId,
    empresa_id: empresaId,
    consultado_por: userId,
    raw_xml: xml ? xml.slice(0, 200000) : null,
    ...colunasDecodificadas(resultado.ok ? resultado.dados : null),
    sucesso: resultado.ok,
    codigo_retorno: resultado.ok ? null : (resultado.codigo ?? null),
    mensagem_retorno: resultado.ok ? null : (resultado.mensagem ?? null),
    erro: erroTransporte ? erroTransporte.slice(0, 500) : null,
    payload: resultado.ok ? resultado.dados : null,
  };

  let { error: insErr } = await admin.from("consultas_cpf").insert(linha);
  if (insErr) {
    console.error("[cpf] falha ao registrar consulta (tentativa 1):", insErr.message);
    ({ error: insErr } = await admin.from("consultas_cpf").insert(linha));
  }
  if (insErr) console.error("[cpf] falha ao registrar consulta (tentativa 2):", insErr.message);

  if (erroTransporte) throw new Error("Não foi possível consultar o CPF agora.");

  return resultado.ok
    ? { ok: true, cache: false, dados: resultado.dados, mensagem: null }
    : { ok: false, cache: false, dados: null, mensagem: resultado.mensagem };
}

export const consultarCpf = createServerFn({ method: "POST" })
  .inputValidator((data: ConsultarCpfPayload) => {
    if (!data?.caller_token) throw new Error("Sem token.");
    const cpf = onlyDigits(data?.cpf ?? "");
    if (cpf.length !== 11) throw new Error("CPF inválido.");
    return { ...data, cpf };
  })
  .handler(async ({ data }): Promise<ConsultaCpfResposta> => executarConsultaCpf(data));
