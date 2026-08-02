import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { cadastroManualSchema } from "@/lib/schemas/cadastro.schema";

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
      import.meta.env?.VITE_SUPABASE_URL ||
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

// V11 · C2/C3 (Frente 3) — cadastro manual · exceção. Diferente de
// `cadastrarFranquia`: quem cria é a Matriz (não a própria pessoa), então não há
// senha escolhida por ninguém aqui — nasce descartável, e o e-mail de boas-vindas
// (PR #104) entrega o link de "criar senha" depois da aprovação.
type CadastroManualPayload = {
  caller_token: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  email: string;
  celular?: string;
  cidade?: string;
  uf?: string;
};

export const criarPendenteManual = createServerFn({ method: "POST" })
  .inputValidator((data: CadastroManualPayload) => {
    if (!data?.caller_token) throw new Error("Sessão inválida.");
    const parsed = cadastroManualSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }
    return { ...parsed.data, caller_token: data.caller_token };
  })
  .handler(async ({ data }) => {
    const url =
      import.meta.env?.VITE_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SELF_SUPABASE_URL;
    const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) {
      throw new Error("Configuração do servidor ausente.");
    }

    // A checagem de permissão roda como o próprio chamador — nunca como
    // service_role — para valer a mesma regra que a RPC confere de novo depois.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${data.caller_token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: quem, error: whoError } = await caller.auth.getUser();
    if (whoError || !quem?.user) throw new Error("Sessão inválida.");
    const criadoPor = quem.user.id;

    const { data: pode, error: permError } = await caller.rpc("fn_pode_criar_pendente_manual", {
      _uid: criadoPor,
    });
    if (permError) throw new Error(permError.message);
    if (!pode) throw new Error("Seu acesso não permite criar cadastro manual.");

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const senhaDescartavel = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: senhaDescartavel,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "Falha ao criar usuário.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        throw new Error("Este e-mail já está cadastrado.");
      }
      throw new Error(msg);
    }

    const { data: empresaId, error: rpcError } = await admin.rpc("criar_pendente_manual", {
      p_user_id: created.user.id,
      p_criado_por: criadoPor,
      p_nome: data.nome,
      p_tipo: data.tipo,
      p_documento: data.documento,
      p_email: data.email,
      p_celular: data.celular || undefined,
      p_cidade: data.cidade || undefined,
      p_uf: data.uf || undefined,
    });
    if (rpcError || !empresaId) {
      // Evita usuário órfão (auth.users sem nenhum pendente associado).
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(rpcError?.message ?? "Falha ao criar o cadastro.");
    }

    return { empresaId: empresaId as string };
  });
