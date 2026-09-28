import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { useTutorialController } from "@/components/tutorial/tutorial-controller-context";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { AceiteTutorialPreview } from "@/components/venda/aceite-tutorial-preview";
import { EM_FINALIZACAO_EXEMPLO_ROW } from "@/components/venda/em-finalizacao-tutorial-preview";
import {
  dedupTentativas,
  EM_FINALIZACAO_ROWS_QUERY_KEY,
  fetchEmFinalizacaoRows,
  type Row,
  type TentativaRow,
} from "@/components/venda/em-finalizacao/queries";
import { useEmFinalizacaoImprimir } from "@/components/venda/em-finalizacao/print";
import { FocoBarra } from "@/components/venda/foco-barra";
import { cotNum, money } from "@/components/venda/cotacoes/lista-helpers";
import { useAuth } from "@/lib/auth";
import { FOCO_SCROLL_DELAY_MS, useFocoAoChegar } from "@/lib/use-foco-ao-chegar";

export const Route = createFileRoute("/_authenticated/venda/em-finalizacao")({
  head: () => ({ meta: [{ title: "Em finalização · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string; foco?: string } => ({
    // `selected`: link legado (Pipeline — fora do escopo, item 7). `foco` é o
    // destaque novo (fila do dia/agenda), com faixa e pulso.
    selected: typeof s.selected === "string" ? s.selected : undefined,
    foco: typeof s.foco === "string" ? s.foco : undefined,
  }),
  component: Page,
});

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
  const navigate = useNavigate({ from: Route.fullPath });
  const { selected, foco: focoBusca } = Route.useSearch();
  const tutorialPreview = useTutorialPreview();
  const { isOpen: tutorialOpen } = useTutorialController();
  const foco = useFocoAoChegar(focoBusca, () => {
    void navigate({ search: (s) => ({ ...s, foco: undefined }) });
  });
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const [q, setQ] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const imprimir = useEmFinalizacaoImprimir();

  const tutorialAtivo =
    tutorialPreview === "aceite-aceita" || tutorialPreview === "aceite-pendencia";
  // Tutorial do vendedor (cap. 8, "Em finalização — consultar status") —
  // exemplo estático dentro da tabela real, pro caso de o vendedor ainda não
  // ter nenhuma proposta em finalização (ver `EM_FINALIZACAO_EXEMPLO_ROW`).
  const tutorialExemplo = tutorialPreview === "em-finalizacao-exemplo";

  const {
    data: rowsData,
    isLoading: queryLoading,
    error,
  } = useQuery({
    queryKey: [...EM_FINALIZACAO_ROWS_QUERY_KEY, uid],
    enabled: Boolean(uid) && !tutorialAtivo && !tutorialExemplo,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await fetchEmFinalizacaoRows(uid as string);
      if (error) throw error;
      return dedupTentativas(data as unknown as TentativaRow[]);
    },
  });
  const rows = useMemo(
    () => (tutorialExemplo ? [EM_FINALIZACAO_EXEMPLO_ROW] : (rowsData ?? [])),
    [rowsData, tutorialExemplo],
  );
  const loading = tutorialAtivo || tutorialExemplo ? false : queryLoading;
  const err =
    tutorialAtivo || tutorialExemplo ? null : error instanceof Error ? error.message : null;

  // Destaque: `foco` novo (fila do dia/agenda) ou, na ausência dele,
  // `selected` legado (Pipeline — fora do escopo, item 7). Nunca durante o
  // tutorial (real ou preview do wizard de aceite).
  const destaqueId =
    foco.ativo && foco.id
      ? foco.id
      : !tutorialOpen && !tutorialAtivo && !tutorialExemplo
        ? (selected ?? null)
        : null;
  useEffect(() => {
    if (!destaqueId || loading) return;
    const row = rows.find((r) => r.propostaId === destaqueId);
    if (!row) return;
    const delay = foco.ativo ? FOCO_SCROLL_DELAY_MS : 0;
    const t = window.setTimeout(() => {
      rowRefs.current[row.cotacaoId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }, delay);
    return () => window.clearTimeout(t);
  }, [destaqueId, foco.ativo, loading, rows]);
  const focoClasse = useCallback(
    (propostaId: string | null) => {
      if (!propostaId) return undefined;
      const cls = foco.classe(propostaId);
      if (cls) return cls.trim();
      return destaqueId === propostaId ? "em-foco" : undefined;
    },
    [foco, destaqueId],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t = `${cotNum(r.numero, r.cotacaoCriadoEm)} ${r.segurado} ${r.veiculo}`.toLowerCase();
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

      <FocoBarra ativo={foco.ativo} fonte={foco.fonte} id={foco.id} onLimpar={foco.limpar} />

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
                  onClick={tutorialExemplo ? undefined : () => continuar(r.cotacaoId)}
                  style={{ cursor: tutorialExemplo ? "default" : "pointer" }}
                  className={focoClasse(r.propostaId)}
                  aria-readonly={tutorialExemplo || undefined}
                >
                  <td
                    className="small muted"
                    style={{ fontFamily: "ui-monospace,Menlo,monospace" }}
                  >
                    #{cotNum(r.numero, r.cotacaoCriadoEm)}
                  </td>
                  <td>
                    <strong>{r.segurado}</strong>
                    {tutorialExemplo && (
                      <span className="chip chip-outline" style={{ marginLeft: 8 }}>
                        Exemplo do tutorial
                      </span>
                    )}
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
                  <td className="fase-acoes-td">
                    <div className="fase-acoes" data-tour="em-finalizacao-fase-acoes">
                      <button
                        className="btn btn-yellow btn-sm"
                        disabled={tutorialExemplo}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tutorialExemplo) continuar(r.cotacaoId);
                        }}
                      >
                        <svg width={13} height={13}>
                          <use href={r.status === "falha" ? "#i-send" : "#i-search"} />
                        </svg>{" "}
                        {r.status === "falha" ? "Tentar novamente" : "Consultar status"}
                      </button>
                      <button
                        className="ic-btn"
                        title="Imprimir ou enviar a cotação aprovada"
                        disabled={tutorialExemplo}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tutorialExemplo) imprimir.abrir(r);
                        }}
                      >
                        <svg width={15} height={15}>
                          <use href="#i-printer" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {imprimir.modal}

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
