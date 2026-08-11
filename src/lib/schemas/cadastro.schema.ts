// Schemas zod do formulário de cadastro (auth.cadastro.tsx).
// Espelham as constraints reais do banco (D1 tamanho + D3 formato) para avisar
// o usuário ANTES do envio, sem serem mais restritivos: campos opcionais só
// validam se preenchidos (mesma lógica dos checks `col is null or col = '' or ...`).

import { z } from "zod";
import { onlyDigits } from "@/lib/masks";
import { email } from "@/lib/schemas/common";

function optionalDigits(min: number, max: number) {
  return z
    .string()
    .optional()
    .refine(
      (v) => !v || !v.trim() || (onlyDigits(v).length >= min && onlyDigits(v).length <= max),
      {
        message: "Telefone inválido.",
      },
    );
}

function obrigatorioDigits(min: number, max: number, mensagemVazio: string) {
  return z
    .string()
    .trim()
    .min(1, mensagemVazio)
    .refine((v) => onlyDigits(v).length >= min && onlyDigits(v).length <= max, {
      message: "Telefone inválido.",
    });
}

const nome = z.string().trim().min(1, "Informe o nome.").max(150, "Nome muito longo.");

const documento = z
  .string()
  .trim()
  .min(1, "Informe o documento.")
  .refine((v) => [11, 14].includes(onlyDigits(v).length), {
    message: "CPF ou CNPJ inválido.",
  });

const socioCpf = z
  .string()
  .optional()
  .refine((v) => !v || !v.trim() || onlyDigits(v).length === 11, {
    message: "CPF do sócio inválido.",
  });

const rgObrigatorio = z.string().trim().min(1, "Informe o RG.").max(20, "RG muito longo.");

const dataNascimentoObrigatoria = z.string().trim().min(1, "Informe a data de nascimento.");

const textoLongoOpcional = z.string().max(2000, "Texto muito longo.").optional();

const contatoEmergenciaObrigatorio = z
  .string()
  .trim()
  .min(1, "Informe um contato de emergência.")
  .max(2000, "Texto muito longo.");

const pixChave = z.string().max(150, "Chave Pix muito longa.").optional();

const dadosBancariosOpcionais = {
  banco: z.string().max(80, "Texto muito longo.").optional(),
  agencia: z.string().max(20, "Texto muito longo.").optional(),
  conta: z.string().max(30, "Texto muito longo.").optional(),
};

export const cnpjCadastroSchema = z.object({
  nome,
  documento,
  data_nascimento: dataNascimentoObrigatoria,
  endereco: textoLongoOpcional,
  socio_nome: nome,
  socio_cpf: socioCpf,
  socio_rg: rgObrigatorio,
  celular: obrigatorioDigits(10, 11, "Informe o celular."),
  telefone_recado: optionalDigits(10, 11),
  email,
  pix_chave: pixChave,
  ...dadosBancariosOpcionais,
});

export const cpfCadastroSchema = z.object({
  nome,
  documento,
  rg: rgObrigatorio,
  data_nascimento: dataNascimentoObrigatoria,
  celular: obrigatorioDigits(10, 11, "Informe o celular."),
  endereco: textoLongoOpcional,
  telefone_recado: optionalDigits(10, 11),
  contato_emergencia: contatoEmergenciaObrigatorio,
  email,
  pix_chave: pixChave,
  ...dadosBancariosOpcionais,
});

export type CadastroFormValues =
  | z.infer<typeof cnpjCadastroSchema>
  | z.infer<typeof cpfCadastroSchema>;

// V11 · C3 (Frente 3) — "Cadastro manual · exceção". Documento troca de tamanho
// junto com `tipo` (pj=CNPJ, pf=CPF), por isso a checagem de formato entra via
// superRefine em vez do primitivo `documento` (que aceita os dois tamanhos).
export const cadastroManualSchema = z
  .object({
    nome,
    tipo: z.enum(["pj", "pf"]),
    documento: z.string().trim().min(1, "Informe o documento."),
    email,
    celular: optionalDigits(10, 11),
    cidade: z.string().trim().max(120, "Cidade muito longa.").optional(),
    uf: z
      .string()
      .optional()
      .refine((v) => !v || v.trim().length === 2, { message: "UF inválida." }),
  })
  .superRefine((data, ctx) => {
    const tamanho = data.tipo === "pj" ? 14 : 11;
    const rotulo = data.tipo === "pj" ? "CNPJ" : "CPF";
    if (onlyDigits(data.documento).length !== tamanho) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documento"],
        message: `${rotulo} inválido.`,
      });
    }
  });

export type CadastroManualValues = z.infer<typeof cadastroManualSchema>;
