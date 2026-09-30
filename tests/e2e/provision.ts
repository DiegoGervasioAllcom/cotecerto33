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
  leadNome: string;
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

  const leadNome = uniq("Cliente E2E");
  const { data: lead, error: eLead } = await admin
    .from("leads")
    .insert({
      nome: leadNome,
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

  return { email, senha, userId, empresaId: emp.id, leadId: lead.id, leadNome };
}

/** Remove os dados criados por `criarVendedorComLead` (best-effort; `db reset` também resolve). */
export async function limparVendedorComLead(v: VendedorComLead): Promise<void> {
  await admin.from("leads").delete().eq("id", v.leadId);
  await admin.from("user_roles").delete().eq("user_id", v.userId);
  await admin.auth.admin.deleteUser(v.userId);
  await admin.from("empresas").delete().eq("id", v.empresaId);
}

export type VendedorComPropostasEmissao = VendedorComLead & {
  cotacaoTransmitidaId: string;
  propostaTransmitidaId: string;
  cotacaoFalhaId: string;
  propostaFalhaId: string;
};

/**
 * Vendedor com duas propostas já transmitidas (Frente 3, V12.1.25 parcial):
 * uma `transmissao_status='transmitida'` sem nenhum dado pós-transmissão
 * ainda (protocolo/apólice — a integração que os preenche não está ligada),
 * e uma `'falha'` (pendência real da seguradora, mesmo shape de
 * `criarVendedorComAgendaCompleta`). Usado por `emissao-transmitida.spec.ts`
 * pra confirmar que `/venda/emissao` separa "Aguardando a seguradora"
 * (as duas) de "Concluídas" (vazia — só `emitida` cai lá, e nada aqui simula
 * esse status, V12.1.28).
 */
export async function criarVendedorComPropostasEmissao(): Promise<VendedorComPropostasEmissao> {
  const vendedor = await criarVendedorComLead();

  const { data: cotacaoTransmitida, error: eCotTransmitida } = await admin
    .from("cotacoes")
    .insert({ empresa_id: vendedor.empresaId, responsavel_id: vendedor.userId, status: "proposta" })
    .select("id")
    .single();
  if (eCotTransmitida || !cotacaoTransmitida)
    throw new Error(`criar cotação transmitida E2E: ${eCotTransmitida?.message}`);
  const { error: eSeguradoTransmitida } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacaoTransmitida.id, nome: "Cliente Transmitida Emissão E2E" });
  if (eSeguradoTransmitida)
    throw new Error(`criar segurado da cotação transmitida E2E: ${eSeguradoTransmitida.message}`);

  const { data: propostaTransmitida, error: ePropostaTransmitida } = await admin
    .from("propostas")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      cotacao_id: cotacaoTransmitida.id,
      numero: "PRP-E2E-EMISSAO-TRANSMITIDA",
      seguradora: "Seguradora Emissão E2E",
      premio: 2500,
      transmissao_status: "transmitida",
      transmitida_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (ePropostaTransmitida || !propostaTransmitida)
    throw new Error(`criar proposta transmitida E2E: ${ePropostaTransmitida?.message}`);

  const { data: cotacaoFalha, error: eCotacaoFalha } = await admin
    .from("cotacoes")
    .insert({ empresa_id: vendedor.empresaId, responsavel_id: vendedor.userId, status: "proposta" })
    .select("id")
    .single();
  if (eCotacaoFalha || !cotacaoFalha)
    throw new Error(`criar cotação da proposta em falha E2E: ${eCotacaoFalha?.message}`);
  const { error: eSeguradoFalha } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacaoFalha.id, nome: "Cliente Falha Emissão E2E" });
  if (eSeguradoFalha)
    throw new Error(`criar segurado da cotação em falha E2E: ${eSeguradoFalha.message}`);

  const { data: propostaFalha, error: ePropostaFalha } = await admin
    .from("propostas")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      cotacao_id: cotacaoFalha.id,
      numero: "PRP-E2E-EMISSAO-FALHA",
      transmissao_status: "falha",
      transmissao_motivo: "documento_pendente",
      transmissao_mensagem: "Falta o CRLV do veículo E2E",
    })
    .select("id")
    .single();
  if (ePropostaFalha || !propostaFalha)
    throw new Error(`criar proposta em falha E2E: ${ePropostaFalha?.message}`);

  return {
    ...vendedor,
    cotacaoTransmitidaId: cotacaoTransmitida.id,
    propostaTransmitidaId: propostaTransmitida.id,
    cotacaoFalhaId: cotacaoFalha.id,
    propostaFalhaId: propostaFalha.id,
  };
}

/** Remove os dados criados por `criarVendedorComPropostasEmissao` (best-effort; `db reset` também resolve). */
export async function limparVendedorComPropostasEmissao(
  v: VendedorComPropostasEmissao,
): Promise<void> {
  await admin.from("propostas").delete().eq("id", v.propostaFalhaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoFalhaId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoFalhaId);
  await admin.from("propostas").delete().eq("id", v.propostaTransmitidaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoTransmitidaId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoTransmitidaId);
  await limparVendedorComLead(v);
}

/**
 * Colega na MESMA empresa de `empresaId`, com uma proposta transmitida
 * própria — usado pra confirmar que `/venda/emissao` é "minhas propostas"
 * (decisão do usuário): a RLS de `propostas` libera SELECT pra empresa
 * inteira (mesma regra já documentada em `criarColegaComAgendaCompleta`),
 * mas `fetchEmissaoRows` filtra por `.eq("responsavel_id", uid)` — a
 * proposta do colega NÃO aparece na lista do vendedor logado.
 */
export async function criarColegaComPropostaEmissao(empresaId: string): Promise<{
  userId: string;
  cotacaoId: string;
  propostaId: string;
}> {
  const senha = "Teste@123!";
  const email = `${uniq("colega-emissao-e2e")}@teste.local`;

  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (eUser || !userData.user)
    throw new Error(`criar usuário colega emissão E2E: ${eUser?.message}`);
  const userId = userData.user.id;

  const { error: eProfile } = await admin
    .from("profiles")
    .update({ empresa_id: empresaId, status: "aprovada" })
    .eq("id", userId);
  if (eProfile) throw new Error(`atualizar profile colega emissão E2E: ${eProfile.message}`);

  const { error: eRole } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "vendedor" });
  if (eRole) throw new Error(`inserir role colega emissão E2E: ${eRole.message}`);

  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: userId, status: "proposta" })
    .select("id")
    .single();
  if (eCotacao || !cotacao)
    throw new Error(`criar cotação do colega emissão E2E: ${eCotacao?.message}`);
  const { error: eSegurado } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacao.id, nome: "Cliente Colega Emissão E2E" });
  if (eSegurado) throw new Error(`criar segurado do colega emissão E2E: ${eSegurado.message}`);

  const { data: proposta, error: eProposta } = await admin
    .from("propostas")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      cotacao_id: cotacao.id,
      numero: "PRP-E2E-EMISSAO-COLEGA",
      transmissao_status: "transmitida",
      transmitida_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eProposta || !proposta)
    throw new Error(`criar proposta do colega emissão E2E: ${eProposta?.message}`);

  return { userId, cotacaoId: cotacao.id, propostaId: proposta.id };
}

