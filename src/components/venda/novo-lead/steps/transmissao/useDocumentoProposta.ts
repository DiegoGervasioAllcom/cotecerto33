import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  obterUrlDocumentoProposta,
  solicitarRecapturaDocumento,
} from "@/lib/proposta-documento.functions";
import {
  DOC_REFETCH_MS,
  estadoDocumentoProposta,
  type DocumentoLinha,
} from "@/lib/proposta-documento-estado";

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

/** Abrir (URL assinada) e "Tentar de novo" — compartilhado entre o card Transmitida e a lista de Emissão. */
export function useAcoesDocumentoProposta(propostaId: string) {
  const qc = useQueryClient();

  const abrir = useMutation({
    mutationFn: async () => {
      // Abre a aba no clique (antes do await) para não ser barrada como pop-up.
      const aba = window.open("", "_blank");
      try {
        const { url } = await obterUrlDocumentoProposta({
          data: { propostaId, caller_token: await token() },
        });
        if (aba) {
          aba.opener = null;
          aba.location.href = url;
        } else {
          window.location.assign(url);
        }
      } catch (e) {
        aba?.close();
        throw e;
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Documento indisponível."),
  });

  const tentarDeNovo = useMutation({
    mutationFn: async () =>
      solicitarRecapturaDocumento({ data: { propostaId, caller_token: await token() } }),
    onSuccess: () => {
      toast.success("Documento solicitado. Isso leva alguns instantes.");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível solicitar o documento."),
    // Sucesso ou não, relê o estado real (o servidor marca pendente).
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["proposta-documento", propostaId] }),
        qc.invalidateQueries({ queryKey: ["proposta-documentos-lote"] }),
      ]),
  });

  return { abrir, tentarDeNovo };
}

/** Documento (PDF) da proposta via RLS; refetch leve enquanto "Preparando". */
export function useDocumentoProposta(propostaId: string, transmitidaEm: string | null) {
  const queryKey = ["proposta-documento", propostaId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<DocumentoLinha> => {
      const { data, error } = await supabase
        .from("proposta_documentos")
        .select("status, tentado_em, updated_at")
        .eq("proposta_id", propostaId)
        .eq("tipo", "proposta_pdf")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) =>
      q.state.data === undefined ||
      estadoDocumentoProposta(q.state.data, transmitidaEm) === "preparando"
        ? DOC_REFETCH_MS
        : false,
  });

  const estado = estadoDocumentoProposta(query.data ?? null, transmitidaEm);

  const { abrir, tentarDeNovo } = useAcoesDocumentoProposta(propostaId);

  return { estado, carregando: query.isLoading, abrir, tentarDeNovo };
}
