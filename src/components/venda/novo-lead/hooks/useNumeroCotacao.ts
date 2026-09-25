import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Número real da cotação (`cotacoes.numero`), no mesmo formato já usado na
 * tela "Comparativo lado a lado" (`cotacoes.$id.tsx`) e nas listas de
 * cotação/negociação (`lista-helpers.tsx`/`agenda.ts`): `COT-AAAA-NNNNN`,
 * com o ano da criação da cotação (`criado_em`), não o ano corrente.
 *
 * O wizard (`Form`) não carrega `numero`/`criado_em` — só existem quando a
 * cotação já foi salva pelo menos uma vez (autosave em
 * `useCotacaoRascunho`). Por isso é uma query pequena e independente, ligada
 * ao `cotacaoId`, em vez de crescer o hook de rascunho.
 */
export function useNumeroCotacao(cotacaoId: string | null) {
  const query = useQuery({
    queryKey: ["cotacao-numero", cotacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select("numero,criado_em")
        .eq("id", cotacaoId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
  });

  return {
    numero: query.data?.numero ?? null,
    criadoEm: query.data?.criado_em ?? null,
  };
}

const pad = (numero: number) => String(numero).padStart(5, "0");

/** `null` quando a cotação ainda não tem número real (rascunho não salvo ou
 * ainda carregando) — o chamador decide o texto de fallback ("—"). */
export function formatarNumeroCotacao(
  numero: number | null,
  criadoEm: string | null,
): string | null {
  if (numero == null || !criadoEm) return null;
  return `COT-${new Date(criadoEm).getFullYear()}-${pad(numero)}`;
}
