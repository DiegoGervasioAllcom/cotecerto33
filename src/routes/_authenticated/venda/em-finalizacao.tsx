import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { AceiteTutorialPreview } from "@/components/venda/aceite-tutorial-preview";
import { cotNum, money } from "@/components/venda/cotacoes/lista-helpers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/em-finalizacao")({
  head: () => ({ meta: [{ title: "Em finalização · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

// A Etapa 7 (wizard de transmissão via Quiver) grava cada tentativa em
// `cotacao_transmissoes`. Enquanto o robô não devolve o resultado pelo
// webhook, a tentativa fica com status='enviada'; se o portal recusa, vira
// 'falha' (o vendedor precisa agir — reabrir a Etapa 7 e reenviar). Só
// quando a tentativa vira 'transmitida' é que a cotação sai desta lista —
// nesse ponto ela já vive em Propostas/Emissão. Cada linha é a ÚLTIMA
// tentativa por cotação (mais recente primeiro, deduplicada em memória).
type TentativaRow = {
  id: string;
  cotacao_id: string;
  status: string;
  motivo: string | null;
  mensagem: string | null;
  seguradora: string | null;
  premio: number | null;
  forma_pagamento: string | null;
  criado_em: string;
  proposta_id: string | null;
  cotacoes: {
    numero: number;
    segurado: { nome: string | null }[] | null;
    veiculo:
      | {
          marca_nome: string | null;
          modelo_nome: string | null;
          ano_modelo: string | null;
          placa: string | null;
        }[]
      | null;
  } | null;
};

type Row = {
  tentativaId: string;
  cotacaoId: string;
  numero: number;
  status: string;
  motivo: string | null;
  mensagem: string | null;
  seguradora: string | null;
  premio: number | null;
  formaPagamento: string | null;
  criadoEm: string;
  propostaId: string | null;
  segurado: string;
  veiculo: string;
};

function tempoDesde(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min}min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

function statusChip(r: Row) {
  if (r.status === "falha")
    return (
      <span className="chip chip-alert">
        <svg width={12} height={12}>
          <use href="#i-alert-triangle" />
        </svg>{" "}
        Falha na transmissão
      </span>
    );
  return (
    <span className="chip chip-yellow">
      <svg width={12} height={12} className="pulse">
        <use href="#i-clock" />
      </svg>{" "}
      Aguardando confirmação
    </span>
  );
}

function Page() {
  const nav = useNavigate();
  const { selected } = Route.useSearch();
  const tutorialPreview = useTutorialPreview();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cotacao_transmissoes")
      .select(
        "id,cotacao_id,status,motivo,mensagem,seguradora,premio,forma_pagamento,criado_em,proposta_id," +
          "cotacoes(numero,segurado:cotacao_segurado(nome),veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa))",
      )
      .in("status", ["enviada", "falha"])
      .order("criado_em", { ascending: false })
      .limit(500);
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    // Uma cotação pode ter várias tentativas (retransmissão após falha) — só a
    // mais recente importa, e a lista já vem ordenada por criado_em desc.
    const vistos = new Set<string>();
    const dedup: Row[] = [];
    for (const t of (data ?? []) as unknown as TentativaRow[]) {
      if (vistos.has(t.cotacao_id)) continue;
      vistos.add(t.cotacao_id);
      const c = t.cotacoes;
      const veiculo = c?.veiculo?.[0];
      dedup.push({
        tentativaId: t.id,
        cotacaoId: t.cotacao_id,
        numero: c?.numero ?? 0,
        status: t.status,
        motivo: t.motivo,
        mensagem: t.mensagem,
        seguradora: t.seguradora,
        premio: t.premio,
        formaPagamento: t.forma_pagamento,
        criadoEm: t.criado_em,
        propostaId: t.proposta_id,
        segurado: c?.segurado?.[0]?.nome || "—",
        veiculo: veiculo
          ? [veiculo.marca_nome, veiculo.modelo_nome, veiculo.ano_modelo]
              .filter(Boolean)
              .join(" ") + (veiculo.placa ? ` · ${veiculo.placa}` : "")
          : "—",
      });
    }
    setRows(dedup);
    setLoading(false);
  }

  useEffect(() => {
    if (tutorialPreview === "aceite-aceita" || tutorialPreview === "aceite-pendencia") {
      setLoading(false);
      return;
    }
    void load();
  }, [tutorialPreview]);

  useEffect(() => {
    if (!selected || loading) return;
    const row = rows.find((r) => r.propostaId === selected);
    if (!row) return;
    const el = rowRefs.current[row.cotacaoId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t = `${cotNum(r.numero)} ${r.segurado} ${r.veiculo}`.toLowerCase();
        if (q && !t.includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q],
  );

  function continuar(cotacaoId: string) {
    void nav({ to: "/venda/novo-lead", search: { id: cotacaoId, step: 6 } });
  }

  if (tutorialPreview === "aceite-aceita" || tutorialPreview === "aceite-pendencia") {
    return (
      <AppShell title="Em finalização">
        <ProtoIcons />
        <AceiteTutorialPreview mode={tutorialPreview} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Em finalização">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Em finalização</h1>
          <div className="sub">
            Na transmissão à seguradora · {filtered.length} proposta
            {filtered.length !== 1 ? "s" : ""}{" "}
            <span className="chip chip-yellow">transmitindo</span>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Ver no pipeline
          </Link>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <input
          className="select-mini"
          placeholder="Buscar segurado, veículo, nº cotação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-link btn-sm" onClick={() => setQ("")}>
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" data-tour="em-finalizacao-lista">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhuma proposta em finalização. Escolha uma seguradora no cálculo e clique em
            Contratar.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          className="card"
          data-tour="em-finalizacao-lista"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Nº COTAÇÃO</th>
                <th>SEGURADO</th>
                <th>VEÍCULO</th>
                <th>SEGURADORA</th>
                <th style={{ textAlign: "right" }}>PRÊMIO</th>
                <th>STATUS</th>
                <th>PARADO HÁ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.cotacaoId}
                  ref={(el) => {
                    rowRefs.current[r.cotacaoId] = el;
                  }}
                  onClick={() => continuar(r.cotacaoId)}
                  style={{
                    cursor: "pointer",
                    ...(r.propostaId && selected === r.propostaId
                      ? {
                          outline: "2px solid var(--brand, #2563eb)",
                          background: "rgba(37,99,235,.06)",
                        }
                      : {}),
                  }}
                >
                  <td
                    className="small muted"
                    style={{ fontFamily: "ui-monospace,Menlo,monospace" }}
                  >
                    #{cotNum(r.numero)}
                  </td>
                  <td>
                    <strong>{r.segurado}</strong>
                  </td>
                  <td>{r.veiculo}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {r.premio ? money(Number(r.premio)) : "—"}
                  </td>
                  <td>
                    {statusChip(r)}
                    {r.status === "falha" && (r.motivo || r.mensagem) && (
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {r.motivo && (
                          <span className="chip chip-slate" style={{ marginRight: 6 }}>
                            {r.motivo}
                          </span>
                        )}
                        {r.mensagem}
                      </div>
                    )}
                  </td>
                  <td className="small muted">{tempoDesde(r.criadoEm)}</td>
                  <td>
                    <button
                      className="btn btn-yellow btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        continuar(r.cotacaoId);
                      }}
                    >
                      <svg width={13} height={13}>
                        <use href={r.status === "falha" ? "#i-send" : "#i-search"} />
                      </svg>{" "}
                      {r.status === "falha" ? "Tentar novamente" : "Consultar status"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="clt-note" style={{ marginTop: 14 }}>
        <svg width={15} height={15}>
          <use href="#i-info" />
        </svg>
        <div>
          Depois de transmitida com sucesso, a proposta sai desta lista e passa a viver em{" "}
          <strong>Emissão & histórico</strong>, onde você acompanha até a apólice sair.
        </div>
        <Link to="/venda/emissao" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>
          <svg width={13} height={13}>
            <use href="#i-chevron-right" />
          </svg>{" "}
          Ir para Emissão
        </Link>
      </div>
    </AppShell>
  );
}
