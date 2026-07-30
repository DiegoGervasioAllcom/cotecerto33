// Query e normalização compartilhadas entre a fila da Matriz (useAcessosData)
// e a fila própria da Franquia Full (useFilaFranquiaData, F9) — mesma tabela
// `empresas`, mesmo embed de convite, cada uma vendo o que a RLS deixa.
import { supabase } from "@/integrations/supabase/client";
import type { ConviteDoPendente, Pendente } from "../types";

// `empresas.convite_id` e `convites.vinc_empresa_id` são duas FKs distintas
// entre as mesmas tabelas — sem apontar a constraint, o PostgREST rejeita a
// query com "more than one relationship was found" (achado ao verificar F6 no
// navegador).
export const PENDENTES_SELECT =
  "id,nome,tipo,documento,cidade,uf,email,telefone,celular,created_at,dados_cadastro," +
  "convites!empresas_convite_id_fkey(codigo,trilha,perfil,cargo_id,vinc_tipo,vinc_empresa_id,cargos(nome))";

type PendenteBruto = {
  id: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  created_at: string;
  dados_cadastro: Record<string, unknown> | null;
  // PostgREST devolve objeto único para *-a-1, mas o client-gen tipa como
  // array quando não sabe a cardinalidade da FK — tratamos os dois formatos.
  convites:
    | {
        codigo: string;
        trilha: string;
        perfil: string | null;
        cargo_id: string | null;
        vinc_tipo: string;
        vinc_empresa_id: string | null;
        cargos: { nome: string } | { nome: string }[] | null;
      }
    | {
        codigo: string;
        trilha: string;
        perfil: string | null;
        cargo_id: string | null;
        vinc_tipo: string;
        vinc_empresa_id: string | null;
        cargos: { nome: string } | { nome: string }[] | null;
      }[]
    | null;
};

/** Normaliza o join de convites (+ cargo) e deriva o bloco (F6). */
export function mapPendentes(data: unknown): Pendente[] {
  return ((data ?? []) as PendenteBruto[]).map((row) => {
    const convRaw = Array.isArray(row.convites) ? row.convites[0] : row.convites;
    let convite: ConviteDoPendente | null = null;
    if (convRaw) {
      const cargoRaw = Array.isArray(convRaw.cargos) ? convRaw.cargos[0] : convRaw.cargos;
      convite = {
        codigo: convRaw.codigo,
        trilha: convRaw.trilha as ConviteDoPendente["trilha"],
        perfil: convRaw.perfil as ConviteDoPendente["perfil"],
        cargo_id: convRaw.cargo_id,
        cargo_nome: cargoRaw?.nome ?? null,
        vinc_tipo: convRaw.vinc_tipo as ConviteDoPendente["vinc_tipo"],
        vinc_empresa_id: convRaw.vinc_empresa_id,
      };
    }
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo,
      documento: row.documento,
      cidade: row.cidade,
      uf: row.uf,
      email: row.email,
      telefone: row.telefone,
      celular: row.celular,
      created_at: row.created_at,
      dados_cadastro: row.dados_cadastro,
      convite,
      // Sem convite: cai no bloco externo, onde a Matriz define o tipo na
      // análise (a "Prime Riscos" do protótipo). Com convite, segue a trilha.
      bloco: convite?.trilha === "interno" ? "interno" : "externo",
    };
  });
}

/** Busca os pendentes visíveis para o usuário logado — a RLS decide o escopo. */
export function fetchPendentes() {
  return supabase
    .from("empresas")
    .select(PENDENTES_SELECT)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });
}