/** Remove os dados criados por `criarColegaComPropostaEmissao` (best-effort; `db reset` também resolve). */
export async function limparColegaComPropostaEmissao(colega: {
  userId: string;
  cotacaoId: string;
  propostaId: string;
}): Promise<void> {
  await admin.from("propostas").delete().eq("id", colega.propostaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", colega.cotacaoId);
  await admin.from("cotacoes").delete().eq("id", colega.cotacaoId);
  await admin.from("user_roles").delete().eq("user_id", colega.userId);
  await admin.auth.admin.deleteUser(colega.userId);
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

export type VendedorComVariosLeads = VendedorComLead & { leadIds: string[] };

/**
 * Cria um vendedor com `total` leads, todos no bucket "Lead novo" (mesmo
 * shape de `distribuirLeadE2E`: `status_pipeline='novo'`, sem cotação) —
 * usado pelos testes de paginação server-side do Kanban (Pipeline V12,
 * T10), que precisam passar da carga inicial (5) pra exercitar "carregar
 * mais"/scroll infinito de verdade. Reaproveita `criarVendedorComLead` (1º
 * lead) + `distribuirLeadE2E` (os demais) em vez de duplicar o insert.
 */
export async function criarVendedorComVariosLeads(total: number): Promise<VendedorComVariosLeads> {
  const base = await criarVendedorComLead();
  const leadIds = [base.leadId];
  for (let i = 1; i < total; i += 1) {
    leadIds.push(await distribuirLeadE2E(base.userId, base.empresaId));
  }
  return { ...base, leadIds };
}

/** Remove os dados criados por `criarVendedorComVariosLeads` (best-effort; `db reset` também resolve). */
export async function limparVendedorComVariosLeads(v: VendedorComVariosLeads): Promise<void> {
  await admin.from("leads").delete().in("id", v.leadIds);
  await admin.from("user_roles").delete().eq("user_id", v.userId);
  await admin.auth.admin.deleteUser(v.userId);
  await admin.from("empresas").delete().eq("id", v.empresaId);
}

export type VendedorComLeadEmCotacao = VendedorComLead & {
  leadCotacaoId: string;
  cotacaoId: string;
};

/**
 * Além do lead "Lead novo" de `criarVendedorComLead`, cria um segundo lead
 * com uma cotação em `status='rascunho'` vinculada (`cotacoes.lead_id`) —
 * cai no bucket "Em cotação" (`EM_COTACAO_STATUSES`, `@/lib/lead-etapa`).
 * Usado pelo teste do filtro Estágio do Kanban paginado (Pipeline V12,
 * T10), que precisa de mais de um bucket populado pra confirmar que só a
 * coluna filtrada é buscada/exibida.
 */
export async function criarVendedorComLeadEmCotacao(): Promise<VendedorComLeadEmCotacao> {
  const vendedor = await criarVendedorComLead();

  const { data: leadCotacao, error: eLead } = await admin
    .from("leads")
    .insert({
      nome: uniq("Cliente Em Cotação E2E"),
      contato: "(11) 97777-0000",
      origem: "teste-e2e",
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      status_pipeline: "qualificado",
      distribuido_em: new Date().toISOString(),
      dados: {},
    })
    .select("id")
    .single();
  if (eLead || !leadCotacao) throw new Error(`criar lead em cotação E2E: ${eLead?.message}`);

  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      lead_id: leadCotacao.id,
      status: "rascunho",
      step_atual: 1,
    })
    .select("id")
    .single();
  if (eCotacao || !cotacao) throw new Error(`criar cotação rascunho E2E: ${eCotacao?.message}`);

  return { ...vendedor, leadCotacaoId: leadCotacao.id, cotacaoId: cotacao.id };
}

/** Remove os dados criados por `criarVendedorComLeadEmCotacao` (best-effort; `db reset` também resolve). */
export async function limparVendedorComLeadEmCotacao(v: VendedorComLeadEmCotacao): Promise<void> {
  await admin.from("cotacoes").delete().eq("id", v.cotacaoId);
  await admin.from("leads").delete().eq("id", v.leadCotacaoId);
  await limparVendedorComLead(v);
}

export type VendedorComFilaDia = VendedorComLead & {
  retornoAtrasadoId: string;
  retornoHojeId: string;
  lembreteAtrasadoId: string;
  cotacaoRiscoId: string;
};

/**
 * Vendedor com as 3 fontes da agenda unificada populadas (V12.3.1/tests/e2e/
 * inicio-fila-dia.spec.ts): um retorno atrasado, um retorno de hoje, um
 * lembrete atrasado (usado no teste do "visto verde tira da lista") e um
 * negócio em risco (cotação `calculada` parada há mais de `RISCO_DIAS_PARADO`
 * dias — sem ação de "marcar como feito", só leitura). Mesmo lead de
 * `criarVendedorComLead` recebe os 2 retornos; o risco é uma cotação à parte,
 * sem lead — só precisa existir na mesma empresa para a RLS de `cotacoes`
 * deixar o vendedor enxergar (`empresa_id in (profiles.empresa_id)`).
 */
export async function criarVendedorComFilaDia(): Promise<VendedorComFilaDia> {
  const vendedor = await criarVendedorComLead();
  const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hojeISO = new Date().toISOString().slice(0, 10);

  const { data: retornoAtrasado, error: eRetAtrasado } = await admin
    .from("lead_agendamentos")
    .insert({
      lead_id: vendedor.leadId,
      data: ontemISO,
      hora: "09:00",
      nota: "Retorno atrasado E2E",
      criado_por: vendedor.userId,
    })
    .select("id")
    .single();
  if (eRetAtrasado || !retornoAtrasado)
    throw new Error(`criar retorno atrasado E2E: ${eRetAtrasado?.message}`);

  const { data: retornoHoje, error: eRetHoje } = await admin
    .from("lead_agendamentos")
    .insert({
      lead_id: vendedor.leadId,
      data: hojeISO,
      hora: "15:00",
      nota: "Retorno hoje E2E",
      criado_por: vendedor.userId,
    })
    .select("id")
    .single();
  if (eRetHoje || !retornoHoje) throw new Error(`criar retorno hoje E2E: ${eRetHoje?.message}`);

  const { data: lembrete, error: eLembrete } = await admin
    .from("lembretes")
    .insert({
      vendedor_id: vendedor.userId,
      tipo: "tarefa",
      titulo: "Lembrete atrasado E2E",
      data: ontemISO,
      hora: "08:00",
    })
    .select("id")
    .single();
  if (eLembrete || !lembrete) throw new Error(`criar lembrete E2E: ${eLembrete?.message}`);

  const atualizadoEmRisco = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      status: "calculada",
      step_atual: 5,
      atualizado_em: atualizadoEmRisco,
      // V12.3.4: sem isso, esta cotação "em risco" (parada há dias, não um
      // cálculo recém-terminado) contaria como "nova" pra
      // `useCotacoesNovas`/`CotacaoFinalizadaAviso` — o aviso global
      // duplicaria o nome do segurado em cima de QUALQUER tela (ex.:
      // `agenda.spec.ts`, que já mostra esse mesmo nome na lista de agenda).
      // Semanticamente ela já foi vista há muito: é por isso que virou risco.
      calculo_visto_em: atualizadoEmRisco,
    })
    .select("id")
    .single();
  if (eCotacao || !cotacao) throw new Error(`criar cotação em risco E2E: ${eCotacao?.message}`);
  const { error: eSegurado } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacao.id, nome: "Cliente Em Risco E2E" });
  if (eSegurado) throw new Error(`criar segurado da cotação em risco E2E: ${eSegurado.message}`);

  return {
    ...vendedor,
    retornoAtrasadoId: retornoAtrasado.id,
    retornoHojeId: retornoHoje.id,
    lembreteAtrasadoId: lembrete.id,
    cotacaoRiscoId: cotacao.id,
  };
}

/** Remove os dados criados por `criarVendedorComFilaDia` (best-effort; `db reset` também resolve). */
export async function limparVendedorComFilaDia(v: VendedorComFilaDia): Promise<void> {
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoRiscoId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoRiscoId);
  await admin.from("lembretes").delete().eq("id", v.lembreteAtrasadoId);
  await admin.from("lead_agendamentos").delete().in("id", [v.retornoAtrasadoId, v.retornoHojeId]);
  await limparVendedorComLead(v);
}

export type ColegaComAgendaCompleta = {
  userId: string;
  email: string;
  senha: string;
  cotacaoRiscoId: string;
  cotacaoPropostaFalhaId: string;
  propostaFalhaId: string;
  cotacaoAprovacaoId: string;
  descontoSolicitacaoId: string;
};

/**
 * Colega de trabalho na MESMA empresa de `empresaId`, com as 3 fontes que
 * dependem de `responsavel_id`/`solicitante_id` populadas: negócio em risco,
 * proposta bloqueada (seguradora) e desconto pendente (aprovação). Usado
 * pelo teste de não-vazamento entre colegas — RLS de `cotacoes`/`propostas`
 * libera SELECT pra empresa inteira, então só o filtro em `fetchRiscoAgenda`/
 * `fetchSeguradoraAgenda`/`fetchAprovacoesAgenda` (por uid) impede um
 * vendedor de ver a agenda do colega.
 */
