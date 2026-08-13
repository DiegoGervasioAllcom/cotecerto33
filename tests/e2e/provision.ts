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

const QUIVER_WEBHOOK_KEY =
  env.SELF_QUIVER_WEBHOOK_CLIENT_KEY || process.env.SELF_QUIVER_WEBHOOK_CLIENT_KEY || "";
const QUIVER_WEBHOOK_SECRET =
  env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET || process.env.SELF_QUIVER_WEBHOOK_CLIENT_SECRET || "";
if (!QUIVER_WEBHOOK_KEY || !QUIVER_WEBHOOK_SECRET) {
  throw new Error(
    "Defina SELF_QUIVER_WEBHOOK_CLIENT_KEY/SECRET (local: .env; CI: já exportado pelo job `e2e`) — " +
      "precisam bater com o que o dev server usado pelo webServer do Playwright está lendo.",
  );
}

/** Headers do webhook da Quiver prontos pra usar em `request.post("/api/webhooks/quiver", ...)`. */
export const QUIVER_WEBHOOK_HEADERS = {
  "content-type": "application/json",
  "x-client-key": QUIVER_WEBHOOK_KEY,
  "x-client-secret": QUIVER_WEBHOOK_SECRET,
};

type Db = SupabaseClient<Database>;

const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function criarLinkRecoveryE2E() {
  const email = `${uniq("recovery-e2e")}@teste.local`;
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email,
    password: "Inicial123",
    email_confirm: true,
  });
  if (userError || !user.user) throw new Error(`criar usuário recovery: ${userError?.message}`);
  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Acesso recovery E2E"),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
    })
    .select("id")
    .single();
  if (empresaError || !empresa) throw new Error(`criar empresa recovery: ${empresaError?.message}`);
  const { error: profileError } = await admin
    .from("profiles")
    .update({ empresa_id: empresa.id, status: "aprovada" })
    .eq("id", user.user.id);
  if (profileError) throw new Error(`aprovar profile recovery: ${profileError.message}`);
  const { data: outbox, error: outboxError } = await admin
    .from("email_outbox")
    .insert({
      empresa_id: empresa.id,
      tipo: "boas_vindas",
      destinatario: email,
      payload: {},
      criado_por: user.user.id,
    })
    .select("id")
    .single();
  if (outboxError || !outbox) throw new Error(`criar emissão recovery: ${outboxError?.message}`);
  const { data: emissao, error: emissaoError } = await admin
    .from("acesso_emissoes")
    .update({ status: "pendente", envio_confirmado_em: new Date().toISOString() })
    .eq("outbox_id", outbox.id)
    .select("id, numero")
    .single();
  if (emissaoError || !emissao)
    throw new Error(`confirmar emissão recovery: ${emissaoError?.message}`);
  const redirect = new globalThis.URL("http://localhost:8080/auth/criar-senha");
  redirect.searchParams.set("emissao", emissao.id);
  redirect.searchParams.set("versao", String(emissao.numero));
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: redirect.toString() },
  });
  if (linkError) throw new Error(`gerar recovery: ${linkError.message}`);
  return {
    email,
    userId: user.user.id,
    empresaId: empresa.id,
    emissaoId: emissao.id,
    actionLink: link.properties.action_link,
  };
}

export async function buscarEmissaoAcessoE2E(emissaoId: string) {
  const { data, error } = await admin
    .from("acesso_emissoes")
    .select("status, ativado_em")
    .eq("id", emissaoId)
    .single();
  if (error) throw new Error(`buscar emissão recovery: ${error.message}`);
  return data;
}

export async function limparUsuarioAuth(userId: string, empresaId?: string) {
  await admin.auth.admin.deleteUser(userId);
  if (empresaId) await admin.from("empresas").delete().eq("id", empresaId);
}

/** Desliga uma persona durante o E2E, simulando a ação administrativa real. */
export async function desligarUsuarioE2E(userId: string) {
  const { error } = await admin
    .from("profiles")
    .update({
      status: "suspensa",
      desligado_em: new Date().toISOString(),
      desligado_motivo: "Teste E2E de acesso desativado",
    })
    .eq("id", userId);
  if (error) throw new Error(`desligar usuário E2E: ${error.message}`);
}

