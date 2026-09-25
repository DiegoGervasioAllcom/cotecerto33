/**
 * Rolagem interna por coluna do Kanban do Pipeline — Pipeline V12, T14
 * (`.kcol-fixo`/`.kcol-fila`/`.kcol-restam`, `src/styles/proto.css`).
 *
 * Equivalente React de `kFilaScroll`/`kFilasSync` do protótipo V12
 * (`cotecerto_prototipo_v12.html`): lá a coluna inteira é HTML estático e a
 * função mexe direto em `classList`/`innerHTML` a cada evento de scroll. Aqui
 * a `.kcol-fila` é controlada por um ref e o estado (`tem-acima`/`tem-abaixo`/
 * quantos cards estão fora da vista) vira `useState`, recalculado em scroll,
 * resize e sempre que a lista de leads mudar (entrar/sair card muda
 * `scrollHeight` sem disparar evento de scroll nenhum).
 *
 * `calcularTemAcimaAbaixo`/`contarForaDaVista` são funções puras (só recebem
 * números/objetos simples) — testáveis em `tests/unit` sem DOM, mesmo padrão
 * de `criarMotorPaginacao` em `use-pipeline-pagination.ts`.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type KcolFilaEstado = {
  temAcima: boolean;
  temAbaixo: boolean;
  /** Quantos cards já carregados estão fora da vista, abaixo da dobra — 0 quando não há `temAbaixo`. */
  foraDaVista: number;
};

const ESTADO_INICIAL: KcolFilaEstado = { temAcima: false, temAbaixo: false, foraDaVista: 0 };

/** Métricas de scroll → tem-acima/tem-abaixo. Mesmo critério do protótipo (`kFilaScroll`): margem de 4px pra não piscar no repouso. */
export function calcularTemAcimaAbaixo(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): { temAcima: boolean; temAbaixo: boolean } {
  const sobra = scrollHeight - clientHeight;
  return { temAcima: scrollTop > 4, temAbaixo: sobra - scrollTop > 4 };
}

/** Conta quantos itens (por `offsetTop`/`offsetHeight`) começam abaixo da dobra visível — mesmo critério do protótipo (offsetTop+offsetHeight > limite+8). */
export function contarForaDaVista(
  itens: readonly { offsetTop: number; offsetHeight: number }[],
  scrollTop: number,
  clientHeight: number,
): number {
  const limite = scrollTop + clientHeight;
  return itens.filter((item) => item.offsetTop + item.offsetHeight > limite + 8).length;
}

export function useKcolFilaScroll(leadsLength: number): {
  /** Ref-callback pra passar em `<div ref={filaRef} className="kcol-fila">`. */
  filaRef: (node: HTMLDivElement | null) => void;
  /** Handler pra `onScroll` da mesma div. */
  onScroll: () => void;
  estado: KcolFilaEstado;
  /** Rola a fila cerca de uma tela pra baixo — usado pelo rodapé "mais N" quando não há mais página no servidor (`hasMore` falso), só cards já carregados fora da vista. */
  rolarUmaTela: () => void;
} {
  const [estado, setEstado] = useState<KcolFilaEstado>(ESTADO_INICIAL);
  const elRef = useRef<HTMLDivElement | null>(null);

  const recalcular = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { temAcima, temAbaixo } = calcularTemAcimaAbaixo(
      el.scrollTop,
      el.scrollHeight,
      el.clientHeight,
    );
    if (!temAbaixo) {
      setEstado({ temAcima, temAbaixo, foraDaVista: 0 });
      return;
    }
    const itens = Array.from(el.querySelectorAll<HTMLElement>(".kcard")).map((card) => ({
      offsetTop: card.offsetTop,
      offsetHeight: card.offsetHeight,
    }));
    setEstado({
      temAcima,
      temAbaixo,
      foraDaVista: contarForaDaVista(itens, el.scrollTop, el.clientHeight),
    });
  }, []);

  // `elRef.current = node` só; NÃO chama `recalcular()` aqui. Chamar
  // `setState` de dentro do próprio ref-callback (fase de commit) faz o
  // `StrictMode` do React 19 (attach → detach → attach de novo, só em DEV)
  // reentrar em loop e estourar "Maximum update depth exceeded" — bug real
  // reproduzido manualmente (nenhum teste automatizado pega isso: sem
  // `@testing-library/react`/jsdom no Vitest, e o Playwright roda contra
  // `vite dev`, não produção, mas o bug também acontece fora do StrictMode,
  // só que exige refs remontando). O `useLayoutEffect` abaixo já cobre o
  // cálculo inicial: ele roda depois que o ref do host component (`<div>`,
  // fibra-filha) já commitou nesta mesma passada de layout, então
  // `elRef.current` já está setado quando ele dispara.
  const filaRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
  }, []);

  // Cards entrando/saindo (paginação, filtro) mudam `scrollHeight` sem
  // disparar `onScroll` nenhum — recalcula sempre que a contagem mudar (e
  // já cobre o cálculo inicial do mount, já que `leadsLength` "muda" de
  // indefinido pro valor inicial na primeira execução do efeito).
  useLayoutEffect(() => {
    recalcular();
  }, [recalcular, leadsLength]);

  useEffect(() => {
    window.addEventListener("resize", recalcular);
    return () => window.removeEventListener("resize", recalcular);
  }, [recalcular]);

  const rolarUmaTela = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    el.scrollBy({ top: el.clientHeight * 0.85, behavior: "smooth" });
  }, []);

  return { filaRef, onScroll: recalcular, estado, rolarUmaTela };
}
