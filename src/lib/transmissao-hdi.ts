// Módulo compartilhado (cliente + servidor): campos da transmissão que só a HDI exige. Espelha o contrato do robô em
// `POST /transmissao`: `ramoAtividade` (= Ocupação do portal), `rendaMensal` (= Faixa salarial), `pessoaPoliticamenteExposta`
// (só Sim/Não), `ufPlaca` e `produtoId`. Todas são declarações do vendedor: SEM valor padrão (a UF só vem pré-selecionada do
// endereço do segurado). Sem documento, órgão, renavam, tipo de logradouro nem CPF do vendedor.
// O pagamento (débito/cartão) é o mesmo da família Yelum (ver `transmissao-yelum.ts`).
// Mensagens de erro NUNCA repetem o valor recebido.
import { OCUPACOES_HDI } from "@/components/venda/novo-lead/enumsOcupacaoHdi";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";

/** Faixa salarial do select da HDI (texto exato do portal; o robô casa por igualdade normalizada). */
export const FAIXAS_SALARIAIS_HDI = [
  "até R$ 3.000,00",
  "de R$ 3.000,01 a R$ 5.000,00",
  "de R$ 5.000,01 a R$ 10.000,00",
  "de R$ 10.000,01 a R$ 20.000,00",
  "acima de R$ 20.000,00",
  "do lar, sem renda a informar",
  "Não Informado",
] as const;

/** A HDI só aceita Sim/Não (a lista de 3 valores da Porto/Tokio NÃO vale aqui). */
export const PEP_HDI = ["Sim", "Não"] as const;

export const UFS_HDI = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const; // prettier-ignore

export const ERRO_PRODUTO_SEM_ID_HDI = "Produto sem identificação — recalcule a cotação.";

export type DadosHdi = {
  ramoAtividade?: string;
  rendaMensal?: string;
  pessoaPoliticamenteExposta?: string;
  ufPlaca?: string;
};

export function ehSeguradoraHdi(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "hdi seguros";
}

/** UF do endereço do segurado, em maiúsculas, só se for uma das 27 da lista (senão undefined: o campo começa vazio). */
export function ufPlacaDoEndereco(uf: string | undefined | null): string | undefined {
  const u = (uf ?? "").trim().toUpperCase();
  return (UFS_HDI as readonly string[]).includes(u) ? u : undefined;
}

/** Erro por campo dos 4 obrigatórios da HDI ({} se tudo certo). Usado pelo schema e pelo servidor. */
export function errosDadosHdi(
  dados: DadosHdi | undefined,
): Partial<Record<keyof DadosHdi, string>> {
  const d = dados ?? {};
  const erros: Partial<Record<keyof DadosHdi, string>> = {};
  if (!d.ramoAtividade || !OCUPACOES_HDI.includes(d.ramoAtividade)) {
    erros.ramoAtividade = "Escolha a ocupação na lista.";
  }
  if (!d.rendaMensal || !(FAIXAS_SALARIAIS_HDI as readonly string[]).includes(d.rendaMensal)) {
    erros.rendaMensal = "Informe a faixa salarial.";
  }
  if (
    !d.pessoaPoliticamenteExposta ||
    !(PEP_HDI as readonly string[]).includes(d.pessoaPoliticamenteExposta)
  ) {
    erros.pessoaPoliticamenteExposta = "Informe se é pessoa politicamente exposta.";
  }
  if (!d.ufPlaca || !(UFS_HDI as readonly string[]).includes(d.ufPlaca.trim().toUpperCase())) {
    erros.ufPlaca = "Escolha a UF da placa.";
  }
  return erros;
}

/** Regra de bloqueio (servidor). Devolve a mensagem, ou `null` (também para outras seguradoras). */
export function erroDadosHdi(
  seguradora: string,
  dados: DadosHdi | undefined,
  produtoId: string | undefined,
): string | null {
  if (!ehSeguradoraHdi(seguradora)) return null;
  // A Confirmação da HDI não exibe o produto: o ID é a única garantia contra Fit/Básico/Compreensiva.
  if (!produtoId || !produtoId.trim()) return ERRO_PRODUTO_SEM_ID_HDI;
  const primeiro = Object.values(errosDadosHdi(dados))[0];
  return primeiro ? `${primeiro} (exigido pela HDI)` : null;
}

/** Campos extras do payload — só HDI. Sem `cpfVendedor`, `tipoLogradouro`, `veiculoAlienado` nem `kitApolicePorEmail`. */
export function camposHdiPayload(seguradora: string, dados: DadosHdi | undefined): DadosHdi {
  if (!ehSeguradoraHdi(seguradora) || !dados) return {};
  const c: DadosHdi = {};
  if (dados.ramoAtividade) c.ramoAtividade = dados.ramoAtividade;
  if (dados.rendaMensal) c.rendaMensal = dados.rendaMensal;
  if (dados.pessoaPoliticamenteExposta)
    c.pessoaPoliticamenteExposta = dados.pessoaPoliticamenteExposta;
  if (dados.ufPlaca) c.ufPlaca = dados.ufPlaca.trim().toUpperCase();
  return c;
}