/**
 * Monta o caso defensivo de um perfil com mais de um cargo. Embora o fluxo de
 * classificação mantenha uma única role, a UI dos filtros não pode tratar um
 * gestor que também tenha `vendedor` como vendedor elegível.
 */
export async function adicionarRoleE2E(userId: string, role: PersonaRole) {
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(`adicionar role E2E (${role}): ${error.message}`);
}

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

export type VendedorComTutorial = VendedorComLead & {
  cotacaoId: string;
  rascunhoId: string;
  propostaId: string;
};

/**
 * Cria uma empresa aprovada + vendedor aprovado nela, e um lead já distribuído
 * (`responsavel_id` = vendedor, `status_pipeline='novo'`) pronto para aparecer em
 * "Atender agora" (mesmo shape usado por `atender.tsx`: sem `distribuido_em` nulo,
 * sem `arquivado`, sem `ultimo_atendimento_em`).
 */
export async function criarVendedorComLead(
  opts: { statusPipeline?: "novo" | "qualificado" } = {},
): Promise<VendedorComLead> {
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
      status_pipeline: opts.statusPipeline ?? "novo",
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

/** Distribui outro lead para uma persona já autenticada, simulando chegada em tempo real. */
export async function distribuirLeadE2E(userId: string, empresaId: string): Promise<string> {
  const { data, error } = await admin
    .from("leads")
    .insert({
      nome: uniq("Cliente distribuído E2E"),
      contato: "(11) 98888-0000",
      origem: "teste-e2e",
      empresa_id: empresaId,
      responsavel_id: userId,
      status_pipeline: "novo",
      distribuido_em: new Date().toISOString(),
      dados: {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`distribuir lead E2E: ${error?.message}`);
  return data.id;
}

export async function limparLeadE2E(leadId: string): Promise<void> {
  await admin.from("leads").delete().eq("id", leadId);
}

/**
 * Acrescenta ao vendedor uma cotação calculada e uma proposta selecionada.
 * A fixture permite validar os destinos read-only do tutorial sem clicar em
 * ações de negócio para fabricar dados durante o próprio tour.
 */
export async function criarVendedorComTutorial(): Promise<VendedorComTutorial> {
  const vendedor = await criarVendedorComLead();
  const criadoEmCalculada = new Date(Date.now() - 60_000).toISOString();
  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      status: "calculada",
      step_atual: 5,
      criado_em: criadoEmCalculada,
      atualizado_em: criadoEmCalculada,
    })
    .select("id")
    .single();
  if (eCotacao || !cotacao) throw new Error(`criar cotação tutorial: ${eCotacao?.message}`);

  const cotacaoId = cotacao.id;
  const children = await Promise.all([
    admin.from("cotacao_segurado").insert({
      cotacao_id: cotacaoId,
      nome: "Cliente Tutorial",
      cpf_cnpj: "52998224725",
      email: "cliente.tutorial@teste.local",
    }),
    admin.from("cotacao_veiculo").insert({
      cotacao_id: cotacaoId,
      marca_nome: "FIAT",
      modelo_nome: "UNO",
      ano_modelo: "2024",
      placa: "TST1A23",
    }),
    admin.from("cotacao_coberturas").insert({ cotacao_id: cotacaoId }),
  ]);
  const childError = children.find((result) => result.error)?.error;
  if (childError) throw new Error(`criar detalhe da cotação tutorial: ${childError.message}`);

  const { error: ePremios } = await admin.from("cotacao_premios").insert([
    {
      cotacao_id: cotacaoId,
      seguradora: "Porto Seguro",
      cobertura: "Completa",
      premio: 2100,
      selecionada: true,
    },
    {
      cotacao_id: cotacaoId,
      seguradora: "Azul",
      cobertura: "Completa",
      premio: 2250,
      selecionada: false,
    },
    {
      cotacao_id: cotacaoId,
      seguradora: "HDI",
      cobertura: "Completa",
      premio: 2400,
      selecionada: false,
    },
  ]);
  if (ePremios) throw new Error(`criar prêmios tutorial: ${ePremios.message}`);

  const { data: proposta, error: eProposta } = await admin
    .from("propostas")
    .select("id")
    .eq("cotacao_id", cotacaoId)
    .single();
  if (eProposta || !proposta) throw new Error(`buscar proposta tutorial: ${eProposta?.message}`);

  const { data: rascunho, error: eRascunho } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      status: "rascunho",
      step_atual: 1,
      criado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eRascunho || !rascunho) throw new Error(`criar rascunho mais recente: ${eRascunho?.message}`);

  return { ...vendedor, cotacaoId, rascunhoId: rascunho.id, propostaId: proposta.id };
}

