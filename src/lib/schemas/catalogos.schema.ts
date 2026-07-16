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
