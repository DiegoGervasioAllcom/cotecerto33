// Visão em cartões do passo Cálculo — a que já existia antes da V12.3.5.
// A V12.3.5 troca a visão padrão para a lista comparativa (`CalculoLista`)
// e mantém esta como alternativa (`.calc-toolset`), extraída aqui pra
// StepCalculo não crescer ao virar orquestrador.
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import {
  gruposOpcoesResultado,
  tituloResultado,
} from "@/components/venda/cotacoes/quiver-resultado";
import type { DescontoInfo } from "@/components/venda/cotacoes/useDescontoAdicional";
import { SegAcoes } from "./SegAcoes";
import type { EscolhaCard } from "./types";

type Props = {
  resultados: ResultadoCalculo[];
  cotacaoId: string | null;
  escolhaDoCard: (r: ResultadoCalculo) => EscolhaCard;
  setEscolha: (cardId: string, escolha: EscolhaCard) => void;
  onEscolherOferta: (r: ResultadoCalculo) => void;
  infoDescontoFor: (r: ResultadoCalculo) => DescontoInfo;
  onAbrirDesconto: (r: ResultadoCalculo) => void;
  onRecalcularSeguradora: (r: ResultadoCalculo) => Promise<void>;
};

export function CalculoCardsGrid({
  resultados,
  cotacaoId,
  escolhaDoCard,
  setEscolha,
  onEscolherOferta,
  infoDescontoFor,
  onAbrirDesconto,
  onRecalcularSeguradora,
}: Props) {
  return (
    <div className="calc-grid">
      {resultados.map((r) => {
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
              <span className="chip chip-slate">{tituloResultado(r)}</span>
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
              <SegAcoes
                resultado={r}
                cotacaoId={cotacaoId}
                info={infoDescontoFor(r)}
                onAbrirDesconto={() => onAbrirDesconto(r)}
                outrasSeguradoras={resultados
                  .filter((outro) => outro.cardId !== r.cardId)
                  .map((outro) => outro.seguradora)}
                onRecalcular={() => onRecalcularSeguradora(r)}
              />
              <button
                className="ic-btn ok"
                title={
                  cotacaoId
                    ? `Gerar proposta (${r.seguradora})`
                    : "Salve a cotação antes de gerar a proposta"
                }
                disabled={!cotacaoId || !opcaoSelecionada}
                onClick={() => onEscolherOferta(r)}
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
  );
}
