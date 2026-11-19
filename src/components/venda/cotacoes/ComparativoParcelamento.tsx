// Grade de parcelamento (visualização "Colunado" da Quiver): uma coluna por oferta, dividida em
// subcolunas pelas faixas de franquia da PRÓPRIA oferta (1ª e 2ª opção: normal 100% | reduzida 50%)
// lado a lado, e uma linha por quantidade de parcelas. Vale em qualquer aba/filtro. Reaproveita o
// agrupamento da lista de cálculo (`agruparParcelamento`); o clique numa célula escolhe a opção (a
// mesma do select "Parcelas"). Usada pelo comparativo e pela lista do passo Cálculo.
import { useMemo, type CSSProperties } from "react";
import {
  agruparParcelamento,
  formasPagamentoResultado,
  gruposOpcoesResultado,
  parcelaSemJuros,
  type GrupoOpcoesPremio,
  type ResultadoCalculo,
} from "./quiver-resultado";

export type OpcaoComId = GrupoOpcoesPremio["opcoes"][number];

export type EscolhaParcelamento = { grupoId: string; opcaoId: string };

export type GradeParcelamento = {
  /** Subcolunas por oferta = maior número de faixas de franquia de uma oferta (1ª, 2ª opção…). */
  nSlots: number;
  /** Rótulo da faixa por oferta e subcoluna ("" quando a oferta não tem essa subcoluna). */
  faixas: string[][];
  /** Forma de pagamento escolhida por oferta (null = sem opções). */
  formas: Array<{ grupoId: string; opcaoIdEscolhida: string; formaPagamento: string } | null>;
  /** Franquia por oferta e subcoluna. */
  franquias: string[][];
  /** Valor à vista e desconto informados pela seguradora, por oferta e subcoluna (informativo). */
  avistas: Array<Array<{ avista: string; desconto: string }>>;
  linhas: Array<{ chave: string; rotulo: string; celulas: Array<Array<OpcaoComId | undefined>> }>;
};

const textoFranquia = (t?: string) => (t ? t.replace(/^franquia:\s*/i, "") : "");

const ordemRotulo = (rotulo: string) => {
  if (/vista/i.test(rotulo)) return 1;
  const n = /(\d+)/.exec(rotulo)?.[1];
  return n ? Number(n) : 0;
};

/**
 * Monta a grade [linha][oferta][subcoluna] a partir da forma de pagamento escolhida em cada
 * oferta. Cada oferta usa as próprias faixas de franquia como subcolunas (como a Quiver:
 * 1ª e 2ª opção de franquia), em qualquer aba — não depende das faixas das outras ofertas.
 */
