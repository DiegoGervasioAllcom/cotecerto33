import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminDeleteUser } from "@/lib/admin-users.functions";
import { seguradoraSchema } from "@/lib/schemas/catalogos.schema";
import { email as emailSchema, password as passwordSchema } from "@/lib/schemas/common";
import { z } from "zod";

const nomeUsuarioSchema = z.string().trim().min(1, "Informe o nome.").max(150, "Nome muito longo.");

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
type Seguradora = {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
  ordem: number;
};
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
  const [dist, setDist] = useState<{
    modo: string;
    automatico_on: boolean;
    sla_segundos: number;
  } | null>(null);
  const [integracoes, setIntegracoes] = useState<Integracao[]>([]);
  const [segCount, setSegCount] = useState(0);
  const [segPreview, setSegPreview] = useState<string>("");
  const [roles, setRoles] = useState<RoleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<
    null | "seguradoras" | "matriz" | "franqueado" | "vendedor" | "todos"
  >(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const [c, d, ig, sg, rl] = await Promise.all([
      supabase.from("configuracoes_gerais").select("*").eq("id", "default").maybeSingle(),
      supabase
        .from("distribuicao_config")
        .select("modo,automatico_on,sla_segundos")
        .eq("id", "default")
        .maybeSingle(),
      supabase.from("integracoes").select("id,nome,descricao,status").order("ordem"),
      supabase
        .from("seguradoras")
        .select("nome", { count: "exact" })
        .eq("ativo", true)
        .order("nome")
        .limit(5),
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
    if (d.data)
      setDist({
        modo: d.data.modo,
        automatico_on: !!d.data.automatico_on,
        sla_segundos: d.data.sla_segundos,
      });
    setIntegracoes((ig.data ?? []) as Integracao[]);
    setSegCount(sg.count ?? 0);
    setSegPreview(((sg.data ?? []) as { nome: string }[]).map((s) => s.nome).join(", "));
    const counts: Record<string, number> = {};
    ((rl.data ?? []) as { role: string }[]).forEach((r) => {
      counts[r.role] = (counts[r.role] ?? 0) + 1;
    });
    setRoles(Object.entries(counts).map(([role, count]) => ({ role, count })));
    setLoading(false);
    if (c.error) setErr(c.error.message);
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(patch: Partial<Cfg>, key: string) {
    setSavingKey(key);
    const next = { ...cfg, ...patch };
    setCfg(next);
    const { error } = await supabase.from("configuracoes_gerais").update(patch).eq("id", "default");
    if (error) {
      setErr(error.message);
    }
    setSavingKey(null);
  }

  const roleCount = (r: string) => {
    if (r === "franqueado")
      return (
        (roles.find((x) => x.role === "franqueado")?.count ?? 0) +
        (roles.find((x) => x.role === "master")?.count ?? 0)
      );
    return roles.find((x) => x.role === r)?.count ?? 0;
  };
  const modoLabel =
    dist?.modo === "regiao"
      ? "Automático por região"
      : dist?.modo === "performance"
        ? "Performance (vendedores disponíveis)"
        : dist?.modo === "fila"
          ? "Fila (round-robin)"
          : "—";

  return (
    <AppShell title="Configurações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <div className="sub">Regras, metas, perfis e integrações da operação Supper Certo</div>
        </div>
      </div>

      {err && (
        <div
          className="card"
          style={{ borderColor: "#fecaca", background: "#fef2f2", marginBottom: 12 }}
        >
          <div className="card-b" style={{ color: "#991b1b" }}>
            {err}
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-share" />
                </svg>{" "}
                Distribuição de leads
              </h3>
            </div>
            <div className="card-b">
              <p className="small muted" style={{ marginTop: 0 }}>
                Modo ativo: <strong>{modoLabel}</strong> · SLA de reação{" "}
                <strong>{Math.round((dist?.sla_segundos ?? 180) / 60)} min</strong>.
              </p>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => nav({ to: "/comando/distribuicao" })}
              >
                <svg width="13" height="13">
                  <use href="#i-settings" />
                </svg>{" "}
                Abrir regras de distribuição
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-target" />
                </svg>{" "}
                Metas
              </h3>
            </div>
            <div className="card-b">
              <div className="field-group">
                <label>Meta mensal padrão por vendedor (apólices)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={cfg.meta_vendedor}
                  onChange={(e) => setCfg({ ...cfg, meta_vendedor: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_vendedor: cfg.meta_vendedor }, "meta_vendedor")}
                  disabled={loading}
                />
              </div>
              <div className="field-group">
                <label>Meta mensal padrão por franquia (apólices)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={cfg.meta_franquia}
                  onChange={(e) => setCfg({ ...cfg, meta_franquia: Number(e.target.value || 0) })}
                  onBlur={() => update({ meta_franquia: cfg.meta_franquia }, "meta_franquia")}
                  disabled={loading}
                />
              </div>
              {savingKey?.startsWith("meta_") && <div className="small muted">Salvando…</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-lock" />
                </svg>{" "}
                Auditoria e segurança
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle
                  title="Trava de auditoria em comissões"
                  desc="Registrar autor, data e valor anterior em toda alteração"
                  on={cfg.auditoria_comissoes}
                  onChange={(v) => update({ auditoria_comissoes: v }, "auditoria_comissoes")}
                />
                <Toggle
                  title="Exigir motivo em estornos"
                  desc="Cancelamento só conclui com motivo preenchido"
                  on={cfg.exigir_motivo_estorno}
                  onChange={(v) => update({ exigir_motivo_estorno: v }, "exigir_motivo_estorno")}
                />
                <Toggle
                  title="Aprovação dupla para ajuste de comissão"
                  desc="Alterações acima de R$ 500 exigem 2º aprovador"
                  on={cfg.aprovacao_dupla_comissao}
                  onChange={(v) =>
                    update({ aprovacao_dupla_comissao: v }, "aprovacao_dupla_comissao")
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-users" />
                </svg>{" "}
                Perfis e usuários
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <PerfilRow
                  title="Matriz"
                  desc="Acesso total · distribui, audita e remunera"
                  count={roleCount("matriz")}
                  solid
                  onClick={() => setModal("matriz")}
                />
                <PerfilRow
                  title="Franqueado"
                  desc="Vê a própria unidade e equipe"
                  count={roleCount("franqueado")}
                  onClick={() => setModal("franqueado")}
                />
                <PerfilRow
                  title="Vendedor"
                  desc="Pipeline, cotação, proposta e extrato próprios"
                  count={roleCount("vendedor")}
                  onClick={() => setModal("vendedor")}
                />
                <PerfilRow
                  title="Todos os usuários"
                  desc="Lista central: usuário, tipo, supervisão e status"
                  count={roles.reduce((acc, r) => acc + r.count, 0)}
                  onClick={() => setModal("todos")}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-shield" />
                </svg>{" "}
                Integrações
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                {integracoes.map((i) => (
                  <div key={i.id} className="crit-row">
                    <div className="cr-body">
                      <div className="cr-t">{i.nome}</div>
                      <div className="cr-d">{i.descricao}</div>
                    </div>
                    <span
                      className={`chip ${i.status === "conectado" ? "chip-ok" : "chip-outline"}`}
                    >
                      {i.status === "conectado"
                        ? "Conectado"
                        : i.status === "desconectado"
                          ? "Desconectado"
                          : "Pendente"}
                    </span>
                  </div>
                ))}
                <div
                  className="crit-row"
                  style={{ cursor: "pointer" }}
                  onClick={() => setModal("seguradoras")}
                >
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
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-bell" />
                </svg>{" "}
                Notificações
              </h3>
            </div>
            <div className="card-b">
              <div className="conf-section">
                <Toggle
                  title="SLA estourado"
                  desc="Avisar a Matriz quando um lead voltar para a fila"
                  on={cfg.notif_sla_estourado}
                  onChange={(v) => update({ notif_sla_estourado: v }, "notif_sla_estourado")}
                />
                <Toggle
                  title="Venda não paga"
                  desc="Alertar após 7 dias sem baixa financeira"
                  on={cfg.notif_venda_nao_paga}
                  onChange={(v) => update({ notif_venda_nao_paga: v }, "notif_venda_nao_paga")}
                />
                <Toggle
                  title="Renovação a vencer"
                  desc="Lembrete 60 dias antes do vencimento"
                  on={cfg.notif_renovacao_vencer}
                  onChange={(v) => update({ notif_renovacao_vencer: v }, "notif_renovacao_vencer")}
                />
                <Toggle
                  title="Resumo diário por e-mail"
                  desc="Enviar consolidado às 8h"
                  on={cfg.notif_resumo_diario}
                  onChange={(v) => update({ notif_resumo_diario: v }, "notif_resumo_diario")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {modal === "seguradoras" && (
        <SeguradorasModal
          onClose={() => {
            setModal(null);
            void load();
          }}
        />
      )}
      {modal === "matriz" && (
        <UsuariosModal role="matriz" title="Usuários · Matriz" onClose={() => setModal(null)} />
      )}
      {modal === "franqueado" && (
        <UsuariosModal
          role="franqueado"
          title="Usuários · Franqueados"
          onClose={() => setModal(null)}
        />
      )}
      {modal === "vendedor" && (
        <UsuariosModal
          role="vendedor"
          title="Usuários · Vendedores"
          onClose={() => setModal(null)}
        />
      )}
      {modal === "todos" && <UsuariosSistemaModal onClose={() => setModal(null)} />}
    </AppShell>
  );
}

function Toggle({
  title,
  desc,
  on,
  onChange,
}: {
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="crit-row">
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <div
        className={`switch ${on ? "on" : ""}`}
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
      >
        <span className="track" />
      </div>
    </div>
  );
}

function PerfilRow({
  title,
  desc,
  count,
  solid,
  onClick,
}: {
  title: string;
  desc: string;
  count: number;
  solid?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="crit-row" style={onClick ? { cursor: "pointer" } : undefined} onClick={onClick}>
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <span className={`chip ${solid ? "chip-slate" : "chip-outline"}`}>
        {count} {count === 1 ? "usuário" : "usuários"}
      </span>
    </div>
  );
}

/* ============== MODAIS ============== */

function ModalShell({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-host" onClick={onClose}>
      <div className={`modal ${wide ? "lg" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            ✕
          </div>
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
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativa" | "inativa">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("seguradoras")
      .select("id,nome,codigo,ativo,ordem")
      .order("ordem")
      .order("nome");
    if (error) setErr(error.message);
    setRows((data ?? []) as Seguradora[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    const r = seguradoraSchema.safeParse(nova);
    if (!r.success) {
      setErr(r.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ordem = (rows.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase
      .from("seguradoras")
      .insert({ nome: r.data.nome, codigo: r.data.codigo?.trim() || null, ordem });
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
    if (nome === r.nome || !nome.trim()) return;
    const check = seguradoraSchema.shape.nome.safeParse(nome);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    const { error } = await supabase
      .from("seguradoras")
      .update({ nome: check.data })
      .eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function updateCodigo(r: Seguradora, codigo: string) {
    const novo = codigo.trim() || null;
    if (novo === r.codigo) return;
    const check = seguradoraSchema.shape.codigo.safeParse(codigo);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Código inválido.");
      return;
    }
    const { error } = await supabase.from("seguradoras").update({ codigo: novo }).eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function remove(r: Seguradora) {
    if (!confirm(`Remover ${r.nome}?`)) return;
    const { error } = await supabase.from("seguradoras").delete().eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  const filtered = rows.filter((r) => {
    if (statusFilter === "ativa" && !r.ativo) return false;
    if (statusFilter === "inativa" && r.ativo) return false;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      if (!r.nome.toLowerCase().includes(t) && !(r.codigo ?? "").toLowerCase().includes(t))
        return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const ativas = rows.filter((r) => r.ativo).length;

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  return (
    <ModalShell title="Gerenciar seguradoras" onClose={onClose} wide>
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="muted small" style={{ marginRight: "auto" }}>
          <strong style={{ color: "#0f172a" }}>{rows.length}</strong> seguradoras · {ativas}{" "}
          ativa(s)
        </div>
        <input
          className="input"
          placeholder="Buscar por nome ou código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 260 }}
        />
        <div style={{ display: "inline-flex", gap: 4 }}>
          {(["all", "ativa", "inativa"] as const).map((s) => (
            <button
              key={s}
              className={`chip ${statusFilter === s ? "chip-ok" : "chip-outline"}`}
              onClick={() => setStatusFilter(s)}
              style={{ cursor: "pointer", textTransform: "capitalize" }}
            >
              {s === "all" ? "Todas" : s}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          background: "#f8fafc",
          marginBottom: 14,
        }}
      >
        <div className="small muted" style={{ marginBottom: 6, fontWeight: 600 }}>
          Adicionar nova seguradora
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
          <input
            className="input"
            placeholder="Nome da seguradora"
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            maxLength={150}
          />
          <input
            className="input"
            placeholder="Código (opcional)"
            value={nova.codigo}
            onChange={(e) => setNova({ ...nova, codigo: e.target.value })}
            maxLength={30}
          />
          <button className="btn btn-primary" onClick={add} disabled={busy || !nova.nome.trim()}>
            Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : (
        <>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <table className="table" style={{ margin: 0 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ width: 48, textAlign: "center" }}>#</th>
                  <th>Nome</th>
                  <th style={{ width: 160 }}>Código</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 110, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted small" style={{ textAlign: "center" }}>
                      {(pageSafe - 1) * pageSize + i + 1}
                    </td>
                    <td>
                      <input
                        className="input"
                        defaultValue={r.nome}
                        onBlur={(e) => rename(r, e.target.value)}
                        maxLength={150}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        defaultValue={r.codigo ?? ""}
                        placeholder="—"
                        onBlur={(e) => updateCodigo(r, e.target.value)}
                        maxLength={30}
                      />
                    </td>
                    <td>
                      <span
                        className={`chip ${r.ativo ? "chip-ok" : "chip-outline"}`}
                        onClick={() => toggle(r)}
                        style={{ cursor: "pointer" }}
                      >
                        {r.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(r)}
                        style={{ color: "#b91c1c" }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="muted small"
                      style={{ textAlign: "center", padding: 24 }}
                    >
                      {filtered.length === 0
                        ? "Nenhuma seguradora encontrada."
                        : "Nenhum resultado nesta página."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <div className="muted small">
              Mostrando {pageRows.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1}–
              {(pageSafe - 1) * pageSize + pageRows.length} de {filtered.length}
            </div>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={pageSafe <= 1}
                onClick={() => setPage(pageSafe - 1)}
              >
                ← Anterior
              </button>
              <span className="small muted">
                Página {pageSafe} de {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage(pageSafe + 1)}
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}

type UserFull = UserRow & { desligado_em: string | null; roles: string[] };
type Empresa = { id: string; nome: string; tipo: string };

function UsuariosModal({
  role,
  title,
  onClose,
}: {
  role: "matriz" | "franqueado" | "vendedor";
  title: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<UserFull[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<UserFull | null>(null);
  const [creating, setCreating] = useState(false);

  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);

  const targetRoles: ("matriz" | "master" | "vendedor" | "franqueado")[] =
    role === "franqueado" ? ["franqueado", "master"] : [role];

  async function load() {
    setLoading(true);
    setErr(null);
    const ur = await supabase.from("user_roles").select("user_id,role").in("role", targetRoles);
    if (ur.error) {
      setErr(ur.error.message);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((ur.data ?? []).map((x: { user_id: string }) => x.user_id)));
    const rolesByUser: Record<string, string[]> = {};
    (ur.data ?? []).forEach((x: { user_id: string; role: string }) => {
      (rolesByUser[x.user_id] ||= []).push(x.role);
    });

    const [em, pr] = await Promise.all([
      supabase.from("empresas").select("id,nome,tipo").order("nome"),
      ids.length
        ? supabase
            .from("profiles")
            .select("id,nome,email,status,empresa_id,desligado_em")
            .in("id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setEmpresas((em.data ?? []) as Empresa[]);
    const empMap = Object.fromEntries(((em.data ?? []) as Empresa[]).map((e) => [e.id, e.nome]));
    setRows(
      (pr.data ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        status: p.status,
        empresa_id: p.empresa_id,
        empresa_nome: p.empresa_id ? (empMap[p.empresa_id] ?? null) : null,
        desligado_em: p.desligado_em,
        roles: rolesByUser[p.id] ?? [],
      })),
    );
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [role]);

  async function toggleAtivo(u: UserFull) {
    const ativo = !!u.desligado_em; // se já está desligado → reativar
    const motivo = !ativo ? (prompt("Motivo da desativação (opcional):") ?? null) : null;
    const { error } = await supabase.rpc("admin_set_usuario_status", {
      p_user_id: u.id,
      p_ativo: ativo,
      p_motivo: motivo ?? undefined,
    });
    if (error) setErr(error.message);
    void load();
  }

  async function remover(u: UserFull) {
    if (!confirm(`Excluir definitivamente ${u.nome || u.email}? Esta ação é irreversível.`)) return;
    const { data: sess } = await supabase.auth.getSession();
    try {
      await deleteFn({ data: { user_id: u.id, caller_token: sess.session?.access_token ?? "" } });
      void load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const empresasFiltradas =
    role === "franqueado" ? empresas.filter((e) => e.tipo !== "matriz") : empresas;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted small" style={{ marginRight: "auto" }}>
            {rows.length} usuário(s)
          </span>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Novo usuário
          </button>
        </>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : (
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              {role !== "matriz" && <th>{role === "franqueado" ? "Franquia" : "Unidade"}</th>}
              <th>Status</th>
              <th style={{ width: 200, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const desligado = !!u.desligado_em;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nome || "—"}</strong>
                  </td>
                  <td className="muted">{u.email}</td>
                  {role !== "matriz" && <td>{u.empresa_nome ?? "—"}</td>}
                  <td>
                    <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                      {desligado ? "Desativado" : "Ativo"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleAtivo(u)}
                      style={{ marginLeft: 6 }}
                    >
                      {desligado ? "Reativar" : "Desativar"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => remover(u)}
                      style={{ marginLeft: 6, color: "#b91c1c" }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={role === "matriz" ? 4 : 5}
                  className="muted small"
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Nenhum usuário com este perfil.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {edit && (
        <EditUserModal
          user={edit}
          empresas={empresasFiltradas}
          role={role}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void load();
          }}
        />
      )}
      {creating && (
        <CreateUserModal
          role={role}
          empresas={empresasFiltradas}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
          createFn={async (payload) => {
            const { data: sess } = await supabase.auth.getSession();
            return createFn({
              data: { ...payload, caller_token: sess.session?.access_token ?? "" },
            });
          }}
        />
      )}
    </ModalShell>
  );
}

// Lista central "Usuários do sistema" (G1.5 — MAPA seção 5): usuário · tipo ·
// supervisão · status, com todos os perfis lado a lado e filtro por tipo/status.
// Read-only: edição/desativação seguem pelos modais por perfil (UsuariosModal).
type SistemaRole = "matriz" | "master" | "vendedor" | "franqueado" | "supervisor";

const TIPO_CHIP_CLASS: Record<string, string> = {
  Matriz: "chip-outline",
  "Supervisor (Matriz)": "chip-slate",
  "Master franqueado": "chip-yellow",
  "Franquia (Full)": "chip-info",
  "Franquia (Individual)": "chip-info",
  "Vendedor CLT": "chip-outline",
  "Vendedor de franquia": "chip-outline",
};

type UsuarioSistema = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string | null;
  role: SistemaRole;
  tipoLabel: string;
  supervisaoLabel: string;
};

function UsuariosSistemaModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      const ur = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("role", ["matriz", "master", "vendedor", "franqueado", "supervisor"])
        // ordem explícita: torna determinístico o role escolhido no raro caso de
        // múltiplos vínculos para o mesmo usuário (hoje é 1:1 na prática).
        .order("user_id", { ascending: true })
        .order("role", { ascending: true });
      if (ur.error) {
        setErr(ur.error.message);
        setLoading(false);
        return;
      }
      const roleByUser: Record<string, SistemaRole> = {};
      (ur.data ?? []).forEach((x) => {
        // um usuário pode ter mais de um vínculo histórico; mantém o primeiro
        // (determinístico pela ordenação da query acima).
        roleByUser[x.user_id] ??= x.role as SistemaRole;
      });
      const ids = Object.keys(roleByUser);
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      const [pr, em, mf] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nome,email,empresa_id,superior_id,desligado_em")
          .in("id", ids),
        supabase.from("empresas").select("id,tipo,modelo_id"),
        supabase.from("modelos_franquia").select("id,nome,modalidade"),
      ]);
      if (pr.error) {
        setErr(pr.error.message);
        setLoading(false);
        return;
      }
      type ProfileLite = {
        id: string;
        nome: string;
        email: string;
        empresa_id: string | null;
        superior_id: string | null;
        desligado_em: string | null;
      };
      const profiles = (pr.data ?? []) as ProfileLite[];
      const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
      const empresaById = Object.fromEntries(
        ((em.data ?? []) as { id: string; tipo: string; modelo_id: string | null }[]).map((e) => [
          e.id,
          e,
        ]),
      );
      const modeloModalidadeById = Object.fromEntries(
        ((mf.data ?? []) as { id: string; nome: string; modalidade: string | null }[]).map((m) => [
          m.id,
          m.modalidade,
        ]),
      );

      function tipoLabel(p: ProfileLite, role: SistemaRole): string {
        if (role === "matriz") return "Matriz";
        if (role === "supervisor") return "Supervisor (Matriz)";
        if (role === "master") return "Master franqueado";
        if (role === "franqueado") {
          const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
          const modalidade = emp?.modelo_id ? modeloModalidadeById[emp.modelo_id] : null;
          return modalidade === "full" ? "Franquia (Full)" : "Franquia (Individual)";
        }
        // vendedor: empresa vinculada com tipo 'pj' (franquia real) → de franquia; senão CLT
        const emp = p.empresa_id ? empresaById[p.empresa_id] : undefined;
        return emp?.tipo === "pj" ? "Vendedor de franquia" : "Vendedor CLT";
      }

      function supervisaoLabel(p: ProfileLite, role: SistemaRole): string {
        if (role === "matriz") return "—";
        if (!p.superior_id) return "Matriz";
        return profileById[p.superior_id]?.nome ?? "—";
      }

      setRows(
        ids.map((id) => {
          const p = profileById[id];
          const role = roleByUser[id];
          return {
            id,
            nome: p?.nome ?? "—",
            email: p?.email ?? "—",
            desligado_em: p?.desligado_em ?? null,
            role,
            tipoLabel: p ? tipoLabel(p, role) : "—",
            supervisaoLabel: p ? supervisaoLabel(p, role) : "—",
          };
        }),
      );
      setLoading(false);
    })();
  }, []);

  const tipos = Array.from(new Set(rows.map((r) => r.tipoLabel))).sort();
  const filtradas = rows.filter((r) => {
    if (filtroTipo && r.tipoLabel !== filtroTipo) return false;
    if (filtroStatus === "ativo" && r.desligado_em) return false;
    if (filtroStatus === "desativado" && !r.desligado_em) return false;
    return true;
  });

  return (
    <ModalShell
      title="Usuários do sistema"
      onClose={onClose}
      wide
      footer={
        <span className="muted small" style={{ marginRight: "auto" }}>
          {filtradas.length} de {rows.length} usuário(s)
        </span>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="input"
          style={{ maxWidth: 180 }}
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="desativado">Desativado</option>
        </select>
      </div>
      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : (
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Tipo</th>
              <th>Supervisão</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((u) => {
              const desligado = !!u.desligado_em;
              return (
                <tr key={u.id}>
                  <td>
                    <strong>{u.nome}</strong>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td>
                    <span className={`chip ${TIPO_CHIP_CLASS[u.tipoLabel] ?? "chip-outline"}`}>
                      {u.tipoLabel}
                    </span>
                  </td>
                  <td>
                    <small className="muted">{u.supervisaoLabel}</small>
                  </td>
                  <td>
                    <span className={`chip ${desligado ? "chip-outline" : "chip-ok"}`}>
                      {desligado ? "Desativado" : "Ativo"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="muted small"
                  style={{ padding: 20, textAlign: "center" }}
                >
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}

function EditUserModal({
  user,
  empresas,
  role,
  onClose,
  onSaved,
}: {
  user: UserFull;
  empresas: Empresa[];
  role: "matriz" | "franqueado" | "vendedor";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(user.nome);
  const [empresaId, setEmpresaId] = useState<string>(user.empresa_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const check = nomeUsuarioSchema.safeParse(nome);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("admin_atualizar_usuario", {
      p_user_id: user.id,
      p_nome: check.data,
      p_empresa_id: (empresaId || null) as unknown as string, // SQL aceita null (remove vínculo); tipo gerado exige string
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell
      title={`Editar · ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Salvar
          </button>
        </>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div className="field-group">
        <label>Nome</label>
        <input
          className="input"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={150}
        />
      </div>
      <div className="field-group">
        <label>E-mail</label>
        <input className="input" value={user.email} disabled />
      </div>
      {role !== "matriz" && (
        <div className="field-group">
          <label>{role === "franqueado" ? "Franquia" : "Unidade"}</label>
          <select
            className="input"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
          >
            <option value="">— Selecionar —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </ModalShell>
  );
}

function CreateUserModal({
  role,
  empresas,
  onClose,
  onCreated,
  createFn,
}: {
  role: "matriz" | "franqueado" | "vendedor";
  empresas: Empresa[];
  onClose: () => void;
  onCreated: () => void;
  createFn: (p: {
    email: string;
    password: string;
    nome: string;
    role: "matriz" | "franqueado" | "vendedor";
    empresa_id: string | null;
  }) => Promise<unknown>;
}) {
  const [form, setForm] = useState({ nome: "", email: "", password: "", empresa_id: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const nomeCheck = nomeUsuarioSchema.safeParse(form.nome);
    if (!nomeCheck.success) {
      setErr(nomeCheck.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    const emailCheck = emailSchema.safeParse(form.email);
    if (!emailCheck.success) {
      setErr(emailCheck.error.issues[0]?.message ?? "E-mail inválido.");
      return;
    }
    const passwordCheck = passwordSchema.safeParse(form.password);
    if (!passwordCheck.success) {
      setErr(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createFn({
        nome: nomeCheck.data,
        email: emailCheck.data.toLowerCase(),
        password: passwordCheck.data,
        role,
        empresa_id: form.empresa_id || null,
      });
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={`Novo usuário · ${role}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !form.nome || !form.email || form.password.length < 6}
          >
            {busy ? "Criando…" : "Criar usuário"}
          </button>
        </>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div className="field-group">
        <label>Nome</label>
        <input
          className="input"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          maxLength={150}
        />
      </div>
      <div className="field-group">
        <label>E-mail</label>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          maxLength={254}
        />
      </div>
      <div className="field-group">
        <label>Senha (mín. 6)</label>
        <input
          className="input"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      {role !== "matriz" && (
        <div className="field-group">
          <label>{role === "franqueado" ? "Franquia" : "Unidade"}</label>
          <select
            className="input"
            value={form.empresa_id}
            onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
          >
            <option value="">— Selecionar —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </ModalShell>
  );
}
