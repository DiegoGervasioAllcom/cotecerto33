import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type PerdaMotivo = { id: number; nome: string };
export type PerdaSubmotivo = {
  id: number;
  motivo_id: number;
  nome: string;
  destino_sugerido: "Remalho" | "Descarte";
};

/**
 * Subsistema de "classificar perda" da tela Novo lead.
 * Depende de `cotacaoId` e `persistir` (produzidos por useCotacaoRascunho).
 */
export function useClassificarPerda(cotacaoId: string | null, persistir: () => Promise<void>) {
  const navigate = useNavigate();

  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaMotivos, setPerdaMotivos] = useState<PerdaMotivo[]>([]);
  const [perdaSubs, setPerdaSubs] = useState<PerdaSubmotivo[]>([]);
  const [perdaForm, setPerdaForm] = useState<{ motivo: string; sub: string; obs: string }>({
    motivo: "",
    sub: "",
    obs: "",
  });
  const [perdaSaving, setPerdaSaving] = useState(false);

  useEffect(() => {
    if (!perdaOpen) return;
    if (perdaMotivos.length) return;
    void (async () => {
      const [m, s] = await Promise.all([
        supabase.from("perda_motivos").select("id,nome").eq("ativo", true).order("ordem"),
        supabase
          .from("perda_submotivos")
          .select("id,motivo_id,nome,destino_sugerido")
          .eq("ativo", true)
          .order("ordem"),
      ]);
      if (m.data) setPerdaMotivos(m.data as PerdaMotivo[]);
      if (s.data) setPerdaSubs(s.data as PerdaSubmotivo[]);
    })();
  }, [perdaOpen, perdaMotivos.length]);

  async function abrirPerda() {
    if (!cotacaoId) {
      try {
        await persistir();
      } catch {
        /* noop */
      }
    }
    setPerdaForm({ motivo: "", sub: "", obs: "" });
    setPerdaOpen(true);
  }

  async function confirmarPerda() {
    if (!cotacaoId || !perdaForm.motivo || !perdaForm.sub) return;
    setPerdaSaving(true);
    const { error } = await supabase.rpc("classificar_perda_cotacao", {
      p_cotacao_id: cotacaoId as string, // a RPC aceita null: cria rascunho novo
      p_motivo: perdaForm.motivo,
      p_submotivo: perdaForm.sub,
      p_observacao: perdaForm.obs || undefined,
    });
    setPerdaSaving(false);
    if (error) {
      alert("Erro ao classificar perda: " + error.message);
      return;
    }
    setPerdaOpen(false);
    navigate({ to: "/venda/pipeline" });
  }

  return {
    perdaOpen,
    setPerdaOpen,
    perdaMotivos,
    perdaSubs,
    perdaForm,
    setPerdaForm,
    perdaSaving,
    abrirPerda,
    confirmarPerda,
  };
}
