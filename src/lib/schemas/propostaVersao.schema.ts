// Schema do formulário "Registrar nova versão" de negociação de proposta (G7.2).
// Espelha a RPC registrar_versao_proposta: nota obrigatória (<=1000), parcelas
// 1..99 quando informadas, prêmio >= 0 quando informado.

import { z } from "zod";

export const propostaVersaoSchema = z.object({
  premio: z
    .union([z.number(), z.nan()])
    .optional()
    .refine((v) => v === undefined || Number.isNaN(v) || v >= 0, {
      message: "Prêmio não pode ser negativo.",
    }),
  formaPagamento: z.string().trim().max(60, "Máximo 60 caracteres.").optional(),
  parcelas: z
    .union([z.number(), z.nan()])
    .optional()
    .refine((v) => v === undefined || Number.isNaN(v) || (v >= 1 && v <= 99), {
      message: "Parcelas deve ser entre 1 e 99.",
    }),
  nota: z
    .string()
    .trim()
    .min(1, "Informe uma nota descrevendo a mudança.")
    .max(1000, "Máximo 1000 caracteres."),
});

export type PropostaVersaoForm = z.infer<typeof propostaVersaoSchema>;
