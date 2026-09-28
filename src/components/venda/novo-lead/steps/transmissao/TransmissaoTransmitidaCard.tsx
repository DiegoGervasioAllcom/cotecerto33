import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Form } from "@/components/venda/novo-lead/types";
import { embed1a1 } from "@/lib/postgrest-embed";
import {
  AVISO_INTEGRACAO_PENDENTE,
  dataOuTraco,
  moedaOuTraco,
  premioComParcelamento,
  propostaSituacaoInfo,
  textoOuTraco,
} from "@/lib/proposta-situacao";
import { salvarFocoMotivo, serializeFoco } from "@/lib/use-foco-ao-chegar";
import { useProposta } from "./useProposta";

const linhaFf = (k: string, v: ReactNode) => (
  <tr key={k}>
    <td className="ff-k">{k}</td>
    <td className="ff-v">{v}</td>
  </tr>
);

type Props = {
  propostaId: string;
  /** `Form` do wizard só para "Modelo" — o resto vem da proposta persistida. */
  f: Form;
};

// Espelha `transmResultado()` do protótipo V12 (`cotecerto_prototipo_v12.html`,
// por volta da linha 5935). O protótipo fabrica os campos pós-transmissão
// (protocolo, orçamento na cia, vigência aceita, apólice) como dado de
// demonstração — aqui eles vêm de `propostas` de verdade e mostram "—"
// enquanto a integração que os preenche (V12.1.16/17/20) não estiver ligada.
// Nunca simular status (V12.1.28).
export function TransmissaoTransmitidaCard({ propostaId, f }: Props) {
  const { data: proposta, isLoading, error } = useProposta(propostaId);

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 20, marginBottom: 12 }}>
        <div className="muted">Carregando a proposta…</div>
      </div>
    );
  }

  if (error || !proposta) {
    return (
      <div className="card" style={{ padding: 20, marginBottom: 12 }}>
        <div className="alert alert-err">Não foi possível carregar os dados da proposta.</div>
      </div>
    );
  }

  const st = propostaSituacaoInfo(proposta.transmissao_status);
  const cliente = embed1a1(proposta.cotacoes?.segurado)?.nome || "—";
  // V12.3.11 (destaque pós-transmissão) — o motivo real (segurado + nº da
  // proposta) viaja em sessionStorage; a URL leva só `foco=transmissao:<id>`.
  const focoEmissao = serializeFoco({ fonte: "transmissao", id: proposta.id });
  const focoMotivo = {
    titulo: `Proposta ${textoOuTraco(proposta.numero)} transmitida`,
    texto: `${cliente} · ${proposta.seguradora || "—"}`,
  };
  function marcarFocoEmissao() {
    salvarFocoMotivo(focoEmissao, focoMotivo);
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      <div
        className="acc-sol"
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <svg width={20} height={20}>
          <use href="#i-check-circle" />
        </svg>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 16 }}>
            Proposta {textoOuTraco(proposta.numero)} · {proposta.seguradora || "—"}
          </strong>
          <div className="small muted" style={{ marginTop: 3 }}>
            {cliente} · transmitida em {dataOuTraco(proposta.transmitida_em)}
          </div>
        </div>
        <span className={`chip ${st.chipClass}`}>{st.label}</span>
      </div>

      <div className="wizard-grid cols-2" data-tour="transmitida-docs" style={{ marginBottom: 16 }}>
        <div className="doc-li">
          <span>Cálculo</span>
          <strong>{textoOuTraco(proposta.cotacoes?.numero ?? null)}</strong>
        </div>
        <div className="doc-li">
          <span>Segurado</span>
          <strong>{cliente.toUpperCase()}</strong>
        </div>
        <div className="doc-li">
          <span>Modelo</span>
          <strong>{f.modelo || "—"}</strong>
        </div>
        <div className="doc-li">
          <span>Seguradora / produto</span>
          <strong>{(proposta.seguradora || "—").toUpperCase()}</strong>
        </div>
      </div>

      <div className="wizard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div className="acc-sec-t">Proposta</div>
          <table className="table-pipe ff-table">
            <tbody>
              {linhaFf("Nº da proposta", <strong>{textoOuTraco(proposta.numero)}</strong>)}
              {linhaFf("Protocolo", textoOuTraco(proposta.protocolo_seguradora))}
              {linhaFf("Orçamento na cia", textoOuTraco(proposta.orcamento_cia))}
              {linhaFf(
                "Vigência proposta",
                `${dataOuTraco(proposta.vigencia_inicio)} a ${dataOuTraco(proposta.vigencia_fim)}`,
              )}
              {linhaFf(
                "Vigência aceita",
                proposta.vigencia_aceita ? (
                  dataOuTraco(proposta.vigencia_aceita)
                ) : (
                  <span className="muted">aguardando a seguradora</span>
                ),
              )}
              {proposta.apolice_numero &&
                linhaFf("Apólice", <strong>{proposta.apolice_numero}</strong>)}
            </tbody>
          </table>
        </div>
        <div>
          <div className="acc-sec-t">Prêmio e pagamento</div>
          <table className="table-pipe ff-table">
            <tbody>
              {linhaFf(
                "Prêmio total",
                <strong>
                  {premioComParcelamento(
                    proposta.premio ?? proposta.valor,
                    proposta.parcelas,
                    proposta.valor_parcela,
                  )}
                </strong>,
              )}
              {linhaFf(
                "Pagamento",
                proposta.forma_pagamento
                  ? proposta.parcelas
                    ? `${proposta.forma_pagamento} · ${proposta.parcelas}x ${moedaOuTraco(proposta.valor_parcela)}`
                    : `${proposta.forma_pagamento} · à vista`
                  : "—",
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="clt-note" style={{ marginTop: 16 }}>
        <svg width={15} height={15}>
          <use href="#i-edit" />
        </svg>
        <div>
          <strong>Colete a assinatura do proponente</strong> e acompanhe até a emissão da apólice. A
          assinatura deve ocorrer em até <strong>15 dias</strong>, senão a proposta caduca na
          seguradora.
        </div>
      </div>

      <div className="acc-sec-t" style={{ marginTop: 16 }}>
        Nesta proposta
      </div>
      <div className="acc-pills" data-tour="transmitida-acoes">
        <button
          type="button"
          className="acc-pill"
          disabled
          aria-disabled="true"
          title={AVISO_INTEGRACAO_PENDENTE}
        >
          <svg width={13} height={13}>
            <use href="#i-file" />
          </svg>{" "}
          Documentos e envio
        </button>
        <button
          type="button"
          className="acc-pill"
          disabled
          aria-disabled="true"
          title={AVISO_INTEGRACAO_PENDENTE}
        >
          <svg width={13} height={13}>
            <use href="#i-refresh" />
          </svg>{" "}
          Consultar protocolo
        </button>
      </div>

      <div className="atalhos" data-tour="transmitida-atalhos">
        <span className="at-lbl">Ir para</span>
        <Link
          to="/venda/emissao"
          search={{ foco: focoEmissao }}
          className="at-btn"
          style={{ textDecoration: "none" }}
          onClick={marcarFocoEmissao}
        >
          <svg width={14} height={14}>
            <use href="#i-check-circle" />
          </svg>{" "}
          Emissão &amp; histórico
        </Link>
        <Link to="/venda/pipeline" className="at-btn" style={{ textDecoration: "none" }}>
          <svg width={14} height={14}>
            <use href="#i-kanban" />
          </svg>{" "}
          Pipeline
        </Link>
        <span className="spacer" />
        <Link to="/venda/novo-lead" className="btn btn-slate" style={{ textDecoration: "none" }}>
          <svg width={14} height={14}>
            <use href="#i-plus" />
          </svg>{" "}
          Nova cotação
        </Link>
      </div>
    </div>
  );
}