export async function limparVendedorComTutorial(v: VendedorComTutorial): Promise<void> {
  await admin.from("proposta_versoes").delete().eq("proposta_id", v.propostaId);
  await admin.from("propostas").delete().eq("id", v.propostaId);
  await admin.from("cotacoes").delete().eq("id", v.rascunhoId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoId);
  await limparVendedorComLead(v);
}

export type PersonaRole =
  | "master"
  | "coordenador"
  | "supervisor"
  | "franqueado"
  | "vendedor"
  | "interno";
export type PersonaModalidade = "individual" | "full";

export type Persona = {
  email: string;
  senha: string;
  userId: string;
  empresaId: string;
  nome: string;
  /** Fixtures auxiliares criadas para satisfazer invariantes de hierarquia. */
  dependencias?: Persona[];
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
  /**
   * Cargo do time interno (V11). Obrigatório na prática para matriz/coordenador/
   * supervisor/interno: o menu deles é recortado pelas áreas do cargo, e sem
   * cargo `fn_areas_do_usuario` devolve vazio — a nav fica sem nenhum item. Na
   * V11 quem define o cargo é a aprovação do cadastro.
   */
  cargo?: string;
  /**
   * `profiles.superior_id` — única fonte de hierarquia (rede master→franquia,
   * `empresas_visiveis()`/RLS, `solicitar_desligamento`, trava de exclusão C6:
   * "quantas franquias este Master tem"). `empresas.parent_id` foi removida —
   * nunca era escrita pela aprovação real (ver migration 20260804170000).
   */
  superiorId?: string;
  /**
   * Reusa uma empresa já existente em vez de criar uma nova — necessário pro
   * vendedor "dentro" de uma franquia: a trava de C6 (`excluir_cadastro_rede`)
   * olha `vendedor.empresa_id = franquia.empresa_id`, o mesmo registro, não uma
   * hierarquia de empresas separadas (mesmo padrão de
   * `criarPersonaComEmpresa` em tests/helpers/supabase.ts).
   */
  empresaId?: string;
}): Promise<Persona> {
  const { role, modalidade, cargo, empresaId: empresaExistente } = opts;
  let superiorId = opts.superiorId;
  const dependencias: Persona[] = [];
  // V11.5c: uma Full ativa nunca pode existir sem Master. Os specs antigos
  // criavam a Full isoladamente; a fixture passa a montar a árvore mínima
  // real sem enfraquecer a constraint do banco.
  if (role === "franqueado" && modalidade === "full" && !superiorId) {
    const master = await criarPersona({ role: "master" });
    superiorId = master.userId;
    dependencias.push(master);
  }
  const senha = "Teste@123!";
  const email = `${uniq(`${role}-e2e`)}@teste.local`;

  let modeloId: string | null = null;
  if (role === "franqueado" && !empresaExistente) {
    modeloId = await obterModeloId(modalidade ?? "individual");
  }

  let empresaId = empresaExistente;
  if (!empresaId) {
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
    empresaId = emp.id;
  }

  // Sem `user_metadata.nome`, `handle_new_user` cai no fallback pro e-mail
  // (coalesce(raw_user_meta_data->>'nome', email)) — e esse fallback vaza pra
  // qualquer tela que mostre "dono da empresa" por nome (ex.: a coluna Info
  // de uma franquia mostra "Master {nome}"), fazendo o e-mail do Master
  // aparecer também na linha da franquia — locators por e-mail ficam
  // ambíguos. Um nome próprio evita a colisão.
  const nome = uniq(`Pessoa ${role} E2E`);
  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (eUser || !userData.user) throw new Error(`criar usuário (${role}): ${eUser?.message}`);
  const userId = userData.user.id;

  const { error: eProfile } = await admin
    .from("profiles")
    .update({
      empresa_id: empresaId,
      status: "aprovada",
      ...(cargo ? { cargo_id: cargo } : {}),
      ...(superiorId ? { superior_id: superiorId } : {}),
    })
    .eq("id", userId);
  if (eProfile) throw new Error(`atualizar profile (${role}): ${eProfile.message}`);

  const { error: eRole } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (eRole) throw new Error(`inserir role (${role}): ${eRole.message}`);

  return { email, senha, userId, empresaId, nome, dependencias };
}

