import { z } from "zod";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";

const textoOpcional = z.string().trim().optional();

// V12.4.2/V12.4.5 — contratos opcionais do robô. Cada entrada inválida é
// descartada individualmente: nunca derruba o card nem o payload.
const MOTIVO_MAX = 300;
const MENSAGENS_MAX_POR_CARD = 20;

const textoCurtoOpcional = z.string().trim().min(1).max(150).optional().catch(undefined);

const semRetornoItemSchema = z.object({
  seguradora: textoCurtoOpcional,
  produtoId: textoCurtoOpcional,
  produto: textoCurtoOpcional,
  faixa: textoCurtoOpcional,
  motivo: z.string().trim().min(1).max(MOTIVO_MAX),
});

const mensagensFaixaSchema = z.object({
  faixa: textoCurtoOpcional,
  mensagens: z
    .array(z.unknown())
    .transform((itens) =>
      itens
        .flatMap((m) => (typeof m === "string" && m.trim() ? [m.trim().slice(0, MOTIVO_MAX)] : []))
        .slice(0, MENSAGENS_MAX_POR_CARD),
    ),
});

export type SemRetornoItem = z.infer<typeof semRetornoItemSchema>;
export type MensagensFaixa = { faixa?: string; mensagens: string[] };

const mensagensRetornoSchema = z
  .array(z.unknown())
  .transform((itens): MensagensFaixa[] =>
    itens.flatMap((item) => {
      const r = mensagensFaixaSchema.safeParse(item);
      return r.success && r.data.mensagens.length > 0 ? [r.data] : [];
    }),
  )
  .optional()
  .catch(undefined);

export const opcaoPremioSchema = z.object({
  tipo: textoOpcional,
  avista: textoOpcional,
  desconto: textoOpcional,
  franquia: textoOpcional,
  parcelas: textoOpcional,
  // Todas as variantes de parcelamento que o portal Quiver calculou pra essa
  // faixa (ex.: "6x sem juros de R$ 1.896,08", "12x sem juros de R$ 948,04"),
  // não só a que o robô via renderizada por padrão em `parcelas`. O robô lê
  // isso de spans escondidos no DOM (ver cotacaoPaginaPremios.ts no repo
  // playwright) — sem esse campo, o card só conseguia mostrar 1 opção de
  // parcela por faixa mesmo quando a seguradora oferecia várias.
  parcelasOpcoes: z.array(z.string()).optional(),
  // Número do orçamento na seguradora (só dígitos), quando ela informa. Valor
  // inválido é ignorado sem derrubar a faixa.
  numeroOrcamentoCia: z
    .string()
    .trim()
    .regex(/^\d{1,20}$/)
    .optional()
    .catch(undefined),
});

const formasPagamentoSchema = z.object({
  opcoes: z.array(z.string()),
  selecionada: textoOpcional,
});

const premioPorFormaPagamentoSchema = z.object({
  formaPagamento: z.string(),
  opcoes: z.array(opcaoPremioSchema),
});

export const resultadoCalculoSchema = z.object({
  index: z.number().int().nonnegative().optional(),
  seguradora: z.string().trim().min(1),
  nome: z.string().trim().default(""),
  produto: textoOpcional,
  // Código do produto no portal (ex.: "10290_81"). O robô envia no webhook e
  // é a chave EXATA para a transmissão escolher a oferta certa — sem declarar
  // aqui, o zod descartava o campo silenciosamente e ele nunca chegava à UI.
  produtoId: textoOpcional,
  opcoes: z.array(opcaoPremioSchema).default([]),
  formaPagamento: textoOpcional,
  formasPagamento: formasPagamentoSchema.optional(),
  coberturasBasicas: z.record(z.string()).optional(),
  coberturasAdicionais: z.record(z.string()).optional(),
  premiosPorFormaPagamento: z.array(premioPorFormaPagamentoSchema).optional(),
  // Rótulo literal da seção no portal (ex.: "Ofertas adicionais"). Opcional:
  // robô/cotações antigas não enviam; valor inválido é ignorado sem derrubar o card.
  secao: z.string().trim().min(1).max(150).optional().catch(undefined),
  // Mensagens da seguradora por faixa (V12.4.5). Ausente/vazio = sem mensagens.
  mensagensRetorno: mensagensRetornoSchema,
});