export async function criarColegaComAgendaCompleta(
  empresaId: string,
): Promise<ColegaComAgendaCompleta> {
  const senha = "Teste@123!";
  const email = `${uniq("colega-e2e")}@teste.local`;

  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (eUser || !userData.user) throw new Error(`criar usuário colega E2E: ${eUser?.message}`);
  const userId = userData.user.id;

  const { error: eProfile } = await admin
    .from("profiles")
    .update({ empresa_id: empresaId, status: "aprovada" })
    .eq("id", userId);
  if (eProfile) throw new Error(`atualizar profile colega E2E: ${eProfile.message}`);

  const { error: eRole } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "vendedor" });
  if (eRole) throw new Error(`inserir role colega E2E: ${eRole.message}`);

  // --- fonte "risco" --------------------------------------------------------
  const atualizadoEmRisco = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cotacaoRisco, error: eCotacaoRisco } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      status: "calculada",
      atualizado_em: atualizadoEmRisco,
    })
    .select("id")
    .single();
  if (eCotacaoRisco || !cotacaoRisco)
    throw new Error(`criar cotação em risco do colega E2E: ${eCotacaoRisco?.message}`);
  const { error: eSeguradoRisco } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacaoRisco.id, nome: "Cliente Em Risco Colega E2E" });
  if (eSeguradoRisco)
    throw new Error(`criar segurado do risco do colega E2E: ${eSeguradoRisco.message}`);

  // --- fonte "seguradora" ----------------------------------------------------
  const atualizadoEmFalha = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cotacaoFalha, error: eCotacaoFalha } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: userId, status: "proposta" })
    .select("id")
    .single();
  if (eCotacaoFalha || !cotacaoFalha)
    throw new Error(`criar cotação da proposta em falha do colega E2E: ${eCotacaoFalha?.message}`);
  const { error: eSeguradoFalha } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacaoFalha.id, nome: "Cliente Pendência Seguradora Colega E2E" });
  if (eSeguradoFalha)
    throw new Error(`criar segurado da falha do colega E2E: ${eSeguradoFalha.message}`);

  const { data: propostaFalha, error: ePropostaFalha } = await admin
    .from("propostas")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      cotacao_id: cotacaoFalha.id,
      numero: "PRP-E2E-FALHA-COLEGA",
      transmissao_status: "falha",
      transmissao_motivo: "documento_pendente",
      transmissao_mensagem: "Falta o CRLV do veículo do colega E2E",
      atualizado_em: atualizadoEmFalha,
    })
    .select("id")
    .single();
  if (ePropostaFalha || !propostaFalha)
    throw new Error(`criar proposta em falha do colega E2E: ${ePropostaFalha?.message}`);

  // --- fonte "aprovacao" -----------------------------------------------------
  const { data: cotacaoAprovacao, error: eCotacaoAprovacao } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: userId, status: "calculada" })
    .select("id")
    .single();
  if (eCotacaoAprovacao || !cotacaoAprovacao)
    throw new Error(`criar cotação da aprovação do colega E2E: ${eCotacaoAprovacao?.message}`);

  const { data: seguradora, error: eSeguradora } = await admin
    .from("seguradoras")
    .select("id")
    .limit(1)
    .single();
  if (eSeguradora || !seguradora)
    throw new Error(`buscar seguradora para aprovação do colega E2E: ${eSeguradora?.message}`);

  const { data: descontoSolicitacao, error: eDesconto } = await admin
    .from("desconto_solicitacoes")
    .insert({
      cotacao_id: cotacaoAprovacao.id,
      solicitante_id: userId,
      nivel_atual: userId,
      seguradora_id: seguradora.id,
      pct_pedido: 30,
      status: "pendente",
    })
    .select("id")
    .single();
  if (eDesconto || !descontoSolicitacao)
    throw new Error(`criar solicitação de desconto do colega E2E: ${eDesconto?.message}`);

  return {
    userId,
    email,
    senha,
    cotacaoRiscoId: cotacaoRisco.id,
    cotacaoPropostaFalhaId: cotacaoFalha.id,
    propostaFalhaId: propostaFalha.id,
    cotacaoAprovacaoId: cotacaoAprovacao.id,
    descontoSolicitacaoId: descontoSolicitacao.id,
  };
}

/** Remove os dados criados por `criarColegaComAgendaCompleta` (best-effort; `db reset` também resolve). */
export async function limparColegaComAgendaCompleta(c: ColegaComAgendaCompleta): Promise<void> {
  await admin.from("desconto_solicitacoes").delete().eq("id", c.descontoSolicitacaoId);
  await admin.from("cotacoes").delete().eq("id", c.cotacaoAprovacaoId);
  await admin.from("propostas").delete().eq("id", c.propostaFalhaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", c.cotacaoPropostaFalhaId);
  await admin.from("cotacoes").delete().eq("id", c.cotacaoPropostaFalhaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", c.cotacaoRiscoId);
  await admin.from("cotacoes").delete().eq("id", c.cotacaoRiscoId);
  await admin.from("user_roles").delete().eq("user_id", c.userId);
  await admin.auth.admin.deleteUser(c.userId);
}

export type VendedorComAgendaCompleta = VendedorComFilaDia & {
  cotacaoPropostaFalhaId: string;
  propostaFalhaId: string;
  cotacaoAprovacaoId: string;
  descontoSolicitacaoId: string;
};

/**
 * Estende `criarVendedorComFilaDia` com as 2 fontes acrescentadas em
 * V12.3.2: uma proposta com `transmissao_status='falha'` (pendência da
 * seguradora) e uma `desconto_solicitacoes` pendente do próprio vendedor
 * (aprovação que ele pediu) — usadas por `tests/e2e/agenda.spec.ts`.
 * Isolado do resto: cada fonte extra ganha sua própria cotação, sem tocar
 * na cotação de risco nem no lead das 3 fontes originais.
 */
export async function criarVendedorComAgendaCompleta(): Promise<VendedorComAgendaCompleta> {
  const base = await criarVendedorComFilaDia();

  // --- fonte "seguradora": proposta bloqueada ------------------------------
  const atualizadoEmFalha = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cotacaoFalha, error: eCotacaoFalha } = await admin
    .from("cotacoes")
    .insert({ empresa_id: base.empresaId, responsavel_id: base.userId, status: "proposta" })
    .select("id")
    .single();
  if (eCotacaoFalha || !cotacaoFalha)
    throw new Error(`criar cotação da proposta em falha E2E: ${eCotacaoFalha?.message}`);
  const { error: eSeguradoFalha } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacaoFalha.id, nome: "Cliente Pendência Seguradora E2E" });
  if (eSeguradoFalha)
    throw new Error(`criar segurado da cotação em falha E2E: ${eSeguradoFalha.message}`);

  const { data: propostaFalha, error: ePropostaFalha } = await admin
    .from("propostas")
    .insert({
      empresa_id: base.empresaId,
      responsavel_id: base.userId,
      cotacao_id: cotacaoFalha.id,
      numero: "PRP-E2E-FALHA",
      transmissao_status: "falha",
      transmissao_motivo: "documento_pendente",
      transmissao_mensagem: "Falta o CRLV do veículo E2E",
      atualizado_em: atualizadoEmFalha,
    })
    .select("id")
    .single();
  if (ePropostaFalha || !propostaFalha)
    throw new Error(`criar proposta em falha E2E: ${ePropostaFalha?.message}`);

  // --- fonte "aprovacao": desconto pendente do próprio vendedor ------------
  const { data: cotacaoAprovacao, error: eCotacaoAprovacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: base.empresaId,
      responsavel_id: base.userId,
      lead_id: base.leadId,
      status: "calculada",
      // V12.3.4: mesmo motivo da cotação "em risco" acima — `calculada` aqui
      // é só o pré-requisito pra existir uma linha de `desconto_solicitacoes`
      // (fonte "aprovação"), não representa um cálculo recém-terminado.
      calculo_visto_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (eCotacaoAprovacao || !cotacaoAprovacao)
    throw new Error(`criar cotação da aprovação E2E: ${eCotacaoAprovacao?.message}`);

  const { data: seguradora, error: eSeguradora } = await admin
    .from("seguradoras")
    .select("id")
    .limit(1)
    .single();
  if (eSeguradora || !seguradora)
    throw new Error(`buscar seguradora para aprovação E2E: ${eSeguradora?.message}`);

  const { data: descontoSolicitacao, error: eDesconto } = await admin
    .from("desconto_solicitacoes")
    .insert({
      cotacao_id: cotacaoAprovacao.id,
      solicitante_id: base.userId,
      nivel_atual: base.userId,
      seguradora_id: seguradora.id,
      pct_pedido: 12,
      status: "pendente",
    })
    .select("id")
    .single();
  if (eDesconto || !descontoSolicitacao)
    throw new Error(`criar solicitação de desconto E2E: ${eDesconto?.message}`);

  return {
    ...base,
    cotacaoPropostaFalhaId: cotacaoFalha.id,
    propostaFalhaId: propostaFalha.id,
    cotacaoAprovacaoId: cotacaoAprovacao.id,
    descontoSolicitacaoId: descontoSolicitacao.id,
  };
}

