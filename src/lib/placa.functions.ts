// Consulta de placa (decodificador AR — ws.sisconsulta.com). A chamada
// roda no servidor porque a chave da API não pode ir ao bundle e porque
// cada consulta é cobrada: o cache e o registro em `consultas_placa`
// ficam do lado que o front não consegue burlar.
//
// Mesmo padrão de quiver.functions.ts: client service_role + validação
// manual do usuário pelo caller_token (a RLS de `consultas_placa` não se
// aplica ao service_role, que é quem grava).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { normalizePlaca } from "@/lib/masks";
import {
  parseDecodificadorXml,
  type PlacaDecodificada,
  type ResultadoConsultaPlaca,
} from "@/lib/placa-decodificador";

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

/** Janela do cache: consulta bem-sucedida da mesma placa é reaproveitada. */
const CACHE_DIAS = 30;
/** A API é lenta em placa nova (~10-20s); acima disso desiste. */
const TIMEOUT_MS = 45_000;

export type ConsultaPlacaResposta = {
  ok: boolean;
  /** true quando veio de `consultas_placa` em vez da API. */
  cache: boolean;
  dados: PlacaDecodificada | null;
  /** Mensagem do fornecedor quando a placa não foi identificada. */
  mensagem: string | null;
};

type ConsultarPlacaPayload = {
  placa: string;
  caller_token: string;
  cotacaoId?: string | null;
  /** Ignora o cache e força uma chamada nova à API. */
  forcar?: boolean;
};

/**
 * Colunas decodificadas de `consultas_placa`. Sempre com as mesmas chaves
 * (nulas na falha) para que sucesso e erro produzam um único formato de
 * linha — o insert do supabase-js rejeita união de shapes diferentes.
 */
function colunasDecodificadas(dados: PlacaDecodificada | null) {
  const primeira = dados?.fipe[0];
  return {
    marca: dados?.marca || null,
    modelo: dados?.modelo || null,
    versao: dados?.versao || null,
    ano_modelo: dados?.anoModelo || null,
    ano_fabricacao: dados?.anoFabricacao || null,
    chassi: dados?.chassi || null,
    combustivel: primeira?.combustivel || null,
    categoria: dados?.categoria || null,
    tipo_carroceria: dados?.tipoCarroceria || null,
    origem: dados?.origem || null,
    motor: dados?.motor || null,
    local_fabricacao: dados?.localFabricacao || null,
    fipe_codigo: primeira?.codigo || null,
    fipe_valor: primeira?.valor ?? null,
  };
}

