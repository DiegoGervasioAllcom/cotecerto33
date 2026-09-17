// "Minha agenda" (Frente 9 · V12) — lista única de pendências do vendedor,
// juntando 3 fontes reais (retornos agendados, negócios em risco e
// lembretes pessoais), ordenada por urgência (atrasado > hoje > amanhã >
// resto). Espelha render_agenda() do protótipo v12, mas sem "pendência da
// seguradora"/"aprovações" (fora do escopo v1 — decisão do usuário).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { AgendaItemRow } from "@/components/venda/agenda/agenda-item-row";
import { NovoLembreteModal } from "@/components/venda/agenda/novo-lembrete-modal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  classificarUrgencia,
  fetchLembretesAgenda,
  fetchRetornosAgenda,
  fetchRiscoAgenda,
  montarAgenda,
  type AgendaItem,
} from "@/lib/agenda";
import { resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";

export const Route = createFileRoute("/_authenticated/venda/agenda")({
  head: () => ({ meta: [{ title: "Minha agenda · CoteCerto" }] }),
  component: Page,
});

const QK_RETORNOS = ["agenda", "retornos"] as const;
const QK_RISCO = ["agenda", "risco"] as const;
const QK_LEMBRETES = ["agenda", "lembretes"] as const;

function Page() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [novoLembreteOpen, setNovoLembreteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const retornosQuery = useQuery({
    queryKey: [...QK_RETORNOS, uid],
    queryFn: () => fetchRetornosAgenda(uid!),
    enabled: !!uid,
  });
  const riscoQuery = useQuery({ queryKey: QK_RISCO, queryFn: () => fetchRiscoAgenda() });
  const lembretesQuery = useQuery({ queryKey: QK_LEMBRETES, queryFn: fetchLembretesAgenda });

  const loading =
    !uid || retornosQuery.isPending || riscoQuery.isPending || lembretesQuery.isPending;
  const queryErr =
    (retornosQuery.error instanceof Error ? retornosQuery.error.message : null) ??
    (riscoQuery.error instanceof Error ? riscoQuery.error.message : null) ??
    (lembretesQuery.error instanceof Error ? lembretesQuery.error.message : null);

  const itens = useMemo(
    () => montarAgenda(retornosQuery.data ?? [], riscoQuery.data ?? [], lembretesQuery.data ?? []),
    [retornosQuery.data, riscoQuery.data, lembretesQuery.data],
  );

  const atrasados = itens.filter((i) => classificarUrgencia(i.data).ord === 0).length;
  const hoje = itens.filter((i) => classificarUrgencia(i.data).ord === 1).length;

  function invalidarTudo() {
    void queryClient.invalidateQueries({ queryKey: QK_RETORNOS });
    void queryClient.invalidateQueries({ queryKey: QK_LEMBRETES });
  }

  async function marcarFeito(item: AgendaItem) {
    const [, rawId] = item.id.split(":");
    if (!rawId) return;
    setErr(null);
    setBusyId(item.id);
    const tabela = item.fonte === "retorno" ? "lead_agendamentos" : "lembretes";
    const { error } = await supabase.from(tabela).update({ done: true }).eq("id", rawId);
    setBusyId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    invalidarTudo();
  }

  async function abrirItem(item: AgendaItem) {
    if (abrindo) return;
    setErr(null);
    if (item.fonte === "risco") {
      if (item.cotacaoId)
        void navigate({ to: "/venda/novo-lead", search: { id: item.cotacaoId, step: 5 } });
      return;
    }
    if (!item.leadId || !item.statusPipeline) return;
    setAbrindo(true);
    try {
      const destino = await resolveExistingLeadDestination({
        leadId: item.leadId,
        status: item.statusPipeline,
        canAssume: true,
      });
      if (destino.kind === "wizard") {
        void navigate({ to: "/venda/novo-lead", search: { id: destino.id, step: destino.step } });
      } else if (destino.kind === "proposals") {
        void navigate({
          to: "/venda/em-negociacao",
          search: destino.selected ? { selected: destino.selected } : {},
        });
      } else if (destino.kind === "acceptance") {
        void navigate({
          to: "/venda/em-finalizacao",
          search: destino.selected ? { selected: destino.selected } : {},
        });
      } else {
        setErr(destino.message);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao abrir o lead.");
    } finally {
      setAbrindo(false);
    }
  }

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

      {(err || queryErr) && (
        <div className="alert alert-err" style={{ marginBottom: 12 }}>
          {err ?? queryErr}
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