/** Remove os dados criados por `criarVendedorComAgendaCompleta` (best-effort; `db reset` também resolve). */
export async function limparVendedorComAgendaCompleta(v: VendedorComAgendaCompleta): Promise<void> {
  await admin.from("desconto_solicitacoes").delete().eq("id", v.descontoSolicitacaoId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoAprovacaoId);
  await admin.from("propostas").delete().eq("id", v.propostaFalhaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoPropostaFalhaId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoPropostaFalhaId);
  await limparVendedorComFilaDia(v);
}

export type VendedorComRetornoEmNegociacao = VendedorComLead & {
  cotacaoId: string;
  propostaId: string;
  retornoId: string;
};

/**
 * Vendedor com um retorno agendado (fonte "retorno" da agenda) para um lead
 * que já está em negociação de proposta (`status_pipeline='proposta'`) —
 * usado por `foco-ao-chegar.spec.ts` (caso c): `abrirItem` resolve esse lead
 * via `resolveExistingLeadDestination` para `{ kind: "proposals", selected }`
 * e navega para `/venda/em-negociacao`, ao contrário dos leads "novos" que
 * caem no wizard.
 */
export async function criarVendedorComRetornoEmNegociacao(): Promise<VendedorComRetornoEmNegociacao> {
  const vendedor = await criarVendedorComLead();

  const { error: eLead } = await admin
    .from("leads")
    .update({ status_pipeline: "proposta" })
    .eq("id", vendedor.leadId);
  if (eLead) throw new Error(`mover lead pra proposta E2E: ${eLead.message}`);

  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      lead_id: vendedor.leadId,
      status: "proposta",
    })
    .select("id")
    .single();
  if (eCotacao || !cotacao)
    throw new Error(`criar cotação em negociação E2E: ${eCotacao?.message}`);
  const { error: eSegurado } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacao.id, nome: "Cliente Retorno Negociação E2E" });
  if (eSegurado)
    throw new Error(`criar segurado da cotação em negociação E2E: ${eSegurado.message}`);

  const { data: proposta, error: eProposta } = await admin
    .from("propostas")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      cotacao_id: cotacao.id,
      lead_id: vendedor.leadId,
      numero: "PRP-E2E-RETORNO-NEG",
    })
    .select("id")
    .single();
  if (eProposta || !proposta)
    throw new Error(`criar proposta em negociação E2E: ${eProposta?.message}`);

  const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: retorno, error: eRetorno } = await admin
    .from("lead_agendamentos")
    .insert({
      lead_id: vendedor.leadId,
      data: ontemISO,
      hora: "09:00",
      nota: "Retorno em negociação E2E",
      criado_por: vendedor.userId,
    })
    .select("id")
    .single();
  if (eRetorno || !retorno)
    throw new Error(`criar retorno em negociação E2E: ${eRetorno?.message}`);

  return {
    ...vendedor,
    cotacaoId: cotacao.id,
    propostaId: proposta.id,
    retornoId: retorno.id,
  };
}

/** Remove os dados criados por `criarVendedorComRetornoEmNegociacao` (best-effort; `db reset` também resolve). */
export async function limparVendedorComRetornoEmNegociacao(
  v: VendedorComRetornoEmNegociacao,
): Promise<void> {
  await admin.from("lead_agendamentos").delete().eq("id", v.retornoId);
  await admin.from("propostas").delete().eq("id", v.propostaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoId);
  await limparVendedorComLead(v);
}

export type VendedorComRetornoEmFinalizacao = VendedorComLead & {
  cotacaoId: string;
  propostaId: string;
  tentativaId: string;
  retornoId: string;
};

/**
 * Vendedor com um retorno agendado (fonte "retorno" da agenda) para um lead
 * já ganho (`status_pipeline='ganho'`) com uma tentativa de transmissão em
 * aberto (`cotacao_transmissoes.status='enviada'`) — usado por
 * `foco-ao-chegar.spec.ts` (revisão pós-V12.3.11): `abrirItem` resolve esse
 * lead via `resolveExistingLeadDestination` para
 * `{ kind: "acceptance", selected }` e navega para `/venda/em-finalizacao`
 * só com `foco` (sem `selected` — ao contrário de "proposals"/Em negociação,
 * este destino nunca teve painel pra abrir).
 */
export async function criarVendedorComRetornoEmFinalizacao(): Promise<VendedorComRetornoEmFinalizacao> {
  const vendedor = await criarVendedorComLead();

  const { error: eLead } = await admin
    .from("leads")
    .update({ status_pipeline: "ganho" })
    .eq("id", vendedor.leadId);
  if (eLead) throw new Error(`mover lead pra ganho E2E: ${eLead.message}`);

  const { data: cotacao, error: eCotacao } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      lead_id: vendedor.leadId,
      status: "proposta",
    })
    .select("id")
    .single();
  if (eCotacao || !cotacao)
    throw new Error(`criar cotação em finalização E2E: ${eCotacao?.message}`);
  const { error: eSegurado } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: cotacao.id, nome: "Cliente Retorno Finalização E2E" });
  if (eSegurado)
    throw new Error(`criar segurado da cotação em finalização E2E: ${eSegurado.message}`);

  const { data: proposta, error: eProposta } = await admin
    .from("propostas")
    .insert({
      empresa_id: vendedor.empresaId,
      responsavel_id: vendedor.userId,
      cotacao_id: cotacao.id,
      lead_id: vendedor.leadId,
      numero: "PRP-E2E-RETORNO-FIN",
    })
    .select("id")
    .single();
  if (eProposta || !proposta)
    throw new Error(`criar proposta em finalização E2E: ${eProposta?.message}`);

  const { data: tentativa, error: eTentativa } = await admin
    .from("cotacao_transmissoes")
    .insert({
      cotacao_id: cotacao.id,
      proposta_id: proposta.id,
      seguradora: "Seguradora Finalização E2E",
      forma_pagamento: "Boleto",
      premio: 1234.56,
      status: "enviada",
    })
    .select("id")
    .single();
  if (eTentativa || !tentativa)
    throw new Error(`criar tentativa de transmissão em finalização E2E: ${eTentativa?.message}`);

  const ontemISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: retorno, error: eRetorno } = await admin
    .from("lead_agendamentos")
    .insert({
      lead_id: vendedor.leadId,
      data: ontemISO,
      hora: "09:00",
      nota: "Retorno em finalização E2E",
      criado_por: vendedor.userId,
    })
    .select("id")
    .single();
  if (eRetorno || !retorno)
    throw new Error(`criar retorno em finalização E2E: ${eRetorno?.message}`);

  return {
    ...vendedor,
    cotacaoId: cotacao.id,
    propostaId: proposta.id,
    tentativaId: tentativa.id,
    retornoId: retorno.id,
  };
}

