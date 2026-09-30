// Derivação do estado do botão "Proposta (PDF)" (V12.4.7 fatia 4). Função pura:
// o servidor decide de verdade; aqui só se escolhe o que mostrar.
export const DOC_PREPARANDO_MS = 10 * 60 * 1000;
export const DOC_REFETCH_MS = 15_000;

export type DocumentoLinha = {
  status: string;
  tentado_em: string | null;
  updated_at?: string | null;
} | null;

export type EstadoDocumento = "ok" | "preparando" | "indisponivel";

export function estadoDocumentoProposta(
  doc: DocumentoLinha,
  transmitidaEm: string | null,
  agora: number = Date.now(),
): EstadoDocumento {
  if (doc?.status === "ok") return "ok";
  if (doc?.status === "falhou") return "indisponivel";
  // Sem linha ou pendente: conta desde a tentativa (ou, sem ela, a transmissão).
  const ref = doc?.tentado_em ?? transmitidaEm;
  const t = ref ? Date.parse(ref) : NaN;
  if (Number.isNaN(t)) return "preparando";
  return agora - t >= DOC_PREPARANDO_MS ? "indisponivel" : "preparando";
}

/** Botão "Tentar de novo": só dono da cotação e Matriz (o servidor confere). */
export function podeTentarDeNovo(
  userId: string | null | undefined,
  role: string | null | undefined,
  responsavelId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return role === "matriz" || (responsavelId != null && responsavelId === userId);
}
