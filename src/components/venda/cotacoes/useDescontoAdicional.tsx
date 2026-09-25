// Desconto adicional por seguradora — lógica compartilhada entre o
// comparativo lado a lado (`ComparativoQuiver.tsx`) e as ações por
// seguradora do passo Cálculo do wizard (`SegAcoes.tsx`, V12.3.6).
//
// `useDescontoAdicional` é a parte pura (vínculo prêmio↔card, disponibilidade,
// rótulos de status) + o modal `SolicitarDescontoModal` já existente — sem
// mudar o comportamento que já existia em `ComparativoQuiver`, só extraindo.
// `useDescontoAdicionalDados` é a parte nova, usada só pelo wizard
// (`novo-lead.tsx`/`StepCalculo`), que hoje não busca seguradoras/prêmios/
// solicitações — a página `cotacoes/$id` já faz essa busca à sua maneira e
// continua intacta.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SolicitarDescontoModal } from "@/components/venda/solicitar-desconto-modal";
import { vincularPremiosQuiver, type ResultadoCalculo } from "./quiver-resultado";

export type PremioComparativo = {
  id: string;
  seguradora: string;
  cobertura: string | null;
  premio: number;
};

export type SolicitacaoComparativo = {
  id: string;
  seguradora_id: string;
  pct_pedido: number;
  pct_concedido: number | null;
  status: string;
};

export const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aguardando_aceite: "Aguardando seu aceite",
  aprovado: "Aprovado",
  negado: "Negado",
  cancelado: "Cancelado",
};
export const STATUS_CHIP: Record<string, string> = {
  pendente: "chip-yellow",
  aguardando_aceite: "chip-info",
  aprovado: "chip-ok",
  negado: "chip-alert",
  cancelado: "chip-outline",
};

export const normalizarNomeSeguradora = (texto: string | null | undefined) =>
  (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("pt-BR");

/** Pedidos de desconto (`desconto_solicitacoes`) de outras seguradoras que
 * "Recalcular esta seguradora" precisa cancelar antes de reenviar — pendentes
 * ou aguardando aceite, de uma seguradora diferente da escolhida. Extraída
 * como função pura (sem `useState`/fetch) para poder testar a seleção sem
 * montar o hook — o projeto não tem `@testing-library/react` (ver
 * `tests/unit/use-pipeline-pagination.test.ts`). */
export function selecionarSolicitacoesParaCancelar(
  solicitacoes: readonly SolicitacaoComparativo[],
  seguradoraIdAlvo: string | null,
): SolicitacaoComparativo[] {
  return solicitacoes.filter(
    (solicitacao) =>
      solicitacao.seguradora_id !== seguradoraIdAlvo &&
      ["pendente", "aguardando_aceite"].includes(solicitacao.status),
  );
}

export type DescontoInfo = {
  premio: PremioComparativo | undefined;
  solicitacao: SolicitacaoComparativo | undefined;
  emAndamento: boolean;
  disponivel: boolean;
  indisponivelMotivo: string | null;
};

type UseDescontoAdicionalArgs = {
  cotacaoId: string;
  resultados: ResultadoCalculo[];
  premios: PremioComparativo[];
  seguradoras: { id: string; nome: string }[];
  solicitacoes: SolicitacaoComparativo[];
  onDescontoEnviado: () => void;
};

/** Parte pura + modal — sem fetch nem mutação de aceitar/cancelar (essas
 * continuam com quem já tinha essa responsabilidade, hoje só a página
 * `cotacoes/$id`). */
export function useDescontoAdicional({
  cotacaoId,
  resultados,
  premios,
  seguradoras,
  solicitacoes,
  onDescontoEnviado,
}: UseDescontoAdicionalArgs) {
  const [modalPremio, setModalPremio] = useState<PremioComparativo | null>(null);

  const vinculados = useMemo(
    () => vincularPremiosQuiver(resultados, premios),
    [resultados, premios],
  );
  const cardsPorSeguradora = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const resultado of resultados) {
      const chave = normalizarNomeSeguradora(resultado.seguradora);
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return contagem;
  }, [resultados]);

  function seguradoraId(nome: string): string | null {
    return (
      seguradoras.find(
        (seguradora) =>
          normalizarNomeSeguradora(seguradora.nome) === normalizarNomeSeguradora(nome),
      )?.id ?? null
    );
  }

  function solicitacaoFor(nome: string): SolicitacaoComparativo | undefined {
    const id = seguradoraId(nome);
    if (!id) return undefined;
    return (
      solicitacoes.find(
        (solicitacao) =>
          solicitacao.seguradora_id === id &&
          ["pendente", "aguardando_aceite"].includes(solicitacao.status),
      ) ?? solicitacoes.find((solicitacao) => solicitacao.seguradora_id === id)
    );
  }

  function infoFor(resultado: ResultadoCalculo): DescontoInfo {
    const premio = vinculados.get(resultado.cardId);
    const solicitacao = solicitacaoFor(resultado.seguradora);
    const multiplosProdutos =
      (cardsPorSeguradora.get(normalizarNomeSeguradora(resultado.seguradora)) ?? 0) > 1;
    const emAndamento =
      !!solicitacao && ["pendente", "aguardando_aceite"].includes(solicitacao.status);
    const indisponivelMotivo = multiplosProdutos
      ? "Indisponível: o desconto é aplicado à seguradora inteira, que retornou mais de um produto nesta cotação."
      : !premio
        ? "Indisponível: não foi possível vincular este produto a um único prêmio."
        : null;
    return {
      premio,
      solicitacao,
      emAndamento,
      disponivel: !indisponivelMotivo,
      indisponivelMotivo,
    };
  }

  function abrirModal(resultado: ResultadoCalculo) {
    const premio = vinculados.get(resultado.cardId);
    if (premio) setModalPremio(premio);
  }
  function fecharModal() {
    setModalPremio(null);
  }

  const modal = modalPremio ? (
    <SolicitarDescontoModal
      cotacaoId={cotacaoId}
      seguradoraNome={modalPremio.seguradora}
      seguradoraId={seguradoraId(modalPremio.seguradora)}
      premio={Number(modalPremio.premio)}
      onClose={fecharModal}
      onSent={() => {
        fecharModal();
        onDescontoEnviado();
      }}
    />
  ) : null;

  // "Recalcular esta seguradora" descarta as ofertas das outras — cancela
  // (RPC `cancelar_desconto`) qualquer pedido pendente/aguardando aceite de
  // seguradoras diferentes da escolhida antes de reenviar. Se algum pedido
  // não puder ser cancelado (não é o solicitante), bloqueia e devolve o
  // motivo em vez de seguir o recálculo.
  async function cancelarDescontosDeOutrasSeguradoras(
    nomeSeguradoraAlvo: string,
  ): Promise<{ ok: true; canceladas: number } | { ok: false; motivo: string }> {
    const idAlvo = seguradoraId(nomeSeguradoraAlvo);
    const alvos = selecionarSolicitacoesParaCancelar(solicitacoes, idAlvo);
    for (const solicitacao of alvos) {
      const { error } = await supabase.rpc("cancelar_desconto", { p_id: solicitacao.id });
      if (error) return { ok: false, motivo: error.message };
    }
    return { ok: true, canceladas: alvos.length };
  }

  return {
    vinculados,
    cardsPorSeguradora,
    seguradoraId,
    solicitacaoFor,
    infoFor,
    abrirModal,
    fecharModal,
    modal,
    cancelarDescontosDeOutrasSeguradoras,
  };
}

