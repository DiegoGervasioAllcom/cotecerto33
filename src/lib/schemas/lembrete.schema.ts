// Schema zod do formulário "Novo lembrete" (Frente 9 · V12 · Minha agenda).
// Espelha as constraints reais da tabela `lembretes`
// (20260917020000_lembretes.sql): tipo restrito ao check da coluna,
// titulo/nota com no máximo 2000 caracteres, data obrigatória.

import { z } from "zod";

export const LEMBRETE_TIPOS = ["tarefa", "ligacao", "reuniao", "pessoal"] as const;
export type LembreteTipo = (typeof LEMBRETE_TIPOS)[number];

export const LEMBRETE_TIPO_LABEL: Record<LembreteTipo, string> = {
  tarefa: "Tarefa",
  ligacao: "Ligação",
  reuniao: "Reunião",
  pessoal: "Pessoal",
};

export const LEMBRETE_TIPO_ICON: Record<LembreteTipo, string> = {
  tarefa: "i-check",
  ligacao: "i-phone",
  reuniao: "i-calendar",
  pessoal: "i-user",
};

export const lembreteFormSchema = z.object({
  tipo: z.enum(LEMBRETE_TIPOS),
  titulo: z
    .string()
    .trim()
    .min(1, "Escreva o que precisa ser feito.")
    .max(2000, "Título muito longo (máx. 2000)."),
  nota: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length <= 2000, {
      message: "Observação muito longa (máx. 2000).",
    }),
  data: z.string().min(1, "Informe a data."),
  hora: z.string().optional(),
  lead_id: z.string().optional(),
});

export type LembreteForm = z.infer<typeof lembreteFormSchema>;
