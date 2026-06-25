import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type CreateUserPayload = {
  email: string;
  password: string;
  nome: string;
  role: "matriz" | "franqueado" | "vendedor";
  empresa_id?: string | null;
  caller_token: string;
};

function getAdmin() {
  const url =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Configuração do servidor ausente.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function assertMatriz(admin: ReturnType<typeof getAdmin>, token: string) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Não autenticado.");
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "matriz")) {
    throw new Error("Permissão negada.");
  }
  return data.user.id;
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .inputValidator((data: CreateUserPayload) => {
    if (!data?.email || !data?.password || data.password.length < 6)
      throw new Error("E-mail e senha (mín. 6) são obrigatórios.");
    if (!data?.nome) throw new Error("Nome obrigatório.");
    if (!["matriz", "franqueado", "vendedor"].includes(data?.role))
      throw new Error("Perfil inválido.");
    if (!data?.caller_token) throw new Error("Sem token.");
    return data;
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();
    await assertMatriz(admin, data.caller_token);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) {
      const msg = error?.message ?? "Falha ao criar usuário.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered"))
        throw new Error("Este e-mail já está cadastrado.");
      throw new Error(msg);
    }

    const userId = created.user.id;

    await admin.from("profiles").upsert({
      id: userId,
      nome: data.nome,
      email: data.email,
      empresa_id: data.empresa_id ?? null,
      status: "aprovada",
    });

    await admin.from("user_roles").insert({ user_id: userId, role: data.role });

    return { ok: true, userId };
  });

type DeleteUserPayload = { user_id: string; caller_token: string };

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d: DeleteUserPayload) => {
    if (!d?.user_id || !d?.caller_token) throw new Error("Parâmetros inválidos.");
    return d;
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();
    await assertMatriz(admin, data.caller_token);
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
