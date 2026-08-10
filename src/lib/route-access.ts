import type { Perfil } from "@/integrations/supabase/client";
import type { AreaChave } from "@/lib/use-areas";

const PERFIS_INTERNOS = new Set<Perfil>(["matriz", "coordenador", "supervisor", "interno"]);

/**
 * Compatibilidade de cargo com a Central de Leads/Distribuicao.
 *
 * O cargo/override decide se o link aparece no menu. Este predicado resolve
 * apenas a familia de perfis que pode abrir a experiencia; a RLS continua
 * responsável pelo escopo dos dados e das mutacoes.
 */
export function podeAcessarCentral(role: Perfil | null | undefined, isFranqFull: boolean): boolean {
  if (!role) return false;
  if (PERFIS_INTERNOS.has(role)) return true;
  return role === "franqueado" && isFranqFull;
}

/** Família interna cuja entrada visual é decidida por AreaChave. */
export function podeAcessarAreaInterna(role: Perfil | null | undefined): boolean {
  return !!role && PERFIS_INTERNOS.has(role);
}

/**
 * Escrita na tela de Configuracoes permanece exclusiva da Matriz.
 * Coordenador compartilha a visualizacao, nunca a capacidade de alterar.
 */
export function podeEditarConfiguracoes(role: Perfil | null | undefined): boolean {
  return role === "matriz";
}

/**
 * Mantém as ações administrativas de Acessos nos perfis que já as possuíam.
 *
 * QA manual (10/08/2026): o Supervisor de Vendas NÃO administra — no
 * protótipo ele só acompanha ("você não cadastra nem desliga — acompanha o
 * desempenho e aciona a Matriz"). Ele tem a área `macessos` liberada (H7: é
 * time interno da Matriz), mas cai no ramo somente-leitura de
 * `/operacao/acessos`, não no admin completo.
 */
export function podeAdministrarAcessos(role: Perfil | null | undefined): boolean {
  return role === "matriz" || role === "coordenador";
}

/** Evita até a consulta administrativa quando a tela é negada ou read-only. */
export function deveCarregarDadosAcessos(
  role: Perfil | null | undefined,
  guardNegado: boolean,
): boolean {
  return !guardNegado && podeAdministrarAcessos(role);
}

export const ROTAS_AREAS_INTERNAS = [
  { area: "mdash", to: "/comando/visao-geral" },
  { area: "mleads", to: "/comando/leads" },
  { area: "mdist", to: "/comando/distribuicao" },
  { area: "maprov", to: "/operacao/aprovacoes" },
  { area: "mfranq", to: "/operacao/franquias" },
  { area: "mvend", to: "/operacao/vendedores" },
  { area: "msuperv", to: "/operacao/supervisao" },
  { area: "mpipe", to: "/operacao/pipeline-geral" },
  { area: "mvendas", to: "/operacao/vendas" },
  { area: "mcomm", to: "/operacao/comissoes" },
  { area: "mprem", to: "/operacao/premiacoes" },
  { area: "mestorno", to: "/operacao/estornos" },
  { area: "mren", to: "/operacao/renovacoes" },
  { area: "mrel", to: "/operacao/relatorios" },
  { area: "mmsgs", to: "/operacao/mensagens" },
  { area: "macessos", to: "/operacao/acessos" },
  { area: "mconf", to: "/operacao/configuracoes" },
] as const satisfies ReadonlyArray<{ area: AreaChave; to: string }>;

export type RotaAreaInterna = (typeof ROTAS_AREAS_INTERNAS)[number]["to"];

/**
 * Resolve a AreaChave da rota atual. O prefixo inclui detalhes, portanto
 * `/operacao/franquias/:id` e `/operacao/vendedores/:id` herdam a mesma area
 * das respectivas listas.
 */
export function areaDaRotaInterna(pathname: string): AreaChave | null {
  return (
    ROTAS_AREAS_INTERNAS.find(({ to }) => pathname === to || pathname.startsWith(`${to}/`))?.area ??
    null
  );
}

/** Primeira rota canônica disponível, na mesma ordem exibida no menu. */
export function primeiraRotaInternaPermitida(areas: ReadonlySet<string>): RotaAreaInterna | null {
  return ROTAS_AREAS_INTERNAS.find(({ area }) => areas.has(area))?.to ?? null;
}

export type ResolucaoAcessoArea =
  | { tipo: "permitir" }
  | { tipo: "redirecionar"; to: RotaAreaInterna }
  | { tipo: "restrito" };

/** Decisão pura usada pelo guard central, inclusive para provar ausência de loop. */
export function resolverAcessoAreaInterna(input: {
  role: Perfil | null | undefined;
  pathname: string;
  areas: ReadonlySet<string>;
}): ResolucaoAcessoArea {
  if (!podeAcessarAreaInterna(input.role)) return { tipo: "permitir" };

  const areaAtual = areaDaRotaInterna(input.pathname);
  if (!areaAtual || input.areas.has(areaAtual)) return { tipo: "permitir" };

  const destino = primeiraRotaInternaPermitida(input.areas);
  return destino ? { tipo: "redirecionar", to: destino } : { tipo: "restrito" };
}
