import {
  AVISO_INTEGRACAO_PENDENTE,
  moedaOuTraco,
  propostaSituacaoInfo,
  textoOuTraco,
} from "@/lib/proposta-situacao";
import { embed1a1 } from "@/lib/postgrest-embed";
import type { PropostaEmissaoRow } from "./types";

/** Células da tabela de `/venda/emissao` — uma por coluna que carrega mais
 * de um dado (as colunas simples ficam direto em `PropostasSection`). */

export function ClienteCotacaoCell({ row }: { row: PropostaEmissaoRow }) {
  return (
    <div className="mini-cell">
      <strong>{embed1a1(row.cotacoes?.segurado)?.nome || "—"}</strong>
      <small>cotação {textoOuTraco(row.cotacoes?.numero ?? null)}</small>
    </div>
  );
}

export function SeguradoraProdutoCell({ row }: { row: PropostaEmissaoRow }) {
  return (
    <div className="mini-cell">
      <strong>{row.seguradora || "—"}</strong>
      <small>{row.cotacoes?.ramo || "—"}</small>
    </div>
  );
}

export function PropostaCell({ row }: { row: PropostaEmissaoRow }) {
  return (
    <div className="mini-cell">
      <strong>{textoOuTraco(row.numero)}</strong>
      <small>{textoOuTraco(row.protocolo_seguradora)}</small>
    </div>
  );
}

export function PremioCell({ row }: { row: PropostaEmissaoRow }) {
  return (
    <div className="mini-cell" style={{ alignItems: "flex-end", textAlign: "right" }}>
      <strong>{moedaOuTraco(row.premio ?? row.valor)}</strong>
      <small>{row.parcelas ? `${row.parcelas}x ${moedaOuTraco(row.valor_parcela)}` : "—"}</small>
    </div>
  );
}

export function SituacaoCell({ row }: { row: PropostaEmissaoRow }) {
  const st = propostaSituacaoInfo(row.transmissao_status);
  const pendencia = [row.transmissao_motivo, row.transmissao_mensagem].filter(Boolean).join(" — ");
  return (
    <div className="mini-cell">
      <span className={`chip ${st.chipClass}`} title={pendencia || st.descricao}>
        {st.label}
      </span>
      {pendencia && st.status !== "emitida" && (
        <small className="muted" style={{ maxWidth: 230 }}>
          {pendencia}
        </small>
      )}
      {row.apolice_numero && <small className="muted">apólice {row.apolice_numero}</small>}
    </div>
  );
}

export function AcoesCell() {
  return (
    <div className="row-actions">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled
        aria-disabled="true"
        title={AVISO_INTEGRACAO_PENDENTE}
      >
        <svg width={13} height={13}>
          <use href="#i-file" />
        </svg>{" "}
        Documentos
      </button>
      <button
        type="button"
        className="btn btn-yellow btn-sm"
        disabled
        aria-disabled="true"
        title={AVISO_INTEGRACAO_PENDENTE}
      >
        <svg width={13} height={13}>
          <use href="#i-refresh" />
        </svg>{" "}
        Consultar
      </button>
    </div>
  );
}