export function montarGradeParcelamento(
  ofertas: readonly ResultadoCalculo[],
  escolhaDoCard: (r: ResultadoCalculo) => EscolhaParcelamento,
): GradeParcelamento {
  const grupos = ofertas.map((resultado) => {
    const escolha = escolhaDoCard(resultado);
    const grupo = gruposOpcoesResultado(resultado).find((g) => g.id === escolha.grupoId);
    return { escolha, grupo };
  });
  // Uma lista por oferta: os blocos de cada uma são as suas faixas (subcolunas).
  const blocosPorOferta = grupos.map((g) => agruparParcelamento([g.grupo?.opcoes ?? []]));
  const nSlots = Math.max(1, ...blocosPorOferta.map((b) => b.length));
  const nOfertas = ofertas.length;

  const faixas = blocosPorOferta.map((blocos) =>
    Array.from({ length: nSlots }, (_, s) => (blocos[s] ? blocos[s].faixa || "Demais opções" : "")),
  );
  const franquias = blocosPorOferta.map((blocos) =>
    Array.from({ length: nSlots }, (_, s) => {
      for (const linha of blocos[s]?.linhas ?? []) {
        const f = textoFranquia(linha.opcoes[0]?.franquia);
        if (f) return f;
      }
      return "";
    }),
  );
  const avistas = blocosPorOferta.map((blocos, col) =>
    Array.from({ length: nSlots }, (_, s) => {
      const bloco = blocos[s];
      if (!bloco) return { avista: "", desconto: "" };
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
  blocosPorOferta.forEach((blocos, col) => {
    blocos.forEach((bloco, s) => {
      const vistos = new Map<string, number>();
      for (const linha of bloco.linhas) {
        if (linha.rotulo === "—") continue;
        const seq = vistos.get(linha.rotulo) ?? 0;
        vistos.set(linha.rotulo, seq + 1);
        const chave = `${linha.rotulo}#${seq}`;
        const alvo = linhasMap.get(chave) ?? {
          rotulo: linha.rotulo,
          celulas: Array.from({ length: nOfertas }, () =>
            Array.from({ length: nSlots }, () => undefined as OpcaoComId | undefined),
          ),
        };
        linhasMap.set(chave, alvo);
        alvo.celulas[col][s] = linha.opcoes[0];
      }
    });
  });
  const linhas = [...linhasMap.entries()]
    .map(([chave, v]) => ({ chave, ...v }))
    .sort((a, b) => ordemRotulo(a.rotulo) - ordemRotulo(b.rotulo));

  return {
    nSlots,
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

/** Quantas subcolunas cada oferta ocupa na tabela. */
export const colunasPorOferta = (grade: GradeParcelamento) => Math.max(1, grade.nSlots);

/** Valor à vista informativo da célula; vazio quando a grade já tem a linha "À vista" real nela. */
function textoAvista(grade: GradeParcelamento, col: number, s: number): string {
  const real = grade.linhas.find((l) => l.rotulo === "À vista")?.celulas[col][s];
  return real ? "" : (grade.avistas[col][s]?.avista ?? "");
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

const subBorda = (pos: number): CSSProperties =>
  pos > 0 ? { borderLeft: "1px dashed var(--border)" } : {};

export function ComparativoParcelamento({ ofertas, grade, setEscolha }: Props) {
  const nFaixas = colunasPorOferta(grade);
  const slots = Array.from({ length: nFaixas }, (_, s) => s);
  const temSemJuros = useMemo(
    () => grade.linhas.some((l) => l.celulas.some((cs) => cs.some((o) => o && parcelaSemJuros(o)))),
    [grade],
  );
  const temAvista = slots.some((s) => ofertas.some((_, col) => textoAvista(grade, col, s)));
  const temDesconto = grade.avistas.some((o) => o.some((x) => x.desconto));

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
          slots.map((s) => (
            <td
              key={`${resultado.cardId}-${s}`}
              className="cell"
              style={{ background: "var(--cream-soft)", ...subBorda(s) }}
            >
              {grade.faixas[col][s] && (
                <>
                  <div className="small muted" style={{ textTransform: "capitalize" }}>
                    {grade.faixas[col][s]}
                  </div>
                  <strong>{grade.franquias[col][s] || "—"}</strong>
                </>
              )}
            </td>
          )),
        )}
      </tr>
      {temAvista && (
        <tr>
          <td className="cov-name" style={rotuloFixo}>
            À vista
          </td>
          {ofertas.map((resultado, col) =>
            slots.map((s) => (
              <td key={`${resultado.cardId}-${s}`} className="cell" style={subBorda(s)}>
                {textoAvista(grade, col, s) || <span className="muted">—</span>}
              </td>
            )),
          )}
        </tr>
      )}
      {temDesconto && (
        <tr>
          <td className="cov-name" style={rotuloFixo}>
            Desconto
          </td>
          {ofertas.map((resultado, col) =>
            slots.map((s) => (
              <td key={`${resultado.cardId}-${s}`} className="cell" style={subBorda(s)}>
                {grade.avistas[col][s]?.desconto ? (
                  <span className="chip chip-ok">{grade.avistas[col][s].desconto}</span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            )),
          )}
        </tr>
      )}
      {grade.linhas.map((linha) => (
        <tr key={linha.chave}>
          <td className="cov-name" style={rotuloFixo}>
            {linha.rotulo}
          </td>
          {ofertas.map((resultado, col) =>
            slots.map((s) => {
              const opcao = linha.celulas[col][s];
              const forma = grade.formas[col];
              if (!opcao || !forma)
                return (
                  <td key={`${resultado.cardId}-${s}`} className="cell" style={subBorda(s)}>
                    <span className="muted">—</span>
                  </td>
                );
              const selecionada = forma.opcaoIdEscolhida === opcao.id;
              const texto = opcao.parcelas || opcao.avista || "—";
              return (
                <td
                  key={`${resultado.cardId}-${s}`}
                  className="cell"
                  style={{
                    cursor: "pointer",
                    background: selecionada ? "var(--cream)" : undefined,
                    fontWeight: selecionada ? 700 : undefined,
                    ...subBorda(s),
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