/** Remove os dados criados por `criarVendedorComRetornoEmFinalizacao` (best-effort; `db reset` também resolve). */
export async function limparVendedorComRetornoEmFinalizacao(
  v: VendedorComRetornoEmFinalizacao,
): Promise<void> {
  await admin.from("lead_agendamentos").delete().eq("id", v.retornoId);
  await admin.from("cotacao_transmissoes").delete().eq("id", v.tentativaId);
  await admin.from("propostas").delete().eq("id", v.propostaId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", v.cotacaoId);
  await admin.from("cotacoes").delete().eq("id", v.cotacaoId);
  await limparVendedorComLead(v);
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
      quiver_resultado_raw: {
        cards: [
          {
            seguradora: "Porto Seguro",
            nome: "Auto Completo",
            produto: "Porto Seguro Auto",
            opcoes: [
              {
                tipo: "Completa",
                franquia: "R$ 3.250,00",
                avista: "R$ 2.100,00",
                parcelas: "10x de R$ 210,00",
              },
            ],
            formasPagamento: { selecionada: "Cartão de crédito", opcoes: ["Débito"] },
            coberturasBasicas: { Casco: "100% FIPE", "Danos materiais": "R$ 100.000" },
          },
          {
            seguradora: "Azul",
            nome: "Azul Auto",
            produto: "Azul Seguro Auto",
            opcoes: [
              {
                tipo: "Completa",
                franquia: "R$ 3.480,00",
                avista: "R$ 2.250,00",
                parcelas: "10x de R$ 225,00",
              },
            ],
            formaPagamento: "Cartão de crédito",
            coberturasBasicas: { Casco: "100% FIPE", "Danos materiais": "R$ 100.000" },
          },
          {
            seguradora: "HDI",
            nome: "HDI Auto Perfil",
            produto: "HDI Auto",
            opcoes: [
              {
                tipo: "Completa",
                franquia: "R$ 3.700,00",
                avista: "R$ 2.400,00",
                parcelas: "10x de R$ 240,00",
              },
            ],
            formaPagamento: "Boleto",
            coberturasBasicas: { Casco: "100% FIPE", "Danos materiais": "R$ 100.000" },
          },
        ],
      },
      criado_em: criadoEmCalculada,
      atualizado_em: criadoEmCalculada,
      // V12.3.4: fixture de exemplo do tutorial, não um cálculo "acabou de
      // chegar" — sem isso, o aviso global "COTAÇÃO FINALIZADA" apareceria
      // por cima de qualquer passo do tour com o nome "Cliente Tutorial".
      calculo_visto_em: criadoEmCalculada,
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

export type DistribuicaoMovidaFixture = {
  vendedor: Persona;
  empresaNome: string;
  leadId: string;
  leadNome: string;
  lojaNome: string;
  alias: string;
};

/**
 * Monta somente os dados externos ao formulário testado: empresa/vendedor e
 * um lead Movida ainda na Fila Global. A rota, o alias e o pool são criados
 * pelo browser para que o E2E valide a integração real da tela com o banco.
 */
export async function criarDistribuicaoMovidaFixture(): Promise<DistribuicaoMovidaFixture> {
  const vendedor = await criarPersona({ role: "vendedor" });
  const { data: empresa, error: empresaError } = await admin
    .from("empresas")
    .select("nome")
    .eq("id", vendedor.empresaId)
    .single();
  if (empresaError || !empresa)
    throw new Error(`ler empresa do vendedor Movida E2E: ${empresaError?.message}`);
  const sufixo = crypto.randomUUID().slice(0, 8);
  const lojaNome = `Movida E2E ${sufixo}`;
  const alias = `Movida São José ${sufixo}`;
  const leadNome = `Lead Movida E2E ${sufixo}`;
  const { data, error } = await admin.rpc("ingerir_lead_externo", {
    type: "INSERT",
    record: {
      nome_cliente: leadNome,
      telefone: `119${Date.now().toString().slice(-8)}`,
      placa: `E2E${sufixo.slice(0, 4)}`.toUpperCase(),
      loja: alias,
    },
  } as never);
  const lead = (data as { lead_id: string; criado: boolean }[] | null)?.[0];
  if (error || !lead) throw new Error(`ingerir lead Movida E2E: ${error?.message}`);
  return {
    vendedor,
    empresaNome: empresa.nome,
    leadId: lead.lead_id,
    leadNome,
    lojaNome,
    alias,
  };
}

export async function lerDestinoLeadMovidaE2E(leadId: string) {
  const { data, error } = await admin
    .from("leads")
    .select("empresa_id,responsavel_id")
    .eq("id", leadId)
    .single();
  if (error) throw new Error(`ler destino do lead Movida E2E: ${error.message}`);
  return data;
}

export async function limparDistribuicaoMovidaFixture(
  fixture: DistribuicaoMovidaFixture,
): Promise<void> {
  await admin.from("leads").delete().eq("id", fixture.leadId);
  const { data: lojas } = await admin
    .from("movida_lojas")
    .select("id")
    .eq("nome", fixture.lojaNome);
  if (lojas?.length) {
    await admin
      .from("movida_lojas")
      .delete()
      .in(
        "id",
        lojas.map((loja) => loja.id),
      );
  }
  await limparPersona(fixture.vendedor);
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

/**
 * Marca `calculo_visto_em` direto no banco — usado por specs que não testam
 * o aviso "COTAÇÃO FINALIZADA" (`cotacao-finalizada-aviso.tsx`) e por isso
 * preferem que ele nunca apareça (ex.: `imprimir-cotacao.spec.ts`, cujo modal
 * fica atrás do aviso na mesma tela) em vez de dispensá-lo a cada teste.
 */
export async function marcarCalculoVistoE2E(cotacaoId: string): Promise<void> {
  const { error } = await admin
    .from("cotacoes")
    .update({ calculo_visto_em: new Date().toISOString() })
    .eq("id", cotacaoId);
  if (error) throw new Error(`marcar calculo_visto_em: ${error.message}`);
}

/** Preenche os campos exigidos pelo gate do Recalcular geral (`podeCalcular`). */
export async function preencherCamposCalculoE2E(cotacaoId: string): Promise<void> {
  const seg = await admin.from("cotacao_segurado").upsert({
    cotacao_id: cotacaoId,
    cpf_cnpj: "529.982.247-25",
    nome: "Cliente Personalizar E2E",
    sexo: "Masculino",
    estado_civil: "Solteiro",
    email: "cliente-perso@teste.local",
    cep: "01310-100",
    celular: "(11) 99999-9999",
  });
  if (seg.error) throw new Error(`preencher segurado: ${seg.error.message}`);
  const vei = await admin.from("cotacao_veiculo").upsert({
    cotacao_id: cotacaoId,
    placa: "ABC1D23",
    cep_circulacao: "01310-100",
    km_mensal: "1000",
  });
  if (vei.error) throw new Error(`preencher veículo: ${vei.error.message}`);
  const per = await admin
    .from("cotacao_perfil")
    .upsert({ cotacao_id: cotacaoId, cep_pernoite: "01310-100" });
  if (per.error) throw new Error(`preencher perfil: ${per.error.message}`);
}

/** Remove os dados criados por `criarCotacaoQuiverFixture` (best-effort; `db reset` também resolve). */
export async function limparCotacaoQuiverFixture(f: CotacaoQuiverFixture): Promise<void> {
  await admin.from("cotacoes").delete().eq("id", f.cotacaoId);
  await admin.from("leads").delete().eq("id", f.leadId);
  await admin.from("user_roles").delete().eq("user_id", f.userId);
  await admin.auth.admin.deleteUser(f.userId);
  await admin.from("empresas").delete().eq("id", f.empresaId);
}

/**
 * Igual a `criarCotacaoQuiverFixture`, mas já com `cotacao_segurado.nome`
 * preenchido — necessário para o fluxo de transmissão (`transmitirPropostaQuiver`
 * exige número do portal OU nome do cliente para o robô localizar a cotação;
 * ver `webhook-transmissao.spec.ts`).
 */
export async function criarCotacaoTransmissaoFixture(): Promise<CotacaoQuiverFixture> {
  const fixture = await criarCotacaoQuiverFixture();
  const { error } = await admin
    .from("cotacao_segurado")
    .insert({ cotacao_id: fixture.cotacaoId, nome: "Cliente Transmissão E2E" });
  if (error) throw new Error(`criar segurado: ${error.message}`);
  return fixture;
}

/** Remove os dados extras de `criarCotacaoTransmissaoFixture` além dos de `limparCotacaoQuiverFixture`. */
export async function limparCotacaoTransmissaoFixture(f: CotacaoQuiverFixture): Promise<void> {
  await admin.from("propostas").delete().eq("cotacao_id", f.cotacaoId);
  await admin.from("cotacao_transmissoes").delete().eq("cotacao_id", f.cotacaoId);
  await admin.from("cotacao_segurado").delete().eq("cotacao_id", f.cotacaoId);
  await limparCotacaoQuiverFixture(f);
}

/**
 * Grava `cotacao_seguro.seguradoras_sel` direto no banco — usado por
 * `calculo-lista.spec.ts` para simular que o vendedor marcou, no passo
 * Seguro, uma seguradora que o webhook da Quiver depois não retorna (coluna
 * "Sem retorno" da lista comparativa, real, nunca inventada).
 */
export async function definirSeguradorasSelE2E(
  cotacaoId: string,
  seguradorasSel: string[],
): Promise<void> {
  const { error } = await admin
    .from("cotacao_seguro")
    .upsert({ cotacao_id: cotacaoId, seguradoras_sel: seguradorasSel });
  if (error) throw new Error(`gravar seguradoras_sel: ${error.message}`);
}

/**
 * Cria um pedido de desconto (`desconto_solicitacoes`) pendente numa
 * seguradora desta cotação, com `solicitante_id` de um SEGUNDO usuário (não
 * o dono da cotação) mas `nivel_atual = donoCotacaoId` — é o que deixa o
 * dono da cotação ENXERGAR o pedido via RLS (`desconto_solicitacoes_select`:
 * `nivel_atual = auth.uid() or fn_pode_ver_solicitacao_desconto(solicitante_id)`)
 * sem poder CANCELAR (`cancelar_desconto` exige `solicitante_id = auth.uid()`).
 * Usado por `seg-acoes.spec.ts` para exercitar o bloqueio real de
 * "Recalcular esta seguradora" (RPC recusa com "apenas o solicitante pode
 * cancelar", migration `g3_2_rpcs_desconto.sql`).
 */
export async function criarSolicitacaoDescontoDeOutroUsuarioE2E(
  cotacaoId: string,
  seguradoraNome: string,
  donoCotacaoId: string,
): Promise<{ solicitanteId: string; solicitacaoId: string }> {
  const email = `${uniq("outro-solicitante-e2e")}@teste.local`;
  const { data: userData, error: eUser } = await admin.auth.admin.createUser({
    email,
    password: "Teste@123!",
    email_confirm: true,
  });
  if (eUser || !userData.user) throw new Error(`criar outro solicitante: ${eUser?.message}`);

  const { data: seguradora, error: eSeguradora } = await admin
    .from("seguradoras")
    .select("id")
    .eq("nome", seguradoraNome)
    .single();
  if (eSeguradora || !seguradora)
    throw new Error(`buscar seguradora "${seguradoraNome}": ${eSeguradora?.message}`);

  const { data: solicitacao, error: eSolicitacao } = await admin
    .from("desconto_solicitacoes")
    .insert({
      cotacao_id: cotacaoId,
      solicitante_id: userData.user.id,
      nivel_atual: donoCotacaoId,
      seguradora_id: seguradora.id,
      pct_pedido: 15,
      status: "pendente",
    })
    .select("id")
    .single();
  if (eSolicitacao || !solicitacao)
    throw new Error(`criar solicitação de desconto de outro usuário: ${eSolicitacao?.message}`);

  return { solicitanteId: userData.user.id, solicitacaoId: solicitacao.id };
}

/** Remove os dados de `criarSolicitacaoDescontoDeOutroUsuarioE2E`. */
export async function limparSolicitacaoDescontoDeOutroUsuarioE2E(f: {
  solicitanteId: string;
  solicitacaoId: string;
}): Promise<void> {
  await admin.from("desconto_solicitacoes").delete().eq("id", f.solicitacaoId);
  await admin.auth.admin.deleteUser(f.solicitanteId);
}

/**
 * Cria um pedido de desconto (`desconto_solicitacoes`) pendente numa
 * seguradora desta cotação, com `solicitante_id = nivel_atual = donoCotacaoId`
 * — o PRÓPRIO dono da cotação, diferente de
 * `criarSolicitacaoDescontoDeOutroUsuarioE2E`. Usado por `seg-acoes.spec.ts`
 * para exercitar o caminho feliz de "Recalcular esta seguradora": a RPC
 * `cancelar_desconto` aceita porque `solicitante_id = auth.uid()`, então o
 * recálculo segue sem bloqueio. Sem cleanup próprio — cascade de
 * `desconto_solicitacoes.cotacao_id` (`on delete cascade`) já cobre quando
 * `limparCotacaoQuiverFixture` apaga a cotação.
 */
export async function criarSolicitacaoDescontoPropriaE2E(
  cotacaoId: string,
  seguradoraNome: string,
  donoCotacaoId: string,
): Promise<{ solicitacaoId: string }> {
  const { data: seguradora, error: eSeguradora } = await admin
    .from("seguradoras")
    .select("id")
    .eq("nome", seguradoraNome)
    .single();
  if (eSeguradora || !seguradora)
    throw new Error(`buscar seguradora "${seguradoraNome}": ${eSeguradora?.message}`);

  const { data: solicitacao, error: eSolicitacao } = await admin
    .from("desconto_solicitacoes")
    .insert({
      cotacao_id: cotacaoId,
      solicitante_id: donoCotacaoId,
      nivel_atual: donoCotacaoId,
      seguradora_id: seguradora.id,
      pct_pedido: 10,
      status: "pendente",
    })
    .select("id")
    .single();
  if (eSolicitacao || !solicitacao)
    throw new Error(`criar solicitação de desconto própria: ${eSolicitacao?.message}`);

  return { solicitacaoId: solicitacao.id };
}

/** Lê `status` de uma `desconto_solicitacoes` — para asserts pós-ação em E2E. */
export async function statusSolicitacaoDescontoE2E(solicitacaoId: string): Promise<string> {
  const { data, error } = await admin
    .from("desconto_solicitacoes")
    .select("status")
    .eq("id", solicitacaoId)
    .single();
  if (error || !data) throw new Error(`buscar status da solicitação: ${error?.message}`);
  return data.status;
}

/** Lê `cotacao_seguro.seguradoras_sel` — para asserts pós-recálculo em E2E. */
export async function seguradorasSelE2E(cotacaoId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("cotacao_seguro")
    .select("seguradoras_sel")
    .eq("cotacao_id", cotacaoId)
    .maybeSingle();
  if (error) throw new Error(`buscar seguradoras_sel: ${error.message}`);
  return (data?.seguradoras_sel as string[] | null) ?? [];
}

/**
 * V12.3.8 — lê `ramo` gravado por `salvar_cotacao_rascunho` nas duas colunas
 * (`cotacoes.ramo` e `cotacao_seguro.ramo`), pra confirmar que o tipo de item
 * escolhido no `TipoItemPicker` sobrevive ao autosave/reload.
 */
export async function lerRamoCotacaoE2E(
  cotacaoId: string,
): Promise<{ cotacoes: string | null; cotacaoSeguro: string | null }> {
  const { data: cot, error: eCot } = await admin
    .from("cotacoes")
    .select("ramo")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (eCot) throw new Error(`buscar cotacoes.ramo: ${eCot.message}`);
  const { data: seg, error: eSeg } = await admin
    .from("cotacao_seguro")
    .select("ramo")
    .eq("cotacao_id", cotacaoId)
    .maybeSingle();
  if (eSeg) throw new Error(`buscar cotacao_seguro.ramo: ${eSeg.message}`);
  return { cotacoes: cot?.ramo ?? null, cotacaoSeguro: seg?.ramo ?? null };
}

/** V12.3.8 — lê `cotacao_perfil.condutor_mesmo` (switch "principal condutor"). */
export async function lerCondutorMesmoE2E(cotacaoId: string): Promise<boolean | null> {
  const { data, error } = await admin
    .from("cotacao_perfil")
    .select("condutor_mesmo")
    .eq("cotacao_id", cotacaoId)
    .maybeSingle();
  if (error) throw new Error(`buscar cotacao_perfil.condutor_mesmo: ${error.message}`);
  return data?.condutor_mesmo ?? null;
}

/**
 * Remove uma cotação criada pelo gate "Lead Manual — origem" (primeiro
 * autosave via `salvar_cotacao_rascunho` sem `?id=` na URL): a RPC também cria
 * o `lead` (V11 · `lead_manual_origem_canal`), então precisamos apagar os
 * dois — deletar só `cotacoes` deixaria o `lead` órfão (best-effort; `db
 * reset` também resolve).
 */
export async function limparCotacaoManualE2E(cotacaoId: string): Promise<void> {
  const { data: cot } = await admin
    .from("cotacoes")
    .select("lead_id")
    .eq("id", cotacaoId)
    .maybeSingle();
  await admin.from("cotacoes").delete().eq("id", cotacaoId);
  if (cot?.lead_id) await admin.from("leads").delete().eq("id", cot.lead_id);
}

export type CotacaoEnviadaQuiverExtra = { leadId: string; cotacaoId: string };

/**
 * Cria uma SEGUNDA cotação `enviada_quiver` (com lead próprio) para um vendedor
 * que já existe (ex.: `criarCotacaoQuiverFixture`) — usado por
 * `em-negociacao.spec.ts` (V12.3.4) para popular as duas listas de
 * `/venda/em-negociacao` (Aguardando cotação + Cotação finalizada) ao mesmo
 * tempo para o MESMO dono, sem duplicar a criação de empresa/usuário.
 */
export async function criarCotacaoEnviadaQuiverExtra(
  empresaId: string,
  userId: string,
): Promise<CotacaoEnviadaQuiverExtra> {
  const leadNome = uniq("Lead Quiver Extra E2E");
  const { data: lead, error: eLead } = await admin
    .from("leads")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      nome: leadNome,
      status_pipeline: "qualificando",
    })
    .select("id")
    .single();
  if (eLead || !lead) throw new Error(`criar lead extra: ${eLead?.message}`);

  const { data: cot, error: eCot } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      lead_id: lead.id,
      status: "enviada_quiver",
    })
    .select("id")
    .single();
  if (eCot || !cot) throw new Error(`criar cotação extra: ${eCot?.message}`);

  return { leadId: lead.id, cotacaoId: cot.id };
}

