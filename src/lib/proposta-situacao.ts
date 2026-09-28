/**
 * Situação de uma proposta transmitida à seguradora — espelha `TRANSM_STATUS`
 * do protótipo V12 (`cotecerto_prototipo_v12.html`, por volta da linha 5533)
 * e alimenta tanto a tela "Emissão & histórico"
 * (`src/routes/_authenticated/venda/emissao.tsx`) quanto o card "Transmitida"
 * do wizard (`TransmissaoResultado.tsx`).
 *
 * `propostas.transmissao_status` não tem enum no banco — é `string | null`
 * livre, gravado pelo robô/webhook Quiver. HOJE só `'transmitida'` e
 * `'falha'` são alcançáveis de verdade (a integração só devolve
 * sucesso/recusa da transmissão em si). Os demais status do protótipo
 * (`bloqueada`, `analise`, `emitida`, `recusada`) fazem parte do modelo de
 * dados pensado para quando a integração passar a devolver protocolo,
 * acompanhamento pós-transmissão e emissão de apólice (V12.1.16/17/20/25) —
 * o front já sabe como exibi-los, mas nada aqui os produz OU simula
 * (V12.1.28: nunca simular status).
 */
export type PropostaSituacaoStatus =
  | "transmitida"
  | "bloqueada"
  | "analise"
  | "emitida"
  | "recusada"
  | "falha";

type PropostaSituacaoInfo = {
  /** Label exibido no chip, igual ao protótipo. */
  label: string;
  /** Classe de chip de `proto.css` (`chip-slate` | `chip-alert` | `chip-yellow` | `chip-ok`). */
  chipClass: "chip-slate" | "chip-alert" | "chip-yellow" | "chip-ok";
  /** Descrição curta (tooltip/nota), igual ao protótipo quando existe. */
  descricao: string;
};

export const PROPOSTA_SITUACAO: Record<PropostaSituacaoStatus, PropostaSituacaoInfo> = {
  transmitida: {
    label: "Transmitida",
    chipClass: "chip-slate",
    descricao: "Enviada à seguradora, aguardando processamento",
  },
  bloqueada: {
    label: "Bloqueada",
    chipClass: "chip-alert",
    descricao: "A seguradora aponta uma pendência que impede seguir",
  },
  analise: {
    label: "Em análise",
    chipClass: "chip-yellow",
    descricao: "Em avaliação de risco/vistoria na seguradora",
  },
  emitida: {
    label: "Emitida",
    chipClass: "chip-ok",
    descricao: "Apólice emitida — venda concluída",
  },
  recusada: {
    label: "Recusada",
    chipClass: "chip-alert",
    descricao: "A seguradora recusou a proposta",
  },
  // Não existe no protótipo (que só modela o pós-transmissão) — é o status
  // real que a integração Quiver devolve hoje quando o portal recusa a
  // transmissão em si (ver `TransmissaoResultado.tsx`, ramo `falha`).
  falha: {
    label: "Pendência da seguradora",
    chipClass: "chip-alert",
    descricao: "A seguradora recusou a transmissão desta proposta",
  },
};

/** Status conhecidos hoje pelo banco (`propostas.transmissao_status`) além de `null`. */
export const PROPOSTA_SITUACAO_STATUSES = Object.keys(
  PROPOSTA_SITUACAO,
) as PropostaSituacaoStatus[];

export function propostaSituacaoInfo(
  status: string | null,
): PropostaSituacaoInfo & { status: PropostaSituacaoStatus } {
  const key = (status ?? "transmitida") as PropostaSituacaoStatus;
  const info = PROPOSTA_SITUACAO[key];
  if (!info) return { ...PROPOSTA_SITUACAO.transmitida, status: "transmitida" };
  return { ...info, status: key };
}

/** Uma proposta é "concluída" só quando a apólice sai — o resto aguarda a seguradora. */
export function propostaEstaConcluida(status: string | null): boolean {
  return status === "emitida";
}

/**
 * Separa uma lista de propostas em "aguardando a seguradora" (tudo que não é
 * `emitida`, hoje só `transmitida`/`falha`) e "concluídas" (`emitida`) —
 * espelha `propostasLista()` do protótipo V12.
 */
export function agruparPropostasPorSituacao<T extends { transmissao_status: string | null }>(
  propostas: readonly T[],
): { aguardando: T[]; concluidas: T[] } {
  const aguardando: T[] = [];
  const concluidas: T[] = [];
  for (const p of propostas) {
    if (propostaEstaConcluida(p.transmissao_status)) concluidas.push(p);
    else aguardando.push(p);
  }
  return { aguardando, concluidas };
}

/** "—" no lugar de vazio, igual ao padrão do protótipo para campo sem dado da integração. */
export function textoOuTraco(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function dataHoraOuTraco(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

export function dataOuTraco(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

export function moedaOuTraco(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * "R$ total · Nx de R$ valor" (só o total quando à vista, sem parcelamento).
 * Base do prêmio já é nº de parcelas × valor da parcela desde os ajustes
 * pós-deploy V12 (item 2) — aqui é só a exibição do detalhamento.
 */
export function premioComParcelamento(
  premio: number | null | undefined,
  parcelasNum: number | null | undefined,
  valorParcela: number | null | undefined,
): string {
  const total = moedaOuTraco(premio);
  if (!parcelasNum || valorParcela == null) return total;
  return `${total} · ${parcelasNum}x de ${moedaOuTraco(valorParcela)}`;
}

/** Aviso curto exibido nas ações que ainda dependem da integração com a seguradora. */
export const AVISO_INTEGRACAO_PENDENTE =
  "Disponível quando a integração com a seguradora estiver ligada";
