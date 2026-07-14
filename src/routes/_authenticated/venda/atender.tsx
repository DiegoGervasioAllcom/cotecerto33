import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { veiculoLabel } from "@/lib/veiculo";

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
  bloqueado: boolean | null;
};

const WINDOW_MS = 3 * 60 * 1000; // 3 min

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
  const leadsRef = useRef<Lead[]>([]);
  const firedRef = useRef<Set<string>>(new Set());
  const expiringRef = useRef(false);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .select("id,nome,contato,origem,valor,criado_em,distribuido_em,dados,bloqueado")
      .eq("responsavel_id", uid)
      .eq("status_pipeline", "novo")
      .not("arquivado", "is", true)
      .is("ultimo_atendimento_em", null)
      .order("distribuido_em", { ascending: true, nullsFirst: true })
      .limit(50);
    if (error) setErr(error.message);
    const list = (data ?? []) as Lead[];
    leadsRef.current = list;
    setLeads(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    tickRef.current = setInterval(() => {
      const n = Date.now();
      setNow(n);
      // A devolução à Matriz é feita pelo servidor (pg_cron + trigger).
      // O frontend apenas reflete o tempo e recarrega quando o SLA estoura,
      // para remover o card que já foi devolvido do lado do banco.
      const expirou = leadsRef.current.some((l) => {
        if (firedRef.current.has(l.id)) return false;
        if (l.bloqueado) return false;
        const start = new Date(l.distribuido_em ?? l.criado_em).getTime();
        return start + WINDOW_MS - n <= 0;
      });
      if (!expirou || expiringRef.current) return;
      leadsRef.current.forEach((l) => {
        if (!l.bloqueado) firedRef.current.add(l.id);
      });
      expiringRef.current = true;
      (async () => {
        try {
          await load();
        } finally {
          expiringRef.current = false;
        }
      })();
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  async function assumir(l: Lead) {
    setBusy(l.id);
    const { data, error } = await supabase.rpc("assumir_lead", { p_lead_id: l.id });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
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
            Leads distribuídos pela Matriz esperando sua reação —{" "}
            <strong>aja rápido ou eles voltam pra fila</strong>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Ver pipeline
          </Link>
        </div>
      </div>

      {err && (
        <div className="alert alert-err" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      <div
        className="audit-note"
        style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 16 }}
      >
        <svg width={16} height={16}>
          <use href="#i-bolt" />
        </svg>{" "}
        <strong style={{ marginRight: 4 }}>
          {total} {total === 1 ? "lead para tratar agora." : "leads para tratar agora."}
        </strong>{" "}
        Cada um tem 3 min desde a distribuição; sem reação, volta automaticamente para a Matriz e é
        redistribuído.
      </div>

      {loading ? (
        <div className="card">
          <div className="card-b">Carregando…</div>
        </div>
      ) : total === 0 ? (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Nenhum lead aguardando atendimento 🎉
            </div>
            <div className="muted">
              Aguarde a Matriz distribuir novos leads ou crie um manualmente.
            </div>
          </div>
        </div>
      ) : (
        <div className="atender-grid">
          {leads.map((l) => {
            const blocked = !!l.bloqueado;
            const start = new Date(l.distribuido_em ?? l.criado_em).getTime();
            const left = start + WINDOW_MS - now;
            const t = fmtTimer(left);
            const cls = blocked
              ? "atender-card"
              : t.tone === "urgent"
                ? "atender-card urgent"
                : t.tone === "warn"
                  ? "atender-card warn"
                  : "atender-card";
            const barColor = blocked
              ? "var(--muted)"
              : t.tone === "urgent"
                ? "var(--alert)"
                : t.tone === "warn"
                  ? "var(--yellow)"
                  : "var(--ok)";
            const txtColor = barColor;
            return (
              <div key={l.id} className={cls} style={blocked ? { opacity: 0.85 } : undefined}>
                <div
                  className="row"
                  style={{ justifyContent: "space-between", alignItems: "flex-start" }}
                >
                  <div>
                    <strong style={{ fontSize: 15, color: "var(--slate)" }}>
                      {l.nome || "Lead sem nome"}
                    </strong>
                    <div className="small muted">{veiculoLabel(l.dados)}</div>
                  </div>
                  {blocked ? (
                    <span className="chip chip-red">
                      <svg width={11} height={11}>
                        <use href="#i-lock" />
                      </svg>{" "}
                      Bloqueado
                    </span>
                  ) : (
                    <span className="chip chip-yellow">
                      <svg width={11} height={11}>
                        <use href="#i-share" />
                      </svg>{" "}
                      Matriz
                    </span>
                  )}
                </div>
                <div className="at-bar">
                  <div
                    className="at-fill"
                    style={{ width: blocked ? "100%" : `${t.pct}%`, background: barColor }}
                  />
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span style={{ color: txtColor, fontWeight: 700, fontSize: 13 }}>
                    <svg width={12} height={12}>
                      <use href={blocked ? "#i-lock" : "#i-clock"} />
                    </svg>{" "}
                    {blocked ? "SLA pausado — aguardando desbloqueio pela Matriz" : t.txt}
                  </span>
                  <span className="small muted">{l.contato || "—"}</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-yellow btn-sm"
                    style={{ flex: 1 }}
                    disabled={busy === l.id || blocked}
                    title={blocked ? "Lead bloqueado — solicite o desbloqueio à Matriz" : undefined}
                    onClick={() => !blocked && assumir(l)}
                  >
                    <svg width={13} height={13}>
                      <use href={blocked ? "#i-lock" : "#i-check"} />
                    </svg>{" "}
                    {blocked ? "Bloqueado" : busy === l.id ? "Iniciando…" : "Assumir e iniciar"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={blocked}
                    title={blocked ? "Indisponível enquanto bloqueado" : undefined}
                    onClick={() => !blocked && setView(l)}
                  >
                    <svg width={13} height={13}>
                      <use href="#i-eye" />
                    </svg>{" "}
                    Ver lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && <VerLeadModal lead={view} onClose={() => setView(null)} />}
    </AppShell>
  );
}

function VerLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const d = (lead.dados ?? {}) as Record<string, unknown>;
  const cliente = (d.cliente ?? {}) as Record<string, unknown>;
  const endereco = (d.endereco ?? {}) as Record<string, unknown>;
  const veic = (d.veiculo ?? {}) as Record<string, unknown>;
  function row(label: string, value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 0",
          borderBottom: "1px dashed var(--border)",
        }}
      >
        <span className="small muted">{label}</span>
        <strong className="small" style={{ textAlign: "right" }}>
          {String(value)}
        </strong>
      </div>
    );
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>
            <svg width={16} height={16}>
              <use href="#i-eye" />
            </svg>{" "}
            Ver lead — {lead.nome || "—"}
          </h3>
          <button className="ic-mini" onClick={onClose} title="Fechar">
            <svg width={14} height={14}>
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="modal-b">
          <div className="alert alert-info" style={{ marginBottom: 12 }}>
            <svg width={14} height={14}>
              <use href="#i-info" />
            </svg>{" "}
            Modo somente leitura. Para interagir com o lead, clique em{" "}
            <strong>Assumir e iniciar</strong>.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <h4 style={{ margin: "0 0 6px" }}>Cliente</h4>
              {row("Nome", lead.nome)}
              {row("Contato", lead.contato)}
              {row("CPF/CNPJ", cliente.cpf_cnpj ?? cliente.documento)}
              {row("E-mail", cliente.email)}
              {row("Origem", lead.origem)}
            </div>
            <div>
              <h4 style={{ margin: "0 0 6px" }}>Endereço</h4>
              {row("CEP", endereco.cep)}
              {row("Logradouro", endereco.logradouro)}
              {row("Bairro", endereco.bairro)}
              {row("Cidade/UF", [endereco.cidade, endereco.uf].filter(Boolean).join("/"))}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <h4 style={{ margin: "0 0 6px" }}>Veículo</h4>
              {row("Marca", veic.marca_nome ?? veic.marca)}
              {row("Modelo", veic.modelo_nome ?? veic.modelo)}
              {row("Ano", veic.ano_modelo ?? veic.ano)}
              {row("Placa", veic.placa)}
              {row("Cor", veic.cor)}
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