/** Remove os dados criados por `criarCotacaoEnviadaQuiverExtra` (best-effort; `db reset` também resolve). */
export async function limparCotacaoEnviadaQuiverExtra(f: CotacaoEnviadaQuiverExtra): Promise<void> {
  await admin.from("cotacoes").delete().eq("id", f.cotacaoId);
  await admin.from("leads").delete().eq("id", f.leadId);
}

export type CotacaoStatusExtra = { leadId: string; cotacaoId: string };

/**
 * Generaliza `criarCotacaoEnviadaQuiverExtra` para qualquer `cotacao_status` —
 * usado por `fases-por-vendedor.spec.ts` (follow-up V12.3.4) para popular
 * `/venda/em-cotacao` (`rascunho`) e uma cotação "neutra" (`aceita`, fora das
 * três telas de fase) para hospedar uma tentativa de transmissão sem
 * contaminar a contagem de `/venda/em-negociacao`.
 */
export async function criarCotacaoComStatusExtra(
  empresaId: string,
  userId: string,
  status: Database["public"]["Enums"]["cotacao_status"],
  /**
   * Campos extras do insert de `cotacoes` — usado por
   * `fases-por-vendedor.spec.ts` para já gravar `calculo_visto_em` numa
   * `calculada` de fixture, para ela não acionar o aviso global "COTAÇÃO
   * FINALIZADA" (`useCotacoesNovas`) enquanto o teste navega por outras telas.
   */
  extra?: Partial<Database["public"]["Tables"]["cotacoes"]["Insert"]>,
  /** Se informado, grava `cotacao_segurado.nome` — usado para diferenciar
   * as linhas de dono/colega nas asserções por texto visível. */
  seguradoNome?: string,
): Promise<CotacaoStatusExtra> {
  const leadNome = uniq(`Lead ${status} E2E`);
  const { data: lead, error: eLead } = await admin
    .from("leads")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      nome: leadNome,
      status_pipeline: "qualificando",
    })
    .select("id")
    .single();
  if (eLead || !lead) throw new Error(`criar lead extra (${status}): ${eLead?.message}`);

  const { data: cot, error: eCot } = await admin
    .from("cotacoes")
    .insert({
      empresa_id: empresaId,
      responsavel_id: userId,
      lead_id: lead.id,
      status,
      ...extra,
    })
    .select("id")
    .single();
  if (eCot || !cot) throw new Error(`criar cotação extra (${status}): ${eCot?.message}`);

  if (seguradoNome) {
    const { error: eSegurado } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cot.id, nome: seguradoNome });
    if (eSegurado) throw new Error(`criar segurado extra (${status}): ${eSegurado.message}`);
  }

  return { leadId: lead.id, cotacaoId: cot.id };
}

