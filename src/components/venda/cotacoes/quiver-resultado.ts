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

export type GrupoOpcoesPremio = { formaPagamento: string; opcoes: OpcaoPremio[] };

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
  const texto = opcao?.avista;
  if (!texto) return Infinity;
  const match = texto.match(/(?:R\$\s*)?([\d.]+(?:,\d+)?)/);
  if (!match) return Infinity;
  const numero = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : Infinity;
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
  const grupos: GrupoOpcoesPremio[] = [];
  if (resultado.opcoes.length > 0) {
    grupos.push({
      formaPagamento:
        resultado.formasPagamento?.selecionada ?? resultado.formaPagamento ?? "Opções principais",
      opcoes: resultado.opcoes,
    });
  }
  for (const grupo of resultado.premiosPorFormaPagamento ?? []) {
    grupos.push({ formaPagamento: grupo.formaPagamento, opcoes: grupo.opcoes });
  }
  return grupos;
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
