import type { Database } from "@/integrations/supabase/database.types";

export type CotacaoStatus = Database["public"]["Enums"]["cotacao_status"];

export const STATUS_COTACAO: { valor: CotacaoStatus; rotulo: string }[] = [
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "calculada", rotulo: "Calculada" },
  { valor: "proposta", rotulo: "Proposta" },
  { valor: "aceita", rotulo: "Aceita" },
  { valor: "perdida", rotulo: "Perdida" },
  { valor: "enviada_quiver", rotulo: "Enviada" },
  { valor: "erro_quiver", rotulo: "Erro" },
];

export const rotuloStatusCotacao = (s: string) =>
  STATUS_COTACAO.find((x) => x.valor === s)?.rotulo ?? s;
