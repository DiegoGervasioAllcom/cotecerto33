// Tipos compartilhados da tela "Configurações".
export type Cfg = {
  meta_vendedor: number;
  meta_franquia: number;
  auditoria_comissoes: boolean;
  exigir_motivo_estorno: boolean;
  aprovacao_dupla_comissao: boolean;
  notif_sla_estourado: boolean;
  notif_venda_nao_paga: boolean;
  notif_renovacao_vencer: boolean;
  notif_resumo_diario: boolean;
};

export type Integracao = { id: string; nome: string; descricao: string | null; status: string };
export type RoleCount = { role: string; count: number };
export type Seguradora = {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
  ordem: number;
};
export type UserRow = {
  id: string;
  nome: string;
  email: string;
  status: string;
  empresa_id: string | null;
  empresa_nome?: string | null;
};

export type UserFull = UserRow & { desligado_em: string | null; roles: string[] };
export type Empresa = { id: string; nome: string; tipo: string };

export type ModalKind = null | "seguradoras" | "matriz" | "franqueado" | "vendedor" | "todos";

export type SistemaRole = "matriz" | "master" | "vendedor" | "franqueado" | "supervisor";

export type UsuarioSistema = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string | null;
  role: SistemaRole;
  tipoLabel: string;
  supervisaoLabel: string;
};
