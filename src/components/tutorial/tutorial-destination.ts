import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TutorialStep } from "./tutorial-types";

export type ResolvedTutorialDestination =
  | { kind: "static"; route?: string; target?: string }
  | { kind: "cotacao"; id: string; target?: string }
  | { kind: "proposta"; id: string; target?: string }
  | { kind: "franquia"; id: string; target?: string }
  | { kind: "vendedor"; id: string; target?: string };

type ResolveTutorialDestinationOptions = {
  userId: string;
  signal?: AbortSignal;
};

async function firstVisibleId(
  destination: NonNullable<TutorialStep["destination"]>,
  signal: AbortSignal,
) {
  if (destination === "cotacao-comparativo") {
    const { data, error } = await supabase
      .from("cotacoes")
      .select("id,cotacao_premios!inner(id)")
      .order("criado_em", { ascending: false })
      .limit(1)
      .limit(1, { referencedTable: "cotacao_premios" })
      .abortSignal(signal)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  if (destination === "proposta-selecionada") {
    const { data, error } = await supabase
      .from("propostas")
      .select("id")
      .order("criado_em", { ascending: false })
      .limit(1)
      .abortSignal(signal)
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }
  if (destination === "franquia-detalhe") {
    const { data, error } = await supabase
      .from("v_franquia_kpis")
      .select("empresa_id")
      .order("nome")
      .limit(1)
      .abortSignal(signal)
      .maybeSingle();
    if (error) throw error;
    return data?.empresa_id ?? null;
  }
  const { data, error } = await supabase
    .from("v_vendedor_kpis")
    .select("user_id")
    .order("vendas_mes", { ascending: false })
    .limit(1)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}

export async function resolveTutorialDestination(
  step: TutorialStep,
  queryClient: QueryClient,
  { userId, signal }: ResolveTutorialDestinationOptions,
): Promise<ResolvedTutorialDestination> {
  if (!step.destination) return { kind: "static", route: step.route, target: step.target };

  const destination = step.destination;
  const id = await queryClient
    .fetchQuery({
      queryKey: ["tutorial", "visible-destination", userId, destination],
      queryFn: ({ signal: querySignal }) => firstVisibleId(destination, signal ?? querySignal),
      staleTime: 30_000,
    })
    .catch(() => null);

  if (step.destination === "cotacao-comparativo") {
    return id
      ? { kind: "cotacao", id, target: step.target }
      : {
          kind: "static",
          route: "/venda/cotacoes",
          target: '[data-tour="cotacoes-lista"]',
        };
  }
  if (step.destination === "proposta-selecionada") {
    return id
      ? { kind: "proposta", id, target: step.target }
      : {
          kind: "static",
          route: "/venda/propostas",
          target: '[data-tour="propostas-lista"]',
        };
  }
  if (step.destination === "franquia-detalhe") {
    return id
      ? { kind: "franquia", id, target: step.target }
      : {
          kind: "static",
          route: "/operacao/franquias",
          target: '[data-tour="franquias-lista"]',
        };
  }
  return id
    ? { kind: "vendedor", id, target: step.target }
    : {
        kind: "static",
        route: "/operacao/vendedores",
        target: '[data-tour="vendedores-lista"]',
      };
}
