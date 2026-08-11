import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { renderEmailTemplate, type EmailTemplate } from "./email-templates";
import {
  ACCESS_EMAIL_FROM as FROM,
  ACCESS_EMAIL_REPLY_TO as REPLY_TO,
} from "./email-delivery-config";

type DispatchPayload = { outbox_id: string; caller_token: string };
type WelcomePayload = { empresa_id: string; caller_token: string };
type ClaimedEmail = {
  id: string;
  tipo: EmailTemplate["tipo"];
  destinatario: string;
  payload: Omit<EmailTemplate, "tipo">;
  lease_token: string;
};
type DispatchResult = "enviado" | "falha_explicita" | "incerto";
type AccessLinkContract = { emissao_id: string; versao: number };

function normalizeAppUrl(value: string | undefined) {
  const appUrl = value?.trim().replace(/\/$/, "");
  if (!appUrl || !/^https?:\/\//.test(appUrl)) {
    throw new Error("SELF_APP_URL não está configurada com uma URL válida.");
  }
  return appUrl;
}

function config() {
  const url = process.env.SELF_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
  const anonKey = process.env.SELF_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.SELF_RESEND_API_KEY;
  if (!url || !anonKey || !serviceKey || !resendKey) {
    throw new Error("Configuração de e-mail do servidor ausente.");
  }
  return {
    url,
    anonKey,
    serviceKey,
    resendKey,
    appUrl: normalizeAppUrl(process.env.SELF_APP_URL),
  };
}

export const enqueueWelcomeEmail = createServerFn({ method: "POST" })
  .inputValidator((data: WelcomePayload) => {
    if (!data?.empresa_id || !data?.caller_token) {
      throw new Error("Parâmetros de boas-vindas inválidos.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { url, anonKey } = config();
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.caller_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: outboxId, error } = await caller.rpc("enfileirar_boas_vindas", {
      p_empresa_id: data.empresa_id,
    });
    if (error || !outboxId) throw new Error(error?.message ?? "Falha ao preparar boas-vindas.");
    return { outbox_id: String(outboxId) };
  });

export const dispatchAccessEmail = createServerFn({ method: "POST" })
  .inputValidator((data: DispatchPayload) => {
    if (!data?.outbox_id || !data?.caller_token) throw new Error("Parâmetros de envio inválidos.");
    return data;
  })
  .handler(async ({ data }) => {
    const { url, anonKey, serviceKey, resendKey, appUrl } = config();
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.caller_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claimed, error: claimError } = await caller.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: data.outbox_id,
    });
    if (claimError) throw new Error(claimError.message);

    const email = claimed as ClaimedEmail;
    let providerId: string | null = null;
    let sendError: string | null = null;
    let dispatchResult: DispatchResult = "falha_explicita";
    try {
      let template = { tipo: email.tipo, ...email.payload } as EmailTemplate;
      if (template.tipo === "boas_vindas") {
        const { data: rawContract, error: contractError } = await admin.rpc(
          "obter_contrato_link_acesso",
          { p_outbox_id: email.id, p_lease_token: email.lease_token },
        );
        if (contractError || !rawContract) {
          throw new Error(contractError?.message ?? "Emissão de acesso indisponível.");
        }
        const contract = rawContract as AccessLinkContract;
        if (!contract.emissao_id || !Number.isInteger(contract.versao) || contract.versao <= 0) {
          throw new Error("Contrato de emissão de acesso inválido.");
        }
        const redirectUrl = new URL(`${appUrl}/auth/criar-senha`);
        redirectUrl.searchParams.set("emissao", contract.emissao_id);
        redirectUrl.searchParams.set("versao", String(contract.versao));
        const { data: recovery, error: recoveryError } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: email.destinatario,
          // O GoTrue substitui o recovery anterior para este usuário. A versão
          // abaixo também cerca a ativação no banco caso um callback antigo chegue.
          options: { redirectTo: redirectUrl.toString() },
        });
        if (recoveryError) {
          throw new Error(`Falha ao gerar link de senha: ${recoveryError.message}`);
        }
        template = { ...template, link: recovery.properties.action_link };
      }
      const rendered = renderEmailTemplate(template);
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            // A lease é a identidade desta tentativa. Tentativas com resultado
            // ambíguo nunca recebem outro lease nem outro link.
            "Idempotency-Key": `${email.id}:${email.lease_token}`,
          },
          body: JSON.stringify({
            from: FROM,
            reply_to: REPLY_TO,
            to: [email.destinatario],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          }),
        });
      } catch (error) {
        dispatchResult = "incerto";
        throw error;
      }

      let result: { id?: string; message?: string } = {};
      try {
        result = (await response.json()) as typeof result;
      } catch {
        // A classificação abaixo usa o status mesmo quando o corpo é inválido.
      }
      if (response.ok && result.id) {
        providerId = result.id;
        dispatchResult = "enviado";
      } else {
        dispatchResult =
          response.status >= 400 && response.status < 500 ? "falha_explicita" : "incerto";
        throw new Error(result.message || `Resend HTTP ${response.status}`);
      }
    } catch (error) {
      sendError = error instanceof Error ? error.message : "Falha desconhecida no envio.";
    }
    const { error: finishError } = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: email.id,
      p_lease_token: email.lease_token,
      p_resultado: dispatchResult,
      p_provider_id: providerId,
      p_erro: sendError,
    });
    if (finishError) throw new Error(`Falha ao registrar envio: ${finishError.message}`);
    if (sendError) throw new Error(sendError);
    return { ok: true, provider_id: providerId };
  });
