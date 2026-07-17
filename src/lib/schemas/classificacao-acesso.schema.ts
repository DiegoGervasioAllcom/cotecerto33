// Schemas zod dos campos do modal "Classificar acesso" (Acessos e permissões).
// Espelham os checks da migration 044 (g1_4_campos_classificacao_acesso):
// percentuais 0-100, valores >= 0, dia de pagamento 1-31, equipe <= 120 chars.
// Todos os campos são opcionais — só validam quando preenchidos.

import { z } from "zod";

export const pctSchema = z
  .number({ message: "Informe um número." })
  .min(0, "Mínimo 0%.")
  .max(100, "Máximo 100%.");

export const valorNaoNegativoSchema = z
  .number({ message: "Informe um número." })
  .min(0, "Não pode ser negativo.");

export const diaPagamentoSchema = z
  .number({ message: "Informe um número." })
  .int("Informe um dia inteiro.")
  .min(1, "Dia entre 1 e 31.")
  .max(31, "Dia entre 1 e 31.");

export const leadsDiaSchema = z
  .number({ message: "Informe um número." })
  .int("Informe um número inteiro.")
  .min(0, "Não pode ser negativo.");

export const equipeSchema = z.string().trim().max(120, "Nome de equipe muito longo.");

/** Valida um campo numérico opcional só quando `raw` não está vazio. `parse`
 *  converte o texto mascarado (R$/%/inteiro) num número antes de checar contra
 *  o schema. Retorna a mensagem de erro (ou null) e o número (ou null se vazio). */
export function checkOptionalNumber(
  raw: string,
  parse: (s: string) => number,
  schema: z.ZodType<number>,
): { error: string | null; value: number | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: null, value: null };
  const n = parse(trimmed);
  const check = schema.safeParse(n);
  if (!check.success)
    return { error: check.error.issues[0]?.message ?? "Valor inválido.", value: null };
  return { error: null, value: check.data };
}

export function checkOptionalEquipe(raw: string): { error: string | null; value: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { error: null, value: null };
  const check = equipeSchema.safeParse(trimmed);
  if (!check.success)
    return { error: check.error.issues[0]?.message ?? "Valor inválido.", value: null };
  return { error: null, value: check.data };
}
