// Lista comparativa do passo Cálculo (`.calc-lista`/`.calc-table` no
// protótipo V12 · `calcLista()`, cotecerto_prototipo_v12 linha ~4685) —
// seguradoras em coluna, coberturas em linha, como os "cartões resumidos"
// do Quiver. Virou a visão padrão do passo (V12.3.5); a alternância com o
// grid de cartões fica na `CalculoToolbar`.
//
// Sem o filtro Compreensiva/Demais/Todas nem o rótulo de tipo de cobertura
// sob cada seguradora — decisão do usuário (V12.3.12): não há dado real de
// tipo de cobertura por oferta hoje. A linha "Ações" fica reservada e vazia
// pra V12.3.6 preencher.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import { type ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraTile } from "@/components/venda/novo-lead/SeguradoraBadge";
import type { DescontoInfo } from "@/components/venda/cotacoes/useDescontoAdicional";
import {
  coberturaEntries,
  coberturaLabelsUnion,
  gruposOpcoesResultado,
  tituloResultado,
} from "@/components/venda/cotacoes/quiver-resultado";
import { SegAcoes } from "./SegAcoes";
import type { EscolhaCard } from "./types";

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("pt-BR");

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  // Lista completa (sem o filtro de faixa de preço) só para decidir quem é
  // "sem retorno" de verdade — uma oferta escondida pela faixa não pode virar
  // "sem retorno" (ela voltou, só está fora da faixa escolhida).
  todosResultados: ResultadoCalculo[];
  cotacaoId: string | null;
  erroGlobal: string | null;
  escolhaDoCard: (r: ResultadoCalculo) => EscolhaCard;
  setEscolha: (cardId: string, escolha: EscolhaCard) => void;
  onEscolherOferta: (r: ResultadoCalculo) => void;
  onContratarParcela: (r: ResultadoCalculo, grupoId: string, opcaoId: string) => void;
  // Ações por seguradora (`.seg-acoes` · V12.3.6) — infoFor/onAbrirDesconto
  // vêm do `useDescontoAdicional` chamado em `StepCalculo`.
  infoDescontoFor: (r: ResultadoCalculo) => DescontoInfo;
  onAbrirDesconto: (r: ResultadoCalculo) => void;
  onRecalcularSeguradora: (r: ResultadoCalculo) => Promise<void>;
};

type ColunaOferta = { tipo: "oferta"; resultado: ResultadoCalculo };
type ColunaSemRetorno = { tipo: "sem-retorno"; seguradora: string };
type Coluna = ColunaOferta | ColunaSemRetorno;

type Nav = { n: number; esq: number; dir: number; colW: number };
const NAV_VAZIO: Nav = { n: 0, esq: 0, dir: 0, colW: 0 };

