// Coluna do Kanban do Pipeline — Pipeline V12, T14 (rolagem interna por
// coluna). Extraída de `pipeline.tsx` (regra 9 do AGENTS.md): cada `.kcol`
// agora tem cabeçalho fixo (`.kcol-fixo`) + fila que rola por dentro
// (`.kcol-fila`, via `useKcolFilaScroll`) + rodapé "mais N" (`.kcol-restam`).
//
// Generalizada (revisão pós-aprovação): `.kanban`/`.kcol` são compartilhados
// por DUAS telas — o Pipeline do vendedor (`venda/pipeline.tsx`, paginado
// server-side) e o Pipeline geral da gestão (`operacao/pipeline-geral.tsx`,
// sem paginação, até 1000 leads carregados de uma vez). A altura fixa nova
// do `.kanban`/`overflow:hidden` do `.kcol` (indispensável pra rolagem
// interna) quebraria o Pipeline geral se ele continuasse jogando os cards
// soltos dentro de `.kcol` sem `.kcol-fixo`/`.kcol-fila` — colunas cheias
// ficariam cortadas, sem scroll nenhum. Por isso este componente virou um
// "casco" agnóstico de tipo de lead: cabeçalho (`header`) e cards
// (`children`) são inteiramente resolvidos por quem chama; só a mecânica de
// rolagem/rodapé mora aqui.
//
// O rodapé tem duas fontes de N:
// - `hasMore` (servidor ainda tem mais desta etapa — só o Pipeline do
//   vendedor usa isso): N = `total` (agregado) menos `itemCount` (já
//   carregado); clicar chama `onCarregarMais`.
// - sem `hasMore` (default — inclusive todo o Pipeline geral, que não
//   pagina) mas ainda sobra card abaixo da dobra (só rolagem, não carga):
//   N = cards fora da vista (mesmo cálculo do protótipo, via
//   `useKcolFilaScroll`); clicar só rola a fila, não bate no servidor.
// Não há sentinela de scroll infinito nem botão "Mostrar mais" antigo — o
// rodapé é o único gatilho de "carregar mais", pra não disparar duas
// requisições concorrentes pra mesma página.
import type { ReactNode } from "react";
import { useKcolFilaScroll } from "@/lib/use-kcol-fila-scroll";

export function PipelineColuna({
  stageKey,
  header,
  itemCount,
  total,
  hasMore = false,
  loading = false,
  onCarregarMais,
  primeira = false,
  children,
}: {
  /** Valor de `data-stage` na `.kcol` (chave da etapa: `LeadEtapaBucket` no Pipeline do vendedor, chave de `pipeline_stages` no Pipeline geral). */
  stageKey: string;
  /** Conteúdo de `.kcol-fixo` — cada tela desenha o próprio título/contador/valor/descrição. */
  header: ReactNode;
  /** Quantos cards estão em `children` agora — dispara o recálculo de tem-acima/tem-abaixo/rodapé (`useKcolFilaScroll`) sempre que a lista mudar (paginação, filtro). */
  itemCount: number;
  /** Total agregado (servidor, no Pipeline do vendedor; ou só `itemCount` mesmo, no Pipeline geral) — só importa quando `hasMore`. */
  total: number;
  /** `true` quando há mais uma página no servidor pra esta coluna. `false` (default) quando a tela não pagina — o rodapé aí só reflete cards já carregados fora da vista. */
  hasMore?: boolean;
  loading?: boolean;
  onCarregarMais?: () => void;
  /** Primeira coluna renderizada — ganha `data-tour="pipeline-coluna"` pro tutorial do vendedor. */
  primeira?: boolean;
  /** Cards já resolvidos por quem chama (cada um `.kcard`), incluindo o estado vazio quando não há nenhum. */
  children: ReactNode;
}) {
  const { filaRef, onScroll, estado, rolarUmaTela } = useKcolFilaScroll(itemCount);

  const restam = hasMore ? Math.max(0, total - itemCount) : estado.foraDaVista;
  const mostrarRodape = hasMore ? restam > 0 : estado.temAbaixo && restam > 0;

  const filaClasse = ["kcol-fila", estado.temAcima && "tem-acima", estado.temAbaixo && "tem-abaixo"]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="kcol"
      data-stage={stageKey}
      data-tour={primeira ? "pipeline-coluna" : undefined}
    >
      <div className="kcol-fixo">{header}</div>
      <div ref={filaRef} className={filaClasse} onScroll={onScroll}>
        {children}
      </div>
      <div className="kcol-restam">
        {mostrarRodape && (
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              width: "100%",
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              font: "inherit",
              color: "inherit",
              letterSpacing: "inherit",
            }}
            disabled={loading}
            onClick={() => (hasMore ? onCarregarMais?.() : rolarUmaTela())}
          >
            <span>{loading ? "Carregando…" : `mais ${restam}`}</span>
            <span className="kr-seta">
              <svg width={13} height={13}>
                <use href="#i-chevron-down" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
