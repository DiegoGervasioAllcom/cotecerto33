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
                  count={roleCount("matriz")} solid />
                <PerfilRow title="Franqueado" desc="Vê a própria unidade e equipe"
                  count={roleCount("franqueado")} />
                <PerfilRow title="Vendedor" desc="Pipeline, cotação, proposta e extrato próprios"
                  count={roleCount("vendedor")} />
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
                <div className="crit-row">
                  <div className="cr-body">
                    <div className="cr-t">Seguradoras ({segCount})</div>
                    <div className="cr-d">{segPreview || "Nenhuma cadastrada"}</div>
                  </div>
                  <span className="chip chip-ok">Ativas</span>
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

function PerfilRow({ title, desc, count, solid }: { title: string; desc: string; count: number; solid?: boolean }) {
  return (
    <div className="crit-row">
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <span className={`chip ${solid ? "chip-slate" : "chip-outline"}`}>{count} {count === 1 ? "usuário" : "usuários"}</span>
    </div>
  );
}