export const consultarPlaca = createServerFn({ method: "POST" })
  .inputValidator((data: ConsultarPlacaPayload) => {
    if (!data?.caller_token) throw new Error("Sem token.");
    const placa = normalizePlaca(data?.placa);
    if (placa.length < 7) throw new Error("Placa inválida.");
    return { ...data, placa };
  })
  .handler(async ({ data }): Promise<ConsultaPlacaResposta> => {
    const admin = getAdmin();
    const { data: userData, error: userErr } = await admin.auth.getUser(data.caller_token);
    if (userErr || !userData.user) throw new Error("Não autenticado.");
    const userId = userData.user.id;
    const { placa } = data;

    // O cotacaoId vem do payload do cliente — sem checar posse, um
    // vendedor poderia forjar o UUID de uma cotação alheia (obtido por
    // enumeração/log/URL) e associá-la à própria consulta de placa,
    // quebrando a integridade do vínculo cotação<->consulta para
    // qualquer relatório futuro que junte as duas tabelas. Mesmo padrão
    // de assertDonoCotacao em quiver.functions.ts.
    let cotacaoId: string | null = null;
    if (data.cotacaoId) {
      const { data: cot, error: cotErr } = await admin
        .from("cotacoes")
        .select("id,responsavel_id")
        .eq("id", data.cotacaoId)
        .maybeSingle();
      if (cotErr) throw new Error(cotErr.message);
      if (cot && cot.responsavel_id === userId) cotacaoId = cot.id;
      // cotação inexistente ou de outro responsável: segue sem vínculo
      // em vez de falhar a consulta inteira por causa da auditoria.
    }

    // Empresa do usuário, só para escopar a leitura da tabela depois.
    const { data: perfil, error: perfilErr } = await admin
      .from("profiles")
      .select("empresa_id")
      .eq("id", userId)
      .maybeSingle();
    if (perfilErr) console.error("[placa] falha ao buscar empresa do usuário:", perfilErr.message);
    const empresaId = (perfil as { empresa_id?: string | null } | null)?.empresa_id ?? null;

    // ---- Cache: última consulta bem-sucedida da placa na janela ----
    if (!data.forcar) {
      const desde = new Date(Date.now() - CACHE_DIAS * 24 * 60 * 60 * 1000).toISOString();
      const { data: cached, error: cacheErr } = await admin
        .from("consultas_placa")
        .select("payload")
        .eq("placa", placa)
        .eq("sucesso", true)
        .gte("criado_em", desde)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Uma falha de leitura do cache não pode passar batido como "sem
      // cache" sem deixar rastro — o efeito (chamada paga desnecessária)
      // é o mesmo, mas o motivo precisa aparecer no log do servidor.
      if (cacheErr) console.error("[placa] falha ao ler cache:", cacheErr.message);
      const payload = (cached as { payload?: PlacaDecodificada | null } | null)?.payload;
      if (payload) return { ok: true, cache: true, dados: payload, mensagem: null };
    }

    // ---- Chamada à API ----
    const apiUrl = process.env.SELF_PLACA_API_URL;
    const cliente = process.env.SELF_PLACA_API_CLIENTE;
    const chave = process.env.SELF_PLACA_API_CHAVE;
    if (!apiUrl || !cliente || !chave) {
      throw new Error("Integração de placa não configurada no servidor.");
    }

    const url = new URL(apiUrl);
    url.searchParams.set("placa", placa);
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

    const resultado: ResultadoConsultaPlaca = erroTransporte
      ? { ok: false, codigo: null, mensagem: erroTransporte }
      : parseDecodificadorXml(xml);

    // ---- Registro (sempre, sucesso ou falha) ----
    const linha = {
      placa,
      cotacao_id: cotacaoId,
      empresa_id: empresaId,
      consultado_por: userId,
      // O XML cru fica limitado pelo check da coluna (200k).
      raw_xml: xml ? xml.slice(0, 200000) : null,
      ...colunasDecodificadas(resultado.ok ? resultado.dados : null),
      sucesso: resultado.ok,
      codigo_retorno: resultado.ok
        ? resultado.dados.codigoRetorno || null
        : (resultado.codigo ?? null),
      mensagem_retorno: resultado.ok
        ? resultado.dados.mensagemRetorno || null
        : (resultado.mensagem ?? null),
      erro: erroTransporte ? erroTransporte.slice(0, 500) : null,
      payload: resultado.ok ? resultado.dados : null,
    };

    // Gravar é auditoria: uma falha aqui não pode derrubar a consulta que
    // já foi paga e respondida. Mas se a linha nunca chegar a ser gravada,
    // o cache de 30 dias fica quebrado silenciosamente para essa placa —
    // uma tentativa extra cobre blips transitórios de conexão/timeout.
    let { error: insErr } = await admin.from("consultas_placa").insert(linha);
    if (insErr) {
      console.error("[placa] falha ao registrar consulta (tentativa 1):", insErr.message);
      ({ error: insErr } = await admin.from("consultas_placa").insert(linha));
    }
    if (insErr) console.error("[placa] falha ao registrar consulta (tentativa 2):", insErr.message);

    if (erroTransporte) throw new Error("Não foi possível consultar a placa agora.");

    return resultado.ok
      ? { ok: true, cache: false, dados: resultado.dados, mensagem: null }
      : { ok: false, cache: false, dados: null, mensagem: resultado.mensagem };
  });
