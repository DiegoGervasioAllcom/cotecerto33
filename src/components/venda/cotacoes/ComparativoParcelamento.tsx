// Grade de parcelamento do comparativo (visualização "Colunado" da Quiver): uma coluna por oferta,
// dividida em subcolunas por faixa de franquia (normal 100% | reduzida 50%) lado a lado, e uma
// linha por quantidade de parcelas. Reaproveita o agrupamento da lista de cálculo
// (`agruparParcelamento`); o clique numa célula escolhe a opção (a mesma do select "Parcelas").
import { Fragment, useMemo, type CSSProperties } from "react";
import {
  agruparParcelamento,
  gruposOpcoesResultado,
  parcelaSemJuros,
  type GrupoOpcoesPremio,
  formasPagamentoResultado,
  type ResultadoCalculo,
} from "./quiver-resultado";

type OpcaoComId = GrupoOpcoesPremio["opcoes"][number];

export type EscolhaParcelamento = { grupoId: string; opcaoId: string };

export type GradeParcelamento = {
  /** Rótulos das faixas (subcolunas), na ordem em que apareceram. */
  faixas: string[];
  /** Forma de pagamento escolhida por oferta (null = sem opções). */
  formas: Array<{ grupoId: string; opcaoIdEscolhida: string; formaPagamento: string } | null>;
  /** Franquia por oferta e faixa. */
  franquias: string[][];
  /** Valor à vista e desconto informados pela seguradora, por oferta e faixa (informativo). */
  avistas: Array<Array<{ avista: string; desconto: string }>>;
  linhas: Array<{ chave: string; rotulo: string; celulas: Array<Array<OpcaoComId | undefined>> }>;
};

const textoFranquia = (t?: string) => (t ? t.replace(/^franquia:\s*/i, "") : "");

const ordemRotulo = (rotulo: string) => {
  if (/vista/i.test(rotulo)) return 1;
  const n = /(\d+)/.exec(rotulo)?.[1];
  return n ? Number(n) : 0;
};

/** Monta a grade [linha][oferta][faixa] a partir da forma de pagamento escolhida em cada oferta. */
export function montarGradeParcelamento(
  ofertas: readonly ResultadoCalculo[],
  escolhaDoCard: (r: ResultadoCalculo) => EscolhaParcelamento,
): GradeParcelamento {
  const grupos = ofertas.map((resultado) => {
    const escolha = escolhaDoCard(resultado);
    const grupo = gruposOpcoesResultado(resultado).find((g) => g.id === escolha.grupoId);
    return { escolha, grupo };
  });
  const blocos = agruparParcelamento(grupos.map((g) => g.grupo?.opcoes ?? []));
  const faixas = blocos.map((b) => b.faixa || "Demais opções");
  const nOfertas = ofertas.length;

  const franquias = ofertas.map((_, col) =>
    blocos.map((bloco) => {
      for (const linha of bloco.linhas) {
        const f = textoFranquia(linha.opcoes[col]?.franquia);
        if (f) return f;
      }
      return "";
    }),
  );

  const avistas = ofertas.map((_, col) =>
    blocos.map((bloco) => {
      const opcoes = grupos[col].grupo?.opcoes ?? [];
      const daFaixa = opcoes.filter(
        (o) => (o.tipo ?? "").trim() === bloco.faixa || (!bloco.faixa && !o.tipo),
      );
      return {
        avista: daFaixa.find((o) => o.avista)?.avista ?? "",
        desconto: daFaixa.find((o) => o.desconto)?.desconto ?? "",
      };
    }),
  );

  const linhasMap = new Map<
    string,
    { rotulo: string; celulas: Array<Array<OpcaoComId | undefined>> }
  >();
  blocos.forEach((bloco, f) => {
    const vistos = new Map<string, number>();
    for (const linha of bloco.linhas) {
      if (linha.rotulo === "—") continue;
      const seq = vistos.get(linha.rotulo) ?? 0;
      vistos.set(linha.rotulo, seq + 1);
      const chave = `${linha.rotulo}#${seq}`;
      const alvo = linhasMap.get(chave) ?? {
        rotulo: linha.rotulo,
        celulas: Array.from({ length: nOfertas }, () =>
          Array.from({ length: blocos.length }, () => undefined as OpcaoComId | undefined),
        ),
      };
      linhasMap.set(chave, alvo);
      for (let col = 0; col < nOfertas; col++) alvo.celulas[col][f] = linha.opcoes[col];
    }
  });
  const linhas = [...linhasMap.entries()]
    .map(([chave, v]) => ({ chave, ...v }))
    .sort((a, b) => ordemRotulo(a.rotulo) - ordemRotulo(b.rotulo));

  return {
    faixas,
    formas: grupos.map((g) =>
      g.grupo
        ? {
            grupoId: g.grupo.id,
            opcaoIdEscolhida: g.escolha.opcaoId,
            formaPagamento: g.grupo.formaPagamento,
          }
        : null,
    ),
    franquias,
    avistas,
    linhas,
  };
}

