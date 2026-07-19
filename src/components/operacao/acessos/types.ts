// Tipos compartilhados da tela "Acessos e permissões".
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
