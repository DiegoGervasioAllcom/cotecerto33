import {
  AVISO_INTEGRACAO_PENDENTE,
  moedaOuTraco,
  propostaSituacaoInfo,
  textoOuTraco,
} from "@/lib/proposta-situacao";
import { useAuth } from "@/lib/auth";
import {
  estadoDocumentoProposta,
  podeTentarDeNovo,
  type DocumentoLinha,
} from "@/lib/proposta-documento-estado";
import { useAcoesDocumentoProposta } from "@/components/venda/novo-lead/steps/transmissao/useDocumentoProposta";
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
      {/* O robô grava o texto do portal, que já traz o rótulo ("Protocolo Suhai 215575619"). */}
      <small>{row.protocolo_seguradora || "protocolo —"}</small>
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

export function AcoesCell({
  row,
  documento,
  carregandoDocumento,
}: {
  row: PropostaEmissaoRow;
  /** Linha de `proposta_documentos` desta proposta (lote em `useDocumentosEmissao`). */
  documento: DocumentoLinha;
  carregandoDocumento: boolean;
}) {
  const { session, role } = useAuth();
  const { abrir, tentarDeNovo } = useAcoesDocumentoProposta(row.id);
  const estado = carregandoDocumento
    ? "preparando"
    : estadoDocumentoProposta(documento, row.transmitida_em);
  const icone = (
    <svg width={13} height={13}>
      <use href="#i-file" />
    </svg>
  );
  return (
    <div className="row-actions">
      {estado === "ok" ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={abrir.isPending}
          onClick={() => abrir.mutate()}
        >
          {icone} Proposta (PDF)
        </button>
      ) : estado === "preparando" ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled aria-disabled="true">
          {icone} Preparando documento…
        </button>
      ) : (
        <>
          <button type="button" className="btn btn-ghost btn-sm" disabled aria-disabled="true">
            {icone} Documento indisponível
          </button>
          {podeTentarDeNovo(session?.user.id, role, row.cotacoes?.responsavel_id) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={tentarDeNovo.isPending}
              onClick={() => tentarDeNovo.mutate()}
            >
              <svg width={13} height={13}>
                <use href="#i-refresh" />
              </svg>{" "}
              Tentar de novo
            </button>
          )}
        </>
      )}
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
