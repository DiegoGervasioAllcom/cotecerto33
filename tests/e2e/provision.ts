/**
 * Provisionamento de fixtures para os specs E2E, via client admin (service_role).
 *
 * De onde vêm as envs:
 * - Local: `.env` na raiz (não versionado). `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
 *   e a chave service_role em `SELF_SUPABASE_SERVICE_ROLE_KEY` (saída de `supabase start`).
 *   Carregamos com `loadEnv` do vite (mesmo padrão de `tests/helpers/global-setup.ts` e
 *   `vitest.config.ts`) para não precisar de uma dependência extra (dotenv) só pra isso.
 * - CI (job `e2e` em `.github/workflows/ci.yml`): o step "Exportar env do Supabase local"
 *   já faz `supabase status -o env` com `--override-name auth.service_role_key=SELF_SUPABASE_SERVICE_ROLE_KEY`
 *   e escreve em `$GITHUB_ENV`, então a var chega pronta em `process.env` — nenhuma
 *   mudança no workflow foi necessária.
 *
 * NUNCA usar este client em asserts de RLS (ele bypassa as policies). Aqui ele serve
 * só para montar o cenário (usuário + empresa + role + lead) fora do browser, espelhando
 * os helpers de `tests/helpers/supabase.ts` usados pelos testes de banco.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import type { Database } from "@/integrations/supabase/database.types";

const env = loadEnv("", process.cwd(), "");
const URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE =
  env.SELF_SUPABASE_SERVICE_ROLE_KEY || process.env.SELF_SUPABASE_SERVICE_ROLE_KEY || "";

if (!SERVICE) {
  throw new Error(
    "Defina SELF_SUPABASE_SERVICE_ROLE_KEY (local: .env; CI: já exportado pelo job `e2e`).",
  );
}

type Db = SupabaseClient<Database>;

const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
}
function uniqDoc(): string {
  // 11 dígitos únicos mesmo sob criação concorrente (ex.: `Promise.all` de
  // várias personas no mesmo milissegundo) — timestamp + sufixo aleatório.
  return `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-11).padStart(11, "9");
}

export type VendedorComLead = {
  email: string;
  senha: string;
  userId: string;
  empresaId: string;
  leadId: string;
};

/**
 * Cria uma empresa aprovada + vendedor aprovado nela, e um lead já distribuído
 * (`responsavel_id` = vendedor, `status_pipeline='novo'`) pronto para aparecer em
 * "Atender agora" (mesmo shape usado por `atender.tsx`: sem `distribuido_em` nulo,
 * sem `arquivado`, sem `ultimo_atendimento_em`).
 */
export async function criarVendedorComLead(): Promise<VendedorComLead> {
  const senha = "Teste@123!";
  const email = `${uniq("vend-e2e")}@teste.local`;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Franquia E2E"),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
    })
    .select("id")
    .single();
  if (eEmp || !emp) throw new Error(`criar empresa: ${eEmp?.message}`);

  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (eUser || !userData.user) throw new Error(`criar usuário: ${eUser?.message}`);
  const userId = userData.user.id;

  const { error: eProfile } = await admin
    .from("profiles")
    .update({ empresa_id: emp.id, status: "aprovada" })
    .eq("id", userId);
  if (eProfile) throw new Error(`atualizar profile: ${eProfile.message}`);

  const { error: eRole } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "vendedor" });
  if (eRole) throw new Error(`inserir role: ${eRole.message}`);

  const { data: lead, error: eLead } = await admin
    .from("leads")
    .insert({
      nome: uniq("Cliente E2E"),
      contato: "(11) 99999-0000",
      origem: "teste-e2e",
      empresa_id: emp.id,
      responsavel_id: userId,
      status_pipeline: "novo",
      distribuido_em: new Date().toISOString(),
      dados: {
        cliente: { cpf_cnpj: "12345678901", email: "cliente.e2e@teste.local" },
        veiculo: { marca_nome: "FIAT", modelo_nome: "UNO", ano_modelo: "2020" },
      },
    })
    .select("id")
    .single();
  if (eLead || !lead) throw new Error(`criar lead: ${eLead?.message}`);

  return { email, senha, userId, empresaId: emp.id, leadId: lead.id };
}

