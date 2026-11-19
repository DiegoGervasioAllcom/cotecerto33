// Grade de parcelamento do comparativo (visualização "Colunado" da Quiver): uma coluna por oferta,
// dividida em subcolunas por faixa de franquia (normal 100% | reduzida 50%) lado a lado, e uma
// linha por quantidade de parcelas. Reaproveita o agrupamento da lista de cálculo
// (`agruparParcelamento`); o clique numa célula escolhe a opção (a mesma do select "Parcelas").
import { useMemo, type CSSProperties } from "react";
import {
  agruparParcelamento,
  gruposOpcoesResultado,
  parcelaSemJuros,
  type GrupoOpcoesPremio,
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
    linhas,
  };
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
  const nFaixas = Math.max(grade.faixas.length, 1);
  const temSemJuros = useMemo(
    () => grade.linhas.some((l) => l.celulas.some((cs) => cs.some((o) => o && parcelaSemJuros(o)))),
    [grade],
  );
  const subBorda = (f: number): CSSProperties =>
    f > 0 ? { borderLeft: "1px dashed var(--border)" } : {};

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
      <tr>
        <td className="cov-name" style={{ ...rotuloFixo, background: "var(--cream-soft)" }}>
          Franquia
        </td>
        {ofertas.map((resultado, col) =>
          grade.faixas.map((faixa, f) => (
            <td
              key={`${resultado.cardId}-${f}`}
              className="cell"
              style={{ background: "var(--cream-soft)", ...subBorda(f) }}
            >
              <div className="small muted" style={{ textTransform: "capitalize" }}>
                {faixa}
              </div>
              <strong>{grade.franquias[col][f] || "—"}</strong>
            </td>
          )),
        )}
      </tr>
      {grade.linhas.map((linha) => (
        <tr key={linha.chave}>
          <td className="cov-name" style={rotuloFixo}>
            {linha.rotulo}
          </td>
          {ofertas.map((resultado, col) =>
            grade.faixas.map((_, f) => {
              const opcao = linha.celulas[col][f];
              const forma = grade.formas[col];
              if (!opcao || !forma)
                return (
                  <td key={`${resultado.cardId}-${f}`} className="cell" style={subBorda(f)}>
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
                    ...subBorda(f),
                  }}
                  title={`Escolher ${texto.toLowerCase()}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selecionada}
                  onClick={() =>
                    setEscolha(resultado.cardId, { grupoId: forma.grupoId, opcaoId: opcao.id })
                  }
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    setEscolha(resultado.cardId, { grupoId: forma.grupoId, opcaoId: opcao.id });
                  }}
                >
                  {texto}
                </td>
              );
            }),
          )}
        </tr>
      ))}
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
