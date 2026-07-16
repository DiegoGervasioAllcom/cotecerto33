// Schema zod da etapa "Segurado" do wizard novo-lead (cotacao_segurado).
// Espelha as constraints reais do banco (D1 tamanho + D3 formato) para avisar
// o usuário ANTES de avançar, sem serem mais restritivos: todo campo é
// opcional (mesma lógica dos checks `col is null or col = '' or ...`) e só
// valida formato/tamanho se o campo estiver preenchido.

import { z } from "zod";
import { onlyDigits } from "@/lib/masks";

function optionalDigitsExact(lengths: number[], message: string) {
  return z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || lengths.includes(onlyDigits(v).length), { message });
}

function optionalDigitsRange(min: number, max: number, message: string) {
  return z
    .string()
    .optional()
    .refine(
      (v) => !v || !v.trim() || (onlyDigits(v).length >= min && onlyDigits(v).length <= max),
      {
        message,
      },
    );
}

function optionalMax(max: number, message: string) {
  return z.string().max(max, message).optional();
}

export const seguradoSchema = z.object({
  cpf: optionalDigitsExact([11, 14], "CPF ou CNPJ inválido."),
  pessoa: optionalMax(20, "Campo muito longo."),
  nome: optionalMax(150, "Nome muito longo."),
  nomeSocial: optionalMax(150, "Nome social muito longo."),
  sexo: optionalMax(30, "Campo muito longo."),
  estadoCivil: optionalMax(30, "Campo muito longo."),
  celular: optionalDigitsRange(10, 11, "Telefone celular inválido."),
  telRes: optionalDigitsRange(10, 11, "Telefone residencial inválido."),
  email: z
    .string()
    .optional()
    .refine((v) => !v || !v.trim() || z.string().email().safeParse(v).success, {
      message: "E-mail inválido.",
    })
    .refine((v) => !v || v.length <= 254, { message: "E-mail muito longo." }),
  cep: optionalDigitsExact([8], "CEP inválido."),
  logradouro: optionalMax(2000, "Logradouro muito longo."),
  bairro: optionalMax(2000, "Bairro muito longo."),
  cidade: optionalMax(150, "Cidade muito longa."),
  uf: optionalMax(2, "UF inválida."),
});

export type SeguradoFormValues = z.infer<typeof seguradoSchema>;
