// Regra de bloqueio da transmissão (V12.x): E-mail e Número do endereço são
// opcionais no passo 1, mas OBRIGATÓRIOS para transmitir. A validação roda no
// servidor (`transmitirPropostaQuiver`); o front só espelha. Função pura para
// ser testável sem rede/banco.
import { z } from "zod";

export type ContatoTransmissao = {
  email: string;
  numero: string;
  /** true quando o valor final difere do cadastro → vale gravar de volta. */
  gravarEmail: boolean;
  gravarNumero: boolean;
};

export function resolverContatoTransmissao(
  digitado: { email?: string | null; numero?: string | null },
  cadastro: { email?: string | null; numero?: string | null },
): { ok: true; contato: ContatoTransmissao } | { ok: false; erro: string } {
  const email = (digitado.email?.trim() || cadastro.email?.trim() || "").trim();
  const numero = (digitado.numero?.trim() || cadastro.numero?.trim() || "").trim();
  if (!email) return { ok: false, erro: "Informe o e-mail do segurado para transmitir." };
  if (email.length > 254 || !z.string().email().safeParse(email).success) {
    return { ok: false, erro: "E-mail do segurado inválido." };
  }
  if (!numero)
    return { ok: false, erro: "Informe o número do endereço do segurado para transmitir." };
  if (numero.length > 20) return { ok: false, erro: "Número do endereço muito longo." };
  return {
    ok: true,
    contato: {
      email,
      numero,
      gravarEmail: email !== (cadastro.email ?? "").trim(),
      gravarNumero: numero !== (cadastro.numero ?? "").trim(),
    },
  };
}
