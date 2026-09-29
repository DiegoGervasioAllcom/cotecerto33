// Ações por seguradora do passo Cálculo (`.seg-acoes` no protótipo V12 ·
// `segAcoesHtml()`/`segAcao()`, cotecerto_prototipo_v12 linhas ~4690-4820) —
// V12.3.6. Usado tanto na linha "Ações" da lista comparativa (`CalculoLista`)
// quanto no rodapé do cartão (`CalculoCardsGrid`).
//
// Ordem e ícones do protótipo: Mensagens, % (desconto), Prêmio (VIP),
// Engrenagem (opções), Recalcular. Mensagens (V12.4.5) só habilita quando o
// card traz `mensagensRetorno`; Prêmio fica sempre desabilitado — Cliente VIP
// é feature nova sem escopo fechado (decisão pendente nº 2 do plano V12, `PLANO_TASKS_V12.md`).
import { useState } from "react";
import { createPortal } from "react-dom";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import type { DescontoInfo } from "@/components/venda/cotacoes/useDescontoAdicional";
import { temMensagensRetorno } from "@/components/venda/cotacoes/quiver-resultado";
import { AnaliseEnvioModal } from "./AnaliseEnvioModal";
import { MensagensRetornoModal } from "./MensagensRetornoModal";

type Props = {
  resultado: ResultadoCalculo;
  cotacaoId: string | null;
  info: DescontoInfo;
  onAbrirDesconto: () => void;
  /** Nomes das outras seguradoras com oferta nesta cotação — só para a
   * mensagem de confirmação do recálculo ("descarta as ofertas das outras
   * N seguradoras"). */
  outrasSeguradoras: string[];
  onRecalcular: () => Promise<void>;
};

export function SegAcoes({
  resultado,
  cotacaoId,
  info,
  onAbrirDesconto,
  outrasSeguradoras,
  onRecalcular,
}: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [analiseAberta, setAnaliseAberta] = useState(false);
  const [mensagensAbertas, setMensagensAbertas] = useState(false);
  const temMensagens = temMensagensRetorno(resultado);
  const [confirmarRecalculo, setConfirmarRecalculo] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const descontoDisabledTitle = !info.disponivel
    ? (info.indisponivelMotivo ?? "Indisponível")
    : info.emAndamento
      ? "Já existe um pedido de desconto em andamento para esta seguradora"
      : "Solicitar desconto adicional nesta seguradora";
  const descontoDisabled = !info.disponivel || info.emAndamento;

  const n = outrasSeguradoras.length;
  const mensagemConfirmacao =
    n > 0
      ? `Recalcular só a ${resultado.seguradora} descarta as ofertas das outras ${n} seguradora${n === 1 ? "" : "s"} desta cotação. Continuar?`
      : `Recalcular a ${resultado.seguradora}?`;

  async function confirmarERecalcular() {
    setConfirmarRecalculo(false);
    if (!cotacaoId || recalculando) return;
    setRecalculando(true);
    try {
      await onRecalcular();
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <div className="seg-acoes" data-tour="seg-acoes">
      <button
        type="button"
        className="ic-btn"
        title={
          temMensagens ? "Mensagens de retorno da seguradora" : "Sem retorno da seguradora ainda"
        }
        aria-disabled={!temMensagens}
        disabled={!temMensagens}
        onClick={() => setMensagensAbertas(true)}
      >
        <svg width="15" height="15">
          <use href="#i-message" />
        </svg>
      </button>
      <button
        type="button"
        className="ic-btn"
        title={descontoDisabledTitle}
        aria-disabled={descontoDisabled}
        disabled={descontoDisabled}
        onClick={onAbrirDesconto}
      >
        <svg width="15" height="15">
          <use href="#i-percent" />
        </svg>
      </button>
      <button
        type="button"
        className="ic-btn"
        title="Cliente VIP — em breve"
        aria-disabled="true"
        disabled
      >
        <svg width="15" height="15">
          <use href="#i-award" />
        </svg>
      </button>
      <button
        type="button"
        className="ic-btn"
        title="Opções: análise do envio"
        onClick={() => setMenuAberto(true)}
      >
        <svg width="15" height="15">
          <use href="#i-settings" />
        </svg>
      </button>
      <button
        type="button"
        className="ic-btn"
        title="Recalcular só esta seguradora"
        disabled={!cotacaoId || recalculando}
        onClick={() => setConfirmarRecalculo(true)}
      >
        <svg width="15" height="15">
          <use href="#i-refresh" />
        </svg>
      </button>

      {/* Os modais vão para o <body>: dentro da célula da lista comparativa eles
          herdavam o texto centralizado e sem quebra de linha da tabela. */}
      {menuAberto &&
        createPortal(
          <div className="modal-host" onClick={() => setMenuAberto(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h">
                <svg width="18" height="18">
                  <use href="#i-settings" />
                </svg>
                <h3>Opções — {resultado.seguradora}</h3>
                <div className="x" onClick={() => setMenuAberto(false)}>
                  ×
                </div>
              </div>
              <div className="modal-b" style={{ paddingTop: 10 }}>
                <button
                  type="button"
                  className="op-item"
                  onClick={() => {
                    setMenuAberto(false);
                    setAnaliseAberta(true);
                  }}
                >
                  <span className="op-ic">
                    <svg width="17" height="17">
                      <use href="#i-search" />
                    </svg>
                  </span>
                  <span className="op-tx">
                    <strong>Análise do envio</strong>
                    <small>O que foi enviado e o que a seguradora devolveu</small>
                  </span>
                  <svg width="14" height="14">
                    <use href="#i-chevron-right" />
                  </svg>
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {mensagensAbertas &&
        temMensagens &&
        createPortal(
          <MensagensRetornoModal
            resultado={resultado}
            onClose={() => setMensagensAbertas(false)}
          />,
          document.body,
        )}

      {analiseAberta &&
        cotacaoId &&
        createPortal(
          <AnaliseEnvioModal
            cotacaoId={cotacaoId}
            resultado={resultado}
            onClose={() => setAnaliseAberta(false)}
          />,
          document.body,
        )}

      {confirmarRecalculo &&
        createPortal(
          <div className="modal-host" onClick={() => setConfirmarRecalculo(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-h">
                <svg width="18" height="18">
                  <use href="#i-refresh" />
                </svg>
                <h3>Recalcular — {resultado.seguradora}</h3>
                <div className="x" onClick={() => setConfirmarRecalculo(false)}>
                  ×
                </div>
              </div>
              <div className="modal-b">{mensagemConfirmacao}</div>
              <div className="modal-f">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setConfirmarRecalculo(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-yellow"
                  type="button"
                  onClick={() => void confirmarERecalcular()}
                >
                  <svg width="14" height="14">
                    <use href="#i-refresh" />
                  </svg>{" "}
                  Recalcular
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
