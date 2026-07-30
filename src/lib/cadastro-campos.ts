import { onlyDigits, maskCpfCnpj, maskTelefone } from "@/lib/masks";

/**
 * Campos e máscaras do formulário de cadastro.
 *
 * Extraído de `auth.cadastro.tsx` quando a rota `/convite/$token` (V11 · C7)
 * passou a precisar do mesmo formulário: são as mesmas perguntas, o que muda é
 * que pelo convite o tipo de pessoa vem decidido e perfil/vínculo aparecem em
 * texto fixo. Duplicar 180 linhas de definição de campo era garantia de
 * divergirem na primeira alteração.
 */

export type ModeloCadastro = "cnpj" | "cpf";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "password";
  ph?: string;
  full?: boolean;
  required?: boolean;
  maxLen?: number;
};

export const CNPJ_FIELDS: FieldDef[] = [
  {
    key: "nome",
    label: "Razão Social",
    type: "text",
    full: true,
    ph: "Empresa LTDA",
    required: true,
    maxLen: 150,
  },
  {
    key: "documento",
    label: "CNPJ",
    type: "text",
    ph: "00.000.000/0000-00",
    required: true,
    maxLen: 18,
  },
  { key: "data_nascimento", label: "Data de nascimento (sócio)", type: "date" },
  {
    key: "endereco",
    label: "Endereço completo",
    type: "text",
    full: true,
    ph: "Rua, nº, bairro, cidade - UF, CEP",
    maxLen: 2000,
  },
  {
    key: "socio_nome",
    label: "Nome do sócio operador",
    type: "text",
    full: true,
    ph: "Quem vai operar a franquia",
    required: true,
    maxLen: 150,
  },
  {
    key: "socio_cpf",
    label: "CPF do sócio operador",
    type: "text",
    ph: "000.000.000-00",
    maxLen: 14,
  },
  { key: "socio_rg", label: "RG do sócio operador", type: "text", ph: "00.000.000-0", maxLen: 20 },
  { key: "celular", label: "Celular", type: "tel", ph: "(11) 90000-0000", maxLen: 15 },
  {
    key: "telefone_recado",
    label: "Outro telefone / recado",
    type: "tel",
    ph: "(11) 90000-0000",
    maxLen: 15,
  },
  {
    key: "email",
    label: "E-mail",
    type: "email",
    full: true,
    ph: "voce@email.com",
    required: true,
    maxLen: 254,
  },
  {
    key: "pix_chave",
    label: "Chave Pix (conta PJ)",
    type: "text",
    full: true,
    ph: "CNPJ, e-mail, telefone ou chave aleatória",
    maxLen: 150,
  },
  {
    key: "dados_bancarios",
    label: "Banco / Agência / Conta (PJ)",
    type: "text",
    full: true,
    ph: "Banco 000 · Ag 0001 · CC 00000-0",
    maxLen: 2000,
  },
  {
    key: "password",
    label: "Senha de acesso",
    type: "password",
    ph: "Mínimo 6 caracteres",
    required: true,
  },
];

export const CPF_FIELDS: FieldDef[] = [
  {
    key: "nome",
    label: "Nome completo",
    type: "text",
    full: true,
    ph: "Seu nome",
    required: true,
    maxLen: 150,
  },
  {
    key: "documento",
    label: "CPF",
    type: "text",
    ph: "000.000.000-00",
    required: true,
    maxLen: 14,
  },
  { key: "rg", label: "RG", type: "text", ph: "00.000.000-0", maxLen: 20 },
  { key: "data_nascimento", label: "Data de nascimento", type: "date" },
  { key: "celular", label: "Celular", type: "tel", ph: "(11) 90000-0000", maxLen: 15 },
  {
    key: "endereco",
    label: "Endereço completo",
    type: "text",
    full: true,
    ph: "Rua, nº, bairro, cidade - UF, CEP",
    maxLen: 2000,
  },
  {
    key: "telefone_recado",
    label: "Outro telefone / recado",
    type: "tel",
    ph: "(11) 90000-0000",
    maxLen: 15,
  },
  {
    key: "contato_emergencia",
    label: "Contato de emergência",
    type: "text",
    full: true,
    ph: "Nome e telefone do contato",
    maxLen: 2000,
  },
  {
    key: "email",
    label: "E-mail",
    type: "email",
    full: true,
    ph: "voce@email.com",
    required: true,
    maxLen: 254,
  },
  {
    key: "pix_chave",
    label: "Chave Pix",
    type: "text",
    full: true,
    ph: "CPF, e-mail, telefone ou chave aleatória",
    maxLen: 150,
  },
  {
    key: "dados_bancarios",
    label: "Banco / Agência / Conta",
    type: "text",
    full: true,
    ph: "Banco 000 · Ag 0001 · CC 00000-0",
    maxLen: 2000,
  },
  {
    key: "password",
    label: "Senha de acesso",
    type: "password",
    ph: "Mínimo 6 caracteres",
    required: true,
  },
];

export function camposDoModelo(modelo: ModeloCadastro): FieldDef[] {
  return modelo === "cnpj" ? CNPJ_FIELDS : CPF_FIELDS;
}

export function maskFor(key: string, raw: string): string {
  const d = onlyDigits(raw);
  switch (key) {
    case "documento":
      // CPF (11) ou CNPJ (14)
      return maskCpfCnpj(raw);
    case "socio_cpf":
      return d
        .slice(0, 11)
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    case "socio_rg":
    case "rg":
      return d
        .slice(0, 9)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    case "celular":
    case "telefone_recado":
      return maskTelefone(raw);
    default:
      return raw;
  }
}
