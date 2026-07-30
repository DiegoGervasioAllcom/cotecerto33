// Tipos compartilhados da tela "Acessos e permissões".

/**
 * O que o convite declarou para este pedido (V11 · Frente 1). `null` quando o
 * pedido não tem convite — a criação manual por exceção da Etapa 1, que no
 * protótipo aparece com o chip "manual · exceção" e "sem tipo declarado — a
 * Matriz define na análise".
 */
export type ConviteDoPendente = {
  codigo: string;
  trilha: "interno" | "externo";
  perfil: "master" | "franquia_full" | "franquia_indiv" | "vendedor" | null;
  cargo_id: string | null;
  cargo_nome: string | null;
  vinc_tipo: "matriz" | "master" | "full";
  vinc_empresa_id: string | null;
};

export type Pendente = {
  id: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  created_at: string;
  dados_cadastro: Record<string, unknown> | null;
  convite: ConviteDoPendente | null;
  /**
   * De qual bloco é este pendente — deriva de `convite.trilha` (F1). Sem
   * convite, cai em `externo` (é onde a Matriz classifica o tipo na análise).
   * `franquia` nunca aparece aqui: a RLS já filtra esses pendentes fora da
   * visão da Matriz (F2) — só a `fn_destino_pedido` no banco sabe distinguir
   * pelo vínculo completo (perfil + vinc_tipo), e a Matriz não precisa saber.
   */
  bloco: "interno" | "externo";
};

export type Deslig = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string;
  desligado_motivo: string | null;
  empresa_id: string | null;
};

export type ModeloParams = Record<string, string>;
export type Modelo = {
  id: string;
  nome: string;
  tipo: "franqueada" | "clt";
  perc_comissao_padrao: number;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  params: ModeloParams;
  modalidade: "individual" | "full" | null;
};

export type Pair = [string, string];
export type Trio = [string, string, string]; // [seguradora, item, valor]
export type CltRegras = {
  apuracao_ini: string;
  apuracao_fim: string;
  pagamento: string;
  iof: string;
  rules: string[];
};
export type CltConfig = {
  progressiva: Pair[];
  fator_novas: Pair[];
  fator_remalho: Pair[];
  seguradora_planos: Trio[];
  seguradora_adic: Trio[];
  regras: CltRegras;
};

export type Tab = "pend" | "vendedores" | "deslig" | "modelos";
export type PersoSub = "franquia" | "clt";

export type Superior = { id: string; nome: string; role: "master" | "supervisor" };
export type FranquiaAprovada = {
  id: string;
  nome: string;
  modeloNome: string;
  modalidade: "individual" | "full" | null;
  donoProfileId: string | null;
};
