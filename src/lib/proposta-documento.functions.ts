// Server functions do documento (PDF) da proposta — V12.4.7 fatia 2.
// Autenticação pelo caller_token (mesmo padrão de quiver.functions.ts).
// Mensagens ao front são fixas em PT-BR; nada do banco/robô vaza.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { mensagemErroRecaptura } from "@/lib/quiver-documento";

const BUCKET = "propostas-docs";
const URL_TTL_SEGUNDOS = 60;
const MSG_INDISPONIVEL = "Documento indisponível.";

type Payload = { propostaId: string; caller_token: string };

function validar(data: Payload): Payload {
  if (!data?.caller_token) throw new Error("Sem token.");
  if (!data?.propostaId || !/^[0-9a-f-]{36}$/i.test(data.propostaId)) {
    throw new Error("Proposta inválida.");
  }
  return data;
}

function supabaseUrl() {
  const url =
    import.meta.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  if (!url) throw new Error("Configuração do servidor ausente.");
  return url;
}

function getAdmin() {
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Configuração do servidor ausente.");
  return createClient(supabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente com a identidade do usuário: a RLS de proposta_documentos decide o acesso. */
function getUserClient(token: string) {
  const anon = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anon) throw new Error("Configuração do servidor ausente.");
  return createClient(supabaseUrl(), anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export const obterUrlDocumentoProposta = createServerFn({ method: "POST" })
  .inputValidator(validar)
  .handler(async ({ data }) => {
    const user = getUserClient(data.caller_token);
    const { data: u, error: uErr } = await user.auth.getUser(data.caller_token);
    if (uErr || !u.user) throw new Error("Não autenticado.");

    const { data: doc, error } = await user
      .from("proposta_documentos")
      .select("status, storage_path, nome")
      .eq("proposta_id", data.propostaId)
      .eq("tipo", "proposta_pdf")
      .maybeSingle();
    if (error || !doc || doc.status !== "ok" || !doc.storage_path) {
      throw new Error(MSG_INDISPONIVEL);
    }

    const { data: signed, error: sErr } = await getAdmin()
      .storage.from(BUCKET)
      .createSignedUrl(doc.storage_path, URL_TTL_SEGUNDOS);
    if (sErr || !signed?.signedUrl) throw new Error(MSG_INDISPONIVEL);
    return { url: signed.signedUrl, expiraEmSegundos: URL_TTL_SEGUNDOS };
  });

export const solicitarRecapturaDocumento = createServerFn({ method: "POST" })
  .inputValidator(validar)
  .handler(async ({ data }) => {
    const admin = getAdmin();
    const { data: u, error: uErr } = await admin.auth.getUser(data.caller_token);
    if (uErr || !u.user) throw new Error("Não autenticado.");

    // Valida dono/Matriz, transmitida e 1 por 5 min; marca como pendente.
    const { error: rpcErr } = await admin.rpc("solicitar_recaptura_documento_proposta", {
      p_proposta_id: data.propostaId,
      p_uid: u.user.id,
    });
    if (rpcErr) throw new Error(mensagemErroRecaptura(rpcErr));

    const { data: prop } = await admin
      .from("propostas")
      .select("cotacao_id")
      .eq("id", data.propostaId)
      .maybeSingle();

    // O robô busca no portal pelo número da cotação do portal, guardado na transmissão.
    const { data: tent, error: tentErr } = prop?.cotacao_id
      ? await admin
          .from("cotacao_transmissoes")
          .select("numero_cotacao_portal")
          .eq("cotacao_id", prop.cotacao_id)
          .eq("status", "transmitida")
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };
    if (tentErr) {
      console.error(
        `[recaptura-documento] leitura da transmissão falhou propostaId=${data.propostaId}`,
      );
    }
    const numeroCotacao = tent?.numero_cotacao_portal ?? null;

    const apiUrl = process.env.SELF_QUIVER_API_URL;
    const clientKey = process.env.SELF_QUIVER_TRANSMISSAO_CLIENT_KEY;
    const clientSecret = process.env.SELF_QUIVER_TRANSMISSAO_CLIENT_SECRET;
    const falha = "Não foi possível solicitar o documento agora. Tente novamente mais tarde.";
    if (!prop?.cotacao_id || !numeroCotacao || !apiUrl || !clientKey || !clientSecret) {
      console.error(
        `[recaptura-documento] configuração/dados ausentes propostaId=${data.propostaId}`,
      );
      throw new Error(falha);
    }

    // Contrato com o robô (fatia 3): POST /documento/capturar {cotacaoId, numeroCotacao} -> 202.
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/documento/capturar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-key": clientKey,
          "x-client-secret": clientSecret,
        },
        body: JSON.stringify({ cotacaoId: prop.cotacao_id, numeroCotacao }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      console.error(`[recaptura-documento] robô inacessível propostaId=${data.propostaId}`);
      throw new Error(falha);
    }
    if (res.status !== 202) {
      console.error(
        `[recaptura-documento] robô recusou propostaId=${data.propostaId} http=${res.status}`,
      );
      throw new Error(falha);
    }
    return { ok: true as const };
  });
