// Schema zod do formulário de mensagens prontas — espelha as constraints reais
// da tabela `mensagens_prontas` (titulo/conteudo obrigatórios; `dia` entre 1 e
// 31 quando informado, conforme o check da migration q3_1). Valida ANTES do
// envio para dar erro amigável em vez do erro cru do Postgres.

import { z } from "zod";

export const mensagemFormSchema = z.object({
  titulo: z.string().trim().min(1, "Informe o título."),
  conteudo: z.string().trim().min(1, "Escreva o conteúdo da mensagem."),
  categoria: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 60, { message: "Categoria muito longa." }),
  objetivo: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 300, { message: "Objetivo muito longo (máx. 300)." }),
  dia: z
    .number()
    .int("Dia deve ser um número inteiro.")
    .min(1, "Dia deve ser entre 1 e 31.")
    .max(31, "Dia deve ser entre 1 e 31.")
    .nullable(),
});

export type MensagemForm = z.infer<typeof mensagemFormSchema>;