export function CalculoLista({
  f,
  resultados,
  todosResultados,
  cotacaoId,
  erroGlobal,
  escolhaDoCard,
  setEscolha,
  onEscolherOferta,
  onContratarParcela,
  infoDescontoFor,
  onAbrirDesconto,
  onRecalcularSeguradora,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState<Nav>(NAV_VAZIO);

  // Seguradoras selecionadas pelo vendedor no passo Seguro que não têm
  // nenhum card no retorno da Quiver — real (comparação com `todosResultados`,
  // a lista cheia, não a já filtrada por faixa de preço), nunca uma lista
  // fixa inventada como no protótipo (`SEG_SEM_RETORNO`).
  const seguradorasSemRetorno = useMemo(() => {
    const retornadas = new Set(todosResultados.map((r) => normalizar(r.seguradora)));
    return (f.seguradorasSel ?? []).filter((sg) => !retornadas.has(normalizar(sg)));
  }, [f.seguradorasSel, todosResultados]);

  const colunas: Coluna[] = useMemo(
    () => [
      ...resultados.map((resultado): Coluna => ({ tipo: "oferta", resultado })),
      ...seguradorasSemRetorno.map((seguradora): Coluna => ({ tipo: "sem-retorno", seguradora })),
    ],
    [resultados, seguradorasSemRetorno],
  );

  const coberturaLabels = useMemo(() => coberturaLabelsUnion(resultados), [resultados]);

  const atualizarNav = useCallback(() => {
    const el = containerRef.current;
    const n = colunas.length;
    if (!el || !n) {
      setNav(NAV_VAZIO);
      return;
    }
    const lbl = el.querySelector<HTMLElement>(".cl-lbl");
    const lblW = lbl?.offsetWidth ?? 180;
    const colW = (el.scrollWidth - lblW) / n;
    if (!colW || colW < 1) {
      setNav({ n, esq: 0, dir: 0, colW: 0 });
      return;
    }
    const fora = el.scrollWidth - el.clientWidth;
    let esq = Math.round(el.scrollLeft / colW);
    const visiveis = Math.max(1, Math.floor((el.clientWidth - lblW) / colW));
    let dir = Math.max(0, n - esq - visiveis);
    if (fora <= 2) {
      esq = 0;
      dir = 0;
    }
    setNav({ n, esq, dir, colW });
  }, [colunas.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    atualizarNav();
    const observer = new ResizeObserver(atualizarNav);
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [colunas, atualizarNav]);

  function rolar(direcao: -1 | 1) {
    containerRef.current?.scrollBy({ left: direcao * nav.colW, behavior: "smooth" });
    setTimeout(atualizarNav, 300);
  }

  // Maior nº de opções de parcela entre as formas de pagamento atualmente
  // selecionadas — cada linha da seção "Parcelamento" é um índice dessa
  // lista; o rótulo vem da primeira oferta que tiver aquele índice.
  const gruposSelecionados = useMemo(
    () =>
      resultados.map((resultado) => {
        const escolha = escolhaDoCard(resultado);
        const grupos = gruposOpcoesResultado(resultado);
        const grupo = grupos.find((item) => item.id === escolha.grupoId);
        return { resultado, escolha, grupos, grupo };
      }),
    [resultados, escolhaDoCard],
  );
  const maxOpcoes = Math.max(
    0,
    ...gruposSelecionados.map((item) => item.grupo?.opcoes.length ?? 0),
  );
  const rotuloParcela = (idx: number) =>
    gruposSelecionados.find((item) => item.grupo?.opcoes[idx])?.grupo?.opcoes[idx]?.tipo ||
    `Opção ${idx + 1}`;

  if (colunas.length === 0) {
    return (
      <div className="calc-lista" data-tour="calc-lista">
        <div className="muted small" style={{ padding: 24, textAlign: "center" }}>
          Nenhuma seguradora selecionada para esta cotação.
        </div>
      </div>
    );
  }

  const temContador = nav.n > 0 && (nav.esq > 0 || nav.dir > 0);

  return (
    <>
      <div className="cl-nav" data-tour="cl-nav">
        <button
          type="button"
          className="cl-arrow"
          title="Ver as seguradoras à esquerda"
          disabled={nav.esq <= 0}
          onClick={() => rolar(-1)}
        >
          <svg width="16" height="16">
            <use href="#i-chevron-left" />
          </svg>
        </button>
        <span className="cl-cont">
          {nav.n === 0 ? (
            "Role para ver todas as seguradoras"
          ) : temContador ? (
            <>
              {nav.esq > 0 && (
                <>
                  <strong>{nav.esq}</strong> à esquerda
                </>
              )}
              {nav.esq > 0 && nav.dir > 0 && " · "}
              {nav.dir > 0 && (
                <>
                  <strong>{nav.dir}</strong> à direita
                </>
              )}{" "}
              <span className="cl-de">de {nav.n} seguradoras</span>
            </>
          ) : (
            <>
              todas as <strong>{nav.n}</strong> seguradoras estão na tela
            </>
          )}
        </span>
        <button
          type="button"
          className="cl-arrow"
          title="Ver as seguradoras à direita"
          disabled={nav.dir <= 0}
          onClick={() => rolar(1)}
        >
          <svg width="16" height="16">
            <use href="#i-chevron-right" />
          </svg>
        </button>
      </div>

      <div className="calc-lista" ref={containerRef} onScroll={atualizarNav} data-tour="calc-lista">
        <table className="calc-table">
          <thead>
            <tr>
              <th className="cl-lbl">Coberturas</th>
              {colunas.map((coluna) => {
                const chave =
                  coluna.tipo === "oferta" ? coluna.resultado.cardId : coluna.seguradora;
                const nome =
                  coluna.tipo === "oferta" ? coluna.resultado.seguradora : coluna.seguradora;
                return (
                  <th key={chave}>
                    <div className="cl-seg">
                      <SeguradoraTile nome={nome} tam="t-sm" on={coluna.tipo === "oferta"} />
                      <small>
                        {coluna.tipo === "oferta"
                          ? tituloResultado(coluna.resultado)
                          : "sem retorno"}
                      </small>
                      {coluna.tipo === "oferta" && coluna.resultado.secao && (
                        <small>{coluna.resultado.secao}</small>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {coberturaLabels.map((label) => (
              <tr key={label}>
                <td className="cl-lbl">{label}</td>
                {colunas.map((coluna) => {
                  const chave =
                    coluna.tipo === "oferta" ? coluna.resultado.cardId : coluna.seguradora;
                  const valor =
                    coluna.tipo === "oferta"
                      ? coberturaEntries(coluna.resultado).find(
                          ([candidato]) => candidato === label,
                        )?.[1]
                      : undefined;
                  return <td key={chave}>{valor ?? <span className="nc">—</span>}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td className="cl-lbl">Forma de pagamento</td>
              {colunas.map((coluna) => {
                if (coluna.tipo === "sem-retorno")
                  return (
                    <td key={coluna.seguradora}>
                      <span className="nc">—</span>
                    </td>
                  );
                const { resultado } = coluna;
                const gruposPagamento = gruposOpcoesResultado(resultado);
                const escolha = escolhaDoCard(resultado);
                return (
                  <td key={resultado.cardId}>
                    <select
                      className="select-mini"
                      style={{ width: "100%" }}
                      aria-label="Forma de pagamento"
                      value={escolha.grupoId}
                      disabled={gruposPagamento.length === 0}
                      onChange={(e) => {
                        const grupo = gruposPagamento.find((item) => item.id === e.target.value);
                        setEscolha(resultado.cardId, {
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
                  </td>
                );
              })}
            </tr>
            {maxOpcoes > 0 && (
              <tr className="cl-sec">
                <td className="cl-lbl">Parcelamento</td>
                {colunas.map((coluna) => {
                  const chave =
                    coluna.tipo === "oferta" ? coluna.resultado.cardId : coluna.seguradora;
                  return (
                    <td key={chave}>
                      {coluna.tipo === "oferta" && (
                        <small className="muted">passe o mouse e contrate direto</small>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            {Array.from({ length: maxOpcoes }, (_, idx) => (
              <tr className={`cl-parc${idx === 0 ? " cl-preco" : ""}`} key={`parc-${idx}`}>
                <td className="cl-lbl">{rotuloParcela(idx)}</td>
                {colunas.map((coluna) => {
                  if (coluna.tipo === "sem-retorno")
                    return (
                      <td key={coluna.seguradora}>
                        <span className="nc">—</span>
                      </td>
                    );
                  const { resultado } = coluna;
                  const item = gruposSelecionados.find(
                    (g) => g.resultado.cardId === resultado.cardId,
                  );
                  const opcao = item?.grupo?.opcoes[idx];
                  if (!opcao)
                    return (
                      <td key={resultado.cardId}>
                        <span className="nc">—</span>
                      </td>
                    );
                  const selecionada = item?.escolha.opcaoId === opcao.id;
                  const texto = opcao.parcelas || opcao.avista || "—";
                  return (
                    <td
                      key={resultado.cardId}
                      className={`cl-cell${selecionada ? " on" : ""}`}
                      onClick={() =>
                        setEscolha(resultado.cardId, {
                          grupoId: item?.grupo?.id ?? "",
                          opcaoId: opcao.id,
                        })
                      }
                      title={`Escolher ${texto.toLowerCase()}`}
                    >
                      <span className="cl-v">
                        {texto}
                        {selecionada && (
                          <span className="cl-mark">
                            <svg width="10" height="10">
                              <use href="#i-check" />
                            </svg>
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="cl-buy"
                        title={`Contratar ${resultado.seguradora}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onContratarParcela(resultado, item?.grupo?.id ?? "", opcao.id);
                        }}
                      >
                        <span className="buy-v">{texto}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="cl-lbl">Ações</td>
              {colunas.map((coluna) => {
                if (coluna.tipo === "sem-retorno") return <td key={coluna.seguradora} />;
                const { resultado } = coluna;
                const outrasSeguradoras = colunas
                  .filter(
                    (item): item is ColunaOferta =>
                      item.tipo === "oferta" && item.resultado.cardId !== resultado.cardId,
                  )
                  .map((item) => item.resultado.seguradora);
                return (
                  <td key={resultado.cardId}>
                    <SegAcoes
                      resultado={resultado}
                      cotacaoId={cotacaoId}
                      info={infoDescontoFor(resultado)}
                      onAbrirDesconto={() => onAbrirDesconto(resultado)}
                      outrasSeguradoras={outrasSeguradoras}
                      onRecalcular={() => onRecalcularSeguradora(resultado)}
                    />
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="cl-lbl" />
              {colunas.map((coluna) => {
                if (coluna.tipo === "sem-retorno")
                  return (
                    <td key={coluna.seguradora}>
                      <span className="nc">Sem retorno</span>
                      {erroGlobal && <div className="small muted u-mt-4">{erroGlobal}</div>}
                    </td>
                  );
                const { resultado } = coluna;
                const item = gruposSelecionados.find(
                  (g) => g.resultado.cardId === resultado.cardId,
                );
                const escolha = item?.escolha;
                const opcaoSelecionada = item?.grupo?.opcoes.find((o) => o.id === escolha?.opcaoId);
                return (
                  <td key={resultado.cardId}>
                    <button
                      className="btn btn-yellow btn-sm"
                      type="button"
                      disabled={!cotacaoId || !opcaoSelecionada}
                      title={
                        cotacaoId
                          ? `Gerar proposta (${resultado.seguradora})`
                          : "Salve a cotação antes de gerar a proposta"
                      }
                      onClick={() => onEscolherOferta(resultado)}
                    >
                      <svg width="12" height="12">
                        <use href="#i-check" />
                      </svg>{" "}
                      Contratar
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
