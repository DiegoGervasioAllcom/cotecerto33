import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Form } from "@/components/venda/novo-lead/types";
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import type { DescontoAcoes } from "@/components/venda/novo-lead/hooks/useRecalcularSeguradora";
import { useImprimirCotacaoModal } from "@/components/venda/cotacoes/ImprimirCotacaoModal";
import { docDadosDoForm } from "@/components/venda/cotacoes/doc-dados";
import {
  formatarNumeroCotacao,
  useNumeroCotacao,
} from "@/components/venda/novo-lead/hooks/useNumeroCotacao";
import {
  filtrarPorFaixaDePreco,
  filtrarPorSecao,
  secoesDisponiveis,
  gruposOpcoesResultado,
  ordenarPorEscolha,
  ordenarResultados,
  premioNumerico,
  type FaixaPrecoCalculo,
  type OrdemCalculo,
  type SemRetornoItem,
} from "@/components/venda/cotacoes/quiver-resultado";
import { CalculoContexto } from "./calculo/CalculoContexto";
import { CalculoFiltroSecao } from "./calculo/CalculoFiltroSecao";
import { CalculoToolbar, type CalcView } from "./calculo/CalculoToolbar";
import { CalculoLista } from "./calculo/CalculoLista";
import { CalculoCardsGrid } from "./calculo/CalculoCardsGrid";
import type { EscolhaCard } from "./calculo/types";

export type OfertaTransmissao = {
  resultado: ResultadoCalculo;
  formaPagamento: string;
  parcelas: string;
  premio: number | undefined;
  /**
   * Discriminadores da faixa/opção escolhida (tipo/franquia/avista/desconto)
   * — o servidor usa isso + `parcelas` acima para localizar EXATAMENTE essa
   * opção em `cotacoes.quiver_resultado_raw` e recalcular o prêmio lá
   * (`transmitirPropostaQuiver`/`calcularPremioTransmissao`), em vez de
   * confiar no `premio` calculado aqui no front.
   */
  opcao: { tipo?: string; franquia?: string; avista?: string; desconto?: string };
};

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  semRetorno: SemRetornoItem[];
  calculando: boolean;
  erro: string | null;
  podeCalcular: boolean;
  camposFaltantes: string[];
  cotacaoId: string | null;
  doSimularCalculo: () => void;
  onEscolherOferta: (oferta: OfertaTransmissao) => void;
  // Ações por seguradora (`.seg-acoes` · V12.3.6) — dados e orquestração
  // (fetch de seguradoras/prêmios/solicitações, cancelamento de pedidos de
  // desconto de outras seguradoras, setF+reenvio) ficam em `novo-lead.tsx`
  // via `useRecalcularSeguradora`; aqui só repassa para a lista/grid.
  descontoAcoes: DescontoAcoes;
};

