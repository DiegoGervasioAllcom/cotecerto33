// V11 · D9 (Frente 4) — modal de resumo do selo de performance (D8).
//
// Números vêm de `profiles.performance_motivo` (jsonb gravado por D3/D4) —
// não recalcula nada aqui, só exibe o que já foi persistido. "Notificar
// supervisor" fica igual ao protótipo: aviso local, sem persistir (decisão
// #3 do PLANO_REGUA_V11.md). "Revisado — reativar" chama fn_revisar_
// reativar_performance (D6) e só aparece quando travado.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/operacao/acessos/icon";
import { PERFORMANCE_STATUS_LABEL, PERFORMANCE_STATUS_CHIP } from "@/lib/performance-status";

type PerformanceMotivo = {
  leads?: number;
  cotacoes?: number;
  propostas?: number;
  vendas?: number;
  conversao_pct?: number;
  cancelamentos?: number;
  dias_sem_venda?: number;
  comissao?: number;
  meta_vendas_mes?: number | null;
  meta_vendas_prorata?: number | null;
};

type Sinal = {
  performance_status: "ativo" | "atencao" | "travado" | null;
  performance_motivo: PerformanceMotivo | null;
  performance_calculado_em: string | null;
  performance_revisado_em: string | null;
  performance_revisao_motivo: string | null;
};

function fmtPct(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}
function fmtMoeda(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PerformanceResumoModal({
  profileId,
  nome,
  onClose,
  onAlterado,
}: {
  profileId: string;
  nome: string;
  onClose: () => void;
  onAlterado: () => void;
}) {
  const [sinal, setSinal] = useState<Sinal | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notificado, setNotificado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "performance_status,performance_motivo,performance_calculado_em,performance_revisado_em,performance_revisao_motivo",
        )
        .eq("id", profileId)
        .single();
      if (!ativo) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      setSinal(data as unknown as Sinal);
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [profileId]);

  async function reativar() {
    const motivo = window.prompt(`Motivo da revisão de ${nome} (opcional):`) ?? undefined;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("fn_revisar_reativar_performance", {
      p_profile_id: profileId,
      p_motivo: motivo?.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onAlterado();
    onClose();
  }

  const m = sinal?.performance_motivo;

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-h">
          <Icon id="gauge" size={18} />
          <h3>Performance · {nome}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          {loading ? (
            <div className="muted small">Carregando…</div>
          ) : err ? (
            <div className="banner alert">{err}</div>
          ) : !sinal?.performance_status ? (
            <div className="muted small">Sem sinal calculado ainda — recente ou fora da régua.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span className={`chip ${PERFORMANCE_STATUS_CHIP[sinal.performance_status]}`}>
                  {PERFORMANCE_STATUS_LABEL[sinal.performance_status]}
                </span>
                {sinal.performance_calculado_em && (
                  <span className="muted small">
                    calculado em{" "}
                    {new Date(sinal.performance_calculado_em).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="acc-grid">
                <div className="field-group">
                  <label>Leads</label>
                  <div style={{ fontWeight: 700 }}>{m?.leads ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Cotações</label>
                  <div style={{ fontWeight: 700 }}>{m?.cotacoes ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Propostas</label>
                  <div style={{ fontWeight: 700 }}>{m?.propostas ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Vendas</label>
                  <div style={{ fontWeight: 700 }}>{m?.vendas ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Conversão</label>
                  <div style={{ fontWeight: 700 }}>{fmtPct(m?.conversao_pct)}</div>
                </div>
                <div className="field-group">
                  <label>Cancelamentos</label>
                  <div style={{ fontWeight: 700 }}>{m?.cancelamentos ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Dias sem venda</label>
                  <div style={{ fontWeight: 700 }}>{m?.dias_sem_venda ?? "—"}</div>
                </div>
                <div className="field-group">
                  <label>Comissão na janela</label>
                  <div style={{ fontWeight: 700 }}>{fmtMoeda(m?.comissao)}</div>
                </div>
                <div className="field-group">
                  <label>Meta do mês</label>
                  <div style={{ fontWeight: 700 }}>{m?.meta_vendas_mes ?? "—"}</div>
                </div>
              </div>
              {sinal.performance_revisado_em && (
                <div className="muted small" style={{ marginTop: 12 }}>
                  <Icon id="history" size={13} /> Revisado em{" "}
                  {new Date(sinal.performance_revisado_em).toLocaleDateString("pt-BR")}
                  {sinal.performance_revisao_motivo ? ` — ${sinal.performance_revisao_motivo}` : ""}
                </div>
              )}
              {notificado && (
                <div className="banner" style={{ marginTop: 12 }}>
                  Supervisor notificado (aviso local — não persiste).
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Fechar
          </button>
          {sinal?.performance_status && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setNotificado(true)}
              disabled={notificado}
            >
              <Icon id="bell" size={13} /> Notificar supervisor
            </button>
          )}
          {sinal?.performance_status === "travado" && (
            <button className="btn btn-yellow" type="button" disabled={busy} onClick={reativar}>
              <Icon id="check" size={13} /> Revisado — reativar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