/** Remove os dados criados por `criarCotacaoComStatusExtra` (best-effort; `db reset` também resolve). */
export async function limparCotacaoComStatusExtra(f: CotacaoStatusExtra): Promise<void> {
  await admin.from("cotacoes").delete().eq("id", f.cotacaoId);
  await admin.from("leads").delete().eq("id", f.leadId);
}

const QUIVER_TRANSMISSAO_WEBHOOK_KEY =
  env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY ||
  process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY ||
  "";
const QUIVER_TRANSMISSAO_WEBHOOK_SECRET =
  env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET ||
  process.env.SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_SECRET ||
  "";
if (!QUIVER_TRANSMISSAO_WEBHOOK_KEY || !QUIVER_TRANSMISSAO_WEBHOOK_SECRET) {
  throw new Error(
    "Defina SELF_QUIVER_TRANSMISSAO_WEBHOOK_CLIENT_KEY/SECRET (local: .env; CI: já exportado " +
      "pelo job `e2e`) — precisam bater com o que o dev server do Playwright está lendo.",
  );
}

/** Headers do webhook de resultado de transmissão, prontos para `request.post("/api/webhooks/quiver-transmissao", ...)`. */
export const QUIVER_TRANSMISSAO_WEBHOOK_HEADERS = {
  "content-type": "application/json",
  "x-client-key": QUIVER_TRANSMISSAO_WEBHOOK_KEY,
  "x-client-secret": QUIVER_TRANSMISSAO_WEBHOOK_SECRET,
};

/**
 * Busca a tentativa de transmissão mais recente de uma cotação (via client
 * admin — não usar em asserts de RLS). Usado para esperar a linha em
 * `cotacao_transmissoes` que `transmitirPropostaQuiver` insere ao clicar em
 * "gerar proposta", antes de disparar o webhook de resultado.
 */
export async function tentativaTransmissaoMaisRecente(cotacaoId: string) {
  const { data, error } = await admin
    .from("cotacao_transmissoes")
    .select("id,status")
    .eq("cotacao_id", cotacaoId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`buscar tentativa de transmissão: ${error.message}`);
  return data;
}

/**
 * Lê `cotacoes.transmissao_fase` direto do banco (via admin — não usar em
 * asserts de RLS). `StepTransmissao.tsx`/`novo-lead.tsx` gravam esse campo
 * fire-and-forget (best-effort, T5/T6, de propósito sem `await` bloqueante no
 * app): esperar SÓ a resposta de rede do PATCH que a UI dispara não garante
 * que ele foi o ÚLTIMO a chegar no servidor (o PATCH da fase anterior, também
 * fire-and-forget, pode terminar depois — corrida real, vista em execuções
 * paralelas do E2E). Ler a linha direto no Postgres depois é a única forma de
 * confirmar o valor que de fato ficou persistido.
 */
export async function lerTransmissaoFaseCotacao(cotacaoId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("cotacoes")
    .select("transmissao_fase")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (error) throw new Error(`ler transmissao_fase: ${error.message}`);
  return data?.transmissao_fase ?? null;
}

/**
 * Cria diretamente (via admin) a linha em `cotacao_transmissoes` que
 * `transmitirPropostaQuiver` (`quiver.functions.ts`) inserta antes de chamar
 * o robô externo, com `status='enviada'`. Usado pelo E2E de webhook de
 * transmissão: o robô real (serviço `cotacao-api`, com worker Playwright
 * contra o portal de verdade) não pode ser exercitado num teste automatizado
 * — em vez disso, o clique em "gerar proposta" é interceptado via
 * `page.route` (mesma técnica de `quiver-webhook.spec.ts`) e respondido com o
 * `tentativaId` desta linha, permitindo testar de ponta a ponta o polling da
 * UI e o webhook de resultado real (`/api/webhooks/quiver-transmissao`).
 */
