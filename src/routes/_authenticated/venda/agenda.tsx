// "Minha agenda" (Frente 9 · V12) — lista única de pendências do vendedor,
// juntando 3 fontes reais (retornos agendados, negócios em risco e
// lembretes pessoais), ordenada por urgência (atrasado > hoje > amanhã >
// resto). Espelha render_agenda() do protótipo v12, mas sem "pendência da
// seguradora"/"aprovações" (fora do escopo v1 — decisão do usuário).
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { AgendaItemRow } from "@/components/venda/agenda/agenda-item-row";
import { NovoLembreteModal } from "@/components/venda/agenda/novo-lembrete-modal";
import { useAuth } from "@/lib/auth";
import { classificarUrgencia } from "@/lib/agenda";
import { useAgendaItens } from "@/lib/use-agenda-itens";

export const Route = createFileRoute("/_authenticated/venda/agenda")({
  head: () => ({ meta: [{ title: "Minha agenda · CoteCerto" }] }),
  component: Page,
});

function Page() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [novoLembreteOpen, setNovoLembreteOpen] = useState(false);
  const { itens, loading, err, busyId, marcarFeito, abrirItem, invalidarTudo } = useAgendaItens();

  const atrasados = itens.filter((i) => classificarUrgencia(i.data).ord === 0).length;
  const hoje = itens.filter((i) => classificarUrgencia(i.data).ord === 1).length;

  return (
    <AppShell title="Minha agenda">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Minha agenda</h1>
          <div className="sub">
            Tudo que espera por você — retornos agendados, negócios em risco e os seus lembretes
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-yellow" onClick={() => setNovoLembreteOpen(true)}>
            <svg width={14} height={14} aria-hidden="true">
              <use href="#i-plus" />
            </svg>{" "}
            Novo lembrete
          </button>
        </div>
      </div>

      <div className="summary-chips">
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
              — {itens.length}
            </span>
          </h3>
        </div>
        <div className="card-b" style={{ padding: loading || itens.length ? "14px 16px" : 0 }}>
          {loading && <div className="muted">Carregando…</div>}

          {!loading && itens.length === 0 && (
            <div className="empty-state">
              <div className="ico">
                <svg width={28} height={28} aria-hidden="true">
                  <use href="#i-check-circle" />
                </svg>
              </div>
              <h3>Nada pendente por aqui</h3>
              <p>
                Quando você agendar um retorno, criar um lembrete ou uma negociação ficar parada,
                aparece nesta lista.
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
            itens.map((item) => (
              <AgendaItemRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                onOpen={() => void abrirItem(item)}
                onConcluir={item.fonte !== "risco" ? () => void marcarFeito(item) : undefined}
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
