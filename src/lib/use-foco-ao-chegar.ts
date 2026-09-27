// "Foco ao chegar" (V12.3.11, Frente 3) — espelha focoIr()/focoBarra()/focoScroll()
// do protótipo V12 (cotecerto_prototipo_v12.html ~linhas 2360-2431): ao clicar
// num item da fila do dia/agenda, a tela de destino rola até o item, marca com
// contorno amarelo (`.em-foco`/`.foco-pisca`, ver proto.css) e mostra uma
// faixa "de onde você veio" (`<FocoBarra>`) com X para sair.
//
// A URL carrega só `foco=<fonte>:<id>` (nunca o nome do cliente — regra do
// usuário contra dado inventado/vazamento). O motivo real (título + texto do
// AgendaItem que originou o clique) viaja à parte, em sessionStorage, gravado
// por quem navega (`abrirItem` em use-agenda-itens.ts) e lido por <FocoBarra>.
// Sem motivo salvo (ex.: refresh da página), a faixa cai para o rótulo real da
// fonte (`FONTE_LABEL[fonte]`) — nunca um texto genérico inventado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTutorialController } from "@/components/tutorial/tutorial-controller-context";
import { FONTE_LABEL, type FonteAgenda } from "@/lib/agenda";

// "transmissao" não é uma fonte da agenda (agenda.ts/FonteAgenda/contarPorFonte
// nunca precisam saber dela) — é só mais uma origem de foco, usada pelos
// atalhos "Ir para Emissão"/"Ver proposta" logo após a Etapa 7 transmitir
// (ComparativoQuiver.tsx, TransmissaoTransmitidaCard.tsx). Union separada
// pra não contaminar o tipo que a agenda/seus contadores enxergam.
export type FonteFoco = FonteAgenda | "transmissao";

export type Foco = { fonte: FonteFoco; id: string };

export type FocoMotivo = { titulo: string; texto: string };

/** Rótulo real de fallback (faixa sem motivo salvo) por fonte — inclui as 5
 * da agenda (`FONTE_LABEL`) mais "transmissao". "Proposta transmitida" é o
 * texto que o próprio protótipo grava no histórico do lead ao transmitir
 * (cotecerto_prototipo_v12.html, nota do agendamento automático). */
export const FONTE_FOCO_LABEL: Record<FonteFoco, string> = {
  ...FONTE_LABEL,
  transmissao: "Proposta transmitida",
};

const FONTES_VALIDAS = new Set<string>(Object.keys(FONTE_FOCO_LABEL));

/** Parse puro de `foco=<fonte>:<id>` — sem router, sem DOM, testável isolado. */
export function parseFoco(raw: string | null | undefined): Foco | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i <= 0 || i === raw.length - 1) return null;
  const fonte = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if (!FONTES_VALIDAS.has(fonte)) return null;
  return { fonte: fonte as FonteFoco, id };
}

/** Serializa `{fonte, id}` de volta para o valor de busca `foco=` — usado por
 * quem navega (agenda) para montar o link e a chave do sessionStorage juntas. */
export function serializeFoco(foco: Foco): string {
  return `${foco.fonte}:${foco.id}`;
}

function focoStorageKey(foco: string): string {
  return `cotecerto:foco-motivo:${foco}`;
}

/** Grava o motivo real (título + texto do AgendaItem) para a faixa reconstituir
 * de onde o clique veio. Best-effort: sessionStorage indisponível (modo
 * privado, cota cheia) não pode quebrar a navegação — a faixa só cai para o
 * rótulo da fonte. */
export function salvarFocoMotivo(foco: string, motivo: FocoMotivo): void {
  try {
    sessionStorage.setItem(focoStorageKey(foco), JSON.stringify(motivo));
  } catch {
    /* ignorado — ver comentário acima */
  }
}

export function lerFocoMotivo(foco: string): FocoMotivo | null {
  try {
    const raw = sessionStorage.getItem(focoStorageKey(foco));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FocoMotivo>;
    if (typeof parsed.titulo === "string" && typeof parsed.texto === "string") {
      return { titulo: parsed.titulo, texto: parsed.texto };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove o motivo salvo — chamado ao sair do foco (X da faixa), pra não
 * deixar sessionStorage acumulando chaves de itens já vistos. Best-effort,
 * mesmo espírito de salvarFocoMotivo. */
export function removerFocoMotivo(foco: string): void {
  try {
    sessionStorage.removeItem(focoStorageKey(foco));
  } catch {
    /* ignorado — ver comentário de salvarFocoMotivo */
  }
}

/** Delay antes do scroll e duração do pulso — mesmos tempos de focoScroll()
 * no protótipo (setTimeout 140ms; classe .foco-pisca removida após 2400ms). */
export const FOCO_SCROLL_DELAY_MS = 140;
export const FOCO_PISCA_MS = 2400;

/**
 * Lê `foco=<fonte>:<id>` (já validado/tipado pelo `validateSearch` da rota
 * chamadora) e expõe o estado para destacar o item que motivou a chegada.
 * Nunca ativo durante o tutorial — ele tem seu próprio destaque (spot).
 *
 * `limpar` é fornecido por quem chama (cada rota já tem `Route.useSearch()` +
 * `useNavigate({ from: Route.fullPath })` prontos) — mantém o parse acima
 * puro e este hook fácil de testar sem montar o router inteiro.
 */
export function useFocoAoChegar(raw: string | undefined, limparBusca: () => void) {
  const { isOpen: tutorialOpen } = useTutorialController();
  const parsed = useMemo(() => parseFoco(raw), [raw]);
  const ativo = !tutorialOpen && parsed !== null;
  const [pulsando, setPulsando] = useState(false);

  useEffect(() => {
    if (!ativo) {
      setPulsando(false);
      return;
    }
    const t1 = window.setTimeout(() => setPulsando(true), FOCO_SCROLL_DELAY_MS);
    const t2 = window.setTimeout(() => setPulsando(false), FOCO_SCROLL_DELAY_MS + FOCO_PISCA_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [ativo, parsed?.fonte, parsed?.id]);

  const classe = useCallback(
    (id: string) => {
      if (!ativo || parsed?.id !== id) return "";
      return pulsando ? " em-foco foco-pisca" : " em-foco";
    },
    [ativo, parsed?.id, pulsando],
  );

  // Sai do foco: some com a faixa/destaque (busca) e limpa o motivo salvo —
  // não faz sentido guardar o motivo de um item que a pessoa já disse "não
  // quero mais ver" (item 2 da revisão da V12.3.11).
  const limpar = useCallback(() => {
    if (parsed) removerFocoMotivo(serializeFoco(parsed));
    limparBusca();
  }, [parsed, limparBusca]);

  return {
    id: ativo ? (parsed?.id ?? null) : null,
    fonte: ativo ? (parsed?.fonte ?? null) : null,
    ativo,
    classe,
    limpar,
  };
}