const payloadSchema = z.object({ cards: z.array(z.unknown()).default([]) });

export type OpcaoPremio = z.infer<typeof opcaoPremioSchema>;
export type ResultadoCalculo = Omit<z.infer<typeof resultadoCalculoSchema>, "index"> & {
  index: number;
  cardId: string;
};

export type PremioVinculavel = {
  id: string;
  seguradora: string;
  cobertura: string | null;
  premio: number;
};

export type GrupoOpcoesPremio = {
  id: string;
  formaPagamento: string;
  opcoes: Array<OpcaoPremio & { id: string }>;
};

export function parseQuiverResultado(payload: unknown): ResultadoCalculo[] {
  const parsedPayload = payloadSchema.safeParse(payload);
  if (!parsedPayload.success) return [];

  return parsedPayload.data.cards.flatMap((card, position) => {
    const parsedCard = resultadoCalculoSchema.safeParse(card);
    if (!parsedCard.success) return [];
    return [
      {
        ...parsedCard.data,
        index: parsedCard.data.index ?? position,
        cardId: `quiver-card-${position}`,
      },
    ];
  });
}

/** Lê `semRetorno` da raiz do payload; entradas inválidas são descartadas. */
export function parseQuiverSemRetorno(payload: unknown): SemRetornoItem[] {
  if (typeof payload !== "object" || payload === null) return [];
  const bruto = (payload as { semRetorno?: unknown }).semRetorno;
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((item) => {
    const r = semRetornoItemSchema.safeParse(item);
    return r.success ? [r.data] : [];
  });
}

export function premioNumerico(opcao?: OpcaoPremio): number {
  const avista = opcao?.avista;
  if (avista) {
    const match = avista.match(/(?:R\$\s*)?([\d.]+(?:,\d+)?)/);
    if (match) {
      const numero = Number(match[1].replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(numero)) return numero;
    }
  }
  // Sem preço à vista (produto só parcelado, ex.: Suhai "Roubo e Furto c/
  // Assistência", parcelas: "em 12x de R$ 463,20"): mesmo fallback usado na
  // RPC registrar_premios_quiver (ver migração
  // 20260817000000_quiver_fallback_premio_parcelado.sql) — exige a parte
  // decimal (vírgula) pra não confundir a quantidade de parcelas ("12x")
  // com o valor.
  const parcelas = opcao?.parcelas;
  if (parcelas) {
    const match = parcelas.match(/([\d.]*\d,\d{1,2})/);
    if (match) {
      const numero = Number(match[1].replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(numero)) return numero;
    }
  }
  return Infinity;
}

/**
 * Discriminadores que identificam uma faixa/opção dentro de um card (mesma
 * chave usada em `faixasComParcelas`) — servem para o servidor localizar,
 * dentro de `cotacoes.quiver_resultado_raw`, EXATAMENTE a opção que o
 * vendedor escolheu no front, em vez de confiar num prêmio calculado no
 * cliente (AGENTS.md regra 2 — dinheiro/alçada roda no servidor).
 */
export type OpcaoIdentificador = {
  tipo?: string;
  franquia?: string;
  avista?: string;
  desconto?: string;
};

export type PremioTransmissaoOk = {
  ok: true;
  premio: number;
  parcelasNum: number | null;
  valorParcela: number | null;
};
export type PremioTransmissaoErro = { ok: false; erro: string };
export type PremioTransmissaoResultado = PremioTransmissaoOk | PremioTransmissaoErro;

