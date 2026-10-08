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
  if (numero.length > 10) return { ok: false, erro: "Número do endereço muito longo (máx. 10)." };
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

/**
 * Complemento do endereço (opcional, ≤30 — espelha `cotacao_segurado.complemento`).
 * Vale o digitado na transmissão; senão o cadastro. Vazio vira `undefined`
 * (o payload ao robô omite o campo).
 */
export function resolverComplementoTransmissao(
  digitado?: string | null,
  cadastro?: string | null,
): { ok: true; complemento?: string; gravar: boolean } | { ok: false; erro: string } {
  const complemento = (digitado?.trim() || cadastro?.trim() || "").trim();
  if (complemento.length > 30) return { ok: false, erro: "Complemento muito longo (máx. 30)." };
  return {
    ok: true,
    complemento: complemento || undefined,
    gravar: !!complemento && complemento !== (cadastro ?? "").trim(),
  };
}

type EnderecoCorrespondenciaEntrada = {
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  complemento?: string;
};

/**
 * Campos de complemento do pedido ao robô: residencial sempre (se houver) e
 * correspondência só quando NÃO é o mesmo endereço. Chaves vazias são omitidas.
 */
export function montarComplementosPayload(
  complementoEndereco: string | undefined,
  mesmoEnderecoCorrespondencia: boolean | undefined,
  correspondencia: EnderecoCorrespondenciaEntrada | undefined,
): { complementoEndereco?: string; complementoCorrespondencia?: string } {
  const out: { complementoEndereco?: string; complementoCorrespondencia?: string } = {};
  const res = complementoEndereco?.trim();
  if (res && res.length > 30) throw new Error("Complemento muito longo (máx. 30).");
  if (res) out.complementoEndereco = res;
  const cor = correspondencia?.complemento?.trim();
  if (mesmoEnderecoCorrespondencia === false) {
    // Mesmos limites do portal, revalidados no servidor (o zod do front pode ser contornado).
    if (cor && cor.length > 30)
      throw new Error("Complemento da correspondência muito longo (máx. 30).");
    if ((correspondencia?.numero?.trim().length ?? 0) > 10) {
      throw new Error("Número da correspondência muito longo (máx. 10).");
    }
    if (cor) out.complementoCorrespondencia = cor;
  }
  return out;
}
