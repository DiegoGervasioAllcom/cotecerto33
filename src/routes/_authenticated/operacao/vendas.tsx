import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

function maskCpfCnpj(v: string): string {
  const d = (v || "").replace(/\D/g, "");
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/[-.]+$/, "");
  }
  return d
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5")
    .replace(/[-./]+$/, "");
}
function maskPhone(v: string): string {
  const d = (v || "").replace(/\D/g, "");
  if (d.length <= 10)
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/[-\s()]+$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/[-\s()]+$/, "");
}

export const Route = createFileRoute("/_authenticated/operacao/vendas")({
  head: () => ({ meta: [{ title: "Controle de Vendas · CoteCerto" }] }),
  component: Page,
});

type Proposta = {
  id: string;
  numero: string | null;
  apolice_numero: string | null;
  status: string;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  tipo_venda: string | null;
  forma_pagamento: string | null;
  comissao_pct: number | null;
  comissao_valor: number | null;
  emitida_em: string | null;
  pago_em: string | null;
  baixa_em: string | null;
  cancelada_em: string | null;
  transmitida_em: string | null;
  criado_em: string;
  empresa_id: string | null;
  responsavel_id: string | null;
  cotacao_id: string | null;
  cotacoes: {
    segurado: { nome: string | null; cpf_cnpj: string | null; celular: string | null }[] | null;
    seguro: { tipo_seguro: string | null }[] | null;
  } | null;
};

type Empresa = { id: string; nome: string };
type Profile = { id: string; nome: string };

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";

type Tab = "transmissao" | "emitidas" | "pagas" | "naopagas" | "canceladas";