function extrairAVista(texto?: string | null): number | null {
  if (!texto) return null;
  const match = texto.match(/(?:R\$\s*)?([\d.]+(?:,\d+)?)/);
  if (!match) return null;
  const numero = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Valor do próprio texto de parcelas "À vista R$ 3.193,82" (Suhai: o campo
 * `avista` da faixa vem vazio e o preço à vista só existe como variante de
 * parcelamento). Exige vírgula decimal (nunca confunde "12x"/quantidade) e
 * valor > 0.
 */
function extrairAVistaDeParcelas(texto?: string | null): number | null {
  if (!texto) return null;
  // Prefere o valor logo após "R$" (ignora percentuais como "5,5% desc." antes
  // do preço); sem "R$", usa o último valor com vírgula decimal do texto.
  const comMoeda = texto.match(/R\$\s*([\d.]*\d,\d{1,2})/);
  const todos = texto.match(/[\d.]*\d,\d{1,2}/g);
  const bruto = comMoeda?.[1] ?? todos?.[todos.length - 1];
  if (!bruto) return null;
  const numero = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Espelha `fn_premio_total_de_parcelas` (SQL,
 * `supabase/migrations/20260928090000_premio_base_soma_parcelas.sql`): exige
 * a quantidade (1–12) E o valor da parcela extraíveis com segurança do
 * mesmo texto — nunca confunde "12x" com o valor.
 */
function extrairParcelamento(
  texto?: string | null,
): { parcelasNum: number; valorParcela: number } | null {
  if (!texto) return null;
  const nMatch = texto.match(/(\d{1,2})\s*[xX]\b/);
  const vMatch = texto.match(/([\d.]*\d,\d{1,2})/);
  if (!nMatch || !vMatch) return null;
  const n = Number(nMatch[1]);
  const valor = Number(vMatch[1].replace(/\./g, "").replace(",", "."));
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  if (!Number.isFinite(valor) || valor <= 0) return null;
  return { parcelasNum: n, valorParcela: Math.round(valor * 100) / 100 };
}

/**
 * Recalcula, a partir do `quiver_resultado_raw` (fonte da verdade), o prêmio
 * da oferta que o vendedor escolheu na transmissão — nunca confia no `premio`
 * calculado no front. Localiza o card (seguradora + produtoId/produto), a
 * forma de pagamento (grupo) e, dentro dela, a opção exata (bundle
 * tipo/franquia/avista/desconto + texto de parcelas escolhido). Se qualquer
 * etapa da localização falhar, ou o valor não puder ser extraído do texto
 * com segurança, recusa a transmissão em vez de gravar um valor errado.
 */
export function calcularPremioTransmissao(
  raw: unknown,
  params: {
    seguradora: string;
    produtoId?: string | null;
    produto?: string | null;
    formaPagamento: string;
    parcelasEscolhidas: string;
    opcao: OpcaoIdentificador;
  },
): PremioTransmissaoResultado {
  const resultados = parseQuiverResultado(raw);
  const seguradoraNorm = normalizar(params.seguradora);

  const candidatos = resultados.filter((r) => {
    if (normalizar(r.seguradora) !== seguradoraNorm) return false;
    if (params.produtoId) return (r.produtoId ?? "") === params.produtoId;
    if (params.produto) return normalizar(r.produto ?? "") === normalizar(params.produto);
    return true;
  });
  if (candidatos.length !== 1) {
    return {
      ok: false,
      erro: "Não foi possível localizar, com segurança, a oferta escolhida no resultado atual da cotação. Recalcule e tente novamente.",
    };
  }
  const resultado = candidatos[0];

  const grupo = gruposOpcoesResultado(resultado).find(
    (g) => normalizar(g.formaPagamento) === normalizar(params.formaPagamento),
  );
  if (!grupo) {
    return {
      ok: false,
      erro: "A forma de pagamento escolhida não foi encontrada na oferta atual. Recalcule e tente novamente.",
    };
  }

  const bundleIgual = (o: OpcaoPremio) =>
    normalizar(o.tipo ?? "") === normalizar(params.opcao.tipo ?? "") &&
    normalizar(o.franquia ?? "") === normalizar(params.opcao.franquia ?? "") &&
    normalizar(o.avista ?? "") === normalizar(params.opcao.avista ?? "") &&
    normalizar(o.desconto ?? "") === normalizar(params.opcao.desconto ?? "");

  const opcoesCandidatas = grupo.opcoes.filter(
    (o) => bundleIgual(o) && (o.parcelas ?? "") === params.parcelasEscolhidas,
  );
  if (opcoesCandidatas.length !== 1) {
    return {
      ok: false,
      erro: "A opção de pagamento escolhida não foi encontrada na oferta atual. Recalcule e tente novamente.",
    };
  }
  const opcao = opcoesCandidatas[0];
  const parcelasTexto = (params.parcelasEscolhidas ?? "").trim();

  if (!parcelasTexto || isVista(parcelasTexto)) {
    const valor = extrairAVista(opcao.avista) ?? extrairAVistaDeParcelas(parcelasTexto);
    if (valor === null) {
      return {
        ok: false,
        erro: "Não foi possível calcular o valor à vista desta oferta com segurança.",
      };
    }
    return { ok: true, premio: valor, parcelasNum: null, valorParcela: null };
  }

  const parcelado = extrairParcelamento(parcelasTexto);
  if (!parcelado) {
    return {
      ok: false,
      erro: "Não foi possível calcular o valor parcelado desta oferta com segurança.",
    };
  }
  return {
    ok: true,
    premio: Math.round(parcelado.parcelasNum * parcelado.valorParcela * 100) / 100,
    parcelasNum: parcelado.parcelasNum,
    valorParcela: parcelado.valorParcela,
  };
}

export function ordenarResultados(resultados: readonly ResultadoCalculo[]): ResultadoCalculo[] {
  return [...resultados].sort((a, b) => premioNumerico(a.opcoes[0]) - premioNumerico(b.opcoes[0]));
}

/**
 * Critério de ordenação da lista comparativa do Cálculo (V12.3.5 ·
 * `.calc-bar` → select de ordenação): "menor"/"maior" prêmio (primeira opção
 * do card) ou "retorno" (ordem em que a Quiver devolveu os cards, via
 * `resultado.index` — o protótipo mantém "a ordem em que as cias
 * responderam").
 */
export type OrdemCalculo = "menor" | "maior" | "retorno";

export const ORDEM_CALCULO_OPCOES: Array<[OrdemCalculo, string]> = [
  ["menor", "Menor preço"],
  ["maior", "Maior preço"],
  ["retorno", "Retorno das cias"],
];

export function ordenarPorEscolha(
  resultados: readonly ResultadoCalculo[],
  ordem: OrdemCalculo,
): ResultadoCalculo[] {
  if (ordem === "retorno") return [...resultados].sort((a, b) => a.index - b.index);
  if (ordem === "maior") {
    // Mesma matemática do protótipo (`calcBarra`/comparador "maior"): cards
    // sem prêmio numérico (Infinity) contam como 0 na comparação, então
    // sempre afundam pro fim da lista em vez de ir para o topo do "maior".
    return [...resultados].sort((a, b) => {
      const av = premioNumerico(a.opcoes[0]);
      const bv = premioNumerico(b.opcoes[0]);
      return (bv === Infinity ? 0 : bv) - (av === Infinity ? 0 : av);
    });
  }
  return ordenarResultados(resultados);
}

/**
 * Faixa de preço da barra de ferramentas do Cálculo (`CALC_FAIXAS` no
 * protótipo). Os limites são cópia literal do protótipo V12; o valor
 * comparado é sempre o prêmio real (primeiro item de `opcoes`), nunca
 * inventado.
 */
export type FaixaPrecoCalculo = "" | "ate3500" | "3500a4000" | "4000a5000" | "acima5000";

export const FAIXAS_PRECO_CALCULO: Array<[FaixaPrecoCalculo, string]> = [
  ["", "Faixa de preço · todas"],
  ["ate3500", "Até R$ 3.500"],
  ["3500a4000", "R$ 3.500 a R$ 4.000"],
  ["4000a5000", "R$ 4.000 a R$ 5.000"],
  ["acima5000", "Acima de R$ 5.000"],
];

export function estaNaFaixaDePreco(premio: number, faixa: FaixaPrecoCalculo): boolean {
  if (!faixa) return true;
  if (faixa === "ate3500") return premio <= 3500;
  if (faixa === "3500a4000") return premio > 3500 && premio <= 4000;
  if (faixa === "4000a5000") return premio > 4000 && premio <= 5000;
  return premio > 5000;
}

export function filtrarPorFaixaDePreco(
  resultados: readonly ResultadoCalculo[],
  faixa: FaixaPrecoCalculo,
): ResultadoCalculo[] {
  return resultados.filter((resultado) => {
    const premio = premioNumerico(resultado.opcoes[0]);
    // Card sem prêmio numérico (não deu pra extrair um valor real da
    // seguradora) nunca é escondido por faixa de preço — mesma regra do
    // protótipo (`calcSemRetorno(sg) || calcNaFaixa(...)`).
    return premio === Infinity || estaNaFaixaDePreco(premio, faixa);
  });
}

/** Uma entrada de cobertura (label + valor) de um card, básica ou adicional. */
export function coberturaEntries(resultado: ResultadoCalculo): Array<[string, string]> {
  return [
    ...Object.entries(resultado.coberturasBasicas ?? {}),
    ...Object.entries(resultado.coberturasAdicionais ?? {}),
  ];
}

/**
 * União dos labels de cobertura (básicas + adicionais) de todos os cards,
 * na ordem em que aparecem pela primeira vez — cada linha da lista
 * comparativa é um desses labels; quando uma seguradora não mandou aquele
 * label, a célula mostra "—" (nunca inventa o valor).
 */
export function coberturaLabelsUnion(resultados: readonly ResultadoCalculo[]): string[] {
  return [
    ...new Set(
      resultados.flatMap((resultado) => coberturaEntries(resultado).map(([label]) => label)),
    ),
  ];
}

export function tituloResultado(resultado: ResultadoCalculo): string {
  return [resultado.produto, resultado.nome].filter(Boolean).join(" · ") || "Produto não informado";
}

export function formasPagamentoResultado(resultado: ResultadoCalculo): string[] {
  const formas = [
    resultado.formasPagamento?.selecionada,
    ...(resultado.formasPagamento?.opcoes ?? []),
    resultado.formaPagamento,
    ...(resultado.premiosPorFormaPagamento?.map((item) => item.formaPagamento) ?? []),
  ].filter((item): item is string => Boolean(item));
  return [...new Set(formas)];
}

// Aceita "Nx" em qualquer posição do texto (não só no início ou após "em"),
// pois o portal varia o formato por seguradora/produto: "em 12x de R$ X",
// "12x sem juros de R$ X" e também "à vista R$ X 12x sem juros de R$ Y" (o
// valor à vista aparece antes da parcela na mesma string). Com o padrão
// antigo (só início ou "em Nx"), esse último formato não era reconhecido
// como variante de parcelamento e a expansão em expandirOpcoesPorParcela
// abaixo desistia, mostrando só 1 opção mesmo com várias disponíveis
// (bug real: card HDI só exibia 12x, produção 23/08/2026).
const isTextoParcelamento = (texto: string) => /\d+\s*x\b/i.test(texto);

// "À vista" também é uma forma de pagamento selecionável na transmissão
// (TransmissaoPage.ts reconhece "à vista"/"a vista" e clica na linha certa
// da tabela) — precisa aparecer como opção no select, não só ser descartada.
const isVista = (texto: string) => /(?:^|\s)[àa]\s*vista\b/i.test(texto);

/**
 * Expande uma faixa (ex.: "normal 100%") em uma opção por variante de
 * parcelamento/pagamento disponível (`parcelasOpcoes`) — incluindo "à
 * vista" —, em vez de só a que o robô capturou em `parcelas` (a que o
 * portal deixava visível por padrão). Sem `parcelasOpcoes`, ou com só 1
 * variante, devolve a faixa original sem alteração.
 */
function expandirOpcoesPorParcela(opcoes: OpcaoPremio[]): OpcaoPremio[] {
  return opcoes.flatMap((opcao) => {
    const variantes = (opcao.parcelasOpcoes ?? []).filter(
      (texto) => isTextoParcelamento(texto) || isVista(texto),
    );
    const variantesUnicas = [...new Set(variantes)];
    if (variantesUnicas.length < 2) return [opcao];
    return variantesUnicas.map((parcelas) => ({ ...opcao, parcelas }));
  });
}

export function gruposOpcoesResultado(resultado: ResultadoCalculo): GrupoOpcoesPremio[] {
  if ((resultado.premiosPorFormaPagamento?.length ?? 0) > 0) {
    return (resultado.premiosPorFormaPagamento ?? []).flatMap((grupo, grupoIndex) => {
      if (!grupo.formaPagamento.trim() || grupo.opcoes.length === 0) return [];
      const opcoesExpandidas = expandirOpcoesPorParcela(grupo.opcoes);
      return [
        {
          id: `forma-${grupoIndex}`,
          formaPagamento: grupo.formaPagamento,
          opcoes: opcoesExpandidas.map((opcao, opcaoIndex) => ({
            ...opcao,
            id: `forma-${grupoIndex}-opcao-${opcaoIndex}`,
          })),
        },
      ];
    });
  }

  // Retornos antigos não vinculavam cada prêmio a uma forma. Só é seguro
  // transmiti-los quando todos os campos disponíveis apontam para uma única forma.
  const formasDeclaradas = formasPagamentoResultado(resultado);
  if (formasDeclaradas.length !== 1 || resultado.opcoes.length === 0) return [];
  const opcoesExpandidas = expandirOpcoesPorParcela(resultado.opcoes);
  return [
    {
      id: "forma-legada-0",
      formaPagamento: formasDeclaradas[0],
      opcoes: opcoesExpandidas.map((opcao, opcaoIndex) => ({
        ...opcao,
        id: `forma-legada-0-opcao-${opcaoIndex}`,
      })),
    },
  ];
}

export type FaixaComParcelas = {
  tipo?: string;
  franquia?: string;
  avista?: string;
  desconto?: string;
  parcelas: string[];
};

/**
 * Reagrupa as opções já expandidas por parcela (uma por variante de
 * parcelamento — ver `expandirOpcoesPorParcela`) de volta por faixa
 * (tipo/franquia/à vista/desconto), juntando as parcelas numa lista.
 * Evita repetir tipo/franquia/à vista em blocos idênticos na UI — um por
 * faixa, com as N variantes de parcelamento listadas dentro dela.
 */
export function faixasComParcelas(opcoes: readonly OpcaoPremio[]): FaixaComParcelas[] {
  const faixas: FaixaComParcelas[] = [];
  const indicePorChave = new Map<string, number>();
  for (const opcao of opcoes) {
    const chave = [opcao.tipo, opcao.franquia, opcao.avista, opcao.desconto].join("|");
    let indice = indicePorChave.get(chave);
    if (indice === undefined) {
      indice = faixas.length;
      indicePorChave.set(chave, indice);
      faixas.push({
        tipo: opcao.tipo,
        franquia: opcao.franquia,
        avista: opcao.avista,
        desconto: opcao.desconto,
        parcelas: [],
      });
    }
    if (opcao.parcelas) faixas[indice].parcelas.push(opcao.parcelas);
  }
  return faixas;
}

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

/** Rótulo da linha de parcelamento como o protótipo: "À vista" ou "N parcelas". */
export function rotuloParcelamento(opcao: Pick<OpcaoPremio, "parcelas" | "avista">): {
  rotulo: string;
  ordem: number;
} {
  const texto = opcao.parcelas || opcao.avista || "";
  const n = /(\d+)\s*x\b/i.exec(texto)?.[1];
  if (n) {
    const qtd = Number(n);
    return qtd <= 1 ? { rotulo: "À vista", ordem: 1 } : { rotulo: `${qtd} parcelas`, ordem: qtd };
  }
  if (isVista(texto)) return { rotulo: "À vista", ordem: 1 };
  return { rotulo: texto || "—", ordem: 0 };
}

export const parcelaSemJuros = (opcao: Pick<OpcaoPremio, "parcelas">) =>
  /sem juros/i.test(opcao.parcelas ?? "");

export type LinhaParcelamento<T extends OpcaoPremio = OpcaoPremio> = {
  rotulo: string;
  /** Uma entrada por lista de entrada (mesma ordem); undefined = sem a parcela. */
  opcoes: Array<T | undefined>;
};
export type BlocoParcelamento<T extends OpcaoPremio = OpcaoPremio> = {
  faixa: string;
  linhas: Array<LinhaParcelamento<T>>;
};

/**
 * Agrupa as opções de várias ofertas (uma lista por coluna) em blocos por
 * faixa (`tipo`, sem acento/caixa), cada um com linhas por quantidade de
 * parcelas, em ordem crescente. Repetições do mesmo rótulo na mesma faixa
 * e coluna viram linhas extras.
 */
export function agruparParcelamento<T extends OpcaoPremio>(
  listas: ReadonlyArray<readonly T[]>,
): Array<BlocoParcelamento<T>> {
  const blocos = new Map<
    string,
    {
      faixa: string;
      linhas: Map<string, { rotulo: string; ordem: number; opcoes: Array<T | undefined> }>;
    }
  >();
  listas.forEach((lista, col) => {
    const vistos = new Map<string, number>();
    for (const opcao of lista) {
      const faixa = (opcao.tipo ?? "").trim();
      const chaveFaixa = normalizar(faixa);
      const { rotulo, ordem } = rotuloParcelamento(opcao);
      const seq = vistos.get(`${chaveFaixa}|${rotulo}`) ?? 0;
      vistos.set(`${chaveFaixa}|${rotulo}`, seq + 1);
      const bloco = blocos.get(chaveFaixa) ?? { faixa, linhas: new Map() };
      blocos.set(chaveFaixa, bloco);
      const chaveLinha = `${rotulo}#${seq}`;
      const linha = bloco.linhas.get(chaveLinha) ?? {
        rotulo,
        ordem,
        opcoes: listas.map(() => undefined),
      };
      bloco.linhas.set(chaveLinha, linha);
      linha.opcoes[col] = opcao;
    }
  });
  return [...blocos.values()].map((b) => ({
    faixa: b.faixa,
    linhas: [...b.linhas.values()]
      .sort((a, c) => a.ordem - c.ordem)
      .map(({ rotulo, opcoes }) => ({ rotulo, opcoes })),
  }));
}

/**
 * Resolve o vínculo global 1:1 entre cards detalhados e linhas financeiras.
 * Todos os discriminadores disponíveis no card precisam ser consistentes;
 * candidatos contraditórios, disputados ou não resolvidos permanecem sem vínculo.
 */
export function vincularPremiosQuiver<T extends PremioVinculavel>(
  resultados: readonly ResultadoCalculo[],
  premios: readonly T[],
): Map<string, T> {
  const candidatos = new Map<string, T[]>();
  for (const resultado of resultados) {
    const valor = premioNumerico(resultado.opcoes[0]);
    const temValor = Number.isFinite(valor);
    const cobertura = normalizar(resultado.opcoes[0]?.tipo);
    candidatos.set(
      resultado.cardId,
      premios.filter(
        (premio) =>
          normalizar(premio.seguradora) === normalizar(resultado.seguradora) &&
          (!temValor || Math.abs(Number(premio.premio) - valor) < 0.02) &&
          (!cobertura || normalizar(premio.cobertura) === cobertura),
      ),
    );
  }

  const vinculados = new Map<string, T>();
  const usados = new Set<string>();
  let houveProgresso = true;
  while (houveProgresso) {
    houveProgresso = false;
    const unicos = resultados.flatMap((resultado) => {
      if (vinculados.has(resultado.cardId)) return [];
      const disponiveis = (candidatos.get(resultado.cardId) ?? []).filter(
        (premio) => !usados.has(premio.id),
      );
      return disponiveis.length === 1 ? [{ cardId: resultado.cardId, premio: disponiveis[0] }] : [];
    });
    const contagem = new Map<string, number>();
    for (const item of unicos)
      contagem.set(item.premio.id, (contagem.get(item.premio.id) ?? 0) + 1);
    for (const item of unicos) {
      if (contagem.get(item.premio.id) !== 1) continue;
      vinculados.set(item.cardId, item.premio);
      usados.add(item.premio.id);
      houveProgresso = true;
    }
  }
  return vinculados;
}

/** Seções distintas (texto literal do portal), na ordem em que aparecem. */
export function secoesDisponiveis(resultados: readonly ResultadoCalculo[]): string[] {
  const vistas = new Set<string>();
  for (const r of resultados) if (r.secao) vistas.add(r.secao);
  return [...vistas];
}

/** `secao` vazia = "Todas". */
export function filtrarPorSecao(
  resultados: readonly ResultadoCalculo[],
  secao: string,
): ResultadoCalculo[] {
  return secao ? resultados.filter((r) => r.secao === secao) : [...resultados];
}

function mesmoProduto(
  item: Pick<SemRetornoItem, "seguradora" | "produtoId" | "produto">,
  alvo: { seguradora: string; produtoId?: string; produto?: string },
): boolean {
  if (normalizar(item.seguradora) !== normalizar(alvo.seguradora)) return false;
  if (item.produtoId) return item.produtoId === (alvo.produtoId ?? "");
  if (item.produto) return normalizar(item.produto) === normalizar(alvo.produto);
  return true;
}

/** Faixas (dentro de um card retornado) que a seguradora não precificou. */
export function semRetornoPorFaixa(
  semRetorno: readonly SemRetornoItem[],
  resultado: Pick<ResultadoCalculo, "seguradora" | "produtoId" | "produto">,
): Array<{ faixa: string; motivo: string }> {
  return semRetorno.flatMap((item) =>
    item.faixa && mesmoProduto(item, resultado) ? [{ faixa: item.faixa, motivo: item.motivo }] : [],
  );
}

export type SeguradoraSemRetorno = {
  chave: string;
  seguradora: string;
  produto?: string;
  /** Mensagem real do portal; ausente quando só sabemos que não voltou card. */
  motivo?: string;
};

/**
 * Seguradoras/produtos que não voltaram preço nenhum: entradas de
 * `semRetorno` sem `faixa` que não têm card correspondente, mais as
 * seguradoras selecionadas sem card e sem entrada (sem motivo, como antes).
 */
export function seguradorasSemRetorno(
  semRetorno: readonly SemRetornoItem[],
  resultados: readonly ResultadoCalculo[],
  seguradorasSel: readonly string[] = [],
): SeguradoraSemRetorno[] {
  const lista: SeguradoraSemRetorno[] = [];
  const vistas = new Set<string>();
  for (const item of semRetorno) {
    if (item.faixa || !item.seguradora) continue;
    const seguradora = item.seguradora;
    const semProduto = !item.produtoId && !item.produto;
    // Seguradora que voltou com algum card e a entrada não aponta produto:
    // ambíguo, não inventa coluna.
    if (semProduto && resultados.some((r) => normalizar(r.seguradora) === normalizar(seguradora)))
      continue;
    if (!semProduto && resultados.some((r) => mesmoProduto(item, r))) continue;
    const chave = `${normalizar(seguradora)}|${item.produtoId ?? normalizar(item.produto)}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    lista.push({ chave, seguradora, produto: item.produto, motivo: item.motivo });
  }
  const cobertas = new Set([
    ...resultados.map((r) => normalizar(r.seguradora)),
    ...lista.map((l) => normalizar(l.seguradora)),
  ]);
  for (const sg of seguradorasSel) {
    // Seleção usa nome de exibição ("HDI"); os cards, o canônico do robô ("hdi seguros").
    const canon = normalizar(nomeCanonicoSeguradora(sg));
    if (cobertas.has(canon) || cobertas.has(normalizar(sg))) continue;
    cobertas.add(canon);
    lista.push({ chave: `sel|${normalizar(sg)}`, seguradora: sg });
  }
  return lista;
}

/** Card tem mensagens da seguradora para exibir? */
export function temMensagensRetorno(resultado: Pick<ResultadoCalculo, "mensagensRetorno">) {
  return (resultado.mensagensRetorno?.length ?? 0) > 0;
}
