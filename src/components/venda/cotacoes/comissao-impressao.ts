// Regras puras da impressão com comissão (Frente 3 V12 · 7b, fatia B).
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";
import type { DocDados } from "@/lib/print";
import type { ImprimirCotacaoConfig } from "@/lib/schemas/imprimirCotacao.schema";

export const AVISO_DOC_INTERNO =
  "Documento interno com comissão: só baixar ou imprimir aqui. Não envie ao cliente.";
export const AVISO_SEM_PCT = "% de comissão não cadastrado";
export const AVISO_SEM_ACESSO = "Você não tem acesso à comissão desta cotação";

/** Trava de envio externo (e-mail/SMS/WhatsApp/link): documento com comissão
 * é interno e nunca sai do app. O servidor também recusa e-mail com comissão. */
export function envioExternoPermitido(config: Pick<ImprimirCotacaoConfig, "comComissao">): boolean {
  return !config.comComissao;
}

export type AcaoImpressao = "baixar" | "imprimir" | "email";

/** Grava a trilha imutável (`rpc_registrar_impressao`). Lança em caso de erro. */
export async function registrarImpressao(
  dados: DocDados,
  config: ImprimirCotacaoConfig,
  acao: AcaoImpressao,
): Promise<void> {
  if (!dados.cotacaoId) throw new Error("Cotação sem identificador para registrar a impressão.");
  const nomes = dados.seguradoras
    .filter((s) => config.seguradorasSelecionadas.includes(s.id))
    .map((s) => s.seguradora);
  const { error } = await supabase.rpc("rpc_registrar_impressao", {
    p_cotacao_id: dados.cotacaoId,
    p_acao: acao,
    p_modelo: config.modelo === "supper" ? "a" : "b",
    p_detalhada: config.tipo === "detalhada",
    p_seguradoras: nomes as Json,
    p_com_comissao: config.comComissao,
  });
  if (error) throw new Error(error.message);
}
