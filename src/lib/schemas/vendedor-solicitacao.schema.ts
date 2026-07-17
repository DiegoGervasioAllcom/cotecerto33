// Schema zod do form "Cadastrar vendedor" (xAcessos) — espelha as validações
// da RPC solicitar_vendedor (migration 045): nome obrigatório <= 150, cpf
// opcional mas se preenchido precisa ter 11 dígitos, celular <= 20, email
// válido <= 150. Todos os campos (exceto nome) só validam quando preenchidos.

import { z } from "zod";
import { onlyDigits } from "@/lib/masks";

export const vendedorNomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome completo.")
  .max(150, "Máximo de 150 caracteres.");

export const vendedorCpfSchema = z
  .string()
  .refine((v) => onlyDigits(v).length === 11, "CPF deve ter 11 dígitos.");

export const vendedorCelularSchema = z.string().max(20, "Máximo de 20 caracteres.");

export const vendedorEmailSchema = z
  .string()
  .trim()
  .email("E-mail inválido.")
  .max(150, "Máximo de 150 caracteres.");

export type VendedorSolicitacaoFields = {
  nome: string;
  cpf: string;
  celular: string;
  email: string;
};

export type VendedorSolicitacaoErrors = Partial<Record<keyof VendedorSolicitacaoFields, string>>;

/** Valida os 4 campos do form; cpf/celular/email só validam se preenchidos. */
export function validarVendedorSolicitacao(
  fields: VendedorSolicitacaoFields,
): VendedorSolicitacaoErrors {
  const errors: VendedorSolicitacaoErrors = {};

  const nomeCheck = vendedorNomeSchema.safeParse(fields.nome);
  if (!nomeCheck.success) errors.nome = nomeCheck.error.issues[0]?.message ?? "Nome inválido.";

  const cpfTrim = fields.cpf.trim();
  if (cpfTrim) {
    const cpfCheck = vendedorCpfSchema.safeParse(cpfTrim);
    if (!cpfCheck.success) errors.cpf = cpfCheck.error.issues[0]?.message ?? "CPF inválido.";
  }

  const celularTrim = fields.celular.trim();
  if (celularTrim) {
    const celularCheck = vendedorCelularSchema.safeParse(celularTrim);
    if (!celularCheck.success)
      errors.celular = celularCheck.error.issues[0]?.message ?? "Celular inválido.";
  }

  const emailTrim = fields.email.trim();
  if (emailTrim) {
    const emailCheck = vendedorEmailSchema.safeParse(emailTrim);
    if (!emailCheck.success)
      errors.email = emailCheck.error.issues[0]?.message ?? "E-mail inválido.";
  }

  return errors;
}
