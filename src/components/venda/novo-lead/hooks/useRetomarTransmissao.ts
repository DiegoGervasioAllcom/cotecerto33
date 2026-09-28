import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import type { OfertaTransmissao } from "@/components/venda/novo-lead/steps/StepCalculo";
import type { ResultadoTransmissaoEstado } from "@/components/venda/novo-lead/steps/transmissao/TransmissaoResultado";
import type { Fase as FaseTransmissao } from "@/components/venda/novo-lead/steps/transmissao/StepTransmissao";

// V12: reabrir a Etapa 7 no ponto certo em vez de sempre voltar ao Cálculo
// (ver `novo-lead.tsx` — antes, um remount com `cotacoes.step_atual = 6`
// caía sempre no Cálculo, porque `oferta` era só `useState` local).
//
// Duas fontes, nenhuma com dado pessoal:
// - `cotacao_transmissoes` (última tentativa real): existe assim que o
//   vendedor confirma "Transmitir" — dono da verdade sobre status
//   (aguardando/transmitida/falha).
// - `cotacoes.transmissao_oferta` (snapshot best-effort, gravado quando o
//   vendedor escolhe a oferta no Cálculo): cobre a janela ANTES da primeira
//   tentativa, enquanto ele ainda está em "Dados complementares".

type CotacaoTransmissaoRow = Database["public"]["Tables"]["cotacao_transmissoes"]["Row"];

export type TransmissaoTentativaResumo = Pick<
  CotacaoTransmissaoRow,
  | "id"
  | "seguradora"
  | "produto_id"
  | "produto"
  | "forma_pagamento"
  | "parcelas"
  | "premio"
  | "status"
  | "motivo"
  | "mensagem"
  | "proposta_id"
>;

const snapshotSchema = z.object({
  seguradora: z.string().trim().min(1),
  produto_id: z.string().nullable().optional(),
  produto: z.string().nullable().optional(),
  forma_pagamento: z.string().trim().min(1),
  parcelas: z.string().nullable().optional(),
  premio: z.number().nullable().optional(),
  // Discriminadores da opção escolhida (tipo/franquia/avista/desconto) — só
  // usados para retomar a Etapa 7 ANTES da primeira tentativa real (fase
  // "dados"), quando `onTransmitir` precisa deles pra localizar a opção no
  // servidor (ver `OfertaTransmissao.opcao` em StepCalculo.tsx).
  opcao_tipo: z.string().nullable().optional(),
  opcao_franquia: z.string().nullable().optional(),
  opcao_avista: z.string().nullable().optional(),
  opcao_desconto: z.string().nullable().optional(),
});

export type TransmissaoOfertaSnapshot = z.infer<typeof snapshotSchema>;

