// Inbox de Aprovações (G3.4) — pedidos de desconto multinível pendentes de
// decisão do usuário logado. A RLS já escopa quem pode ver/agir; aqui
// filtramos por nivel_atual = auth.uid() (ou nivel_atual is null p/ matriz,
// sentinela de "pendente na Matriz" — ver G3.2).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";

export const Route = createFileRoute("/_authenticated/operacao/aprovacoes")({
  head: () => ({ meta: [{ title: "Aprovações · CoteCerto" }] }),
  component: Page,
});

type Solicitacao = {
  id: string;
  cotacao_id: string;
  seguradora_id: string;
  pct_pedido: number;
  pct_concedido: number | null;
  status: string;
  criado_em: string;
  solicitante: { nome: string | null } | null;
  seguradora: { nome: string | null } | null;
  cotacao: { numero: number | null; criado_em: string | null } | null;
};

type RespostaPadrao = { id: string; titulo: string; texto: string };

type TrilhaItem = {
  id: string;
  acao: string;
  pct: number | null;
  observacao: string | null;
  criado_em: string;
  autor: { nome: string | null } | null;
};

// Chaves = valores gravados em desconto_trilha.acao pelas RPCs (verbos no
// passado: solicitou/aprovou/contrapropos/aceitou/negou/escalou/cancelou).
const ACAO_LABEL: Record<string, string> = {
  solicitou: "Solicitou",
  aprovou: "Aprovou",
  contrapropos: "Contraproposta",
  aceitou: "Aceitou",
  negou: "Negou",
  escalou: "Escalou",
  cancelou: "Cancelou",
};

