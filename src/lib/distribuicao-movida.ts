import { z } from "zod";

export const lojaMovidaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome exibido da loja.").max(120),
  alias: z.string().trim().min(1, "Informe a chave recebida da Movida.").max(160),
  empresaId: z.string().uuid("Selecione a empresa de destino."),
  ativa: z.boolean(),
  exigirOnline: z.boolean(),
});

export const aliasMovidaSchema = z
  .string()
  .trim()
  .min(1, "Informe o alias da loja.")
  .max(160, "O alias deve ter no máximo 160 caracteres.");

export const membroPoolMovidaSchema = z.object({
  vendedorId: z.string().uuid("Selecione um vendedor."),
  peso: z.coerce
    .number()
    .int("O peso deve ser inteiro.")
    .min(1, "O peso mínimo é 1.")
    .max(100, "O peso máximo é 100."),
  limiteDiario: z
    .number()
    .int("O limite deve ser inteiro.")
    .min(1, "O limite mínimo é 1.")
    .nullable(),
  ativo: z.boolean(),
});

export type LojaMovidaForm = z.infer<typeof lojaMovidaSchema>;
export type MembroPoolMovidaForm = z.infer<typeof membroPoolMovidaSchema>;

export function normalizarChaveLojaMovida(valor: string): string {
  return valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function somarPendenciasAliasesMovida(
  aliasesNormalizados: readonly (string | null)[],
  pendenciasPorAlias: ReadonlyMap<string, number>,
): number {
  return aliasesNormalizados.reduce(
    (total, alias) => total + (alias ? (pendenciasPorAlias.get(alias) ?? 0) : 0),
    0,
  );
}