/** Dados + mutação de aceitar/cancelar para quem ainda não os busca — hoje
 * só o wizard (`novo-lead.tsx`), que só chega no passo Cálculo depois de
 * calculado (mesmo webhook que grava `cotacao_premios`, ver
 * `registrar_premios_quiver`). A página `cotacoes/$id` já tem sua própria
 * busca com `queryKey` e mutação próprios — não trocada aqui. */
export function useDescontoAdicionalDados(cotacaoId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ["desconto-adicional-wizard", cotacaoId] as const;
  const [busySolId, setBusySolId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey,
    enabled: !!cotacaoId,
    queryFn: async () => {
      const [seguradorasResult, solicitacoesResult, premiosResult] = await Promise.all([
        supabase.from("seguradoras").select("id,nome"),
        supabase
          .from("desconto_solicitacoes")
          .select("id,seguradora_id,pct_pedido,pct_concedido,status,criado_em")
          .eq("cotacao_id", cotacaoId as string)
          .order("criado_em", { ascending: false }),
        supabase
          .from("cotacao_premios")
          .select("id,seguradora,cobertura,premio")
          .eq("cotacao_id", cotacaoId as string),
      ]);
      const error =
        seguradorasResult.error ?? solicitacoesResult.error ?? premiosResult.error ?? null;
      if (error) throw error;
      return {
        seguradoras: seguradorasResult.data ?? [],
        solicitacoes: (solicitacoesResult.data ?? []) as SolicitacaoComparativo[],
        premios: (premiosResult.data ?? []) as PremioComparativo[],
      };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({
      solicitacaoId,
      acao,
    }: {
      solicitacaoId: string;
      acao: "aceitar" | "cancelar";
    }) => {
      setBusySolId(solicitacaoId);
      const result =
        acao === "aceitar"
          ? await supabase.rpc("aceitar_desconto", { p_id: solicitacaoId })
          : await supabase.rpc("cancelar_desconto", { p_id: solicitacaoId });
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      setErro(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) =>
      setErro(error instanceof Error ? error.message : "Falha ao atualizar desconto."),
    onSettled: () => setBusySolId(null),
  });

  async function aceitar(solicitacaoId: string) {
    await mutation.mutateAsync({ solicitacaoId, acao: "aceitar" }).catch(() => undefined);
  }
  async function cancelar(solicitacaoId: string) {
    await mutation.mutateAsync({ solicitacaoId, acao: "cancelar" }).catch(() => undefined);
  }
  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey });
  }

  return {
    seguradoras: query.data?.seguradoras ?? [],
    solicitacoes: query.data?.solicitacoes ?? [],
    premios: query.data?.premios ?? [],
    isLoading: query.isLoading,
    busySolId,
    erro,
    aceitar,
    cancelar,
    invalidate,
  };
}