/** Remove os dados criados por `criarPersona` (best-effort; `db reset` também resolve). */
export async function limparPersona(p: Persona): Promise<void> {
  await admin.from("profile_areas").delete().eq("profile_id", p.userId);
  await admin.from("user_roles").delete().eq("user_id", p.userId);
  await admin.auth.admin.deleteUser(p.userId);
  await admin.from("empresas").delete().eq("id", p.empresaId);
  for (const dependencia of p.dependencias ?? []) {
    await limparPersona(dependencia);
  }
}

/** Define o override completo de áreas de uma persona para regressões de navegação. */
export async function definirAreasPersona(userId: string, areas: string[]): Promise<void> {
  const { error: limparError } = await admin
    .from("profile_areas")
    .delete()
    .eq("profile_id", userId);
  if (limparError) throw new Error(`limpar áreas da persona: ${limparError.message}`);
  if (areas.length === 0) return;

  const { error } = await admin
    .from("profile_areas")
    .insert(areas.map((area_chave) => ({ profile_id: userId, area_chave })));
  if (error) throw new Error(`definir áreas da persona: ${error.message}`);
}

/**
 * Igual a `limparPersona`, mas NÃO apaga a empresa — para quando `criarPersona`
 * reusou uma empresa existente (`opts.empresaId`, ex.: vendedor "dentro" de uma
 * franquia). Quem é dono da empresa (a franquia) limpa com `limparPersona`.
 */
export async function limparPersonaSemEmpresa(p: Pick<Persona, "userId">): Promise<void> {
  await admin.from("user_roles").delete().eq("user_id", p.userId);
  await admin.auth.admin.deleteUser(p.userId);
}

export type CotacaoQuiverFixture = {
  email: string;
  senha: string;
  userId: string;
  empresaId: string;
  leadId: string;
  leadNome: string;
  cotacaoId: string;
};

/**
 * Cria uma empresa aprovada + vendedor aprovado nela + uma cotação já
 * `enviada_quiver` (simula que `enviarCotacaoQuiver` já rodou com sucesso),
 * pronta pra receber o callback do webhook via `QUIVER_WEBHOOK_HEADERS`
 * (ver quiver-webhook.spec.ts). Não preenche o wizard pela UI — o objeto
 * deste teste é a reação da tela ao webhook, não o preenchimento em si.
 */
export async function criarCotacaoQuiverFixture(): Promise<CotacaoQuiverFixture> {
  const senha = "Teste@123!";
  const email = `${uniq("vend-quiver-e2e")}@teste.local`;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Franquia Quiver E2E"),
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

  const leadNome = uniq("Lead Quiver E2E");
  const { data: lead, error: eLead } = await admin
    .from("leads")
    .insert({
      empresa_id: emp.id,
      responsavel_id: userId,
      nome: leadNome,
      status_pipeline: "qualificando",
    })
    .select("id")
    .single();
  if (eLead || !lead) throw new Error(`criar lead: ${eLead?.message}`);

  const { data: cot, error: eCot } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: emp.id,
      responsavel_id: userId,
      lead_id: lead.id,
      status: "enviada_quiver",
    })
    .select("id")
    .single();
  if (eCot || !cot) throw new Error(`criar cotação: ${eCot?.message}`);

  return {
    email,
    senha,
    userId,
    empresaId: emp.id,
    leadId: lead.id,
    leadNome,
    cotacaoId: cot.id,
  };
}

