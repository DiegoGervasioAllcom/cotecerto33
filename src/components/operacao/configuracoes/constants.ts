// Constantes da tela "Configurações".
import { z } from "zod";
import type { Cfg } from "./types";

export const nomeUsuarioSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(150, "Nome muito longo.");

export const DEFAULT_CFG: Cfg = {
  meta_vendedor: 14,
  meta_franquia: 48,
  auditoria_comissoes: true,
  exigir_motivo_estorno: true,
  aprovacao_dupla_comissao: false,
  notif_sla_estourado: true,
  notif_venda_nao_paga: true,
  notif_renovacao_vencer: true,
  notif_resumo_diario: false,
};

// Lista central "Usuários do sistema" (G1.5 — MAPA seção 5): usuário · tipo ·
// supervisão · status, com todos os perfis lado a lado e filtro por tipo/status.
// Read-only: edição/desativação seguem pelos modais por perfil (UsuariosModal).
export const TIPO_CHIP_CLASS: Record<string, string> = {
  Matriz: "chip-outline",
  "Supervisor (Matriz)": "chip-slate",
  "Master franqueado": "chip-yellow",
  "Franquia (Full)": "chip-info",
  "Franquia (Individual)": "chip-info",
  "Vendedor CLT": "chip-outline",
  "Vendedor de franquia": "chip-outline",
};
