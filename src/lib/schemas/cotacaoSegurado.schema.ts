// Schema zod da etapa "Segurado" do wizard novo-lead (cotacao_segurado).
// Espelha as constraints reais do banco (D1 tamanho + D3 formato) para avisar
// o usuário ANTES de avançar, sem serem mais restritivos: todo campo é
// opcional (mesma lógica dos checks `col is null or col = '' or ...`) e só
// valida formato/tamanho se o campo estiver preenchido — exceto `nomeSocial`,
// ver superRefine abaixo.

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

export const seguradoSchema = z
  .object({
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
  })
  // Nome social é a única exceção à regra "todo campo é opcional" desta etapa:
  // decisão de negócio (não vem do protótipo) — obrigatório, diferente do
  // Nome e composto (nome + sobrenome), pra não aceitar um nome social vazio
  // de fato ou copiado do Nome civil.
  .superRefine((v, ctx) => {
    // R.10 (revisão form vs robô Quiver, 2026-08): o robô só cota para
    // Pessoa Física (validarCpf.ts do robô usa módulo 11, 11 dígitos).
    // O campo aceita CNPJ (14 dígitos) na digitação/máscara e no banco,
    // mas bloqueamos aqui o avanço de etapa para não gerar 422 no envio.
    if (v.cpf && onlyDigits(v.cpf).length === 14) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cpf"],
        message:
          "O robô de cotação só aceita Pessoa Física (CPF) por enquanto. CNPJ não é suportado.",
      });
    }
    const nomeSocial = (v.nomeSocial ?? "").trim();
    if (!nomeSocial) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomeSocial"],
        message: "Nome social é obrigatório.",
      });
      return;
    }
    const nome = (v.nome ?? "").trim();
    if (nome && nomeSocial.toLowerCase() === nome.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomeSocial"],
        message: "Nome social não pode ser igual ao Nome.",
      });
      return;
    }
    if (nomeSocial.split(/\s+/).filter(Boolean).length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomeSocial"],
        message: "Informe nome e sobrenome (nome composto).",
      });
    }
  });

export type SeguradoFormValues = z.infer<typeof seguradoSchema>;