/** Remove os dados criados por `criarCotacaoQuiverFixture` (best-effort; `db reset` também resolve). */
export async function limparCotacaoQuiverFixture(f: CotacaoQuiverFixture): Promise<void> {
  await admin.from("cotacoes").delete().eq("id", f.cotacaoId);
  await admin.from("leads").delete().eq("id", f.leadId);
  await admin.from("user_roles").delete().eq("user_id", f.userId);
  await admin.auth.admin.deleteUser(f.userId);
  await admin.from("empresas").delete().eq("id", f.empresaId);
}

// ===========================================================================
// Cadastro manual · exceção (V11 · C2/C3) e desligamento (C7)
// ===========================================================================

/** Id do profile da Matriz do seed — usado pra confirmar autoria (C1) do cadastro manual. */
export async function matrizProfileId(): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "desenvolvimento@suppercerto.com.br")
    .single();
  if (error || !data) throw new Error(`matriz do seed não encontrada: ${error?.message}`);
  return data.id;
}

/** Empresa criada por "Cadastro manual · exceção" — encontrada pelo nome único do form. */
export async function empresaPendentePorNome(nome: string) {
  const { data } = await admin
    .from("empresas")
    .select("id,nome,status,convite_id,criado_por,tipo,documento")
    .eq("nome", nome)
    .maybeSingle();
  return data;
}

/** Limpa o pendente + usuário criados por "Cadastro manual · exceção". */
export async function limparCadastroManual(empresaId: string): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (profile) await admin.auth.admin.deleteUser(profile.id);
  await admin.from("empresas").delete().eq("id", empresaId);
}

/** Sinal de desligamento (`profiles.desligado_em`) — pra confirmar que a aprovação executou de fato. */
export async function statusDesligamento(profileId: string) {
  const { data } = await admin
    .from("profiles")
    .select("desligado_em,status")
    .eq("id", profileId)
    .single();
  return data;
}

/** Localiza o vendedor criado pelo cadastro direto da Full. */
export async function profilePorEmail(email: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,empresa_id,superior_id,status,equipe,leads_dia,cpf,telefone,desligado_em")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`buscar profile por e-mail: ${error.message}`);
  return data;
}

// ===========================================================================
// SLA por empresa (V11.5.3/V11.5.2b) — helpers pra confirmar, via banco, que
// o SLA da Full é isolado do singleton `distribuicao_config` (id='default').
// ===========================================================================

/** Override de SLA da empresa em `sla_empresa_config` (null = nunca configurou). */
export async function lerSlaOverrideEmpresa(empresaId: string): Promise<number | null> {
  const { data } = await admin
    .from("sla_empresa_config")
    .select("sla_segundos")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data?.sla_segundos ?? null;
}

/** `distribuicao_config.sla_segundos` — o singleton global da Matriz (id='default'). */
export async function lerSlaSingletonMatriz(): Promise<number | null> {
  const { data } = await admin
    .from("distribuicao_config")
    .select("sla_segundos")
    .eq("id", "default")
    .maybeSingle();
  return data?.sla_segundos ?? null;
}

/**
 * `regua_performance_config` do bloco `'full'` — UMA LINHA COMPARTILHADA por
 * todas as Fulls (V11.5b.2), não uma por empresa.
 */
export async function lerReguaPerformanceFull() {
  const { data, error } = await admin
    .from("regua_performance_config")
    .select(
      "janela_dias,conv_atencao_pct,conv_travado_pct,dias_atencao,dias_travado,cancelamentos_limite,pausa_leads_ativa",
    )
    .eq("bloco", "full")
    .maybeSingle();
  if (error) throw new Error(`ler regua_performance_config (full): ${error.message}`);
  return data;
}

/** `full_comissao_complementos` de UMA empresa (V11.5b.3, 1 linha por Full). */
export async function lerComplementosFull(empresaId: string) {
  const { data, error } = await admin
    .from("full_comissao_complementos")
    .select("comissao_venda_pct,comissao_renovacao_pct,bonus_campanha,meta_padrao_equipe")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw new Error(`ler full_comissao_complementos: ${error.message}`);
  return data;
}

export type ReguaPerformanceFull = NonNullable<Awaited<ReturnType<typeof lerReguaPerformanceFull>>>;

