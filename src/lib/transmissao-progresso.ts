import {
  TRANSMISSAO_ETAPAS,
  TRANSMISSAO_ETAPA_ROTULO,
  TRANSMISSAO_TOTAL_PASSOS,
  type TransmissaoEtapa,
} from "@/lib/transmissao-etapas";

export type TransmissaoProgressoRow = {
  tentativa_id: string;
  cotacao_id: string;
  etapa: string;
  seq: number;
  erro: string | null;
  atualizado_em: string;
};

export type TransmissaoProgressoView = {
  etapa: TransmissaoEtapa | null;
  /** 1..TOTAL: passo em andamento (seq 0/1 → 1). */
  passo: number;
  totalPassos: number;
  rotulo: string;
  final: "concluido" | "erro" | null;
  erro: string | null;
  semAtualizacaoHaSegundos: number | null;
};

/** Acima disso a tela avisa "sem atualização há X s". */
export const TRANSMISSAO_SEM_ATUALIZACAO_S = 45;

const ETAPAS = new Set<string>([...TRANSMISSAO_ETAPAS, "concluido", "erro"]);

export function calcularTransmissaoProgresso(
  row: TransmissaoProgressoRow | undefined,
  agora: number,
): TransmissaoProgressoView {
  const etapa = row && ETAPAS.has(row.etapa) ? (row.etapa as TransmissaoEtapa) : null;
  const final = etapa === "concluido" || etapa === "erro" ? etapa : null;
  const seq = row ? Math.max(0, row.seq) : 0;
  const seg = row ? Math.floor((agora - new Date(row.atualizado_em).getTime()) / 1000) : null;
  return {
    etapa,
    passo: Math.min(Math.max(seq, 1), TRANSMISSAO_TOTAL_PASSOS),
    totalPassos: TRANSMISSAO_TOTAL_PASSOS,
    rotulo: etapa ? TRANSMISSAO_ETAPA_ROTULO[etapa] : "Aguardando o robô",
    final,
    erro: etapa === "erro" ? (row?.erro ?? "Erro na transmissão") : null,
    semAtualizacaoHaSegundos:
      !final && seg !== null && seg > TRANSMISSAO_SEM_ATUALIZACAO_S ? seg : null,
  };
}
