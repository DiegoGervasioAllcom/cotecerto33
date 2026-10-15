// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Pagador do "Cartão Porto Bank (Terceiros)" (`pagador` do POST /transmissao):
// o titular do cartão é outra pessoa e o portal cobra os dados dela.
//
// DADO PESSOAL: mesmo cuidado do restante — nunca persistido nem logado pelo
// front; mensagens de erro NUNCA repetem o valor.
import { cnpjValido, cpfValido } from "@/lib/documento";

export const TIPOS_PESSOA_PAGADOR = ["Física", "Jurídica"] as const;
export const SEXOS_PAGADOR = ["Masculino", "Feminino"] as const;
// Opções do select "Estado Civil" do pagador no portal (lidas ao vivo em 14/10/2026).
export const ESTADOS_CIVIS_PAGADOR = [
  "Solteiro(a)",
  "Casado(a)",
  "Viúvo(a)",
  "Divorciado(a)/Separado(a)",
  "Outros",
] as const;

export type PagadorTransmissao = {
  tipoPessoa: (typeof TIPOS_PESSOA_PAGADOR)[number] | "";
  nome: string;
  /** CPF (Física) ou CNPJ (Jurídica), só dígitos. */
  documento: string;
  email: string;
  /** DDD (2 dígitos) e celular (8 a 9 dígitos, sem DDD). */
  ddd: string;
  telefone: string;
  // Obrigatórios só para pessoa Física (o portal cobra).
  sexo: (typeof SEXOS_PAGADOR)[number] | "";
  estadoCivil: (typeof ESTADOS_CIVIS_PAGADOR)[number] | "";
  /** DD/MM/AAAA. */
  dataNascimento: string;
};

export type ErrosPagador = Partial<Record<keyof PagadorTransmissao, string>>;

/** "15031985" -> "15/03/1985". */
export function mascararData(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida o pagador; devolve erros por campo ({} se estiver tudo certo). Nunca repete o valor. */
export function validarPagador(
  pagador: Partial<PagadorTransmissao> | undefined,
  agora: Date = new Date(),
): ErrosPagador {
  const erros: ErrosPagador = {};
  const p = pagador ?? {};
  const fisica = p.tipoPessoa === "Física";
  const juridica = p.tipoPessoa === "Jurídica";

  if (!fisica && !juridica) erros.tipoPessoa = "Escolha Física ou Jurídica.";

  if (typeof p.nome !== "string" || p.nome.trim() === "" || p.nome.trim().length > 100) {
    erros.nome = "Informe o nome do pagador (até 100 caracteres).";
  }

  const doc = typeof p.documento === "string" ? p.documento : "";
  if (fisica && !cpfValido(doc)) erros.documento = "CPF inválido.";
  else if (juridica && !cnpjValido(doc)) erros.documento = "CNPJ inválido.";
  else if (!fisica && !juridica && !doc.trim()) erros.documento = "Informe o CPF ou CNPJ.";

  if (
    typeof p.email !== "string" ||
    p.email.trim().length > 254 ||
    !REGEX_EMAIL.test(p.email.trim())
  ) {
    erros.email = "Informe um e-mail válido.";
  }
  if (typeof p.ddd !== "string" || !/^\d{2}$/.test(p.ddd.trim())) {
    erros.ddd = "DDD com 2 dígitos.";
  }
  if (typeof p.telefone !== "string" || !/^\d{8,9}$/.test(p.telefone.replace(/\D/g, ""))) {
    erros.telefone = "Celular com 8 ou 9 dígitos, sem o DDD.";
  }

  if (fisica) {
    if (!SEXOS_PAGADOR.some((s) => s === p.sexo)) erros.sexo = "Escolha o sexo.";
    if (!ESTADOS_CIVIS_PAGADOR.some((e) => e === p.estadoCivil)) {
      erros.estadoCivil = "Escolha o estado civil.";
    }
    const m =
      typeof p.dataNascimento === "string"
        ? p.dataNascimento.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        : null;
    const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
    const real = !!m && !!d && d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1;
    if (!real || (d as Date).getTime() >= agora.getTime()) {
      erros.dataNascimento = "Informe a data de nascimento (dd/mm/aaaa) no passado.";
    }
  }
  return erros;
}