function fmtDate(s: string | null) {
  return s
    ? new Date(s).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function cotNum(numero: number | null | undefined, criado: string | null | undefined) {
  if (numero == null || !criado) return "—";
  return `COT-${new Date(criado).getFullYear()}-${String(numero).padStart(5, "0")}`;
}

/** Modal genérico de ação (aprovar/contrapropor/negar) com pct + observação opcionais. */
function AcaoModal({
  titulo,
  showPct,
  pctDefault,
  showObs,
  seguradoraId,
  busy,
  err,
  onClose,
  onConfirm,
}: {
  titulo: string;
  showPct: boolean;
  pctDefault?: number;
  showObs: boolean;
  seguradoraId?: string;
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onConfirm: (pct: number | null, obs: string) => void;
}) {
  const [pct, setPct] = useState(pctDefault != null ? String(pctDefault) : "");
  const [obs, setObs] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<RespostaPadrao[]>([]);
  const [respostaSel, setRespostaSel] = useState("");

  useEffect(() => {
    if (!showObs) return;
    let active = true;
    (async () => {
      let query = supabase
        .from("respostas_padrao")
        .select("id,titulo,texto")
        .eq("ativo", true)
        .order("titulo");
      query = seguradoraId
        ? query.or(`seguradora_id.is.null,seguradora_id.eq.${seguradoraId}`)
        : query.is("seguradora_id", null);
      const { data, error } = await query;
      if (!active) return;
      if (!error) setRespostas(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [showObs, seguradoraId]);

  function inserirResposta(id: string) {
    setRespostaSel(id);
    if (!id) return;
    const r = respostas.find((x) => x.id === id);
    if (!r) return;
    setObs((prev) => (prev.trim() ? `${prev.trim()}\n${r.texto}` : r.texto));
    setRespostaSel("");
  }

  function handleConfirm() {
    setLocalErr(null);
    let pctNum: number | null = null;
    if (showPct) {
      pctNum = Number(pct.replace(",", "."));
      if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100) {
        setLocalErr("Informe um percentual entre 0 e 100.");
        return;
      }
    }
    onConfirm(pctNum, obs);
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <h3>{titulo}</h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <div className="modal-b">
          {(err || localErr) && (
            <div className="banner alert" style={{ marginBottom: 12 }}>
              {err || localErr}
            </div>
          )}
          {showPct && (
            <div className="field-group">
              <label>Percentual</label>
              <input
                className="input"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                placeholder="ex.: 10"
                inputMode="decimal"
                maxLength={6}
              />
            </div>
          )}
          {showObs && (
            <div className="field-group">
              <label>Observação {showPct ? "(opcional)" : ""}</label>
              {respostas.length > 0 && (
                <select
                  className="input input-mini"
                  style={{ marginBottom: 6 }}
                  value={respostaSel}
                  onChange={(e) => inserirResposta(e.target.value)}
                >
                  <option value="">Inserir resposta padrão…</option>
                  {respostas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                className="input"
                rows={3}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                maxLength={500}
              />
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-yellow" disabled={busy} onClick={handleConfirm}>
            {busy ? "Enviando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Trilha (histórico) de um pedido, carregada sob demanda ao expandir. */
function Trilha({ solicitacaoId }: { solicitacaoId: string }) {
  const [items, setItems] = useState<TrilhaItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("desconto_trilha")
        .select("id,acao,pct,observacao,criado_em,autor:profiles(nome)")
        .eq("solicitacao_id", solicitacaoId)
        .order("criado_em", { ascending: true });
      if (!active) return;
      if (error) setErr(error.message);
      setItems((data as unknown as TrilhaItem[]) ?? []);
    })();
    return () => {
      active = false;
    };
  }, [solicitacaoId]);

  if (err) return <div style={{ color: "var(--alert)", padding: 8 }}>{err}</div>;
  if (!items)
    return (
      <div className="muted small" style={{ padding: 8 }}>
        Carregando histórico…
      </div>
    );
  if (items.length === 0)
    return (
      <div className="muted small" style={{ padding: 8 }}>
        Sem histórico.
      </div>
    );

  return (
    <div style={{ padding: "8px 4px" }}>
      {items.map((it) => (
        <div
          key={it.id}
          style={{
            display: "flex",
            gap: 8,
            padding: "6px 0",
            borderBottom: "1px solid var(--border)",
            fontSize: 13,
          }}
        >
          <span className="chip chip-outline" style={{ minWidth: 110, textAlign: "center" }}>
            {ACAO_LABEL[it.acao] ?? it.acao}
          </span>
          <span className="muted" style={{ minWidth: 130 }}>
            {fmtDate(it.criado_em)}
          </span>
          <span style={{ minWidth: 140 }}>{it.autor?.nome ?? "—"}</span>
          {it.pct != null && <span>{Number(it.pct).toFixed(1)}%</span>}
          {it.observacao && <span className="muted">— {it.observacao}</span>}
        </div>
      ))}
    </div>
  );
}

function Page() {
  const { role } = useAuth();
  const { loading: scopeLoading, isFranqIndividual } = useGroupScope();
  const [rows, setRows] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [politicas, setPoliticas] = useState<Record<string, number>>({});
  const [politicasLoaded, setPoliticasLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acao, setAcao] = useState<{
    tipo: "aprovar" | "contrapropor" | "negar" | "escalar";
    sol: Solicitacao;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const modelo: string | null = useMemo(() => {
    if (role === "matriz") return null; // sem alçada — ilimitada
    if (role === "master") return "master";
    if (role === "supervisor") return "supervisor";
    if (role === "franqueado") return isFranqIndividual ? "franquia_individual" : "franquia_full";
    return null;
  }, [role, isFranqIndividual]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id ?? null;
    let query = supabase
      .from("desconto_solicitacoes")
      .select(
        "id,cotacao_id,seguradora_id,pct_pedido,pct_concedido,status,criado_em," +
          "solicitante:profiles!desconto_solicitacoes_solicitante_id_fkey(nome)," +
          "seguradora:seguradoras(nome)," +
          "cotacao:cotacoes(numero,criado_em)",
      )
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });

    if (role === "matriz") {
      query = query.is("nivel_atual", null);
    } else if (uid) {
      query = query.eq("nivel_atual", uid);
    }

    const { data, error } = await query;
    if (error) setErr(error.message);
    setRows((data as unknown as Solicitacao[]) ?? []);
    setLoading(false);
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  // Alçada por seguradora envolvida na lista (só quando há política pra buscar).
  useEffect(() => {
    if (!modelo) return; // matriz: ilimitada, não precisa buscar
    const ids = Array.from(new Set(rows.map((r) => r.seguradora_id)));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("desconto_politicas")
        .select("seguradora_id,pct_maximo")
        .eq("modelo", modelo)
        .in("seguradora_id", ids);
      const map: Record<string, number> = {};
      for (const p of data ?? []) map[p.seguradora_id] = Number(p.pct_maximo);
      setPoliticas(map);
      setPoliticasLoaded(true);
    })();
  }, [rows, modelo]);

  function alcadaLabel(seguradoraId: string) {
    if (role === "matriz") return "ilimitada";
    if (!politicasLoaded) return "…"; // evita "sem política" piscar antes de carregar
    const max = politicas[seguradoraId];
    if (max == null) return "sem política — escale";
    return `${max}%`;
  }

  function closeAcao() {
    setAcao(null);
    setActionErr(null);
  }

  async function confirmarAprovar(sol: Solicitacao, pct: number) {
    setBusy(true);
    setActionErr(null);
    const { error } = await supabase.rpc("aprovar_desconto", {
      p_id: sol.id,
      p_pct_concedido: pct,
    });
    setBusy(false);
    if (error) {
      setActionErr(
        error.message?.toLowerCase().includes("alçada") ||
          error.message?.toLowerCase().includes("alcada")
          ? "Acima da sua alçada — use Contrapropor ou Escalar."
          : error.message,
      );
      return;
    }
    setFeedback("Desconto aprovado.");
    closeAcao();
    await load();
  }

  async function confirmarContrapropor(sol: Solicitacao, pct: number, obs: string) {
    setBusy(true);
    setActionErr(null);
    const { error } = await supabase.rpc("contrapropor_desconto", {
      p_id: sol.id,
      p_pct_novo: pct,
      p_obs: obs || undefined,
    });
    setBusy(false);
    if (error) {
      setActionErr(error.message);
      return;
    }
    setFeedback("Contraproposta enviada ao solicitante.");
    closeAcao();
    await load();
  }

  async function confirmarNegar(sol: Solicitacao, obs: string) {
    setBusy(true);
    setActionErr(null);
    const { error } = await supabase.rpc("negar_desconto", {
      p_id: sol.id,
      p_obs: obs || undefined,
    });
    setBusy(false);
    if (error) {
      setActionErr(error.message);
      return;
    }
    setFeedback("Pedido negado.");
    closeAcao();
    await load();
  }

  async function handleEscalar(sol: Solicitacao) {
    if (!window.confirm("Escalar este pedido para o superior?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("escalar_desconto", { p_id: sol.id });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setFeedback("Pedido escalado.");
    await load();
  }

  return (
    <AppShell title="Aprovações" crumbs="Grupo">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Aprovações</h1>
          <div className="sub">
            {role === "matriz"
              ? "Pedidos de desconto endereçados à Matriz (última instância) e respostas-padrão"
              : "Pedidos que sobem para você — aprove dentro da sua alçada ou escale ao superior"}
          </div>
        </div>
      </div>

      {feedback && (
        <div className="banner ok" style={{ marginBottom: 12 }}>
          {feedback}
        </div>
      )}
      {err && (
        <div className="banner alert" style={{ marginBottom: 12 }}>
          {err}
        </div>
      )}

      {(loading || scopeLoading) && <div className="muted">Carregando…</div>}

      {!loading && !scopeLoading && rows.length === 0 && !err && (
        <div className="card">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhum pedido pendente pra você.
          </div>
        </div>
      )}

      {!loading &&
        !scopeLoading &&
        rows.map((sol) => (
          <div key={sol.id} className="card" style={{ marginBottom: 12 }}>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <strong>{sol.solicitante?.nome ?? "—"}</strong>
                  <span className="muted"> pediu </span>
                  <strong>{Number(sol.pct_pedido).toFixed(1)}%</strong>
                  <span className="muted"> em </span>
                  <strong>{sol.seguradora?.nome ?? "—"}</strong>
                  <div className="muted small">
                    Cotação {cotNum(sol.cotacao?.numero, sol.cotacao?.criado_em)} ·{" "}
                    {fmtDate(sol.criado_em)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="chip chip-info">
                    Sua alçada: {alcadaLabel(sol.seguradora_id)}
                  </span>
                </div>
              </div>

              <div className="tools" style={{ flexWrap: "wrap" }}>
                <button
                  className="btn btn-yellow btn-sm"
                  disabled={busy}
                  onClick={() => setAcao({ tipo: "aprovar", sol })}
                >
                  Aprovar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => setAcao({ tipo: "contrapropor", sol })}
                >
                  Contrapropor
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => setAcao({ tipo: "negar", sol })}
                >
                  Negar
                </button>
                {role !== "matriz" && (
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => handleEscalar(sol)}
                  >
                    Escalar
                  </button>
                )}
                <Link
                  to="/venda/cotacoes/$id"
                  params={{ id: sol.cotacao_id }}
                  className="btn btn-ghost btn-sm"
                >
                  Ver cotação
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedId(expandedId === sol.id ? null : sol.id)}
                >
                  {expandedId === sol.id ? "Ocultar histórico" : "Ver histórico"}
                </button>
              </div>

              {expandedId === sol.id && <Trilha solicitacaoId={sol.id} />}
            </div>
          </div>
        ))}

      {acao?.tipo === "aprovar" && (
        <AcaoModal
          titulo={`Aprovar desconto — ${acao.sol.seguradora?.nome ?? ""}`}
          showPct
          pctDefault={Number(acao.sol.pct_pedido)}
          showObs={false}
          busy={busy}
          err={actionErr}
          onClose={closeAcao}
          onConfirm={(pct) => pct != null && confirmarAprovar(acao.sol, pct)}
        />
      )}
      {acao?.tipo === "contrapropor" && (
        <AcaoModal
          titulo={`Contrapropor — ${acao.sol.seguradora?.nome ?? ""}`}
          showPct
          showObs
          seguradoraId={acao.sol.seguradora_id}
          busy={busy}
          err={actionErr}
          onClose={closeAcao}
          onConfirm={(pct, obs) => pct != null && confirmarContrapropor(acao.sol, pct, obs)}
        />
      )}
      {acao?.tipo === "negar" && (
        <AcaoModal
          titulo={`Negar pedido — ${acao.sol.seguradora?.nome ?? ""}`}
          showPct={false}
          showObs
          seguradoraId={acao.sol.seguradora_id}
          busy={busy}
          err={actionErr}
          onClose={closeAcao}
          onConfirm={(_pct, obs) => confirmarNegar(acao.sol, obs)}
        />
      )}
    </AppShell>
  );
}
