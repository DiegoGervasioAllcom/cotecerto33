import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { renderEmailTemplate } from "@/lib/email-templates";
import { ACCESS_EMAIL_FROM, ACCESS_EMAIL_REPLY_TO } from "@/lib/email-delivery-config";

const cadastroDiretoFullSchema = z.object({
  caller_token: z.string().min(1),
  nome: z.string().trim().min(2).max(150),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  cpf: z.string().transform((value, context) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "CPF inválido." });
    }
    return digits;
  }),
  celular: z.string().transform((value, context) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Celular inválido." });
    }
    return digits;
  }),
  leads_dia: z.number().int().min(0).max(1000).optional(),
  produtos: z.array(z.string().min(1)).max(100),
  canais: z.array(z.string().uuid()).max(100),
  comissao_venda_pct: z.number().min(0).max(100).optional(),
  comissao_renovacao_pct: z.number().min(0).max(100).optional(),
});

type CadastroDiretoFullPayload = z.input<typeof cadastroDiretoFullSchema>;

export const cadastrarVendedorFullDireto = createServerFn({ method: "POST" })
  .inputValidator((data: CadastroDiretoFullPayload) => cadastroDiretoFullSchema.parse(data))
  .handler(async ({ data }) => {
    const url = process.env.SELF_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
    const anonKey = process.env.SELF_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.SELF_RESEND_API_KEY;
    const appUrl = process.env.SELF_APP_URL?.trim().replace(/\/$/, "");
    if (!url || !anonKey || !serviceKey) {
      throw new Error("Configuração do servidor ausente.");
    }

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.caller_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) throw new Error("Sessão inválida.");
    const criadoPor = authData.user.id;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: full, error: fullError } = await admin
      .from("profiles")
      .select("id,nome,status,desligado_em,empresa_id,superior_id")
      .eq("id", criadoPor)
      .maybeSingle();
    if (
      fullError ||
      !full ||
      full.status !== "aprovada" ||
      full.desligado_em ||
      !full.empresa_id ||
      !full.superior_id
    ) {
      throw new Error("Somente Franquia Full ativa e vinculada a Master pode cadastrar vendedor.");
    }

    const [{ data: role }, { data: empresa, error: empresaError }, { data: master }] =
      await Promise.all([
        admin
          .from("user_roles")
          .select("role")
          .eq("user_id", criadoPor)
          .eq("role", "franqueado")
          .maybeSingle(),
        admin.from("empresas").select("id,modelo_id").eq("id", full.empresa_id).maybeSingle(),
        admin
          .from("profiles")
          .select("id,status,desligado_em")
          .eq("id", full.superior_id)
          .maybeSingle(),
      ]);
    if (
      !role ||
      empresaError ||
      !empresa?.modelo_id ||
      !master ||
      master.status !== "aprovada" ||
      master.desligado_em
    ) {
      throw new Error("Somente Franquia Full ativa e vinculada a Master pode cadastrar vendedor.");
    }

    const [{ data: modelo, error: modeloError }, { data: masterRole }] = await Promise.all([
      admin.from("modelos_franquia").select("modalidade").eq("id", empresa.modelo_id).maybeSingle(),
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", full.superior_id)
        .eq("role", "master")
        .maybeSingle(),
    ]);
    if (modeloError || modelo?.modalidade !== "full" || !masterRole) {
      throw new Error("Somente Franquia Full ativa e vinculada a Master pode cadastrar vendedor.");
    }

    const senhaDescartavel = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: data.email,
      password: senhaDescartavel,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createError || !created.user) {
      const message = createError?.message ?? "Falha ao criar usuário.";
      if (/already|registered/i.test(message)) throw new Error("Este e-mail já está cadastrado.");
      throw new Error(message);
    }

    const userId = created.user.id;
    const { error: rpcError } = await admin.rpc("fn_cadastrar_vendedor_full", {
      p_user_id: userId,
      p_criado_por: criadoPor,
      p_nome: data.nome,
      p_email: data.email,
      p_cpf: data.cpf,
      p_celular: data.celular,
      p_leads_dia: data.leads_dia,
      p_produtos: data.produtos,
      p_canais: data.canais,
      p_comissao_venda_pct: data.comissao_venda_pct,
      p_comissao_renovacao_pct: data.comissao_renovacao_pct,
    });
    if (rpcError) {
      await admin.auth.admin.deleteUser(userId);
      throw new Error(rpcError.message);
    }

    if (!resendKey || !appUrl) {
      return {
        user_id: userId,
        email_enviado: false,
        email_erro:
          "Configuração de e-mail ausente no servidor (SELF_RESEND_API_KEY/SELF_APP_URL).",
      };
    }

    try {
      const { data: recovery, error: recoveryError } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: `${appUrl}/auth/criar-senha` },
      });
      if (recoveryError) throw recoveryError;
      const rendered = renderEmailTemplate({
        tipo: "boas_vindas",
        variante: "vendedor",
        nome: data.nome,
        origem: "Full",
        responsavel: full.nome,
        link: recovery.properties.action_link,
      });
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `cadastro-direto-full:${userId}`,
        },
        body: JSON.stringify({
          from: ACCESS_EMAIL_FROM,
          reply_to: ACCESS_EMAIL_REPLY_TO,
          to: [data.email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });
      if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
      return { user_id: userId, email_enviado: true };
    } catch (error) {
      return {
        user_id: userId,
        email_enviado: false,
        email_erro: error instanceof Error ? error.message : "Falha ao enviar boas-vindas.",
      };
    }
  });
