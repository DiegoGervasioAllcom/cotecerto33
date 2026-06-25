import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações · CoteCerto" }] }),
  component: Page,
});

type Cfg = {
  meta_vendedor: number;
  meta_franquia: number;
  auditoria_comissoes: boolean;
  exigir_motivo_estorno: boolean;
  aprovacao_dupla_comissao: boolean;
  notif_sla_estourado: boolean;
  notif_venda_nao_paga: boolean;
  notif_renovacao_vencer: boolean;
  notif_resumo_diario: boolean;
};

type Integracao = { id: string; nome: string; descricao: string | null; status: string };
type RoleCount = { role: string; count: number };
type Seguradora = { id: string; nome: string; codigo: string | null; ativo: boolean; ordem: number };
type UserRow = {
  id: string;
  nome: string;
  email: string;
  status: string;
  empresa_id: string | null;
  empresa_nome?: string | null;
};

const DEFAULT_CFG: Cfg = {
  meta_vendedor: 14,
  meta_franquia: 48,
  auditoria_comissoes: true,
  exigir_motivo_estorno: true,
  aprovacao_dupla_comissao: false,
  notif_sla_estourado: true,
  notif_venda_nao_paga: true,
  notif_renovacao_vencer: true,
  notif_resumo_diario: false,
};

