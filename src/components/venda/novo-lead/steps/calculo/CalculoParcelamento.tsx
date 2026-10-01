// Seção "Parcelamento" da lista do passo Cálculo (protótipo V12 · calcLista):
// linhas "À vista" / "N parcelas", `cl-sj` nas sem juros e nota "(*) sem juros".
// Com mais de uma faixa (opcao.tipo) vira um bloco por faixa.
import { Fragment, useMemo } from "react";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import {
  agruparParcelamento,
  gruposOpcoesResultado,
  parcelaSemJuros,
} from "@/components/venda/cotacoes/quiver-resultado";
import type { EscolhaCard } from "./types";

type ColunaParc =
  | { tipo: "oferta"; resultado: ResultadoCalculo }
  | { tipo: "sem-retorno"; chave: string };

type Props = {
  colunas: ColunaParc[];
  escolhaDoCard: (r: ResultadoCalculo) => EscolhaCard;
  setEscolha: (cardId: string, escolha: EscolhaCard) => void;
  onContratarParcela: (r: ResultadoCalculo, grupoId: string, opcaoId: string) => void;
};

const chaveColuna = (c: ColunaParc) => (c.tipo === "oferta" ? c.resultado.cardId : c.chave);

export function CalculoParcelamento({
  colunas,
  escolhaDoCard,
  setEscolha,
  onContratarParcela,
}: Props) {
  const itens = useMemo(
    () =>
      colunas.map((coluna) => {
        if (coluna.tipo !== "oferta") return null;
        const escolha = escolhaDoCard(coluna.resultado);
        const grupo = gruposOpcoesResultado(coluna.resultado).find((g) => g.id === escolha.grupoId);
        return { resultado: coluna.resultado, escolha, grupo };
      }),
    [colunas, escolhaDoCard],
  );
  const blocos = useMemo(
    () => agruparParcelamento(itens.map((item) => item?.grupo?.opcoes ?? [])),
    [itens],
  );
  if (blocos.length === 0) return null;

  const varias = blocos.length > 1;
  const temSemJuros = blocos.some((b) =>
    b.linhas.some((l) => l.opcoes.some((o) => o && parcelaSemJuros(o))),
  );

  return (
    <>
      <tr className="cl-sec">
        <td className="cl-lbl">Parcelamento</td>
        {colunas.map((coluna) => (
          <td key={chaveColuna(coluna)}>
            {coluna.tipo === "oferta" && (
              <small className="muted">passe o mouse e contrate direto</small>
            )}
          </td>
        ))}
      </tr>
      {blocos.map((bloco, b) => (
        <Fragment key={`bloco-${bloco.faixa}`}>
          {varias && (
            <tr className="cl-sec" data-testid="cl-faixa-bloco">
              <td className="cl-lbl">{bloco.faixa || "Demais opções"}</td>
              {colunas.map((coluna) => (
                <td key={chaveColuna(coluna)} />
              ))}
            </tr>
          )}
          {bloco.linhas.map((linha, idx) => (
            <tr
              className={`cl-parc${b === 0 && idx === 0 ? " cl-preco" : ""}`}
              key={`${linha.rotulo}-${idx}`}
            >
              <td className="cl-lbl">{linha.rotulo}</td>
              {colunas.map((coluna, col) => {
                const item = itens[col];
                const opcao = linha.opcoes[col];
                const primeira = b === 0 && idx === 0;
                if (coluna.tipo === "sem-retorno")
                  return (
                    <td key={chaveColuna(coluna)}>
                      <span className="nc">{primeira ? "Sem retorno" : "—"}</span>
                    </td>
                  );
                if (!item || !opcao)
                  return (
                    <td key={chaveColuna(coluna)}>
                      <span className="nc">—</span>
                    </td>
                  );
                const { resultado } = item;
                const selecionada = item.escolha.opcaoId === opcao.id;
                const texto = opcao.parcelas || opcao.avista || "—";
                return (
                  <td
                    key={resultado.cardId}
                    className={`cl-cell${selecionada ? " on" : ""}`}
                    onClick={() =>
                      setEscolha(resultado.cardId, {
                        grupoId: item.grupo?.id ?? "",
                        opcaoId: opcao.id,
                      })
                    }
                    title={`Escolher ${texto.toLowerCase()}`}
                  >
                    <span className="cl-v">
                      {primeira ? <strong>{texto}</strong> : texto}
                      {!primeira && parcelaSemJuros(opcao) && (
                        <>
                          {" "}
                          <span className="cl-sj">*</span>
                        </>
                      )}
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
                        onContratarParcela(resultado, item.grupo?.id ?? "", opcao.id);
                      }}
                    >
                      <span className="buy-v">{texto}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </Fragment>
      ))}
      {temSemJuros && (
        <tr>
          <td className="cl-lbl">
            <small className="muted">(*) sem juros</small>
          </td>
          {colunas.map((coluna) => (
            <td key={chaveColuna(coluna)} />
          ))}
        </tr>
      )}
    </>
  );
}