/**
 * Restaura a linha COMPARTILHADA do bloco 'full' (V11.5b.2) — usar sempre no
 * `afterAll` de specs que salvam a régua da Full via UI, para não vazar
 * estado entre specs/execuções em paralelo (`admin` bypassa o gate por
 * identidade, então serve para desfazer sem precisar logar como a persona).
 */
export async function restaurarReguaPerformanceFull(original: ReguaPerformanceFull): Promise<void> {
  const { error } = await admin
    .from("regua_performance_config")
    .update(original)
    .eq("bloco", "full");
  if (error) throw new Error(`restaurar regua_performance_config (full): ${error.message}`);
}

// ===========================================================================
// Convite Supper (V11 · Frente 1)
// ===========================================================================

export type ConviteFixture = { id: string; codigo: string; token: string; nome: string };

/** Documento de 11 dígitos único — o schema valida só o tamanho. */
export function documentoUnico(): string {
  return uniqDoc();
}

/**
 * Emite um convite direto pelo banco, para os casos em que o teste não precisa
 * passar pela tela (expirado, já usado).
 */
export async function criarConviteInterno(opts?: {
  nome?: string;
  cargoId?: string;
  expiraEm?: Date;
  usado?: boolean;
}): Promise<ConviteFixture> {
  const nome = opts?.nome ?? uniq("Convidado E2E");
  const { data: matriz, error: eMatriz } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "desenvolvimento@suppercerto.com.br")
    .single();
  if (eMatriz || !matriz) throw new Error(`matriz do seed não encontrada: ${eMatriz?.message}`);

  const { data: codigo, error: eCod } = await admin.rpc("fn_convite_codigo");
  if (eCod) throw new Error(`fn_convite_codigo: ${eCod.message}`);

  const token = `e2e-${crypto.randomUUID()}-${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 48);

  const { data, error } = await admin
    .from("convites")
    .insert({
      codigo: codigo as unknown as string,
      token,
      nome,
      escopo: "interno",
      trilha: "interno",
      cargo_id: opts?.cargoId ?? "sup_operacional",
      vinc_tipo: "matriz",
      expira_em: (opts?.expiraEm ?? new Date(Date.now() + 7 * 86_400_000)).toISOString(),
      usado_em: opts?.usado ? new Date().toISOString() : null,
      criado_por: matriz.id,
    })
    .select("id,codigo,token,nome")
    .single();
  if (error || !data) throw new Error(`criar convite: ${error?.message}`);
  return data as ConviteFixture;
}

/** Empresa (pedido pendente) ligada a um convite, com a classificação por join. */
export async function pedidoDoConvite(conviteId: string) {
  const { data } = await admin
    .from("empresas")
    .select("id,nome,tipo,status,convite_id")
    .eq("convite_id", conviteId)
    .maybeSingle();
  return data;
}

/** Limpa convite, pedido e usuário criados por um cenário de convite. */
export async function limparConvite(conviteId: string): Promise<void> {
  const { data: conv } = await admin
    .from("convites")
    .select("usado_por")
    .eq("id", conviteId)
    .maybeSingle();
  const { data: emp } = await admin
    .from("empresas")
    .select("id")
    .eq("convite_id", conviteId)
    .maybeSingle();

  if (conv?.usado_por) {
    await admin.from("user_roles").delete().eq("user_id", conv.usado_por);
    await admin.auth.admin.deleteUser(conv.usado_por);
  }
  await admin.from("convites").delete().eq("id", conviteId);
  if (emp?.id) await admin.from("empresas").delete().eq("id", emp.id);
}

/**
 * Pedido pendente ligado ao convite, buscado pelo código humano (SC-XXXXXX) que
 * a tela mostra. É a asserção central do C9: o pedido não é uma linha solta, ele
 * aponta para o convite que o originou.
 */
export async function pedidoDoConvitePorCodigo(codigo: string) {
  const { data: conv } = await admin
    .from("convites")
    .select("id,usado_em,cargo_id,trilha")
    .eq("codigo", codigo)
    .maybeSingle();
  if (!conv) return null;
  const { data: emp } = await admin
    .from("empresas")
    .select("id,nome,tipo,status,convite_id")
    .eq("convite_id", conv.id)
    .maybeSingle();
  return { convite: conv, pedido: emp };
}