function Page() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<Cfg>(DEFAULT_CFG);
  const [dist, setDist] = useState<{ modo: string; automatico_on: boolean; sla_segundos: number } | null>(null);
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [segCount, setSegCount] = useState(0);
  const [segPreview, setSegPreview] = useState<string>("");
  const [roles, setRoles] = useState<RoleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "seguradoras" | "matriz" | "franqueado" | "vendedor">(null);

  async function load() {
    setLoading(true); setErr(null);
    const [c, d, ig, sg, rl] = await Promise.all([
      supabase.from("configuracoes_gerais").select("*").eq("id", "default").maybeSingle(),
      supabase.from("distribuicao_config").select("modo,automatico_on,sla_segundos").eq("id", "default").maybeSingle(),
      supabase.from("integracoes").select("id,nome,descricao,status").order("ordem"),
      supabase.from("seguradoras").select("nome", { count: "exact" }).eq("ativo", true).order("nome").limit(5),
      supabase.from("user_roles").select("role"),
    ]);
    if (c.data) {
      setCfg({
        meta_vendedor: c.data.meta_vendedor ?? 14,
        meta_franquia: c.data.meta_franquia ?? 48,
        auditoria_comissoes: !!c.data.auditoria_comissoes,
        exigir_motivo_estorno: !!c.data.exigir_motivo_estorno,
        aprovacao_dupla_comissao: !!c.data.aprovacao_dupla_comissao,
        notif_sla_estourado: !!c.data.notif_sla_estourado,
        notif_venda_nao_paga: !!c.data.notif_venda_nao_paga,
        notif_renovacao_vencer: !!c.data.notif_renovacao_vencer,
        notif_resumo_diario: !!c.data.notif_resumo_diario,
      });
    }
    if (d.data) setDist({ modo: d.data.modo, automatico_on: !!d.data.automatico_on, sla_segundos: d.data.sla_segundos });
    setIntegracoes((ig.data ?? []) as Integracao[]);
    setSegCount(sg.count ?? 0);
    setSegPreview(((sg.data ?? []) as { nome: string }[]).map((s) => s.nome).join(", "));
    const counts: Record<string, number> = {};
    ((rl.data ?? []) as { role: string }[]).forEach((r) => { counts[r.role] = (counts[r.role] ?? 0) + 1; });
    setRoles(Object.entries(counts).map(([role, count]) => ({ role, count })));
    setLoading(false);
    if (c.error) setErr(c.error.message);
  }

  useEffect(() => { void load(); }, []);

  async function update(patch: Partial<Cfg>, key: string) {
    setSavingKey(key);
    const next = { ...cfg, ...patch };
    setCfg(next);
    const { error } = await supabase.from("configuracoes_gerais").update(patch).eq("id", "default");
    if (error) { setErr(error.message); }
    setSavingKey(null);
  }

  const roleCount = (r: string) => roles.find((x) => x.role === r)?.count ?? 0;
  const modoLabel = dist?.modo === "regiao" ? "Automático por região"
    : dist?.modo === "performance" ? "Performance (vendedores disponíveis)"
    : dist?.modo === "fila" ? "Fila (round-robin)" : "—";

  return (
    <AppShell title="Configurações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <div className="sub">Regras, metas, perfis e integrações da operação Supper Certo</div>
        </div>
      </div>

      {err && <div className="card" style={{ borderColor: "#fecaca", background: "#fef2f2", marginBottom: 12 }}>
        <div className="card-b" style={{ color: "#991b1b" }}>{err}</div>
      </div>}

      <div className="detail-grid">
        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-share" /></svg> Distribuição de leads</h3></div>
            <div className="card-b">
              <p className="small muted" style={{ marginTop: 0 }}>
                Modo ativo: <strong>{modoLabel}</strong> · SLA de reação <strong>{Math.round((dist?.sla_segundos ?? 180) / 60)} min</strong>.
              </p>
              <button className="btn btn-ghost btn-sm" onClick={() => nav({ to: "/comando/distribuicao" })}>
                <svg width="13" height="13"><use href="#i-settings" /></svg> Abrir regras de distribuição
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-target" /></svg> Metas</h3></div>
            <div className="card-b">
              <div className="field-group">
                <label>Meta mensal padrão por vendedor (apólices)</label>
                <input className="input" type="number" min={0} value={cfg.meta_vendedor}
                  onChange={(e) => setCfg({ ...cfg, meta_vendedor: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_vendedor: cfg.meta_vendedor }, "meta_vendedor")}
                  disabled={loading} />
              </div>
              <div className="field-group">
                <label>Meta mensal padrão por franquia (apólices)</label>
                <input className="input" type="number" min={0} value={cfg.meta_franquia}
                  onChange={(e) => setCfg({ ...cfg, meta_franquia: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_franquia: cfg.meta_franquia }, "meta_franquia")}
                  disabled={loading} />
              </div>
              {savingKey?.startsWith("meta_") && <div className="small muted">Salvando…</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-lock" /></svg> Auditoria e segurança</h3></div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle title="Trava de auditoria em comissões"
                  desc="Registrar autor, data e valor anterior em toda alteração"
                  on={cfg.auditoria_comissoes}
                  onChange={(v) => update({ auditoria_comissoes: v }, "auditoria_comissoes")} />
                <Toggle title="Exigir motivo em estornos"
                  desc="Cancelamento só conclui com motivo preenchido"
                  on={cfg.exigir_motivo_estorno}
                  onChange={(v) => update({ exigir_motivo_estorno: v }, "exigir_motivo_estorno")} />
                <Toggle title="Aprovação dupla para ajuste de comissão"
                  desc="Alterações acima de R$ 500 exigem 2º aprovador"
                  on={cfg.aprovacao_dupla_comissao}
                  onChange={(v) => update({ aprovacao_dupla_comissao: v }, "aprovacao_dupla_comissao")} />
              </div>
            </div>
          </div>
        </div>

        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-users" /></svg> Perfis e usuários</h3></div>
            <div className="card-b">
              <div className="conf-section">
                <PerfilRow title="Matriz" desc="Acesso total · distribui, audita e remunera"
                  count={roleCount("matriz")} solid onClick={() => setModal("matriz")} />
                <PerfilRow title="Franqueado" desc="Vê a própria unidade e equipe"
                  count={roleCount("franqueado")} onClick={() => setModal("franqueado")} />
                <PerfilRow title="Vendedor" desc="Pipeline, cotação, proposta e extrato próprios"
                  count={roleCount("vendedor")} onClick={() => setModal("vendedor")} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-shield" /></svg> Integrações</h3></div>
            <div className="card-b">
              <div className="conf-section">
                {integracoes.map((i) => (
                  <div key={i.id} className="crit-row">
                    <div className="cr-body">
                      <div className="cr-t">{i.nome}</div>
                      <div className="cr-d">{i.descricao}</div>
                    </div>
                    <span className={`chip ${i.status === "conectado" ? "chip-ok" : "chip-outline"}`}>
                      {i.status === "conectado" ? "Conectado" : i.status === "desconectado" ? "Desconectado" : "Pendente"}
                    </span>
                  </div>
                ))}
                <div className="crit-row" style={{ cursor: "pointer" }} onClick={() => setModal("seguradoras")}>
                  <div className="cr-body">
                    <div className="cr-t">Seguradoras ({segCount})</div>
                    <div className="cr-d">{segPreview || "Nenhuma cadastrada"}</div>
                  </div>
                  <span className="chip chip-ok">Gerenciar</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-bell" /></svg> Notificações</h3></div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle title="SLA estourado" desc="Avisar a Matriz quando um lead voltar para a fila"
                  on={cfg.notif_sla_estourado}
                  onChange={(v) => update({ notif_sla_estourado: v }, "notif_sla_estourado")} />
                <Toggle title="Venda não paga" desc="Alertar após 7 dias sem baixa financeira"
                  on={cfg.notif_venda_nao_paga}
                  onChange={(v) => update({ notif_venda_nao_paga: v }, "notif_venda_nao_paga")} />
                <Toggle title="Renovação a vencer" desc="Lembrete 60 dias antes do vencimento"
                  on={cfg.notif_renovacao_vencer}
                  onChange={(v) => update({ notif_renovacao_vencer: v }, "notif_renovacao_vencer")} />
                <Toggle title="Resumo diário por e-mail" desc="Enviar consolidado às 8h"
                  on={cfg.notif_resumo_diario}
                  onChange={(v) => update({ notif_resumo_diario: v }, "notif_resumo_diario")} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal === "seguradoras" && <SeguradorasModal onClose={() => { setModal(null); void load(); }} />}
      {modal === "matriz" && <UsuariosModal role="matriz" title="Usuários · Matriz" onClose={() => setModal(null)} />}
      {modal === "franqueado" && <UsuariosModal role="franqueado" title="Usuários · Franqueados" onClose={() => setModal(null)} />}
      {modal === "vendedor" && <UsuariosModal role="vendedor" title="Usuários · Vendedores" onClose={() => setModal(null)} />}
    </AppShell>
  );
}