/** Máximo de faixas lado a lado; acima disso a grade empilha em blocos (a tabela não estoura). */
export const MAX_FAIXAS_LADO_A_LADO = 2;

/** Quantas subcolunas cada oferta ocupa na tabela. */
export const colunasPorOferta = (grade: GradeParcelamento) =>
  grade.faixas.length > 1 && grade.faixas.length <= MAX_FAIXAS_LADO_A_LADO
    ? grade.faixas.length
    : 1;

/** Valor à vista informativo da célula; vazio quando a grade já tem a linha "À vista" real nela. */
function textoAvista(grade: GradeParcelamento, col: number, f: number): string {
  const real = grade.linhas.find((l) => l.rotulo === "À vista")?.celulas[col][f];
  return real ? "" : (grade.avistas[col][f]?.avista ?? "");
}

type Props = {
  ofertas: ResultadoCalculo[];
  grade: GradeParcelamento;
  setEscolha: (cardId: string, escolha: EscolhaParcelamento) => void;
};

const rotuloFixo: CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "var(--white)",
};

export function ComparativoParcelamento({ ofertas, grade, setEscolha }: Props) {
  const nFaixas = colunasPorOferta(grade);
  const empilhado = grade.faixas.length > MAX_FAIXAS_LADO_A_LADO;
  const temSemJuros = useMemo(
    () => grade.linhas.some((l) => l.celulas.some((cs) => cs.some((o) => o && parcelaSemJuros(o)))),
    [grade],
  );
  const subBorda = (pos: number): CSSProperties =>
    pos > 0 ? { borderLeft: "1px dashed var(--border)" } : {};
  // Lado a lado: um único grupo com todas as faixas em subcolunas. Empilhado: um grupo por faixa.
  const grupos: number[][] = empilhado
    ? grade.faixas.map((_, f) => [f])
    : [grade.faixas.map((_, f) => f)];

  return (
    <>
      <tr>
        <td className="cov-name" style={rotuloFixo}>
          OPÇÕES DE PARCELAMENTO
          <small>Forma de pagamento escolhida</small>
        </td>
        {ofertas.map((resultado, col) => (
          <td key={resultado.cardId} className="cell" colSpan={nFaixas}>
            {grade.formas[col] ? (
              <strong>{grade.formas[col]?.formaPagamento}</strong>
            ) : (
              <span className="muted">Não informado</span>
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
              <tr>
                <td className="cov-name" style={{ ...rotuloFixo, background: "var(--cream-soft)" }}>
                  {grade.faixas[grupo[0]]}
                </td>
                {ofertas.map((resultado) => (
                  <td
                    key={resultado.cardId}
                    className="cell"
                    style={{ background: "var(--cream-soft)" }}
                  />
                ))}
              </tr>
            )}
            <tr>
              <td className="cov-name" style={{ ...rotuloFixo, background: "var(--cream-soft)" }}>
                Franquia
              </td>
              {ofertas.map((resultado, col) =>
                grupo.map((f, pos) => (
                  <td
                    key={`${resultado.cardId}-${f}`}
                    className="cell"
                    style={{ background: "var(--cream-soft)", ...subBorda(pos) }}
                  >
                    {!empilhado && (
                      <div className="small muted" style={{ textTransform: "capitalize" }}>
                        {grade.faixas[f]}
                      </div>
                    )}
                    <strong>{grade.franquias[col][f] || "—"}</strong>
                  </td>
                )),
              )}
            </tr>
            {grupo.some((f) => ofertas.some((_, col) => textoAvista(grade, col, f))) && (
              <tr>
                <td className="cov-name" style={rotuloFixo}>
                  À vista
                </td>
                {ofertas.map((resultado, col) =>
                  grupo.map((f, pos) => (
                    <td key={`${resultado.cardId}-${f}`} className="cell" style={subBorda(pos)}>
                      {textoAvista(grade, col, f) || <span className="muted">—</span>}
                    </td>
                  )),
                )}
              </tr>
            )}
            {grupo.some((f) => grade.avistas.some((o) => o[f]?.desconto)) && (
              <tr>
                <td className="cov-name" style={rotuloFixo}>
                  Desconto
                </td>
                {ofertas.map((resultado, col) =>
                  grupo.map((f, pos) => (
                    <td key={`${resultado.cardId}-${f}`} className="cell" style={subBorda(pos)}>
                      {grade.avistas[col][f]?.desconto ? (
                        <span className="chip chip-ok">{grade.avistas[col][f].desconto}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  )),
                )}
              </tr>
            )}
            {linhas.map((linha) => (
              <tr key={`${linha.chave}-${g}`}>
                <td className="cov-name" style={rotuloFixo}>
                  {linha.rotulo}
                </td>
                {ofertas.map((resultado, col) =>
                  grupo.map((f, pos) => {
                    const opcao = linha.celulas[col][f];
                    const forma = grade.formas[col];
                    if (!opcao || !forma)
                      return (
                        <td key={`${resultado.cardId}-${f}`} className="cell" style={subBorda(pos)}>
                          <span className="muted">—</span>
                        </td>
                      );
                    const selecionada = forma.opcaoIdEscolhida === opcao.id;
                    const texto = opcao.parcelas || opcao.avista || "—";
                    return (
                      <td
                        key={`${resultado.cardId}-${f}`}
                        className="cell"
                        style={{
                          cursor: "pointer",
                          background: selecionada ? "var(--cream)" : undefined,
                          fontWeight: selecionada ? 700 : undefined,
                          ...subBorda(pos),
                        }}
                        title={`Escolher ${texto.toLowerCase()}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selecionada}
                        onClick={() =>
                          setEscolha(resultado.cardId, {
                            grupoId: forma.grupoId,
                            opcaoId: opcao.id,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          setEscolha(resultado.cardId, {
                            grupoId: forma.grupoId,
                            opcaoId: opcao.id,
                          });
                        }}
                      >
                        {texto}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </Fragment>
        );
      })}
      <tr>
        <td className="cov-name" style={rotuloFixo}>
          FORMAS DE PAGAMENTO
          <small>Condições retornadas pela seguradora</small>
        </td>
        {ofertas.map((resultado) => (
          <td key={resultado.cardId} className="cell" colSpan={nFaixas}>
            {formasPagamentoResultado(resultado).join(" · ") || "—"}
          </td>
        ))}
      </tr>
      {temSemJuros && (
        <tr>
          <td className="cov-name" style={rotuloFixo}>
            <small className="muted">(*) sem juros</small>
          </td>
          {ofertas.map((resultado) => (
            <td key={resultado.cardId} className="cell" colSpan={nFaixas} />
          ))}
        </tr>
      )}
    </>
  );
}
