import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/comissoes")({
  head: () => ({ meta: [{ title: "Comissões · CoteCerto" }] }),
  component: Page,
});

type Proposta = {
  id: string;
  numero: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  comissao_valor: number | null;
  comissao_pct: number | null;
  emitida_em: string | null;
  pago_em: string | null;
  cancelada_em: string | null;
  empresa_id: string | null;
  responsavel_id: string | null;
};
type Empresa = { id: string; nome: string };
type Profile = { id: string; nome: string };
type Lanc = {
  id: string;
  vendedor_id: string;
  empresa_id: string | null;
  proposta_id: string | null;
  tipo: "credito" | "debito";
  valor: number;
  descricao: string;
  referencia: string | null;
  seguradora: string | null;
  origem: string;
  criado_em: string;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function monthRange(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const ini = new Date(d.getFullYear(), d.getMonth(), 1);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const label = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

function Page() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => monthRange(periodOffset), [periodOffset]);
  const [emitidas, setEmitidas] = useState<Proposta[]>([]);
  const [estornadas, setEstornadas] = useState<Proposta[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vendedorSel, setVendedorSel] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const cols =
        "id,numero,apolice_numero,seguradora,premio,valor,comissao_valor,comissao_pct,emitida_em,pago_em,cancelada_em,empresa_id,responsavel_id";
      const [emi, est, lan, emps, profs] = await Promise.all([
        supabase
          .from("propostas")
          .select(cols)
          .not("emitida_em", "is", null)
          .gte("emitida_em", period.ini)
          .lt("emitida_em", period.fim)
          .limit(5000),
        supabase
          .from("propostas")
          .select(cols)
          .not("cancelada_em", "is", null)
          .gte("cancelada_em", period.ini)
          .lt("cancelada_em", period.fim)
          .limit(5000),
        supabase
          .from("comissao_lancamentos")
          .select(
            "id,vendedor_id,empresa_id,proposta_id,tipo,valor,descricao,referencia,seguradora,origem,criado_em",
          )
          .order("criado_em", { ascending: false })
          .limit(5000),
        supabase.from("empresas").select("id,nome"),
        supabase.from("profiles").select("id,nome"),
      ]);
      if (emi.error) setErr(emi.error.message);
      setEmitidas((emi.data ?? []) as Proposta[]);
      setEstornadas((est.data ?? []) as Proposta[]);
      setLancs((lan.data ?? []) as Lanc[]);
      const em: Record<string, Empresa> = {};
      for (const e of (emps.data ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs.data ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setLoading(false);
    })();
  }, [period.ini, period.fim]);

  const comOf = (p: Proposta) =>
    Number(p.comissao_valor ?? Number(p.premio ?? p.valor ?? 0) * 0.16);

  const kpis = useMemo(() => {
    const ativas = emitidas.filter((p) => !p.cancelada_em);
    const gerada = ativas.reduce((s, p) => s + comOf(p), 0);
    const paga = ativas.filter((p) => p.pago_em).reduce((s, p) => s + comOf(p), 0);
    const pendente = gerada - paga;
    const media = ativas.length ? gerada / ativas.length : 0;
    const estornada = estornadas.reduce((s, p) => s + comOf(p), 0);
    return {
      gerada,
      paga,
      pendente,
      media,
      estornada,
      qtd: ativas.length,
      qtdEst: estornadas.length,
      pctPaga: gerada > 0 ? (paga / gerada) * 100 : 0,
    };
  }, [emitidas, estornadas]);

  const porFranquia = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.empresa_id || "";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: empresas[id]?.nome || "—", v }))
      .sort((a, b) => b.v - a.v);
  }, [emitidas, empresas]);

  const porSeguradora = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.seguradora || "—";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, v }))
      .sort((a, b) => b.v - a.v);
  }, [emitidas]);

  const topVendedores = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.responsavel_id || "";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: profiles[id]?.nome || "—", v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 7);
  }, [emitidas, profiles]);

  const maxFr = porFranquia[0]?.v || 1;
  const maxSeg = porSeguradora[0]?.v || 1;

  const periodOpts = useMemo(
    () => [0, -1, -2, -3].map((o) => ({ off: o, label: monthRange(o).label })),
    [],
  );

  function exportCsv() {
    const headers = [
      "Apólice",
      "Seguradora",
      "Vendedor",
      "Franquia",
      "Prêmio",
      "Comissão %",
      "Comissão",
      "Status",
      "Emitida em",
      "Pago em",
    ];
    const lines = [headers.join(";")];
    const all = [...emitidas, ...estornadas];
    for (const p of all) {
      lines.push(
        [
          p.apolice_numero || p.numero || "",
          p.seguradora || "",
          profiles[p.responsavel_id || ""]?.nome || "",
          empresas[p.empresa_id || ""]?.nome || "",
          fmtBRL(Number(p.premio ?? p.valor ?? 0)),
          (p.comissao_pct ?? 16) + "%",
          fmtBRL(comOf(p)),
          p.cancelada_em ? "Estornada" : p.pago_em ? "Paga" : "Pendente",
          p.emitida_em ? new Date(p.emitida_em).toLocaleDateString("pt-BR") : "",
          p.pago_em ? new Date(p.pago_em).toLocaleDateString("pt-BR") : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes-${period.label.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Comissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Comissões</h1>
          <div className="sub">
            Comissão por franquia, vendedor e seguradora — fechamento de{" "}
            {period.label}
          </div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={periodOffset}
            onChange={(e) => setPeriodOffset(Number(e.target.value))}
          >
            {periodOpts.map((p) => (
              <option key={p.off} value={p.off}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv}>
            <svg width="14" height="14">
              <use href="#i-download" />
            </svg>{" "}
            Exportar fechamento
          </button>
        </div>
      </div>

      <div className="audit-note" style={{ marginBottom: 16 }}>
        <svg width="16" height="16">
          <use href="#i-lock" />
        </svg>{" "}
        <strong style={{ marginRight: 4 }}>Trava de auditoria ativa.</strong>{" "}
        Toda alteração de comissão fica registrada com autor, data e valor
        anterior. Comissão gera conflito — aqui nada se altera sem rastro.
      </div>

      {err && (
        <div style={{ color: "var(--alert)", marginBottom: 12 }}>{err}</div>
      )}

      <div className="mkpi-grid">
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-dollar" /></svg>
          </div>
          <div className="lbl">COMISSÃO GERADA</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.gerada)}</div>
          <div className="meta">{kpis.qtd} apólices</div>
        </div>
        <div className="kpi k-ok">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-check-circle" /></svg>
          </div>
          <div className="lbl">COMISSÃO PAGA</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.paga)}</div>
          <div className="meta">{kpis.pctPaga.toFixed(0)}% do total</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-clock" /></svg>
          </div>
          <div className="lbl">COMISSÃO PENDENTE</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.pendente)}</div>
          <div className="meta">aguardando baixa</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-percent" /></svg>
          </div>
          <div className="lbl">COMISSÃO MÉDIA</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.media)}</div>
          <div className="meta">por apólice</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-refresh" /></svg>
          </div>
          <div className="lbl">ESTORNADA</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.estornada)}</div>
          <div className="meta">{kpis.qtdEst} cancelamentos</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18"><use href="#i-tag" /></svg>
          </div>
          <div className="lbl">SALDO A PAGAR</div>
          <div className="val" style={{ fontSize: 22 }}>{fmtBRL(kpis.pendente)}</div>
          <div className="meta">no fechamento do mês</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="16" height="16"><use href="#i-building" /></svg>{" "}
              Comissão por franquia
            </h3>
          </div>
          <div className="card-b">
            {loading && <div className="muted">Carregando…</div>}
            {!loading && porFranquia.length === 0 && (
              <div className="muted">Nenhuma comissão no período.</div>
            )}
            <div className="funnel">
              {porFranquia.map((f) => (
                <div className="funnel-row" key={f.nome}>
                  <div className="fn-lbl" style={{ width: 150 }}>{f.nome}</div>
                  <div className="funnel-track" style={{ height: 22 }}>
                    <div
                      className="funnel-bar"
                      style={{
                        height: 22,
                        width: `${Math.max(8, (f.v / maxFr) * 100)}%`,
                        background: "var(--slate)",
                      }}
                    >
                      {fmtBRL(f.v)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="16" height="16"><use href="#i-shield" /></svg>{" "}
              Por seguradora
            </h3>
          </div>
          <div className="card-b">
            {!loading && porSeguradora.length === 0 && (
              <div className="muted">Nenhuma comissão no período.</div>
            )}
            <div className="funnel">
              {porSeguradora.map((s) => (
                <div className="funnel-row" key={s.nome}>
                  <div className="fn-lbl" style={{ width: 150 }}>{s.nome}</div>
                  <div className="funnel-track" style={{ height: 22 }}>
                    <div
                      className="funnel-bar"
                      style={{
                        height: 22,
                        width: `${Math.max(8, (s.v / maxSeg) * 100)}%`,
                        background: "var(--slate)",
                      }}
                    >
                      {fmtBRL(s.v)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="16" height="16"><use href="#i-users" /></svg> Top
              vendedores por comissão
            </h3>
          </div>
          <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {!loading && topVendedores.length === 0 && (
              <div className="muted">Sem vendas no período.</div>
            )}
            {topVendedores.map((v, i) => (
              <div
                key={v.nome + i}
                className="rank-row"
                style={{ cursor: "default" }}
              >
                <div className={"rank-pos " + (i === 0 ? "top" : "")}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }} className="rk-name">
                  {v.nome}
                </div>
                <div className="rk-val">{fmtBRL(v.v)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-yellow">
          <div className="card-h">
            <h3>
              <svg width="16" height="16"><use href="#i-history" /></svg>{" "}
              Resumo do fechamento
            </h3>
          </div>
          <div className="card-b">
            <div className="actions-list">
              <div className="action-row" style={{ cursor: "default" }}>
                <div className="ic-square info">
                  <svg width="16" height="16"><use href="#i-check-circle" /></svg>
                </div>
                <div className="body">
                  <h4>{kpis.qtd} apólices emitidas em {period.label}</h4>
                  <p>Comissão gerada: {fmtBRL(kpis.gerada)}</p>
                </div>
              </div>
              <div className="action-row" style={{ cursor: "default" }}>
                <div className="ic-square warn">
                  <svg width="16" height="16"><use href="#i-clock" /></svg>
                </div>
                <div className="body">
                  <h4>{fmtBRL(kpis.pendente)} pendentes de baixa</h4>
                  <p>{(100 - kpis.pctPaga).toFixed(0)}% ainda não pagos</p>
                </div>
              </div>
              <div className="action-row" style={{ cursor: "default" }}>
                <div className="ic-square alert">
                  <svg width="16" height="16"><use href="#i-refresh" /></svg>
                </div>
                <div className="body">
                  <h4>{kpis.qtdEst} cancelamentos</h4>
                  <p>{fmtBRL(kpis.estornada)} em comissão revertida</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
