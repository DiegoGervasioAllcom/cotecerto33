// Primitivos zod reaproveitados entre schemas (cadastro, catálogos, etc).
// Espelham constraints reais do banco — não tornam obrigatório o que não é.

import { z } from "zod";

export const email = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .email("E-mail inválido.")
  .max(254, "E-mail muito longo.");

export const password = z.string().min(6, "Senha deve ter pelo menos 6 caracteres.");
