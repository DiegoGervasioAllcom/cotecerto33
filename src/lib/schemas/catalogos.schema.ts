// Schemas zod dos catálogos administrativos (seguradoras, modelos de franquia).
// Espelham as constraints reais do banco (D1 tamanho) para avisar o usuário
// ANTES do envio, sem serem mais restritivos: campos opcionais só validam se
// preenchidos.

import { z } from "zod";

export const seguradoraSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(150, "Nome muito longo."),
  codigo: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || v.trim().length <= 30, {
      message: "Código muito longo.",
    }),
});

export const modeloFranquiaNomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(150, "Nome muito longo.");

export const premiacaoCampanhaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(150, "Nome muito longo."),
  seguradora_id: z.string().uuid().nullable().optional(),
  competencia: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}$/.test(v), { message: "Competência inválida (AAAA-MM)." }),
  descricao: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 300, { message: "Descrição muito longa (máx. 300)." }),
  ativa: z.boolean(),
});

export const premiacaoLancamentoSchema = z.object({
  campanha_id: z.string().uuid("Selecione a campanha."),
  vendedor_id: z.string().uuid("Selecione o vendedor."),
  empresa_id: z.string().uuid().nullable().optional(),
  competencia: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Competência inválida (AAAA-MM)."),
  valor: z.coerce.number().min(0, "Valor não pode ser negativo."),
  observacao: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 500, { message: "Observação muito longa." }),
});
