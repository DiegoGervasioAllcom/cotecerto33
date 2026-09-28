// "Minha agenda" (Frente 9 · V12) — lista única de pendências do vendedor,
// juntando 5 fontes reais (retornos agendados, negócios em risco, pendência
// da seguradora, aprovações pedidas e lembretes pessoais), ordenada por
// urgência (atrasado > hoje > amanhã > resto). Espelha render_agenda() do
// protótipo v12, com os chips de filtro por tipo (agFiltro/agSetFiltro).
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { AgendaFiltroChips } from "@/components/venda/agenda/agenda-filtro-chips";
import { AgendaItemRow } from "@/components/venda/agenda/agenda-item-row";
import { AgendaTutorialPreviewRow } from "@/components/venda/agenda/agenda-tutorial-preview";
import { NovoLembreteModal } from "@/components/venda/agenda/novo-lembrete-modal";
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { useAuth } from "@/lib/auth";
import {
  classificarUrgencia,
  contarPorFonte,
  filtrarPorFonte,
  type FonteAgenda,
} from "@/lib/agenda";
import { useAgendaItens } from "@/lib/use-agenda-itens";

export const Route = createFileRoute("/_authenticated/venda/agenda")({
  head: () => ({ meta: [{ title: "Minha agenda · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [novoLembreteOpen, setNovoLembreteOpen] = useState(false);
  const [filtro, setFiltro] = useState<FonteAgenda | "todos">("todos");
  const { itens, loading, err, busyId, marcarFeito, abrirItem, invalidarTudo } = useAgendaItens();
  // Tutorial do vendedor (cap. 2) — exemplo estático quando o vendedor ainda
  // não tem nenhum item real na agenda (ver `agenda-tutorial-preview.tsx`).
  const tutorialAtivo = useTutorialPreview() === "agenda-exemplo";

  const atrasados = itens.filter((i) => classificarUrgencia(i.data).ord === 0).length;
  const hoje = itens.filter((i) => classificarUrgencia(i.data).ord === 1).length;
  const contagem = useMemo(() => contarPorFonte(itens), [itens]);
  const itensFiltrados = useMemo(() => filtrarPorFonte(itens, filtro), [itens, filtro]);

  return (
    <AppShell title="Minha agenda">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Minha agenda</h1>
          <div className="sub">
            Tudo que espera por você — retornos, negócios em risco, seguradora, aprovações e os seus
            lembretes
          </div>
        </div>
        <div className="tools">
          <button
            id="btnNovoLembrete"
            data-tour="agenda-novo-lembrete"
            className="btn btn-yellow"
            onClick={() => setNovoLembreteOpen(true)}
          >
            <svg width={14} height={14} aria-hidden="true">
              <use href="#i-plus" />
            </svg>{" "}
            Novo lembrete
          </button>
        </div>
      </div>

      <div className="summary-chips" data-tour="agenda-resumo">
        <div className={`sum-chip${atrasados ? " alert" : ""}`}>
          <span className="sc-val">{atrasados}</span>
          <span className="sc-lbl">Atrasados</span>
        </div>
        <div className="sum-chip">
          <span className="sc-val">{hoje}</span>
          <span className="sc-lbl">Para hoje</span>
        </div>
        <div className="sum-chip ok">
          <span className="sc-val">{itens.length}</span>
          <span className="sc-lbl">No total</span>
        </div>
      </div>

      <AgendaFiltroChips contagem={contagem} filtro={filtro} onFiltrar={setFiltro} />

      {err && (
        <div className="alert alert-err" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>
            <svg width={16} height={16} aria-hidden="true">
              <use href="#i-calendar" />
            </svg>{" "}
            Pendências{" "}
            <span className="muted small" style={{ fontWeight: 500 }}>
              {filtro === "todos"
                ? `— ${itens.length}`
                : `— ${itensFiltrados.length} de ${itens.length}`}
            </span>
          </h3>
        </div>
        <div
          className="card-b"
          style={{ padding: loading || itensFiltrados.length ? "14px 16px" : 0 }}
        >
          {loading && <div className="muted">Carregando…</div>}

          <AgendaTutorialPreviewRow />

          {!loading && !tutorialAtivo && itensFiltrados.length === 0 && itens.length > 0 && (
            <div className="empty-state">
              <div className="ico">
                <svg width={28} height={28} aria-hidden="true">
                  <use href="#i-check-circle" />
                </svg>
              </div>
              <h3>Nada pendente nesse filtro</h3>
              <p>Limpe o filtro para ver todas as pendências.</p>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setFiltro("todos")}
              >
                <svg width={13} height={13} aria-hidden="true">
                  <use href="#i-x" />
                </svg>{" "}
                Limpar filtro
              </button>
            </div>
          )}

          {!loading && !tutorialAtivo && itens.length === 0 && (
            <div className="empty-state">
              <div className="ico">
                <svg width={28} height={28} aria-hidden="true">
                  <use href="#i-check-circle" />
                </svg>
              </div>
              <h3>Nada pendente por aqui</h3>
              <p>
                Quando você agendar um retorno, criar um lembrete ou a seguradora devolver uma
                pendência, aparece nesta lista.
              </p>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => setNovoLembreteOpen(true)}
              >
                <svg width={13} height={13} aria-hidden="true">
                  <use href="#i-plus" />
                </svg>{" "}
                Criar um lembrete
              </button>
            </div>
          )}

          {!loading &&
            itensFiltrados.map((item) => (
              <AgendaItemRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onOpen={() => void abrirItem(item)}
                onConcluir={
                  item.fonte === "retorno" || item.fonte === "lembrete"
                    ? () => void marcarFeito(item)
                    : undefined
                }
              />
            ))}
        </div>
      </div>

      {novoLembreteOpen && uid && (
        <NovoLembreteModal
          vendedorId={uid}
          onClose={() => setNovoLembreteOpen(false)}
          onCreated={() => {
            setNovoLembreteOpen(false);
            invalidarTudo();
          }}
        />
      )}
    </AppShell>
  );
}