export async function criarTentativaTransmissaoEnviada(opts: {
  cotacaoId: string;
  seguradora: string;
  produto?: string;
  formaPagamento: string;
  parcelas?: string;
  premio?: number;
  parcelasNum?: number;
  valorParcela?: number;
}): Promise<string> {
  const { data, error } = await admin
    .from("cotacao_transmissoes")
    .insert({
      cotacao_id: opts.cotacaoId,
      seguradora: opts.seguradora,
      produto: opts.produto ?? null,
      forma_pagamento: opts.formaPagamento,
      parcelas: opts.parcelas ?? null,
      premio: opts.premio ?? null,
      parcelas_num: opts.parcelasNum ?? null,
      valor_parcela: opts.valorParcela ?? null,
      status: "enviada",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar tentativa de transmissão: ${error?.message}`);
  return data.id as string;
}

/**
 * Lê `step_atual` e `transmissao_oferta` direto do banco (admin — não usar em
 * asserts de RLS). Usado por `retomar-transmissao.spec.ts` para: (1)
 * confirmar que o snapshot best-effort (`gravarTransmissaoOfertaSnapshot`) foi
 * mesmo persistido, e (2) esperar o autosave debounced (1,5s,
 * `useCotacaoRascunho`) gravar `step_atual=6` antes de recarregar a página —
 * sem isso, o reload dependeria só da corrida com `useRetomarTransmissao`
 * pra decidir o ponto certo.
 */
export async function lerCotacaoRetomadaEstado(cotacaoId: string) {
  const { data, error } = await admin
    .from("cotacoes")
    .select("step_atual, transmissao_oferta")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (error) throw new Error(`ler estado de retomada da cotação: ${error.message}`);
  return data;
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

/**
 * Placa usada pelo spec da integração de placa. É a placa real capturada do
 * fornecedor (FTP4J82) — mas o spec NUNCA chama a API: `semearConsultaPlacaE2E`
 * grava o resultado no cache de `consultas_placa`, e a server function devolve
 * o registro em vez de gastar uma consulta paga a cada rodada de CI.
 */
export const PLACA_E2E = "FTP4J82";

/** Payload equivalente ao que `parseDecodificadorXml` produz para PLACA_E2E. */
const PAYLOAD_PLACA_E2E = {
  placa: PLACA_E2E,
  chassi: "9BGJC69Z0FB105973",
  categoria: "AUTOMOVEL",
  marca: "CHEVROLET",
  modelo: "COBALT 1.8 LTZ",
  versao: "1.8 LTZ",
  motor: "1.8",
  origem: "NACIONAL",
  localFabricacao: "SAO CAETANO DO SUL / SP",
  tipoCarroceria: "SEDAN",
  anoModelo: "2015",
  anoFabricacao: "2014",
  codigoRetorno: "0",
  mensagemRetorno: "Marca/Modelo/Ano Identificados",
  fipe: [
    {
      codigo: "004420-2",
      combustivel: "Gasolina",
      marca: "GM - Chevrolet",
      modelo: "COBALT LTZ 1.8 8V Econo.Flex 4p Mec.",
      valor: 43399,
    },
    {
      codigo: "004421-0",
      combustivel: "Gasolina",
      marca: "GM - Chevrolet",
      modelo: "COBALT LTZ 1.8 8V Econo.Flex 4p Aut.",
      valor: 45917,
    },
  ],
};

/** Popula o cache de 30 dias para PLACA_E2E, evitando a chamada ao fornecedor. */
export async function semearConsultaPlacaE2E(userId: string, empresaId: string): Promise<string> {
  const { data, error } = await admin
    .from("consultas_placa")
    .insert({
      placa: PLACA_E2E,
      consultado_por: userId,
      empresa_id: empresaId,
      sucesso: true,
      codigo_retorno: "0",
      mensagem_retorno: "Marca/Modelo/Ano Identificados",
      marca: "CHEVROLET",
      modelo: "COBALT 1.8 LTZ",
      versao: "1.8 LTZ",
      ano_modelo: "2015",
      ano_fabricacao: "2014",
      chassi: "9BGJC69Z0FB105973",
      combustivel: "Gasolina",
      categoria: "AUTOMOVEL",
      tipo_carroceria: "SEDAN",
      origem: "NACIONAL",
      motor: "1.8",
      local_fabricacao: "SAO CAETANO DO SUL / SP",
      fipe_codigo: "004420-2",
      fipe_valor: 43399,
      payload: PAYLOAD_PLACA_E2E,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`semear consulta de placa E2E: ${error?.message}`);
  return data.id;
}

export async function limparConsultaPlacaE2E(id: string): Promise<void> {
  await admin.from("consultas_placa").delete().eq("id", id);
}

/**
 * Segunda placa fictícia, com duas versões FIPE de combustível DIFERENTE
 * (Flex x Diesel) — cobre o bug de `aplicarVersao` deixar o campo
 * Combustível travado na primeira versão (`fipe[0]`) mesmo quando o
 * vendedor escolhe a outra. Nomes de modelo reais da FIPE (Fiat Toro,
 * marca 21 / modelos 7475 e 7476 em 15/08/2026) para que `aplicarVersao`
 * encontre um `modeloMatch` de verdade, em vez de cair no aviso de
 * "modelo não está na lista" por causa de um nome inventado.
 */
export const PLACA_MISTA_E2E = "ABC1D23";

const PAYLOAD_PLACA_MISTA_E2E = {
  placa: PLACA_MISTA_E2E,
  chassi: "1HGCM82633A004352",
  categoria: "AUTOMOVEL",
  marca: "FIAT",
  modelo: "TORO",
  versao: "FREEDOM",
  motor: "2.0",
  origem: "NACIONAL",
  localFabricacao: "BETIM / MG",
  tipoCarroceria: "PICAPE",
  anoModelo: "2019",
  anoFabricacao: "2019",
  codigoRetorno: "0",
  mensagemRetorno: "Marca/Modelo/Ano Identificados",
  fipe: [
    {
      codigo: "007475-0",
      combustivel: "Flex",
      marca: "Fiat",
      modelo: "Toro Freedom 1.8 16V Flex Aut.",
      valor: 90000,
    },
    {
      codigo: "007476-8",
      combustivel: "Diesel",
      marca: "Fiat",
      modelo: "Toro Freedom 2.0 16V 4x2 TB Diesel Mec.",
      valor: 110000,
    },
  ],
};

export async function semearConsultaPlacaMistaE2E(
  userId: string,
  empresaId: string,
): Promise<string> {
  const { data, error } = await admin
    .from("consultas_placa")
    .insert({
      placa: PLACA_MISTA_E2E,
      consultado_por: userId,
      empresa_id: empresaId,
      sucesso: true,
      codigo_retorno: "0",
      mensagem_retorno: "Marca/Modelo/Ano Identificados",
      marca: "FIAT",
      modelo: "TORO",
      versao: "FREEDOM",
      ano_modelo: "2019",
      ano_fabricacao: "2019",
      chassi: "1HGCM82633A004352",
      combustivel: "Flex",
      categoria: "AUTOMOVEL",
      tipo_carroceria: "PICAPE",
      origem: "NACIONAL",
      motor: "2.0",
      local_fabricacao: "BETIM / MG",
      fipe_codigo: "007475-0",
      fipe_valor: 90000,
      payload: PAYLOAD_PLACA_MISTA_E2E,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`semear consulta de placa mista E2E: ${error?.message}`);
  return data.id;
}

/** Define `empresas.perc_comissao` (fonte do % que `rpc_comissao_para_impressao` devolve). */
export async function definirPercComissaoEmpresaE2E(
  empresaId: string,
  pct: number | null,
): Promise<void> {
  const { error } = await admin.from("empresas").update({ perc_comissao: pct }).eq("id", empresaId);
  if (error) throw new Error(`definir perc_comissao da empresa: ${error.message}`);
}

/** Linhas de `cotacao_impressoes` da cotação (registro imutável da impressão). */
export async function listarImpressoesE2E(cotacaoId: string) {
  const { data, error } = await admin
    .from("cotacao_impressoes")
    .select("acao,modelo,detalhada,com_comissao,pct_exibido,seguradoras")
    .eq("cotacao_id", cotacaoId)
    .order("criado_em");
  if (error) throw new Error(`listar impressões: ${error.message}`);
  return data ?? [];
}

/** Ajustes por seguradora gravados na cotação (V12.3.7), por seguradora. */
export async function lerAjustesSeguradoraE2E(cotacaoId: string) {
  const { data, error } = await admin
    .from("cotacao_seguradora_ajustes")
    .select("seguradora,franquia_primeira_opcao,franquia_segunda_opcao,vidros,carro_reserva")
    .eq("cotacao_id", cotacaoId)
    .order("seguradora");
  if (error) throw new Error(`ler ajustes: ${error.message}`);
  return data ?? [];
}

/** Grava um ajuste por seguradora direto no banco (admin), com a chave EXATA informada. */
export async function gravarAjusteSeguradoraE2E(
  cotacaoId: string,
  seguradora: string,
  franquia1: string,
): Promise<void> {
  const { data: cot, error: e1 } = await admin
    .from("cotacoes")
    .select("empresa_id")
    .eq("id", cotacaoId)
    .single();
  if (e1) throw new Error(`ler cotação: ${e1.message}`);
  const { error } = await admin.from("cotacao_seguradora_ajustes").insert({
    cotacao_id: cotacaoId,
    empresa_id: cot.empresa_id,
    seguradora,
    franquia_primeira_opcao: franquia1,
  });
  if (error) throw new Error(`gravar ajuste: ${error.message}`);
}

/** Marca a cotação como já virada em proposta (o RPC de ajuste passa a recusar, 22023). */
export async function virarPropostaE2E(cotacaoId: string): Promise<void> {
  const { error } = await admin.from("cotacoes").update({ status: "proposta" }).eq("id", cotacaoId);
  if (error) throw new Error(`virar proposta: ${error.message}`);
}
