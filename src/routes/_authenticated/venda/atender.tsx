import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/atender")({
  head: () => ({ meta: [{ title: "Atender agora · CoteCerto" }] }),
  component: Page,
});

type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  origem: string | null;
  valor: number | null;
  criado_em: string;
  distribuido_em: string | null;
  dados: Record<string, unknown> | null;
};

const WINDOW_MS = 3 * 60 * 1000; // 3 min

function veiculoLabel(d: Record<string, unknown> | null): string {
  if (!d) return "—";
  const v = (d.veiculo as any) ?? d;
  const marca = v?.marca_nome ?? v?.marca ?? "";
  const modelo = v?.modelo_nome ?? v?.modelo ?? "";
  const ano = v?.ano_modelo ?? v?.ano ?? "";
  const cor = v?.cor ?? "";
  const head = [marca, modelo, ano].filter(Boolean).join(" ");
  return [head, cor].filter(Boolean).join(" · ") || "—";
}

function fmtTimer(ms: number): { txt: string; pct: number; tone: "ok" | "warn" | "urgent" } {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  const txt = `${m}m ${String(r).padStart(2, "0")}s até voltar p/ Matriz`;
  const pct = Math.min(100, Math.max(0, (clamped / WINDOW_MS) * 100));
  const tone = pct > 66 ? "ok" : pct > 33 ? "warn" : "urgent";
  return { txt, pct, tone };
}

function Page() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<Lead | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("leads")
      .select("id,nome,contato,origem,valor,criado_em,distribuido_em,dados,bloqueado")
      .eq("responsavel_id", uid)
      .eq("status_pipeline", "novo")
      .is("ultimo_atendimento_em", null)
      .or("bloqueado.is.null,bloqueado.eq.false")
      .order("distribuido_em", { ascending: true, nullsFirst: true })
      .limit(50);
    if (error) setErr(error.message);
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  async function assumir(l: Lead) {
    setBusy(l.id);
    const { data, error } = await supabase.rpc("assumir_lead", { p_lead_id: l.id });
    setBusy(null);
    if (error) { setErr(error.message); return; }
    const cotId = data as string | null;
    if (cotId) navigate({ to: "/venda/novo-lead", search: { id: cotId, step: 0 } });
    else navigate({ to: "/venda/pipeline" });
  }

  const total = leads.length;

  return (
    <AppShell title="Atender agora">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Atender agora</h1>
          <div className="sub">
            Leads distribuídos pela Matriz esperando sua reação — <strong>aja rápido ou eles voltam pra fila</strong>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}><use href="#i-kanban" /></svg> Ver pipeline
          </Link>
        </div>
      </div>

      {err && <div className="alert alert-err" style={{ marginBottom: 12 }}>{err}</div>}

      <div
        className="audit-note"
        style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 16 }}
      >
        <svg width={16} height={16}><use href="#i-bolt" /></svg>{" "}
        <strong style={{ marginRight: 4 }}>
          {total} {total === 1 ? "lead para tratar agora." : "leads para tratar agora."}
        </strong>{" "}
        Cada um tem 3 min desde a distribuição; sem reação, volta automaticamente para a Matriz e é redistribuído.
      </div>

      {loading ? (
        <div className="card"><div className="card-b">Carregando…</div></div>
      ) : total === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Nenhum lead aguardando atendimento 🎉
            </div>
            <div className="muted">Aguarde a Matriz distribuir novos leads ou crie um manualmente.</div>
          </div>
        </div>
      ) : (
        <div className="atender-grid">
          {leads.map((l) => {
            const start = new Date(l.distribuido_em ?? l.criado_em).getTime();
            const left = start + WINDOW_MS - now;
            const t = fmtTimer(left);
            const cls =
              t.tone === "urgent" ? "atender-card urgent" :
              t.tone === "warn" ? "atender-card warn" : "atender-card";
            const barColor =
              t.tone === "urgent" ? "var(--alert)" :
              t.tone === "warn" ? "var(--yellow)" : "var(--ok)";
            const txtColor = barColor;
            return (
              <div key={l.id} className={cls}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontSize: 15, color: "var(--slate)" }}>{l.nome || "Lead sem nome"}</strong>
                    <div className="small muted">{veiculoLabel(l.dados)}</div>
                  </div>
                  <span className="chip chip-yellow">
                    <svg width={11} height={11}><use href="#i-share" /></svg> Matriz
                  </span>
                </div>
                <div className="at-bar">
                  <div className="at-fill" style={{ width: `${t.pct}%`, background: barColor }} />
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ color: txtColor, fontWeight: 700, fontSize: 13 }}>
                    <svg width={12} height={12}><use href="#i-clock" /></svg> {t.txt}
                  </span>
                  <span className="small muted">{l.contato || "—"}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-yellow btn-sm"
                    style={{ flex: 1 }}
                    disabled={busy === l.id}
                    onClick={() => assumir(l)}
                  >
                    <svg width={13} height={13}><use href="#i-check" /></svg>{" "}
                    {busy === l.id ? "Iniciando…" : "Assumir e iniciar"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setView(l)}>
                    <svg width={13} height={13}><use href="#i-eye" /></svg> Ver lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
