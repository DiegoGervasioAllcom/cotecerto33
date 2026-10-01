import type { RefObject } from "react";
import type { DocumentoLinha } from "@/lib/proposta-documento-estado";
import { dataHoraOuTraco } from "@/lib/proposta-situacao";
import type { PropostaEmissaoRow } from "./types";
import {
  AcoesCell,
  ClienteCotacaoCell,
  PremioCell,
  PropostaCell,
  SeguradoraProdutoCell,
  SituacaoCell,
} from "./EmissaoRowCells";

/** Uma das duas seções de `/venda/emissao` ("Aguardando a seguradora" /
 * "Concluídas") — cabeçalhos da tabela espelham `propostasLista()` do
 * protótipo V12 (`cotecerto_prototipo_v12.html`, por volta da linha 6383). */
export function PropostasSection({
  titulo,
  chipTexto,
  chipClass,
  rows,
  vazio,
  tourId,
  rowRefs,
  focoClasse,
  documentos,
  carregandoDocumentos,
}: {
  titulo: string;
  chipTexto: string;
  chipClass: string;
  rows: PropostaEmissaoRow[];
  vazio: string;
  tourId: string;
  rowRefs: RefObject<Record<string, HTMLTableRowElement | null>>;
  /** V12.3.11 — classes `em-foco`/`foco-pisca` de `useFocoAoChegar` (proto.css). */
  focoClasse: (id: string) => string;
  /** Documento (PDF) por proposta — vem em lote de `useDocumentosEmissao`. */
  documentos: Record<string, NonNullable<DocumentoLinha>> | undefined;
  carregandoDocumentos: boolean;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <h3>
          {titulo} <span className="muted small">— {rows.length}</span>
        </h3>
        <span className={`chip ${chipClass}`}>{chipTexto}</span>
      </div>
      {rows.length === 0 ? (
        <div
          className="card-b"
          data-tour={tourId}
          style={{ padding: "30px 20px", textAlign: "center" }}
        >
          <p className="muted small" style={{ margin: 0 }}>
            {vazio}
          </p>
        </div>
      ) : (
        <div className="card-b" data-tour={tourId} style={{ padding: 0, overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Seguradora</th>
                <th>Proposta</th>
                <th style={{ textAlign: "right" }}>Prêmio</th>
                <th>Situação</th>
                <th>Transmitida</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  ref={(el) => {
                    rowRefs.current[r.id] = el;
                  }}
                  className={focoClasse(r.id).trim() || undefined}
                >
                  <td>
                    <ClienteCotacaoCell row={r} />
                  </td>
                  <td>
                    <SeguradoraProdutoCell row={r} />
                  </td>
                  <td>
                    <PropostaCell row={r} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <PremioCell row={r} />
                  </td>
                  <td>
                    <SituacaoCell row={r} />
                  </td>
                  <td>
                    <small className="muted">{dataHoraOuTraco(r.transmitida_em)}</small>
                  </td>
                  <td>
                    <AcoesCell
                      row={r}
                      documento={documentos?.[r.id] ?? null}
                      carregandoDocumento={carregandoDocumentos}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