function Toggle({ title, desc, on, onChange }: { title: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="crit-row">
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <div className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
        <span className="track" />
      </div>
    </div>
  );
}

function PerfilRow({ title, desc, count, solid, onClick }: { title: string; desc: string; count: number; solid?: boolean; onClick?: () => void }) {
  return (
    <div className="crit-row" style={onClick ? { cursor: "pointer" } : undefined} onClick={onClick}>
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <span className={`chip ${solid ? "chip-slate" : "chip-outline"}`}>{count} {count === 1 ? "usuário" : "usuários"}</span>
    </div>
  );
}

/* ============== MODAIS ============== */

function ModalShell({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-host" onClick={onClose}>
      <div className={`modal ${wide ? "lg" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">✕</div>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

function SeguradorasModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Seguradora[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [nova, setNova] = useState({ nome: "", codigo: "" });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("seguradoras").select("id,nome,codigo,ativo,ordem").order("ordem").order("nome");
    if (error) setErr(error.message);
    setRows((data ?? []) as Seguradora[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!nova.nome.trim()) return;
    setBusy(true); setErr(null);
    const ordem = (rows.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase.from("seguradoras").insert({ nome: nova.nome.trim(), codigo: nova.codigo.trim() || null, ordem });
    if (error) setErr(error.message);
    setNova({ nome: "", codigo: "" });
    setBusy(false);
    void load();
  }

  async function toggle(r: Seguradora) {
    const { error } = await supabase.from("seguradoras").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function rename(r: Seguradora, nome: string) {
    if (nome === r.nome) return;
    const { error } = await supabase.from("seguradoras").update({ nome }).eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function remove(r: Seguradora) {
    if (!confirm(`Remover ${r.nome}?`)) return;
    const { error } = await supabase.from("seguradoras").delete().eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  return (
    <ModalShell title="Gerenciar seguradoras" onClose={onClose} wide>
      {err && <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 14 }}>
        <input className="input" placeholder="Nome da seguradora" value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />
        <input className="input" placeholder="Código (opcional)" value={nova.codigo} onChange={(e) => setNova({ ...nova, codigo: e.target.value })} />
        <button className="btn btn-primary" onClick={add} disabled={busy || !nova.nome.trim()}>Adicionar</button>
      </div>
      {loading ? <div className="muted small">Carregando…</div> : (
        <table className="table">
          <thead><tr><th>Nome</th><th>Código</th><th>Status</th><th style={{ width: 120 }}>Ações</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input className="input" defaultValue={r.nome} onBlur={(e) => rename(r, e.target.value)} />
                </td>
                <td className="muted">{r.codigo ?? "—"}</td>
                <td>
                  <span className={`chip ${r.ativo ? "chip-ok" : "chip-outline"}`} onClick={() => toggle(r)} style={{ cursor: "pointer" }}>
                    {r.ativo ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Remover</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted small">Nenhuma seguradora cadastrada.</td></tr>}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}

function UsuariosModal({ role, title, onClose }: { role: "matriz" | "franqueado" | "vendedor"; title: string; onClose: () => void }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ur = await supabase.from("user_roles").select("user_id").eq("role", role);
      if (ur.error) { setErr(ur.error.message); setLoading(false); return; }
      const ids = (ur.data ?? []).map((x: { user_id: string }) => x.user_id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }
      const pr = await supabase.from("profiles").select("id,nome,email,status,empresa_id").in("id", ids);
      if (pr.error) { setErr(pr.error.message); setLoading(false); return; }
      const empIds = Array.from(new Set((pr.data ?? []).map((p: { empresa_id: string | null }) => p.empresa_id).filter(Boolean))) as string[];
      let empMap: Record<string, string> = {};
      if (empIds.length) {
        const em = await supabase.from("empresas").select("id,nome").in("id", empIds);
        empMap = Object.fromEntries((em.data ?? []).map((e: { id: string; nome: string }) => [e.id, e.nome]));
      }
      setRows((pr.data ?? []).map((p: { id: string; nome: string; email: string; status: string; empresa_id: string | null }) => ({
        ...p,
        empresa_nome: p.empresa_id ? empMap[p.empresa_id] ?? null : null,
      })));
      setLoading(false);
    })();
  }, [role]);

  return (
    <ModalShell title={title} onClose={onClose} wide>
      {err && <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>{err}</div>}
      {loading ? <div className="muted small">Carregando…</div> : (
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              {role !== "matriz" && <th>{role === "franqueado" ? "Franquia" : "Unidade"}</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.nome || "—"}</td>
                <td className="muted">{u.email}</td>
                {role !== "matriz" && <td>{u.empresa_nome ?? "—"}</td>}
                <td>
                  <span className={`chip ${u.status === "ativo" ? "chip-ok" : u.status === "pendente" ? "chip-warn" : "chip-outline"}`}>
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={role === "matriz" ? 3 : 4} className="muted small">Nenhum usuário com este perfil.</td></tr>}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}