export function StepCalculo({
  f,
  resultados,
  semRetorno,
  calculando,
  erro,
  podeCalcular,
  camposFaltantes,
  cotacaoId,
  doSimularCalculo,
  onEscolherOferta,
  descontoAcoes,
}: Props) {
  const { infoDescontoFor, onAbrirDesconto, onRecalcularSeguradora, erroRecalculo, descontoModal } =
    descontoAcoes;
  // Escolha de forma de pagamento/parcelas por card — o robô precisa das duas
  // para clicar na célula certa do modal do portal. Compartilhada entre a
  // lista comparativa e o grid de cartões (só uma visão fica visível por
  // vez, mas a escolha do vendedor não deve se perder ao trocar).
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaCard>>({});
  const [erroSelecao, setErroSelecao] = useState<string | null>(null);
  const [calcView, setCalcView] = useState<CalcView>("lista");
  const [calcOrdem, setCalcOrdem] = useState<OrdemCalculo>("menor");
  const [calcFaixa, setCalcFaixa] = useState<FaixaPrecoCalculo>("");
  const [calcSecao, setCalcSecao] = useState("");
  const imprimir = useImprimirCotacaoModal();
  // Mesmo dado de `CalculoContexto` (react-query dedupe por `queryKey`) — o
  // documento impresso precisa do número real da cotação, não de um pedaço
  // do uuid.
  const { numero: cotacaoNumero, criadoEm: cotacaoCriadoEm } = useNumeroCotacao(cotacaoId);
  const numeroImpressaoFormatado = formatarNumeroCotacao(cotacaoNumero, cotacaoCriadoEm);

  const resultadosExibidos = useMemo(
    () =>
      filtrarPorSecao(
        filtrarPorFaixaDePreco(ordenarPorEscolha(resultados, calcOrdem), calcFaixa),
        calcSecao,
      ),
    [resultados, calcOrdem, calcFaixa, calcSecao],
  );
  const secoes = useMemo(() => secoesDisponiveis(resultados), [resultados]);

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

  // Núcleo compartilhado entre o botão "Contratar/Gerar proposta" (lê a
  // escolha atual do estado) e o clique direto numa célula de parcela na
  // lista comparativa (que já sabe grupo/opção sem depender do estado, pra
  // não esbarrar num `setEscolhas` ainda não aplicado no mesmo clique).
  function confirmarOferta(r: ResultadoCalculo, escolha: EscolhaCard) {
    if (!cotacaoId) {
      setErroSelecao("Salve a cotação antes de gerar a proposta.");
      return;
    }
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
      opcao: {
        tipo: opcao.tipo,
        franquia: opcao.franquia,
        avista: opcao.avista,
        desconto: opcao.desconto,
      },
    });
  }

  function escolherOferta(r: ResultadoCalculo) {
    confirmarOferta(r, escolhaDoCard(r));
  }

  function contratarParcela(r: ResultadoCalculo, grupoId: string, opcaoId: string) {
    const escolha = { grupoId, opcaoId };
    setEscolha(r.cardId, escolha);
    confirmarOferta(r, escolha);
  }

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0 }}>Coberturas e valores</h2>
          <div className="sub" style={{ margin: 0 }}>
            {calculando
              ? "Calculando com as seguradoras… isso pode levar alguns minutos."
              : resultados.length > 0
                ? "Compare, personalize e escolha a seguradora"
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
      </div>
      {imprimir.modal}

      {resultados.length > 0 && (
        <CalculoContexto
          cotacaoId={cotacaoId}
          cliente={f.nome ?? ""}
          padrao={f.tipoCobertura || "—"}
        />
      )}

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

      {erroRecalculo && (
        <div className="banner alert" style={{ marginBottom: 12 }}>
          {erroRecalculo}
        </div>
      )}

      {descontoModal}

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
        <>
          <CalculoFiltroSecao secoes={secoes} atual={calcSecao} onChange={setCalcSecao} />
          <CalculoToolbar
            view={calcView}
            onSetView={setCalcView}
            ordem={calcOrdem}
            onSetOrdem={setCalcOrdem}
            faixa={calcFaixa}
            onSetFaixa={setCalcFaixa}
            podeImprimir={resultados.length > 0}
            onImprimir={() =>
              imprimir.abrir(
                docDadosDoForm(
                  f,
                  ordenarResultados(resultados),
                  numeroImpressaoFormatado ? `#${numeroImpressaoFormatado}` : "—",
                ),
              )
            }
            podeRecalcular={podeCalcular}
            calculando={calculando}
            onRecalcular={doSimularCalculo}
            tituloRecalcular={
              !podeCalcular ? `Faltam preencher: ${camposFaltantes.join(", ")}` : undefined
            }
          />

          {calcView === "lista" ? (
            <CalculoLista
              f={f}
              resultados={resultadosExibidos}
              todosResultados={resultados}
              semRetorno={semRetorno}
              cotacaoId={cotacaoId}
              erroGlobal={erro}
              escolhaDoCard={escolhaDoCard}
              setEscolha={setEscolha}
              onEscolherOferta={escolherOferta}
              onContratarParcela={contratarParcela}
              infoDescontoFor={infoDescontoFor}
              onAbrirDesconto={onAbrirDesconto}
              onRecalcularSeguradora={(r) => onRecalcularSeguradora(r)}
            />
          ) : (
            <CalculoCardsGrid
              resultados={resultadosExibidos}
              todosResultados={resultados}
              semRetorno={semRetorno}
              cotacaoId={cotacaoId}
              escolhaDoCard={escolhaDoCard}
              setEscolha={setEscolha}
              onEscolherOferta={escolherOferta}
              infoDescontoFor={infoDescontoFor}
              onAbrirDesconto={onAbrirDesconto}
              onRecalcularSeguradora={(r) => onRecalcularSeguradora(r)}
            />
          )}
        </>
      )}
    </>
  );
}