/** Remove os dados criados por `criarVendedorComLead` (best-effort; `db reset` também resolve). */
export async function limparVendedorComLead(v: VendedorComLead): Promise<void> {
  await admin.from("leads").delete().eq("id", v.leadId);
  await admin.from("user_roles").delete().eq("user_id", v.userId);
  await admin.auth.admin.deleteUser(v.userId);
  await admin.from("empresas").delete().eq("id", v.empresaId);
}

export type PersonaRole = "master" | "supervisor" | "franqueado";
export type PersonaModalidade = "individual" | "full";

export type Persona = {
  email: string;
  senha: string;
  userId: string;
  empresaId: string;
};

/**
 * Busca (ou cria, se não existir nenhum) um `modelos_franquia` com a
 * `modalidade` pedida. O seed do G2.1 já traz um modelo Individual pronto;
 * para Full, criamos um modelo dedicado caso não exista nenhum ainda —
 * assim o `useGroupScope` (que lê `modelos_franquia.modalidade` via
 * `empresa.modelo_id`) resolve `isFranqFull=true` para essa empresa.
 */
async function obterModeloId(modalidade: PersonaModalidade): Promise<string> {
  const { data: existente } = await admin
    .from("modelos_franquia")
    .select("id")
    .eq("modalidade", modalidade)
    .limit(1)
    .maybeSingle();
  if (existente) return existente.id;

  const { data: criado, error } = await admin
    .from("modelos_franquia")
    .insert({
      nome: uniq(`Franqueada ${modalidade} E2E`),
      tipo: "franqueada",
      modalidade,
      perc_comissao_padrao: modalidade === "full" ? 25 : 15,
    })
    .select("id")
    .single();
  if (error || !criado) throw new Error(`criar modelo_franquia (${modalidade}): ${error?.message}`);
  return criado.id;
}

/**
 * Cria uma persona (usuário + empresa aprovada + role) para os specs de
 * navegação (T3). Para `franqueado`, vincula a empresa a um `modelos_franquia`
 * da modalidade pedida (Individual por padrão, Full se especificado) — é essa
 * coluna que decide qual das 3 experiências de nav (`venLike`/`grpLike`) o
 * `useGroupScope`/`AppShell` mostra.
 */
export async function criarPersona(opts: {
  role: PersonaRole;
  modalidade?: PersonaModalidade;
}): Promise<Persona> {
  const { role, modalidade } = opts;
  const senha = "Teste@123!";
  const email = `${uniq(`${role}-e2e`)}@teste.local`;

  let modeloId: string | null = null;
  if (role === "franqueado") {
    modeloId = await obterModeloId(modalidade ?? "individual");
  }

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq(`Empresa ${role} E2E`),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
      ...(modeloId ? { modelo_id: modeloId } : {}),
    })
    .select("id")
    .single();
  if (eEmp || !emp) throw new Error(`criar empresa (${role}): ${eEmp?.message}`);

  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (eUser || !userData.user) throw new Error(`criar usuário (${role}): ${eUser?.message}`);
  const userId = userData.user.id;

  const { error: eProfile } = await admin
    .from("profiles")
    .update({ empresa_id: emp.id, status: "aprovada" })
    .eq("id", userId);
  if (eProfile) throw new Error(`atualizar profile (${role}): ${eProfile.message}`);

  const { error: eRole } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (eRole) throw new Error(`inserir role (${role}): ${eRole.message}`);

  return { email, senha, userId, empresaId: emp.id };
}

/** Remove os dados criados por `criarPersona` (best-effort; `db reset` também resolve). */
export async function limparPersona(p: Persona): Promise<void> {
  await admin.from("user_roles").delete().eq("user_id", p.userId);
  await admin.auth.admin.deleteUser(p.userId);
  await admin.from("empresas").delete().eq("id", p.empresaId);
}