function monthRange(offset: number): { ini: string; fim: string; label: string } {
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

function classify(p: Proposta): Tab {
  if (p.cancelada_em) return "canceladas";
  if (p.pago_em) return "pagas";
  if (p.emitida_em) return "naopagas";
  return "transmissao";
}

function Page() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => monthRange(periodOffset), [periodOffset]);
  const [rows, setRows] = useState<Proposta[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [seguradoras, setSeguradoras] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("emitidas");
  const [fFranq, setFFranq] = useState("");
  const [fSeg, setFSeg] = useState("");
  const [fTipo, setFTipo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const [props, emps, profs, segs] = await Promise.all([
        supabase
          .from("propostas")
          .select(
            "id,numero,apolice_numero,status,seguradora,premio,valor,tipo_venda,forma_pagamento,comissao_pct,comissao_valor,emitida_em,pago_em,baixa_em,cancelada_em,transmitida_em,criado_em,empresa_id,responsavel_id,cotacao_id," +
              "cotacoes(segurado:cotacao_segurado(nome,cpf_cnpj,celular),seguro:cotacao_seguro(tipo_seguro))",
          )
          .gte("criado_em", period.ini)
          .lt("criado_em", period.fim)
          .order("criado_em", { ascending: false })
          .limit(2000),
        supabase.from("empresas").select("id,nome").order("nome"),
        supabase.from("profiles").select("id,nome").order("nome"),
        supabase.from("seguradoras").select("nome").eq("ativo", true).order("ordem"),
      ]);
      if (props.error) setErr(props.error.message);
      setRows((props.data ?? []) as unknown as Proposta[]);
      const em: Record<string, Empresa> = {};
      for (const e of (emps.data ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs.data ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setSeguradoras(((segs.data ?? []) as { nome: string }[]).map((s) => s.nome).filter(Boolean));
      setLoading(false);
    })();
  }, [period.ini, period.fim]);

  const counts = useMemo(() => {
    const acc: Record<Tab, { n: number; total: number }> = {
      transmissao: { n: 0, total: 0 },
      emitidas: { n: 0, total: 0 },
      pagas: { n: 0, total: 0 },
      naopagas: { n: 0, total: 0 },
      canceladas: { n: 0, total: 0 },
    };
    for (const p of rows) {
      const v = Number(p.premio ?? p.valor ?? 0);
      const t = classify(p);
      acc[t].n += 1;
      acc[t].total += v;
      // "Emitidas" agrupa pagas + nao pagas
      if (t === "pagas" || t === "naopagas") {
        acc.emitidas.n += 1;
        acc.emitidas.total += v;
      }
    }
    return acc;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      const t = classify(p);
      const tabOk = tab === "emitidas" ? t === "pagas" || t === "naopagas" : t === tab;
      if (!tabOk) return false;
      if (fFranq && p.empresa_id !== fFranq) return false;
      if (fSeg && (p.seguradora || "") !== fSeg) return false;
      if (fTipo) {
        const tipo = (p.tipo_venda || "novo").toLowerCase();
        if (fTipo === "Novo" && tipo !== "novo") return false;
        if (fTipo === "Renovação" && tipo !== "renovacao" && tipo !== "renovação") return false;
      }
      return true;
    });
  }, [rows, tab, fFranq, fSeg, fTipo]);

  function exportCsv() {
    const headers = [
      "Apólice/Proposta",
      "Seguradora",
      "Segurado",
      "CPF/CNPJ",
      "Tipo",
      "Prêmio",
      "Comissão",
      "Vendedor",
      "Franquia",
      "Pagamento",
      "Emissão",
      "Baixa",
      "Status",
    ];
    const lines = [headers.join(";")];
    for (const p of filtered) {
      const seg = p.cotacoes?.segurado?.[0];
      const tipo = (p.tipo_venda || "novo").toLowerCase() === "renovacao" ? "Renovação" : "Novo";
      const status = classify(p);
      const statusLbl =
        status === "pagas"
          ? "Paga"
          : status === "naopagas"
            ? "Não paga"
            : status === "canceladas"
              ? "Cancelada"
              : status === "transmissao"
                ? "Em transmissão"
                : "Emitida";
      lines.push(
        [
          p.apolice_numero || p.numero || "",
          p.seguradora || "",
          seg?.nome || "",
          seg?.cpf_cnpj || "",
          tipo,
          fmtBRL(Number(p.premio ?? p.valor ?? 0)),
          fmtBRL(Number(p.comissao_valor ?? 0)),
          profiles[p.responsavel_id || ""]?.nome || "",
          empresas[p.empresa_id || ""]?.nome || "",
          p.forma_pagamento || "",
          fmtDate(p.emitida_em),
          fmtDate(p.baixa_em),
          statusLbl,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${period.label.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Controle de Vendas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Controle de Vendas</h1>
          <div className="sub">
            O <strong>extrato geral da operação</strong> — da transmissão à baixa financeira, num só
            lugar
          </div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={periodOffset}
            onChange={(e) => setPeriodOffset(Number(e.target.value))}
          >
            <option value={0}>{monthRange(0).label}</option>
            <option value={-1}>{monthRange(-1).label}</option>
            <option value={-2}>{monthRange(-2).label}</option>
            <option value={-3}>{monthRange(-3).label}</option>
          </select>
          <button className="btn btn-ghost" onClick={exportCsv}>
            <svg width={14} height={14}>
              <use href="#i-download" />
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      <div className="summary-chips">
        <div className="sum-chip">
          <span className="sc-val">{counts.transmissao.n}</span>
          <span className="sc-lbl">Em transmissão</span>
        </div>
        <div className="sum-chip info">
          <span className="sc-val">{counts.emitidas.n}</span>
          <span className="sc-lbl">Emitidas · {fmtBRL(counts.emitidas.total)}</span>
        </div>
        <div className="sum-chip ok">
          <span className="sc-val">{counts.pagas.n}</span>
          <span className="sc-lbl">Pagas · {fmtBRL(counts.pagas.total)}</span>
        </div>
        <div className="sum-chip alert">
          <span className="sc-val">{counts.naopagas.n}</span>
          <span className="sc-lbl">Não pagas · {fmtBRL(counts.naopagas.total)}</span>
        </div>
        <div className="sum-chip">
          <span className="sc-val">{counts.canceladas.n}</span>
          <span className="sc-lbl">Canceladas · {fmtBRL(counts.canceladas.total)}</span>
        </div>
      </div>

      <div className="filters-bar">
        <div className="toggle">
          {(
            [
              ["transmissao", "Transmissão", counts.transmissao.n],
              ["emitidas", "Emitidas", counts.emitidas.n],
              ["pagas", "Pagas", counts.pagas.n],
              ["naopagas", "Não pagas", counts.naopagas.n],
              ["canceladas", "Canceladas", counts.canceladas.n],
            ] as [Tab, string, number][]
          ).map(([k, l, n]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {l} <span style={{ opacity: 0.7 }}>({n})</span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="label">FILTRAR</span>
        <select className="select-mini" value={fFranq} onChange={(e) => setFFranq(e.target.value)}>
          <option value="">Franquia</option>
          {Object.values(empresas).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fSeg} onChange={(e) => setFSeg(e.target.value)}>
          <option value="">Seguradora</option>
          {seguradoras.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
          <option value="">Tipo</option>
          <option>Novo</option>
          <option>Renovação</option>
        </select>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && (
        <div className="muted" style={{ padding: 12 }}>
          Carregando…
        </div>
      )}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th>Apólice</th>
                <th>Seguradora</th>
                <th>Segurado</th>
                <th>CPF/CNPJ</th>
                <th>Tipo</th>
                <th>Prêmio</th>
                <th>Comissão</th>
                <th>Vendedor</th>
                <th>Franquia</th>
                <th>Pagamento</th>
                <th>Emissão</th>
                <th>Baixa</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const seg = p.cotacoes?.segurado?.[0];
                const tipo =
                  (p.tipo_venda || "novo").toLowerCase() === "renovacao" ||
                  (p.tipo_venda || "").toLowerCase() === "renovação"
                    ? "Renovação"
                    : "Novo";
                const t = classify(p);
                const chip =
                  t === "pagas"
                    ? ["chip-ok", "Paga"]
                    : t === "naopagas"
                      ? ["chip-alert", "Não paga"]
                      : t === "canceladas"
                        ? ["chip", "Cancelada"]
                        : ["chip-info", "Em transmissão"];
                return (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.apolice_numero || p.numero || "—"}</strong>
                    </td>
                    <td>{p.seguradora || "—"}</td>
                    <td>
                      <div className="mini-cell">
                        <strong>{seg?.nome || "—"}</strong>
                        <small>{seg?.celular ? maskPhone(seg.celular) : "—"}</small>
                      </div>
                    </td>
                    <td>
                      <small className="muted">
                        {seg?.cpf_cnpj ? maskCpfCnpj(seg.cpf_cnpj) : "—"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`chip ${tipo === "Renovação" ? "chip-info" : "chip-yellow"}`}
                      >
                        {tipo}
                      </span>
                    </td>
                    <td>{fmtBRL(Number(p.premio ?? p.valor ?? 0))}</td>
                    <td>
                      <strong>{fmtBRL(Number(p.comissao_valor ?? 0))}</strong>
                    </td>
                    <td>
                      <small>{profiles[p.responsavel_id || ""]?.nome || "—"}</small>
                    </td>
                    <td>
                      <small>{empresas[p.empresa_id || ""]?.nome || "—"}</small>
                    </td>
                    <td>
                      <small>{p.forma_pagamento || "—"}</small>
                    </td>
                    <td>
                      <small className="muted">{fmtDate(p.emitida_em)}</small>
                    </td>
                    <td>
                      <small className="muted">{fmtDate(p.baixa_em)}</small>
                    </td>
                    <td>
                      <span className={`chip ${chip[0]}`}>{chip[1]}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}
                  >
                    Nenhuma venda encontrada para os filtros do período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