export function parseTransmissaoOfertaSnapshot(json: unknown): TransmissaoOfertaSnapshot | null {
  if (!json) return null;
  const parsed = snapshotSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export type EstadoTransmissaoRetomado =
  | { tipo: "nenhum" }
  | { tipo: "dados"; oferta: OfertaTransmissao }
  | { tipo: "aguardando"; oferta: OfertaTransmissao; tentativaId: string }
  | { tipo: "resultado"; oferta: OfertaTransmissao; resultado: ResultadoTransmissaoEstado };

// Monta o mínimo de `OfertaTransmissao`/`ResultadoCalculo` que os componentes
// pós-escolha (TransmissaoDadosComplementares, TransmissaoConfirmacao,
// TransmissaoResultado) de fato leem: seguradora, produto/produtoId, forma
// de pagamento, parcelas e prêmio. Nunca inventa dado — sem seguradora ou
// forma de pagamento não há oferta pra retomar.
function montarOferta(
  tentativa: TransmissaoTentativaResumo | null,
  snapshot: TransmissaoOfertaSnapshot | null,
): OfertaTransmissao | null {
  const seguradora = tentativa?.seguradora ?? snapshot?.seguradora ?? null;
  const formaPagamento = tentativa?.forma_pagamento ?? snapshot?.forma_pagamento ?? null;
  if (!seguradora || !formaPagamento) return null;

  return {
    resultado: {
      seguradora,
      nome: "",
      produto: tentativa?.produto ?? snapshot?.produto ?? undefined,
      produtoId: tentativa?.produto_id ?? snapshot?.produto_id ?? undefined,
      opcoes: [],
      index: 0,
      cardId: "retomado",
    },
    formaPagamento,
    parcelas: tentativa?.parcelas ?? snapshot?.parcelas ?? "",
    premio: tentativa?.premio ?? snapshot?.premio ?? undefined,
    // Só o snapshot guarda o bundle da opção (uma tentativa real já foi
    // enviada ao servidor — não precisa mais dele para retransmitir).
    opcao: {
      tipo: snapshot?.opcao_tipo ?? undefined,
      franquia: snapshot?.opcao_franquia ?? undefined,
      avista: snapshot?.opcao_avista ?? undefined,
      desconto: snapshot?.opcao_desconto ?? undefined,
    },
  };
}

/**
 * Função pura: dado o estado bruto (última tentativa de transmissão +
 * snapshot da oferta), decide em que ponto a Etapa 7 deve reabrir.
 *
 * Ramos:
 * - sem tentativa e sem snapshot → "nenhum" (comportamento atual: Cálculo).
 * - sem tentativa, só snapshot → "dados" (Dados complementares, com a oferta).
 * - tentativa `enviada` → "aguardando" (retoma o polling).
 * - tentativa `transmitida`/`falha` → "resultado" (card correspondente).
 */
export function resolverEstadoTransmissao(
  tentativa: TransmissaoTentativaResumo | null,
  snapshot: TransmissaoOfertaSnapshot | null,
): EstadoTransmissaoRetomado {
  if (!tentativa) {
    const oferta = snapshot ? montarOferta(null, snapshot) : null;
    return oferta ? { tipo: "dados", oferta } : { tipo: "nenhum" };
  }

  const oferta = montarOferta(tentativa, snapshot);
  if (!oferta) return { tipo: "nenhum" };

  if (tentativa.status === "enviada") {
    return { tipo: "aguardando", oferta, tentativaId: tentativa.id };
  }

  if (tentativa.status === "transmitida" || tentativa.status === "falha") {
    return {
      tipo: "resultado",
      oferta,
      resultado: {
        status: tentativa.status,
        motivo: tentativa.motivo,
        mensagem: tentativa.mensagem,
        propostaId: tentativa.proposta_id,
      },
    };
  }

  // Defensivo: o check constraint do banco só permite os 3 valores acima
  // (`cotacao_transmissoes_status_chk`) — um valor fora disso não deveria
  // acontecer, mas não trava o wizard: cai de volta pro Cálculo.
  return { tipo: "nenhum" };
}

/**
 * Função pura: decide se a retomada resolvida deve ser aplicada nesse
 * instante, dado o passo que a navegação já resolveu (`visibleStep` — após
 * o rascunho carregar, é `step` da URL ou, na ausência dele, `step_atual`
 * persistido).
 *
 * A retomada só se aplica quando a Etapa 7 é de fato o destino: `step=6`
 * explícito na URL, ou nenhum `step` com `step_atual` já em 6. Um passo
 * explícito diferente precisa ser respeitado (retorna `null` — não mexe em
 * oferta/snapshot) — ex.: "Abrir cálculo" (Em negociação, aviso "COTAÇÃO
 * FINALIZADA") sempre manda `step=5`, mesmo numa cotação que já tem oferta
 * escolhida ou transmissão em andamento; sem essa checagem, reabrir pra ver
 * o Cálculo caía direto de volta na Transmissão.
 */
export function decidirAplicacaoRetomada(
  visibleStep: number,
  retomado: EstadoTransmissaoRetomado,
): EstadoTransmissaoRetomado | null {
  return visibleStep === 6 ? retomado : null;
}

function estadoInicialRetomada(
  cotacaoId: string | null,
  habilitado: boolean,
): { resolvendo: boolean; retomado: EstadoTransmissaoRetomado | null } {
  if (!habilitado || !cotacaoId) return { resolvendo: false, retomado: { tipo: "nenhum" } };
  // Com `cotacaoId` e `habilitado`, o hook sempre nasce "resolvendo" — seja
  // porque ainda espera o rascunho carregar, seja porque já vai disparar a
  // busca (ver `useRetomarTransmissao` pro motivo de nunca nascer "nenhum").
  return { resolvendo: true, retomado: null };
}

/**
 * Busca a última tentativa de transmissão e o snapshot da oferta pra uma
 * cotação, e resolve em que ponto a Etapa 7 deve reabrir. `resolvendo` fica
 * `true` enquanto a busca está em andamento — evita que o wizard pisque no
 * Cálculo antes de saber se há algo pra retomar.
 *
 * `aguardandoRascunho` (o `loading` de `useCotacaoRascunho`) atrasa o INÍCIO
 * da busca até o rascunho terminar de carregar — ordem determinística entre
 * os dois `setStep`/`setVisibleStep` concorrentes (rascunho carrega
 * `step_atual` de 5 tabelas, mais lento; a retomada é só 2 queries simples).
 * Enquanto isso, o hook fica em "resolvendo" (nunca em "nenhum") — se
 * caísse em "nenhum" por engano nesse meio-tempo, `useAplicarRetomadaTransmissao`
 * aplicaria essa decisão (e travaria a marca "já apliquei" pra essa cotação)
 * antes mesmo do rascunho ter tido a chance de setar o passo certo.
 */
export function useRetomarTransmissao(
  cotacaoId: string | null,
  habilitado = true,
  aguardandoRascunho = false,
) {
  const [estado, setEstado] = useState(() => estadoInicialRetomada(cotacaoId, habilitado));

  useEffect(() => {
    // Preview de tutorial (`lead-transmissao-*`): não busca nem retoma nada
    // de verdade — essas telas mostram um exemplo estático, sem tocar no
    // wizard real (ver `novo-lead.tsx`).
    if (!cotacaoId || !habilitado) {
      setEstado({ resolvendo: false, retomado: { tipo: "nenhum" } });
      return;
    }
    if (aguardandoRascunho) {
      setEstado({ resolvendo: true, retomado: null });
      return;
    }
    let cancelado = false;
    setEstado({ resolvendo: true, retomado: null });
    void (async () => {
      const [tentativaRes, cotacaoRes] = await Promise.all([
        supabase
          .from("cotacao_transmissoes")
          .select(
            "id,seguradora,produto_id,produto,forma_pagamento,parcelas,premio,status,motivo,mensagem,proposta_id",
          )
          .eq("cotacao_id", cotacaoId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("cotacoes").select("transmissao_oferta").eq("id", cotacaoId).maybeSingle(),
      ]);
      if (cancelado) return;
      const snapshot = parseTransmissaoOfertaSnapshot(cotacaoRes.data?.transmissao_oferta ?? null);
      setEstado({
        resolvendo: false,
        retomado: resolverEstadoTransmissao(tentativaRes.data ?? null, snapshot),
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [cotacaoId, habilitado, aguardandoRascunho]);

  return estado;
}

// Best-effort (mesmo padrão de `onFaseTransmissaoChange` em novo-lead.tsx):
// nunca deve bloquear nem interromper o wizard — a transmissão de verdade
// roda via `cotacao_transmissoes`, isso aqui é só o snapshot pra retomada.
export async function gravarTransmissaoOfertaSnapshot(
  cotacaoId: string,
  escolha: OfertaTransmissao,
) {
  const snapshot: TransmissaoOfertaSnapshot = {
    seguradora: escolha.resultado.seguradora,
    produto_id: escolha.resultado.produtoId ?? null,
    produto: escolha.resultado.produto ?? escolha.resultado.nome ?? null,
    forma_pagamento: escolha.formaPagamento,
    parcelas: escolha.parcelas || null,
    premio: escolha.premio ?? null,
    opcao_tipo: escolha.opcao.tipo ?? null,
    opcao_franquia: escolha.opcao.franquia ?? null,
    opcao_avista: escolha.opcao.avista ?? null,
    opcao_desconto: escolha.opcao.desconto ?? null,
  };
  const { error } = await supabase
    .from("cotacoes")
    .update({ transmissao_oferta: snapshot })
    .eq("id", cotacaoId);
  if (error && import.meta.env.DEV) {
    console.error("Falha ao gravar transmissao_oferta (best-effort):", error);
  }
}

export async function limparTransmissaoOfertaSnapshot(cotacaoId: string) {
  const { error } = await supabase
    .from("cotacoes")
    .update({ transmissao_oferta: null })
    .eq("id", cotacaoId);
  if (error && import.meta.env.DEV) {
    console.error("Falha ao limpar transmissao_oferta (best-effort):", error);
  }
}

type AplicarRetomadaParams = {
  cotacaoId: string | null;
  resolvendo: boolean;
  retomado: EstadoTransmissaoRetomado | null;
  oferta: OfertaTransmissao | null;
  visibleStep: number;
  setVisibleStep: (step: number) => void;
  setOferta: (oferta: OfertaTransmissao) => void;
  setFaseInicialTransmissao: (fase: FaseTransmissao) => void;
  setTransmissaoEmAndamento: (v: { tentativaId: string }) => void;
  setResultadoTransmissao: (v: ResultadoTransmissaoEstado) => void;
  iniciarPollingTransmissao: (tentativaId: string) => void;
  // Mantém a URL (`?step=`) em sincronia com o passo aplicado — sem isso,
  // um F5 volta a usar o `step` da navegação original em vez do resolvido
  // aqui (ver comentário em `novo-lead.tsx`, na chamada deste hook).
  sincronizarStepNaUrl?: (step: number) => void;
};

/**
 * Aplica, uma única vez por cotação, o estado resolvido por
 * `useRetomarTransmissao` no estado local do wizard (`novo-lead.tsx`). Um
 * "Voltar ao Cálculo" explícito zera `oferta` de propósito — sem o controle
 * "1x por cotação" (via ref), essa mesma retomada reapareceria porque o
 * resultado do fetch continua na memória mesmo depois do vendedor limpar o
 * snapshot no banco.
 */
export function useAplicarRetomadaTransmissao(params: AplicarRetomadaParams) {
  const {
    cotacaoId,
    resolvendo,
    retomado,
    oferta,
    visibleStep,
    setVisibleStep,
    setOferta,
    setFaseInicialTransmissao,
    setTransmissaoEmAndamento,
    setResultadoTransmissao,
    iniciarPollingTransmissao,
    sincronizarStepNaUrl,
  } = params;
  const aplicouParaRef = useRef<string | null>(null);

  useEffect(() => {
    if (resolvendo || !retomado) return;
    if (aplicouParaRef.current === cotacaoId) return;
    if (oferta) {
      aplicouParaRef.current = cotacaoId;
      return;
    }

    // Só conta como "aplicada" quando a URL pede o passo da Transmissão:
    // um step explícito diferente (ex. "Abrir cálculo") não consome a retomada.
    const decisao = decidirAplicacaoRetomada(visibleStep, retomado);
    if (!decisao) return;
    aplicouParaRef.current = cotacaoId;

    if (decisao.tipo === "nenhum") {
      // Etapa 7 só existe com uma oferta (é estado local, não persiste no
      // rascunho por si só). Sem isso, reabrir uma cotação salva com
      // `step_atual = 6` (autosave) ou clicar direto em "Transmissão" no
      // Stepper deixaria o wizard-card em branco.
      setVisibleStep(5);
      sincronizarStepNaUrl?.(5);
      return;
    }

    setOferta(decisao.oferta);
    if (decisao.tipo === "aguardando") {
      setFaseInicialTransmissao("resultado");
      setTransmissaoEmAndamento({ tentativaId: decisao.tentativaId });
      iniciarPollingTransmissao(decisao.tentativaId);
    } else if (decisao.tipo === "resultado") {
      setFaseInicialTransmissao("resultado");
      setResultadoTransmissao(decisao.resultado);
    } else {
      setFaseInicialTransmissao("dados");
    }
    setVisibleStep(6);
    sincronizarStepNaUrl?.(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvendo, retomado, cotacaoId, visibleStep]);
}
