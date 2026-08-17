import { z } from "zod";

const textoOpcional = z.string().trim().optional();

export const opcaoPremioSchema = z.object({
  tipo: textoOpcional,
  avista: textoOpcional,
  desconto: textoOpcional,
  franquia: textoOpcional,
  parcelas: textoOpcional,
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

export function ordenarResultados(resultados: readonly ResultadoCalculo[]): ResultadoCalculo[] {
  return [...resultados].sort((a, b) => premioNumerico(a.opcoes[0]) - premioNumerico(b.opcoes[0]));
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

export function gruposOpcoesResultado(resultado: ResultadoCalculo): GrupoOpcoesPremio[] {
  if ((resultado.premiosPorFormaPagamento?.length ?? 0) > 0) {
    return (resultado.premiosPorFormaPagamento ?? []).flatMap((grupo, grupoIndex) => {
      if (!grupo.formaPagamento.trim() || grupo.opcoes.length === 0) return [];
      return [
        {
          id: `forma-${grupoIndex}`,
          formaPagamento: grupo.formaPagamento,
          opcoes: grupo.opcoes.map((opcao, opcaoIndex) => ({
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
  return [
    {
      id: "forma-legada-0",
      formaPagamento: formasDeclaradas[0],
      opcoes: resultado.opcoes.map((opcao, opcaoIndex) => ({
        ...opcao,
        id: `forma-legada-0-opcao-${opcaoIndex}`,
      })),
    },
  ];
}

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

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
