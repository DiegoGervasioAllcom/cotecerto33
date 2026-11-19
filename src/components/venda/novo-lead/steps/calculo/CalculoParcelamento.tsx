// Seção "Parcelamento" da lista do passo Cálculo (protótipo V12 · calcLista + Colunado da Quiver):
// linhas "À vista" / "N parcelas", `cl-sj` nas sem juros e nota "(*) sem juros". Até 2 faixas de
// franquia (normal 100% | reduzida 50%) ficam lado a lado dentro da coluna da oferta, com a franquia
// de cada uma; com mais faixas vira um bloco empilhado por faixa. Mesma grade do comparativo.
import { Fragment, type CSSProperties } from "react";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { parcelaSemJuros } from "@/components/venda/cotacoes/quiver-resultado";
import {
  MAX_FAIXAS_LADO_A_LADO,
  type GradeParcelamento,
} from "@/components/venda/cotacoes/ComparativoParcelamento";
import type { EscolhaCard } from "./types";

type ColunaParc =
  | { tipo: "oferta"; resultado: ResultadoCalculo }
  | { tipo: "sem-retorno"; chave: string };

type Props = {
  colunas: ColunaParc[];
  /** Grade das ofertas (mesma ordem das colunas do tipo "oferta"). */
  grade: GradeParcelamento;
  /** Subcolunas por oferta (1 ou 2). */
  nFaixas: number;
  setEscolha: (cardId: string, escolha: EscolhaCard) => void;
  onContratarParcela: (r: ResultadoCalculo, grupoId: string, opcaoId: string) => void;
};

const chaveColuna = (c: ColunaParc) => (c.tipo === "oferta" ? c.resultado.cardId : c.chave);

const subBorda = (pos: number): CSSProperties =>
  pos > 0 ? { borderLeft: "1px dashed var(--border)" } : {};

export function CalculoParcelamento({
  colunas,
  grade,
  nFaixas,
  setEscolha,
  onContratarParcela,
}: Props) {
  // Posição de cada oferta dentro da grade (as colunas "sem retorno" não entram nela).
  const posicaoNaGrade = new Map<string, number>();
  colunas.forEach((c) => {
    if (c.tipo === "oferta") posicaoNaGrade.set(c.resultado.cardId, posicaoNaGrade.size);
  });

  if (grade.linhas.length === 0) return null;

  const empilhado = grade.faixas.length > MAX_FAIXAS_LADO_A_LADO;
  const grupos: number[][] = empilhado
    ? grade.faixas.map((_, f) => [f])
    : [grade.faixas.map((_, f) => f)];
  const temSemJuros = grade.linhas.some((l) =>
    l.celulas.some((cs) => cs.some((o) => o && parcelaSemJuros(o))),
  );

  return (
    <>
      <tr className="cl-sec">
        <td className="cl-lbl">Parcelamento</td>
        {colunas.map((coluna) => (
          <td key={chaveColuna(coluna)} colSpan={nFaixas}>
            {coluna.tipo === "oferta" && (
              <small className="muted">passe o mouse e contrate direto</small>
            )}
          </td>
        ))}
      </tr>
      {grupos.map((grupo, g) => {
        const linhas = grade.linhas.filter((linha) =>
          linha.celulas.some((cs) => grupo.some((f) => cs[f])),
        );
        return (
          <Fragment key={`grupo-${g}`}>
            {empilhado && (
              <tr className="cl-sec" data-testid="cl-faixa-bloco">
                <td className="cl-lbl">{grade.faixas[grupo[0]] || "Demais opções"}</td>
                {colunas.map((coluna) => (
                  <td key={chaveColuna(coluna)} colSpan={nFaixas} />
                ))}
              </tr>
            )}
            <tr className="cl-parc">
              <td className="cl-lbl">Franquia</td>
              {colunas.map((coluna) => {
                if (coluna.tipo === "sem-retorno")
                  return <td key={chaveColuna(coluna)} colSpan={nFaixas} />;
                const col = posicaoNaGrade.get(coluna.resultado.cardId) ?? 0;
                return grupo.map((f, pos) => (
                  <td key={`${coluna.resultado.cardId}-${f}`} style={subBorda(pos)}>
                    {!empilhado && (
                      <div className="small muted" style={{ textTransform: "capitalize" }}>
                        {grade.faixas[f]}
                      </div>
                    )}
                    <strong>{grade.franquias[col]?.[f] || "—"}</strong>
                  </td>
                ));
              })}
            </tr>
            {linhas.map((linha, idx) => (
              <tr
                className={`cl-parc${g === 0 && idx === 0 ? " cl-preco" : ""}`}
                key={`${linha.chave}-${g}`}
              >
                <td className="cl-lbl">{linha.rotulo}</td>
                {colunas.map((coluna) => {
                  if (coluna.tipo === "sem-retorno")
                    return (
                      <td key={chaveColuna(coluna)} colSpan={nFaixas}>
                        <span className="nc">{g === 0 && idx === 0 ? "Sem retorno" : "—"}</span>
                      </td>
                    );
                  const { resultado } = coluna;
                  const col = posicaoNaGrade.get(resultado.cardId) ?? 0;
                  const forma = grade.formas[col];
                  return grupo.map((f, pos) => {
                    const opcao = linha.celulas[col]?.[f];
                    if (!opcao || !forma)
                      return (
                        <td key={`${resultado.cardId}-${f}`} style={subBorda(pos)}>
                          <span className="nc">—</span>
                        </td>
                      );
                    const primeira = g === 0 && idx === 0;
                    const selecionada = forma.opcaoIdEscolhida === opcao.id;
                    const texto = opcao.parcelas || opcao.avista || "—";
                    return (
                      <td
                        key={`${resultado.cardId}-${f}`}
                        className={`cl-cell${selecionada ? " on" : ""}`}
                        style={subBorda(pos)}
                        onClick={() =>
                          setEscolha(resultado.cardId, {
                            grupoId: forma.grupoId,
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
                            onContratarParcela(resultado, forma.grupoId, opcao.id);
                          }}
                        >
                          <span className="buy-v">{texto}</span>
                        </button>
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </Fragment>
        );
      })}
      {temSemJuros && (
        <tr>
          <td className="cl-lbl">
            <small className="muted">(*) sem juros</small>
          </td>
          {colunas.map((coluna) => (
            <td key={chaveColuna(coluna)} colSpan={nFaixas} />
          ))}
        </tr>
      )}
    </>
  );
}
