// Etapas da TRANSMISSÃO da proposta no robô (Quiver). Compartilhado entre o
// webhook (servidor) e a tela (front). ATENÇÃO: esta lista está DUPLICADA em
// utils/etapa.ts do repo do robô — mudou aqui, mude lá (e na RPC
// registrar_transmissao_etapa).
import { z } from "zod";

export const TRANSMISSAO_ETAPAS = [
  "na_fila",
  "entrando_portal",
  "abrindo_painel",
  "localizando_cotacao",
  "escolhendo_seguradora",
  "preenchendo_efetivacao",
  "confirmando",
] as const;

export type TransmissaoEtapaRobo = (typeof TRANSMISSAO_ETAPAS)[number];
export type TransmissaoEtapa = TransmissaoEtapaRobo | "concluido" | "erro";

export const TRANSMISSAO_ETAPA_SEQ: Record<TransmissaoEtapaRobo, number> = {
  na_fila: 0,
  entrando_portal: 1,
  abrindo_painel: 2,
  localizando_cotacao: 3,
  escolhendo_seguradora: 4,
  preenchendo_efetivacao: 5,
  confirmando: 6,
};

export const TRANSMISSAO_ETAPA_ROTULO: Record<TransmissaoEtapa, string> = {
  na_fila: "Na fila do robô",
  entrando_portal: "Entrando no portal",
  abrindo_painel: "Abrindo o Painel de Negócios",
  localizando_cotacao: "Localizando a cotação",
  escolhendo_seguradora: "Escolhendo seguradora e pagamento",
  preenchendo_efetivacao: "Preenchendo a Efetivação",
  confirmando: "Confirmando a transmissão",
  concluido: "Transmissão concluída",
  erro: "Erro na transmissão",
};

/** Passos exibidos na lista (sem "na_fila"). */
export const TRANSMISSAO_TOTAL_PASSOS = TRANSMISSAO_ETAPAS.length - 1;

/**
 * Corpo do POST do robô no webhook de etapa com `fluxo: "transmissao"`.
 * concluido/erro nunca vêm do robô (são gravados pelo webhook de resultado).
 */
export const transmissaoEtapaPayloadSchema = z
  .object({
    fluxo: z.literal("transmissao"),
    cotacaoId: z.string().uuid(),
    tentativaId: z.string().uuid(),
    etapa: z.enum(TRANSMISSAO_ETAPAS),
    seq: z.number().int().min(0).max(8),
  })
  .refine((p) => p.seq === TRANSMISSAO_ETAPA_SEQ[p.etapa], {
    message: "seq não bate com a etapa.",
  });
