import {
  CALCULO_ETAPAS,
  CALCULO_ETAPA_ROTULO,
  CALCULO_TOTAL_PASSOS,
  type CalculoEtapa,
} from "@/lib/calculo-etapas";

export type CalculoProgressoRow = {
  cotacao_id: string;
  etapa: string;
  seq: number;
  erro: string | null;
  iniciado_em: string;
  atualizado_em: string;
};

export type CalculoProgressoView = {
  cotacaoId: string;
  etapa: CalculoEtapa | null;
  /** 0–100. Último passo (lendo_resultados) fica em 95 e anima até `concluido`. */
  percent: number;
  indeterminado: boolean;
  rotulo: string;
  /** 1..CALCULO_TOTAL_PASSOS */
  passo: number;
  totalPassos: number;
  final: "concluido" | "erro" | null;
  erro: string | null;
  semAtualizacaoHaSegundos: number | null;
};

/** Acima disso o card avisa "sem atualização há X s". */
export const CALCULO_SEM_ATUALIZACAO_S = 45;

const ETAPAS = new Set<string>([...CALCULO_ETAPAS, "concluido", "erro"]);

export function ehCalculoEtapa(v: string): v is CalculoEtapa {
  return ETAPAS.has(v);
}

export function calcularProgresso(
  row: CalculoProgressoRow | undefined,
  cotacaoId: string,
  agora: number,
): CalculoProgressoView {
  const etapa = row && ehCalculoEtapa(row.etapa) ? row.etapa : null;
  const final = etapa === "concluido" || etapa === "erro" ? etapa : null;
  const seq = row ? Math.max(0, row.seq) : 0;
  const passo = Math.min(Math.max(seq, 1), CALCULO_TOTAL_PASSOS);
  const ultimo = !final && seq >= CALCULO_TOTAL_PASSOS;
  let percent = Math.round((Math.min(seq, CALCULO_TOTAL_PASSOS) / CALCULO_TOTAL_PASSOS) * 100);
  if (ultimo) percent = 95;
  if (etapa === "concluido") percent = 100;
  const seg = row ? Math.floor((agora - new Date(row.atualizado_em).getTime()) / 1000) : null;
  return {
    cotacaoId,
    etapa,
    percent,
    indeterminado: ultimo,
    rotulo: etapa ? CALCULO_ETAPA_ROTULO[etapa] : "Aguardando o robô",
    passo,
    totalPassos: CALCULO_TOTAL_PASSOS,
    final,
    erro: etapa === "erro" ? (row?.erro ?? "Erro no cálculo") : null,
    semAtualizacaoHaSegundos:
      !final && seg !== null && seg > CALCULO_SEM_ATUALIZACAO_S ? seg : null,
  };
}
