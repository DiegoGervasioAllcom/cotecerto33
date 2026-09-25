import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { AguardandoCotacaoLista } from "@/components/venda/em-negociacao/AguardandoCotacaoLista";
import { CotacaoFinalizadaLista } from "@/components/venda/em-negociacao/CotacaoFinalizadaLista";
import {
  useAguardandoCotacaoRows,
  useCotacaoFinalizadaRows,
} from "@/components/venda/em-negociacao/queries";
import { cotNum, FAIXAS, melhorPreco, money } from "@/components/venda/cotacoes/lista-helpers";
import { NegociacaoPropostaPanel } from "@/components/venda/negociacao-proposta-panel";
import { useTutorialController } from "@/components/tutorial/tutorial-controller-context";
import { useAuth } from "@/lib/auth";
import { COTACOES_NOVAS_QUERY_KEY, marcarCotacoesVistas } from "@/lib/cotacao-novas";

export {
  fetchAguardandoCotacaoRows,
  fetchCotacaoFinalizadaRows,
} from "@/components/venda/em-negociacao/queries";

export const Route = createFileRoute("/_authenticated/venda/em-negociacao")({
  head: () => ({ meta: [{ title: "Em negociação · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const navigate = useNavigate({ from: "/venda/em-negociacao" });
  const { selected } = Route.useSearch();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const queryClient = useQueryClient();
  const { isOpen: tutorialOpen } = useTutorialController();

  const {
    data: finalizadaData,
    isLoading: loadingFinalizada,
    error: erroFinalizada,
    refetch: refetchFinalizada,
  } = useCotacaoFinalizadaRows(uid);
  const {
    data: aguardandoData,
    isLoading: loadingAguardando,
    error: erroAguardando,
  } = useAguardandoCotacaoRows(uid);
  const finalizadaRows = useMemo(() => finalizadaData ?? [], [finalizadaData]);
  const aguardandoRows = useMemo(() => aguardandoData ?? [], [aguardandoData]);
  const loading = loadingFinalizada || loadingAguardando;
  const err = erroFinalizada?.message ?? erroAguardando?.message ?? null;

  const [q, setQ] = useState("");
  const [fSeguradora, setFSeguradora] = useState("");
  const [fFaixa, setFFaixa] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Abrir a tela marca como vistas todas as cotações "calculada" ainda sem
  // `calculo_visto_em` do vendedor logado (protótipo V12 · `faseTela`) — some
  // o "nova" da lista, o cartão do aviso global e o pulsar do menu.
  //
  // NÃO durante o tutorial: `posicionarTutorial`/`abrirNaEtapa` navegam de
  // verdade para esta rota (não é o preview de `?tutorialPreview=` como no
  // wizard de Lead Manual — aqui não existe rascunho isolado pra simular),
  // então sem esse gate o passo "A proposta da Azul" gravaria
  // `calculo_visto_em` em cotações reais só por o vendedor estar vendo a
  // demonstração — mesmo espírito de `useTutorialWizardPreview`, mas via
  // `isOpen` do controller (o tour inteiro é real aqui, não um preview
  // isolado).
  //
  // `tutorialAoMontar` congela o valor de `tutorialOpen` na primeira
  // renderização desta instância da página (não reage a mudanças depois) —
  // sem isso, clicar em "Sair" do tour AINDA NESTA TELA vira `tutorialOpen`
  // de `true` para `false` com o componente continuando montado, o que
  // religaria o efeito e dispararia o `PATCH` mesmo sem navegar (é
  // exatamente esse instante que o teste `tutorial.spec.ts` pega).
  const tutorialAoMontar = useRef(tutorialOpen);
  useEffect(() => {
    if (!uid || tutorialAoMontar.current) return;
    void marcarCotacoesVistas(uid).then(() => {
      void queryClient.invalidateQueries({ queryKey: COTACOES_NOVAS_QUERY_KEY });
      void refetchFinalizada();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (!selected || loading) return;
    const row = finalizadaRows.find((r) => r.propostas?.some((p) => p.id === selected));
    if (!row) return;
    const el = rowRefs.current[row.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, finalizadaRows]);

  const seguradoras = useMemo(
    () =>
      Array.from(
        new Set(finalizadaRows.flatMap((r) => r.premios?.map((p) => p.seguradora) ?? [])),
      ).sort(),
    [finalizadaRows],
  );

  const finalizadaFiltrada = useMemo(
    () =>
      finalizadaRows.filter((r) => {
        const t =
          `${cotNum(r.numero)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
        if (q && !t.includes(q.toLowerCase())) return false;
        if (fSeguradora && !r.premios?.some((p) => p.seguradora === fSeguradora)) return false;
        if (fFaixa) {
          const faixa = FAIXAS.find((f) => f.label === fFaixa);
          const preco = melhorPreco(r.premios);
          if (!faixa || preco == null || preco < faixa.min || preco > faixa.max) return false;
        }
        return true;
      }),
    [finalizadaRows, q, fSeguradora, fFaixa],
  );

  const aguardandoFiltrada = useMemo(
    () =>
      aguardandoRows.filter((r) => {
        const t =
          `${cotNum(r.numero)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
        if (q && !t.includes(q.toLowerCase())) return false;
        return true;
      }),
    [aguardandoRows, q],
  );

  const totVal = finalizadaFiltrada.reduce((a, r) => a + (melhorPreco(r.premios) ?? 0), 0);
  const totalNegociacao = finalizadaFiltrada.length + aguardandoFiltrada.length;

  function exportar() {
    const head = [
      "Nº cotação",
      "Segurado",
      "Veículo",
      "Seguradoras cotadas",
      "Melhor preço",
      "Status",
      "Criada",
    ];
    const lines = finalizadaFiltrada.map((r) => {
      const best = r.premios?.length
        ? r.premios.reduce((m, p) => (Number(p.premio) < Number(m.premio) ? p : m))
        : null;
      const veic = r.veiculo
        ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
        : "";
      return [
        cotNum(r.numero),
        r.segurado?.nome ?? "",
        veic,
        r.premios?.length ?? 0,
        best ? `${money(Number(best.premio))} (${best.seguradora})` : "",
        r.status === "calculada" ? "Aberta" : r.status === "proposta" ? "Em ajuste" : r.status,
        new Date(r.criado_em).toLocaleDateString("pt-BR"),
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "em-negociacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function abrirCalculo(id: string) {
    void nav({ to: "/venda/novo-lead", search: { id, step: 5 } });
  }

  function negociarProposta(propostaId: string) {
    void navigate({ search: (s) => ({ ...s, selected: propostaId }) });
  }

  const propostaSelecionada = selected
    ? (finalizadaRows.flatMap((r) => r.propostas ?? []).find((p) => p.id === selected) ?? null)
    : null;
  const seguradoDaSelecionada = selected
    ? (finalizadaRows.find((r) => r.propostas?.some((p) => p.id === selected))?.segurado?.nome ??
      null)
    : null;

  return (
    <AppShell title="Em negociação">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Em negociação</h1>
          <div className="sub">
            {totalNegociacao} cotações em negociação · {finalizadaFiltrada.length} já calculadas ·
            valor total estimado <strong>{money(totVal)}/ano</strong>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Ver no pipeline
          </Link>
          <button className="btn btn-ghost" onClick={exportar}>
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select className="select-mini">
          <option>Período · este mês</option>
          <option>Últimos 30 dias</option>
        </select>
        <select className="select-mini">
          <option>Status · todos</option>
          <option>Aberta</option>
          <option>Em ajuste</option>
        </select>
        <select
          className="select-mini"
          value={fSeguradora}
          onChange={(e) => setFSeguradora(e.target.value)}
        >
          <option value="">Seguradora · todas</option>
          {seguradoras.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fFaixa} onChange={(e) => setFFaixa(e.target.value)}>
          <option value="">Faixa · todas</option>
          {FAIXAS.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          className="select-mini"
          placeholder="Buscar segurado, placa, nº cotação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          className="btn-link btn-sm"
          onClick={() => {
            setQ("");
            setFSeguradora("");
            setFFaixa("");
          }}
        >
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && (
        <>
          <div className="card" data-tour="em-negociacao-aguardando" style={{ padding: 0 }}>
            <div className="card-h">
              <h3>
                <svg width={16} height={16} aria-hidden="true">
                  <use href="#i-clock" />
                </svg>{" "}
                Aguardando cotação{" "}
                <span className="muted small" style={{ fontWeight: 500 }}>
                  — {aguardandoFiltrada.length}
                </span>
              </h3>
              <span className="chip chip-slate">seguradoras calculando</span>
            </div>
            <div style={{ overflow: "hidden" }}>
              <AguardandoCotacaoLista rows={aguardandoFiltrada} onReabrir={abrirCalculo} />
            </div>
          </div>

          <div
            className="card"
            data-tour="em-negociacao-finalizada"
            style={{ padding: 0, marginTop: 16 }}
          >
            <div className="card-h">
              <h3>
                <svg width={16} height={16} aria-hidden="true">
                  <use href="#i-check-circle" />
                </svg>{" "}
                Cotação finalizada{" "}
                <span className="muted small" style={{ fontWeight: 500 }}>
                  — {finalizadaFiltrada.length}
                </span>
              </h3>
              <span className="chip chip-yellow">preço na mão · negocie</span>
            </div>
            <div style={{ overflow: "hidden" }}>
              <CotacaoFinalizadaLista
                rows={finalizadaFiltrada}
                selectedPropostaId={selected}
                rowRefs={rowRefs}
                onAbrirCalculo={abrirCalculo}
                onNegociar={negociarProposta}
              />
            </div>
          </div>
        </>
      )}

      <div className="clt-note" style={{ marginTop: 14 }}>
        <svg width={15} height={15}>
          <use href="#i-info" />
        </svg>
        <div>
          A lista de cima <strong>se atualiza sozinha</strong>: quando a última seguradora devolve o
          preço, a cotação desce para <strong>Cotação finalizada</strong> e você recebe um aviso na
          tela — é a hora de ligar para o cliente.
        </div>
      </div>

      {propostaSelecionada && (
        <NegociacaoPropostaPanel
          proposta={{
            id: propostaSelecionada.id,
            numero: propostaSelecionada.numero,
            seguradora: propostaSelecionada.seguradora,
            premio: propostaSelecionada.premio,
            valor: propostaSelecionada.valor,
            negociacao_status: propostaSelecionada.negociacao_status,
            prazo_resposta: propostaSelecionada.prazo_resposta,
            segurado: seguradoDaSelecionada,
          }}
          onChanged={() => void refetchFinalizada()}
        />
      )}
    </AppShell>
  );
}
