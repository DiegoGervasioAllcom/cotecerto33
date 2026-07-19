import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { premiacaoCampanhaSchema, premiacaoLancamentoSchema } from "@/lib/schemas/catalogos.schema";

export const Route = createFileRoute("/_authenticated/operacao/premiacoes")({
  head: () => ({ meta: [{ title: "Premiações · CoteCerto" }] }),
  component: Page,
});

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function currentCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaLabel(c: string) {
  const [ano, mes] = c.split("-");
  const nomes = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  const idx = Number(mes) - 1;
  return `${nomes[idx] ?? mes} / ${ano}`;
}

type Campanha = {
  id: string;
  nome: string;
  seguradora_id: string | null;
  competencia: string | null;
  descricao: string | null;
  ativa: boolean;
};

type Lancamento = {
  id: string;
  campanha_id: string;
  vendedor_id: string;
  empresa_id: string | null;
  competencia: string | null;
  valor: number;
  status: string;
  pago_em: string | null;
  observacao: string | null;
};

type Seguradora = { id: string; nome: string };
type Profile = { id: string; nome: string };
type Empresa = { id: string; nome: string };

function Page() {
  const { role } = useAuth();
  const isMatriz = role === "matriz";

  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);
  const [vendedores, setVendedores] = useState<Profile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [competencia, setCompetencia] = useState<string>(currentCompetencia());

  const [modal, setModal] = useState<null | "campanhas" | "lancar">(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const [c, l, sg, vd, em] = await Promise.all([
      supabase
        .from("premiacao_campanhas")
        .select("id,nome,seguradora_id,competencia,descricao,ativa")
        .order("criado_em", { ascending: false }),
      supabase
        .from("premiacao_lancamentos")
        .select("id,campanha_id,vendedor_id,empresa_id,competencia,valor,status,pago_em,observacao")
        .order("criado_em", { ascending: false }),
      supabase.from("seguradoras").select("id,nome").order("nome"),
      supabase.from("profiles").select("id,nome").order("nome"),
      supabase.from("empresas").select("id,nome").order("nome"),
    ]);
    if (c.error) setErr(c.error.message);
    if (l.error) setErr(l.error.message);
    setCampanhas((c.data ?? []) as Campanha[]);
    setLancamentos((l.data ?? []) as Lancamento[]);
    setSeguradoras((sg.data ?? []) as Seguradora[]);
    setVendedores((vd.data ?? []) as Profile[]);
    setEmpresas((em.data ?? []) as Empresa[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const campanhaById = useMemo(() => new Map(campanhas.map((c) => [c.id, c])), [campanhas]);
  const vendedorById = useMemo(() => new Map(vendedores.map((v) => [v.id, v])), [vendedores]);
  const empresaById = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas]);

  const lancsMes = useMemo(
    () => lancamentos.filter((l) => !competencia || l.competencia === competencia),
    [lancamentos, competencia],
  );

  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    lancamentos.forEach((l) => l.competencia && set.add(l.competencia));
    set.add(currentCompetencia());
    return Array.from(set).sort().reverse();
  }, [lancamentos]);

  const kpis = useMemo(() => {
    const total = lancsMes.reduce((a, c) => a + Number(c.valor), 0);
    const pago = lancsMes
      .filter((l) => l.status === "pago")
      .reduce((a, c) => a + Number(c.valor), 0);
    const aberto = total - pago;
    return {
      total,
      pago,
      aberto,
      qtdTotal: lancsMes.length,
      qtdPago: lancsMes.filter((l) => l.status === "pago").length,
      qtdAberto: lancsMes.filter((l) => l.status !== "pago").length,
    };
  }, [lancsMes]);

  const porCampanha = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; pago: number; aberto: number }>();
    lancsMes.forEach((l) => {
      const nome = campanhaById.get(l.campanha_id)?.nome ?? "—";
      const cur = map.get(l.campanha_id) ?? { nome, total: 0, pago: 0, aberto: 0 };
      cur.total += Number(l.valor);
      if (l.status === "pago") cur.pago += Number(l.valor);
      else cur.aberto += Number(l.valor);
      map.set(l.campanha_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [lancsMes, campanhaById]);

  const ranking = useMemo(() => {
    const map = new Map<string, { nome: string; franq: string; total: number }>();
    lancsMes.forEach((l) => {
      const nome = vendedorById.get(l.vendedor_id)?.nome ?? "—";
      const franq = l.empresa_id ? (empresaById.get(l.empresa_id)?.nome ?? "—") : "—";
      const cur = map.get(l.vendedor_id) ?? { nome, franq, total: 0 };
      cur.total += Number(l.valor);
      map.set(l.vendedor_id, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [lancsMes, vendedorById, empresaById]);

  const maxCampanha = Math.max(1, ...porCampanha.map((c) => c.total));

  async function togglePago(l: Lancamento) {
    const novoStatus = l.status === "pago" ? "a_pagar" : "pago";
    const { error } = await supabase
      .from("premiacao_lancamentos")
      .update({
        status: novoStatus,
        pago_em: novoStatus === "pago" ? new Date().toISOString() : null,
      })
      .eq("id", l.id);
    if (error) setErr(error.message);
    void load();
  }

  async function removerLancamento(l: Lancamento) {
    if (!confirm("Remover este lançamento de premiação?")) return;
    const { error } = await supabase.from("premiacao_lancamentos").delete().eq("id", l.id);
    if (error) setErr(error.message);
    void load();
  }

  return (
    <AppShell title="Premiações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Premiações</h1>
          <div className="sub">Campanhas de premiação — quem ganhou e o que falta pagar</div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
          >
            {competenciasDisponiveis.map((c) => (
              <option key={c} value={c}>
                {competenciaLabel(c)}
              </option>
            ))}
          </select>
          {isMatriz && (
            <>
              <button className="btn btn-ghost" onClick={() => setModal("campanhas")}>
                <svg width="14" height="14">
                  <use href="#i-layers" />
                </svg>{" "}
                Campanhas
              </button>
              <button className="btn btn-primary" onClick={() => setModal("lancar")}>
                <svg width="14" height="14">
                  <use href="#i-award" />
                </svg>{" "}
                Lançar ganhador
              </button>
            </>
          )}
        </div>
      </div>

      {err && <div style={{ color: "var(--alert)", marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : lancamentos.length === 0 && campanhas.length === 0 ? (
        <div className="card">
          <div className="card-b" style={{ textAlign: "center", padding: "40px 20px" }}>
            <h3 style={{ color: "var(--slate)", margin: "6px 0 4px" }}>
              Nenhuma premiação lançada
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {isMatriz
                ? "Cadastre uma campanha e lance o primeiro ganhador."
                : "Ainda não há premiações registradas."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mkpi-grid">
            <div className="kpi">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-award" />
                </svg>
              </div>
              <div className="lbl">PREMIAÇÃO TOTAL</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.total)}
              </div>
              <div className="meta">{kpis.qtdTotal} premiações no mês</div>
            </div>
            <div className="kpi k-ok">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-check-circle" />
                </svg>
              </div>
              <div className="lbl">JÁ PAGO</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.pago)}
              </div>
              <div className="meta">{kpis.qtdPago} premiações</div>
            </div>
            <div className="kpi k-alert">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-clock" />
                </svg>
              </div>
              <div className="lbl">SALDO A PAGAR</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.aberto)}
              </div>
              <div className="meta">{kpis.qtdAberto} em aberto</div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="card">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-layers" />
                  </svg>{" "}
                  Por campanha
                </h3>
              </div>
              <div className="card-b">
                <div className="funnel">
                  {porCampanha.length === 0 && (
                    <div className="muted small">Sem lançamentos nesta competência.</div>
                  )}
                  {porCampanha.map((c) => (
                    <div className="funnel-row" key={c.nome}>
                      <div className="fn-lbl" style={{ width: 160 }}>
                        {c.nome}
                      </div>
                      <div className="funnel-track" style={{ height: 22 }}>
                        <div
                          className="funnel-bar"
                          style={{
                            height: 22,
                            width: `${Math.max(12, Math.round((c.total / maxCampanha) * 100))}%`,
                            background: "var(--yellow)",
                            color: "var(--slate)",
                          }}
                        >
                          {fmtBRL(c.total)}
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
                  <svg width="16" height="16">
                    <use href="#i-award" />
                  </svg>{" "}
                  Ranking de premiação
                </h3>
              </div>
              <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {ranking.length === 0 && (
                  <div className="muted small">Sem lançamentos nesta competência.</div>
                )}
                {ranking.map((r, i) => (
                  <div className="rank-row" style={{ cursor: "default" }} key={r.nome + i}>
                    <div className={`rank-pos ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rk-name">{r.nome}</div>
                      <div className="rk-sub">{r.franq}</div>
                    </div>
                    <div className="rk-val">{fmtBRL(r.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-list" />
                </svg>{" "}
                Detalhe das premiações
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="table-pipe mtable" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th>Franquia</th>
                    <th>Campanha</th>
                    <th>Valor</th>
                    <th>Status</th>
                    {isMatriz && <th>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {lancsMes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong>{vendedorById.get(l.vendedor_id)?.nome ?? "—"}</strong>
                      </td>
                      <td>
                        <small>
                          {l.empresa_id ? (empresaById.get(l.empresa_id)?.nome ?? "—") : "—"}
                        </small>
                      </td>
                      <td>{campanhaById.get(l.campanha_id)?.nome ?? "—"}</td>
                      <td>
                        <strong>{fmtBRL(Number(l.valor))}</strong>
                      </td>
                      <td>
                        <span
                          className={`chip ${l.status === "pago" ? "chip-ok" : "chip-outline"}`}
                          style={isMatriz ? { cursor: "pointer" } : undefined}
                          onClick={isMatriz ? () => togglePago(l) : undefined}
                        >
                          {l.status === "pago" ? "Pago" : "A pagar"}
                        </span>
                      </td>
                      {isMatriz && (
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: "#b91c1c" }}
                            onClick={() => removerLancamento(l)}
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {lancsMes.length === 0 && (
                    <tr>
                      <td
                        colSpan={isMatriz ? 6 : 5}
                        className="muted small"
                        style={{ textAlign: "center", padding: 24 }}
                      >
                        Nenhuma premiação nesta competência.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal === "campanhas" && (
        <CampanhasModal
          campanhas={campanhas}
          seguradoras={seguradoras}
          onClose={() => setModal(null)}
          onChanged={load}
        />
      )}
      {modal === "lancar" && (
        <LancarModal
          campanhas={campanhas}
          vendedores={vendedores}
          empresas={empresas}
          competenciaPadrao={competencia}
          onClose={() => setModal(null)}
          onChanged={load}
        />
      )}
    </AppShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-host" onClick={onClose}>
      <div className={`modal ${wide ? "lg" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <h3>{title}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            ✕
          </div>
        </div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}

function CampanhasModal({
  campanhas,
  seguradoras,
  onClose,
  onChanged,
}: {
  campanhas: Campanha[];
  seguradoras: Seguradora[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    seguradora_id: "",
    competencia: "",
    descricao: "",
    ativa: true,
  });

  async function add() {
    const r = premiacaoCampanhaSchema.safeParse({
      ...form,
      seguradora_id: form.seguradora_id || null,
    });
    if (!r.success) {
      setErr(r.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("premiacao_campanhas").insert({
      nome: r.data.nome,
      seguradora_id: r.data.seguradora_id || null,
      competencia: r.data.competencia?.trim() || null,
      descricao: r.data.descricao?.trim() || null,
      ativa: r.data.ativa,
    });
    if (error) setErr(error.message);
    else setForm({ nome: "", seguradora_id: "", competencia: "", descricao: "", ativa: true });
    setBusy(false);
    void onChanged();
  }

  async function toggleAtiva(c: Campanha) {
    const { error } = await supabase
      .from("premiacao_campanhas")
      .update({ ativa: !c.ativa })
      .eq("id", c.id);
    if (error) setErr(error.message);
    void onChanged();
  }

  async function remove(c: Campanha) {
    if (
      !confirm(`Remover a campanha "${c.nome}"? Os lançamentos vinculados também serão removidos.`)
    )
      return;
    const { error } = await supabase.from("premiacao_campanhas").delete().eq("id", c.id);
    if (error) setErr(error.message);
    void onChanged();
  }

  return (
    <ModalShell title="Gerenciar campanhas de premiação" onClose={onClose} wide>
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          background: "#f8fafc",
          marginBottom: 14,
        }}
      >
        <div className="small muted" style={{ marginBottom: 6, fontWeight: 600 }}>
          Nova campanha
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginBottom: 8 }}
        >
          <input
            className="input"
            placeholder="Nome da campanha"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            maxLength={150}
          />
          <select
            className="input"
            value={form.seguradora_id}
            onChange={(e) => setForm({ ...form, seguradora_id: e.target.value })}
          >
            <option value="">Geral</option>
            {seguradoras.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
          <input
            className="input"
            type="month"
            value={form.competencia}
            onChange={(e) => setForm({ ...form, competencia: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            maxLength={300}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={add} disabled={busy || !form.nome.trim()}>
            Adicionar
          </button>
        </div>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <table className="table" style={{ margin: 0 }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th>Nome</th>
              <th>Seguradora</th>
              <th>Competência</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 100, textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td>
                  <small>
                    {c.seguradora_id
                      ? (seguradoras.find((s) => s.id === c.seguradora_id)?.nome ?? "—")
                      : "Geral"}
                  </small>
                </td>
                <td>
                  <small>{c.competencia ? competenciaLabel(c.competencia) : "—"}</small>
                </td>
                <td>
                  <span
                    className={`chip ${c.ativa ? "chip-ok" : "chip-outline"}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleAtiva(c)}
                  >
                    {c.ativa ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#b91c1c" }}
                    onClick={() => remove(c)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {campanhas.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="muted small"
                  style={{ textAlign: "center", padding: 24 }}
                >
                  Nenhuma campanha cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function LancarModal({
  campanhas,
  vendedores,
  empresas,
  competenciaPadrao,
  onClose,
  onChanged,
}: {
  campanhas: Campanha[];
  vendedores: Profile[];
  empresas: Empresa[];
  competenciaPadrao: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    campanha_id: "",
    vendedor_id: "",
    empresa_id: "",
    competencia: competenciaPadrao,
    valor: "",
    observacao: "",
  });

  async function lancar() {
    const r = premiacaoLancamentoSchema.safeParse({
      ...form,
      empresa_id: form.empresa_id || null,
      valor: form.valor,
    });
    if (!r.success) {
      setErr(r.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("premiacao_lancamentos").insert({
      campanha_id: r.data.campanha_id,
      vendedor_id: r.data.vendedor_id,
      empresa_id: r.data.empresa_id || null,
      competencia: r.data.competencia,
      valor: r.data.valor,
      status: "a_pagar",
      observacao: r.data.observacao?.trim() || null,
    });
    if (error) setErr(error.message);
    else {
      setForm({
        campanha_id: "",
        vendedor_id: "",
        empresa_id: "",
        competencia: competenciaPadrao,
        valor: "",
        observacao: "",
      });
      onClose();
    }
    setBusy(false);
    void onChanged();
  }

  return (
    <ModalShell title="Lançar ganhador" onClose={onClose}>
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        <label className="small muted">
          Campanha
          <select
            className="input"
            value={form.campanha_id}
            onChange={(e) => setForm({ ...form, campanha_id: e.target.value })}
          >
            <option value="">Selecione…</option>
            {campanhas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted">
          Vendedor
          <select
            className="input"
            value={form.vendedor_id}
            onChange={(e) => setForm({ ...form, vendedor_id: e.target.value })}
          >
            <option value="">Selecione…</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted">
          Franquia
          <select
            className="input"
            value={form.empresa_id}
            onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
          >
            <option value="">—</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label className="small muted">
            Competência
            <input
              className="input"
              type="month"
              value={form.competencia}
              onChange={(e) => setForm({ ...form, competencia: e.target.value })}
            />
          </label>
          <label className="small muted">
            Valor
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
            />
          </label>
        </div>
        <label className="small muted">
          Observação (opcional)
          <input
            className="input"
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            maxLength={500}
          />
        </label>
        <button
          className="btn btn-primary"
          onClick={lancar}
          disabled={busy || !form.campanha_id || !form.vendedor_id || !form.valor}
        >
          Lançar
        </button>
      </div>
    </ModalShell>
  );
}
