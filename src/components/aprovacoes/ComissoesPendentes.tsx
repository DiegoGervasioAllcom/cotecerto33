// Seção "Comissões abaixo do mínimo sem aprovação" da fila de Aprovações. A RLS escopa o que o
// usuário vê; filtramos por nivel_atual = eu (Matriz vê todas as pendentes).
// Ao aprovar, o servidor recalcula sozinho a cotação+seguradora do solicitante.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { COMISSAO_SEM_APROVACAO_MIN } from "@/components/venda/novo-lead/ajusteSeguradora.schema";
import { useAuth } from "@/lib/auth";
import { formatarNumeroCotacao } from "@/lib/cotacao-numero";
import { calcularAposAprovacaoComissao } from "@/lib/quiver.functions";

const motivoSchema = z.string().trim().max(500, "Motivo com até 500 caracteres.");

type Pendente = {
  id: string;
  cotacao_id: string;
  seguradora: string;
  comissao_pct: number;
  criado_em: string;
  solicitante: { nome: string | null } | null;
  cotacao: { numero: number | null; criado_em: string | null } | null;
};

const comissoesPendentesKey = ["comissoes-pendentes"] as const;

export function useComissoesPendentes() {
  const { role } = useAuth();
  return useQuery({
    queryKey: [...comissoesPendentesKey, role],
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Pendente[]> => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id ?? null;
      let q = supabase
        .from("comissao_solicitacoes")
        .select(
          "id,cotacao_id,seguradora,comissao_pct,criado_em," +
            "solicitante:profiles!comissao_solicitacoes_solicitante_id_fkey(nome)," +
            "cotacao:cotacoes(numero,criado_em)",
        )
        .eq("status", "pendente")
        .order("criado_em", { ascending: true });
      if (role !== "matriz") {
        if (!uid) return [];
        q = q.eq("nivel_atual", uid);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data as unknown as Pendente[]) ?? [];
    },
  });
}

export function ComissoesPendentes({ onFeedback }: { onFeedback: (msg: string) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const { data: rows = [], isLoading } = useComissoesPendentes();

  async function aprovar(p: Pendente) {
    setBusy(p.id);
    setErro(null);
    const { error } = await supabase.rpc("aprovar_comissao_baixa", { p_id: p.id });
    if (error) {
      setBusy(null);
      setErro("Não foi possível aprovar a comissão.");
      return;
    }
    // Aprovou: dispara o cálculo no servidor (revalida a aprovação lá).
    try {
      const { data: sess } = await supabase.auth.getSession();
      await calcularAposAprovacaoComissao({
        data: { solicitacaoId: p.id, caller_token: sess.session?.access_token ?? "" },
      });
      onFeedback(`Comissão aprovada — cálculo de ${p.seguradora} disparado para o vendedor.`);
    } catch (e) {
      onFeedback(
        `Comissão aprovada, mas o cálculo automático falhou (${e instanceof Error ? e.message : "erro"}). O vendedor pode recalcular manualmente.`,
      );
    }
    setBusy(null);
    await qc.invalidateQueries({ queryKey: comissoesPendentesKey });
  }

  async function recusar(p: Pendente) {
    const m = motivoSchema.safeParse(motivo);
    if (!m.success) {
      setErro(m.error.issues[0]?.message ?? "Motivo inválido.");
      return;
    }
    setBusy(p.id);
    setErro(null);
    const { error } = await supabase.rpc("recusar_comissao_baixa", {
      p_id: p.id,
      p_motivo: m.data,
    });
    setBusy(null);
    if (error) {
      setErro("Não foi possível recusar a comissão.");
      return;
    }
    setRecusando(null);
    setMotivo("");
    onFeedback("Comissão recusada.");
    await qc.invalidateQueries({ queryKey: comissoesPendentesKey });
  }

  if (isLoading || rows.length === 0) return null;

  return (
    <section data-testid="comissoes-pendentes" style={{ marginTop: 20 }}>
      <h3 style={{ marginBottom: 8 }}>Comissões abaixo de {COMISSAO_SEM_APROVACAO_MIN}%</h3>
      {erro && (
        <div className="banner alert" style={{ marginBottom: 12 }}>
          {erro}
        </div>
      )}
      {rows.map((p) => (
        <div key={p.id} className="card" style={{ marginBottom: 12 }}>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <strong>{p.solicitante?.nome ?? "—"}</strong>
              <span className="muted"> pediu comissão de </span>
              <strong>{String(p.comissao_pct).replace(".", ",")}%</strong>
              <span className="muted"> em </span>
              <strong>{p.seguradora}</strong>
              <div className="muted small">
                Cotação {formatarNumeroCotacao(p.cotacao?.numero, p.cotacao?.criado_em) ?? "—"}
              </div>
            </div>
            {recusando === p.id ? (
              <div className="field-group">
                <label htmlFor={`motivo-${p.id}`}>Motivo da recusa</label>
                <textarea
                  id={`motivo-${p.id}`}
                  className="input"
                  maxLength={500}
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
                <div className="tools">
                  <button
                    className="btn btn-yellow btn-sm"
                    disabled={busy === p.id}
                    onClick={() => void recusar(p)}
                  >
                    Confirmar recusa
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setRecusando(null)}>
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="tools" style={{ flexWrap: "wrap" }}>
                <button
                  className="btn btn-yellow btn-sm"
                  disabled={busy === p.id}
                  onClick={() => void aprovar(p)}
                >
                  Aprovar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy === p.id}
                  onClick={() => {
                    setMotivo("");
                    setRecusando(p.id);
                  }}
                >
                  Recusar
                </button>
                <Link
                  to="/venda/cotacoes/$id"
                  params={{ id: p.cotacao_id }}
                  className="btn btn-ghost btn-sm"
                >
                  Ver cotação
                </Link>
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
