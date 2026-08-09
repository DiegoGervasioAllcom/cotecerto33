import { z } from "zod";

export const cadastroDiretoIdentidadeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo.").max(150),
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Informe um CPF válido."),
  celular: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "Informe um celular válido."),
});

export const cadastroDiretoFullSchema = cadastroDiretoIdentidadeSchema.extend({
  equipe: z.string().trim().max(120),
  leadsDia: z.coerce.number().int().min(0).max(1000),
  comissaoVenda: z.coerce.number().min(0).max(100),
  comissaoRenovacao: z.coerce.number().min(0).max(100),
});
