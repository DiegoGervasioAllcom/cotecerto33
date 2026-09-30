import { z } from "zod";

/**
 * "Recalcular só esta seguradora" reduz `seguradorasSel` a uma cia. Guardamos
 * a seleção de ANTES para avisar no recálculo geral da barra (que repetiria só
 * ela) e oferecer a volta. Lógica pura — o estado vive em `useRecalculoUnico`.
 */
export const recalculoUnicoSchema = z.object({
  seguradora: z.string().min(1).max(80),
  anterior: z.array(z.string().min(1).max(80)).max(50),
});
export type RecalculoUnico = z.infer<typeof recalculoUnicoSchema>;

export type AvisoRecalculoGeral = {
  seguradora: string;
  anterior: string[];
  /** Quantas eram antes, só quando havia mais de uma (senão não há a quê voltar). */
  voltarN: number | null;
};

export function mesmaSelecao(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Estado a guardar ao recalcular só `seguradora`; `null` = nada a guardar
 * (a seleção já era só ela). Repetir o recálculo único preserva o "antes" original. */
export function estadoAoRecalcularUma(
  estado: RecalculoUnico | null,
  selecaoAtual: string[],
  seguradora: string,
): RecalculoUnico | null {
  const jaReduzida = estado !== null && mesmaSelecao(selecaoAtual, [estado.seguradora]);
  const anterior = jaReduzida ? estado.anterior : selecaoAtual;
  if (mesmaSelecao(anterior, [seguradora])) return null;
  return { seguradora, anterior: [...anterior] };
}

/** Só avisa enquanto o estado existe E a seleção atual é a reduzida. */
export function avisoRecalculoGeral(
  estado: RecalculoUnico | null,
  selecaoAtual: string[],
): AvisoRecalculoGeral | null {
  if (!estado || !mesmaSelecao(selecaoAtual, [estado.seguradora])) return null;
  return {
    seguradora: estado.seguradora,
    anterior: estado.anterior,
    voltarN: estado.anterior.length > 1 ? estado.anterior.length : null,
  };
}

/** Deve limpar quando a seleção já foi vista reduzida e agora mudou. */
export function deveLimparRecalculoUnico(
  estado: RecalculoUnico | null,
  selecaoAtual: string[],
  jaVistaReduzida: boolean,
): boolean {
  return estado !== null && jaVistaReduzida && !mesmaSelecao(selecaoAtual, [estado.seguradora]);
}

const chave = (cotacaoId: string) => `cotecerto:recalculo-unico:${cotacaoId}`;

export function lerRecalculoUnico(cotacaoId: string | null): RecalculoUnico | null {
  if (!cotacaoId) return null;
  try {
    const raw = window.sessionStorage.getItem(chave(cotacaoId));
    if (!raw) return null;
    const r = recalculoUnicoSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function gravarRecalculoUnico(cotacaoId: string | null, estado: RecalculoUnico | null) {
  if (!cotacaoId) return;
  try {
    if (estado) window.sessionStorage.setItem(chave(cotacaoId), JSON.stringify(estado));
    else window.sessionStorage.removeItem(chave(cotacaoId));
  } catch {
    // sessionStorage indisponível: a tela segue só com o estado em memória.
  }
}
