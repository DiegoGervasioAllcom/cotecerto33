import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Form } from "@/components/venda/novo-lead/types";
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import { useImprimirCotacaoModal } from "@/components/venda/cotacoes/ImprimirCotacaoModal";
import { docDadosDoForm } from "@/components/venda/cotacoes/doc-dados";
import {
  gruposOpcoesResultado,
  ordenarResultados,
  premioNumerico,
} from "@/components/venda/cotacoes/quiver-resultado";

type EscolhaCard = { grupoId: string; opcaoId: string };
export type OfertaTransmissao = {
  resultado: ResultadoCalculo;
  formaPagamento: string;
  parcelas: string;
  premio: number | undefined;
};

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  calculando: boolean;
  erro: string | null;
  podeCalcular: boolean;
  camposFaltantes: string[];
  cotacaoId: string | null;
  doSimularCalculo: () => void;
  onEscolherOferta: (oferta: OfertaTransmissao) => void;
};

export function StepCalculo({
  f,
  resultados,
  calculando,
  erro,
  podeCalcular,
  camposFaltantes,
  cotacaoId,
  doSimularCalculo,
  onEscolherOferta,
}: Props) {
  // Escolha de forma de pagamento/parcelas por card — o robô precisa das duas
  // para clicar na célula certa do modal do portal.
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaCard>>({});
  const [erroSelecao, setErroSelecao] = useState<string | null>(null);
  const imprimir = useImprimirCotacaoModal();

  function escolhaDoCard(r: ResultadoCalculo): EscolhaCard {
    const primeiroGrupo = gruposOpcoesResultado(r)[0];
    return (
      escolhas[r.cardId] ?? {
        grupoId: primeiroGrupo?.id ?? "",
        opcaoId: primeiroGrupo?.opcoes[0]?.id ?? "",
      }
    );
  }

  function setEscolha(cardId: string, escolha: EscolhaCard) {
    setEscolhas((atual) => ({ ...atual, [cardId]: escolha }));
  }

  function escolherOferta(r: ResultadoCalculo) {
    if (!cotacaoId) {
      setErroSelecao("Salve a cotação antes de gerar a proposta.");
      return;
    }
    const escolha = escolhaDoCard(r);
    const grupo = gruposOpcoesResultado(r).find((item) => item.id === escolha.grupoId);
    const opcao = grupo?.opcoes.find((item) => item.id === escolha.opcaoId);
    if (!grupo || !opcao) {
      setErroSelecao(
        "Esta cotação não possui uma combinação de pagamento válida para transmissão.",
      );
      return;
    }

    setErroSelecao(null);
    onEscolherOferta({
      resultado: r,
      formaPagamento: grupo.formaPagamento,
      parcelas: opcao.parcelas ?? "",
      premio: premioNumerico(opcao),
    });
  }

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Coberturas e valores</h2>
          <div className="sub" style={{ margin: 0 }}>
            {calculando
              ? "Calculando com as seguradoras… isso pode levar alguns minutos."
              : resultados.length > 0
                ? `${resultados.length} seguradoras calculadas · ${f.tipoCobertura || "Compreensiva"}`
                : (f.seguradorasSel?.length ?? 0) > 0
                  ? `${f.seguradorasSel.length} seguradoras selecionadas · clique em Calcular agora`
                  : "Selecione seguradoras no passo Seguro"}
          </div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        {cotacaoId && (
          <Link
            to="/venda/cotacoes/$id"
            params={{ id: cotacaoId }}
            className="btn btn-slate btn-sm"
          >
            <svg width="13" height="13">
              <use href="#i-shield" />
            </svg>{" "}
            Comparativo lado a lado
          </Link>
        )}
        <div className="calc-bar-r">
          <button
            className="btn btn-ghost btn-sm"
            data-tour="calc-imprimir"
            disabled={resultados.length === 0}
            onClick={() =>
              imprimir.abrir(
                docDadosDoForm(
                  f,
                  ordenarResultados(resultados),
                  cotacaoId ? `#${cotacaoId.slice(0, 8)}` : "rascunho",
                ),
              )
            }
          >
            <svg width="13" height="13">
              <use href="#i-download" />
            </svg>{" "}
            Imprimir
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!podeCalcular || calculando}
            title={!podeCalcular ? `Faltam preencher: ${camposFaltantes.join(", ")}` : undefined}
            onClick={doSimularCalculo}
          >
            <svg width="13" height="13">
              <use href="#i-refresh" />
            </svg>{" "}
            {calculando ? "Calculando…" : "Recalcular"}
          </button>
        </div>
      </div>
      {imprimir.modal}

      {erro && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--alert-soft)",
            color: "var(--alert)",
            fontSize: 13,
          }}
        >
          {erro}
        </div>
      )}

      {erroSelecao && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--alert-soft)",
            color: "var(--alert)",
            fontSize: 13,
          }}
        >
          {erroSelecao}
        </div>
      )}

      {calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <span className="muted small">
            Enviamos a cotação para as seguradoras — o resultado chega em alguns minutos, sem
            precisar ficar nesta tela.
          </span>
        </div>
      )}

      {resultados.length === 0 && !calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <button
            className="btn btn-yellow"
            disabled={!podeCalcular}
            title={!podeCalcular ? `Faltam preencher: ${camposFaltantes.join(", ")}` : undefined}
            onClick={doSimularCalculo}
          >
            <svg width="14" height="14">
              <use href="#i-bolt" />
            </svg>
            {podeCalcular ? " Calcular agora" : " Faltam campos"}
          </button>
          {!podeCalcular && camposFaltantes.length > 0 && (
            <div className="muted small" style={{ marginTop: 6 }}>
              Faltam: {camposFaltantes.join(", ")}
            </div>
          )}
        </div>
      )}

      {resultados.length > 0 && (
        <div className="calc-grid">
          {ordenarResultados(resultados).map((r) => {
            const basicas = Object.entries(r.coberturasBasicas ?? {});
            const adicionais = Object.entries(r.coberturasAdicionais ?? {});
            const gruposPagamento = gruposOpcoesResultado(r);
            const escolha = escolhaDoCard(r);
            const grupoSelecionado = gruposPagamento.find((grupo) => grupo.id === escolha.grupoId);
            const opcaoSelecionada = grupoSelecionado?.opcoes.find(
              (opcao) => opcao.id === escolha.opcaoId,
            );
            const opcoesExibidas = opcaoSelecionada ? [opcaoSelecionada] : r.opcoes;
            return (
              <div className="calc-card" key={r.cardId}>
                <div className="calc-head">
                  <div className="calc-ins">
                    <SeguradoraBadge nome={r.seguradora} tam="sm" /> {r.seguradora}
                  </div>
                  <span className="chip chip-slate">
                    {r.produto ? `${r.produto} · ${r.nome}` : r.nome || "Compreensiva"}
                  </span>
                </div>
                <div className="calc-tiers">
                  {opcoesExibidas.map((o, opcaoIndex) => (
                    <div className="calc-tier" key={`${r.cardId}-opcao-${opcaoIndex}`}>
                      <div className="t-lbl">{o.tipo || "—"}</div>
                      <div className="t-fr">{o.franquia || "—"}</div>
                      <div className="t-vista">{o.avista || "—"}</div>
                      <div className="t-parc">{o.parcelas || "—"}</div>
                      {o.desconto && <div className="chip chip-ok">{o.desconto}</div>}
                    </div>
                  ))}
                </div>
                <div className="calc-cobs">
                  <div className="cob-col">
                    <div className="cob-h">Coberturas básicas</div>
                    {basicas.length === 0 && (
                      <div className="cob-row muted small">Não informado pela seguradora</div>
                    )}
                    {basicas.map(([label, valor]) => (
                      <div className="cob-row" key={label}>
                        <span>{label}</span>
                        <b>{valor}</b>
                      </div>
                    ))}
                  </div>
                  <div className="cob-col">
                    <div className="cob-h">Adicionais</div>
                    {adicionais.length === 0 && (
                      <div className="cob-row muted small">Não informado pela seguradora</div>
                    )}
                    {adicionais.map(([label, valor]) => (
                      <div className="cob-row" key={label}>
                        <span>{label}</span>
                        <b>{valor}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="calc-foot">
                  <select
                    className="select-mini"
                    aria-label="Forma de pagamento"
                    value={escolha.grupoId}
                    disabled={gruposPagamento.length === 0}
                    onChange={(e) => {
                      const grupo = gruposPagamento.find((item) => item.id === e.target.value);
                      setEscolha(r.cardId, {
                        grupoId: e.target.value,
                        opcaoId: grupo?.opcoes[0]?.id ?? "",
                      });
                    }}
                  >
                    {gruposPagamento.length === 0 && <option value="">Indisponível</option>}
                    {gruposPagamento.map((grupo) => (
                      <option key={grupo.id} value={grupo.id}>
                        {grupo.formaPagamento}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select-mini"
                    aria-label="Parcelas"
                    value={escolha.opcaoId}
                    disabled={!grupoSelecionado}
                    onChange={(e) =>
                      setEscolha(r.cardId, { grupoId: escolha.grupoId, opcaoId: e.target.value })
                    }
                  >
                    {!grupoSelecionado && <option value="">Indisponível</option>}
                    {grupoSelecionado?.opcoes.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>
                        {[opcao.tipo, opcao.parcelas].filter(Boolean).join(" · ") || "Opção"}
                      </option>
                    ))}
                  </select>
                  <button className="ic-btn" title="Observações">
                    <svg width="15" height="15">
                      <use href="#i-message" />
                    </svg>
                  </button>
                  <button className="ic-btn" title="Enviar">
                    <svg width="15" height="15">
                      <use href="#i-download" />
                    </svg>
                  </button>
                  <button
                    className="ic-btn ok"
                    title={
                      cotacaoId
                        ? `Gerar proposta (${r.seguradora})`
                        : "Salve a cotação antes de gerar a proposta"
                    }
                    disabled={!cotacaoId || !opcaoSelecionada}
                    onClick={() => escolherOferta(r)}
                  >
                    <svg width="15" height="15">
                      <use href="#i-check" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
