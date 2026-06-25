import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Payload = {
  email: string;
  password: string;
  tipo: "pj" | "pf";
  nome: string;
  documento: string;
  extras: Record<string, string>;
};

export const cadastrarFranquia = createServerFn({ method: "POST" })
  .inputValidator((data: Payload) => {
    if (!data?.email || !data?.password || data.password.length < 6) {
      throw new Error("E-mail e senha (mín. 6) são obrigatórios.");
    }
    if (!data.nome || !data.documento) {
      throw new Error("Nome e documento são obrigatórios.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const url =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SELF_SUPABASE_URL;
    const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Configuração do servidor ausente (URL/Service Role).");
    }

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Cria usuário já confirmado
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        nome: data.extras.socio_nome || data.nome,
        empresa_nome: data.nome,
        empresa_tipo: data.tipo,
        empresa_documento: data.documento,
      },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Falha ao criar usuário.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        throw new Error("Este e-mail já está cadastrado.");
      }
      throw new Error(msg);
    }

    // 2. Cadastra franquia via RPC (com service role bypassa RLS)
    const payload = {
      ...data.extras,
      nome: data.nome,
      documento: data.documento,
      email: data.email,
      tipo: data.tipo,
      _user_id: created.user.id,
    };

    const { error: rpcErr } = await admin.rpc("cadastrar_franquia_admin", {
      p: payload,
      p_user: created.user.id,
    });

    if (rpcErr) {
      // Fallback: tenta RPC antiga sem _user
      const { error: rpcErr2 } = await admin.rpc("cadastrar_franquia", { p: payload });
      if (rpcErr2 && !rpcErr2.message.toLowerCase().includes("já cadastrada")) {
        // Não bloqueia o fluxo — usuário foi criado; matriz pode classificar depois
        console.warn("[cadastrarFranquia] RPC falhou:", rpcErr.message, rpcErr2.message);
      }
    }

    return { ok: true, userId: created.user.id };
  });
