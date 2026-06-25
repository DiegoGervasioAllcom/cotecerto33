import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/acessos")({
  head: () => ({ meta: [{ title: "Acessos e permissões · CoteCerto" }] }),
  component: Page,
});

type Pendente = {
  id: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  created_at: string;
  dados_cadastro: Record<string, unknown> | null;
};

type Deslig = {
  id: string;
  nome: string;
  email: string;
  desligado_em: string;
  desligado_motivo: string | null;
  empresa_id: string | null;
};

type ModeloParams = Record<string, string>;
type Modelo = {
  id: string;
  nome: string;
  tipo: "franqueada" | "clt";
  perc_comissao_padrao: number;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  params: ModeloParams;
};

type Pair = [string, string];
type Trio = [string, string, string]; // [seguradora, item, valor]
type CltRegras = {
  apuracao_ini: string;
  apuracao_fim: string;
  pagamento: string;
  iof: string;
  rules: string[];
};
type CltConfig = {
  progressiva: Pair[];
  fator_novas: Pair[];
  fator_remalho: Pair[];
  ituran_planos: Trio[];
  ituran_adic: Trio[];
  regras: CltRegras;
};

const SEGURADORAS = [
  "Ituran", "Porto Seguro", "Azul Seguros", "Bradesco Seguros", "SulAmérica",
  "HDI", "Allianz", "Mapfre", "Tokio Marine", "Liberty", "Itaú", "Zurich",
];

const CLT_DEFAULT: CltConfig = {
  progressiva: [], fator_novas: [], fator_remalho: [],
  ituran_planos: [], ituran_adic: [],
  regras: { apuracao_ini: "26", apuracao_fim: "25", pagamento: "5º dia útil", iof: "7,38%", rules: [] },
};

type Tab = "pend" | "deslig" | "modelos";
type PersoSub = "franquia" | "clt";

const FAIXAS: Array<[string, string]> = [
  ["Faixa 1", "8"],
  ["Faixa 2", "12"],
  ["Faixa 3", "16"],
  ["Faixa 4", "20"],
];

const PARAMS = [
  { k: "leads", l: "Leads · média/dia útil" },
  { k: "comVenda", l: "Comissão de venda" },
  { k: "comRenov", l: "Comissão na renovação" },
  { k: "incentivo", l: "Incentivo comercial" },
  { k: "software", l: "Taxa de software" },
  { k: "franquia", l: "Taxa de franquia" },
  { k: "royalties", l: "Royalties + FPP" },
];

const FIELD_LABELS: Record<string, string> = {
  nome: "Nome / Razão Social",
  documento: "Documento (CPF/CNPJ)",
  rg: "RG",
  data_nascimento: "Data de nascimento",
  endereco: "Endereço completo",
  socio_nome: "Sócio operador",
  socio_cpf: "CPF do sócio",
  socio_rg: "RG do sócio",
  celular: "Celular",
  telefone_recado: "Outro telefone / recado",
  email: "E-mail",
  pix_chave: "Chave Pix",
  dados_bancarios: "Banco / Agência / Conta",
  contato_emergencia: "Contato de emergência",
  tipo: "Tipo de cadastro",
};

function Icon({ id, size = 14 }: { id: string; size?: number }) {
  return (
    <svg style={{ width: size, height: size, verticalAlign: "-2px" }}>
      <use href={`#i-${id}`} />
    </svg>
  );
}

function Page() {
  const [tab, setTab] = useState<Tab>("pend");
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [deslig, setDeslig] = useState<Deslig[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [persoSub, setPersoSub] = useState<PersoSub>("franquia");
  const [clt, setClt] = useState<CltConfig>(CLT_DEFAULT);
  const [err, setErr] = useState<string | null>(null);

  const [analisando, setAnalisando] = useState<Pendente | null>(null);
  const [modelSel, setModelSel] = useState<string>("");
  const [fullForm, setFullForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    const [p, d, m, c] = await Promise.all([
      supabase
        .from("empresas")
        .select(
          "id,nome,tipo,documento,cidade,uf,email,telefone,celular,created_at,dados_cadastro",
        )
        .eq("status", "pendente")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,nome,email,desligado_em,desligado_motivo,empresa_id")
        .not("desligado_em", "is", null)
        .order("desligado_em", { ascending: false }),
      supabase.from("modelos_franquia").select("*").order("ordem").order("nome"),
      supabase.from("clt_config").select("*").eq("id", "default").maybeSingle(),
    ]);
    if (p.error) setErr(p.error.message);
    setPendentes((p.data ?? []) as Pendente[]);
    setDeslig((d.data ?? []) as Deslig[]);
    setModelos(((m.data ?? []) as Modelo[]).map((x) => ({ ...x, params: (x.params ?? {}) as ModeloParams })));
    if (c.data) {
      setClt({
        progressiva: (c.data.progressiva ?? []) as Pair[],
        fator_novas: (c.data.fator_novas ?? []) as Pair[],
        fator_remalho: (c.data.fator_remalho ?? []) as Pair[],
        ituran_planos: ((c.data.ituran_planos ?? []) as unknown[]).map(toTrio),
        ituran_adic: ((c.data.ituran_adic ?? []) as unknown[]).map(toTrio),
        regras: { ...CLT_DEFAULT.regras, ...((c.data.regras ?? {}) as Partial<CltRegras>) },
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function openAnalisar(p: Pendente) {
    setAnalisando(p);
    setFullForm(false);
    const franquia = modelos.filter((m) => m.tipo === "franqueada");
    setModelSel(p.tipo === "pj" && franquia[0] ? franquia[0].id : modelos[0]?.id ?? "");
  }

  function closeModal() {
    setAnalisando(null);
    setFullForm(false);
  }

  async function recusar() {
    if (!analisando) return;
    setBusy(true);
    const { error } = await supabase.rpc("recusar_empresa", {
      empresa_id: analisando.id,
      motivo: null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setToast({ msg: `Cadastro recusado · ${analisando.nome}`, kind: "alert" });
    closeModal();
    await reload();
  }

  async function liberar() {
    if (!analisando) return;
    setBusy(true);
    const { error } = await supabase.rpc("aprovar_empresa", {
      empresa_id: analisando.id,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const m = modelos.find((x) => x.id === modelSel);
    const tag = analisando.tipo === "pf" ? " (CLT)" : m ? ` (${m.nome})` : "";
    setToast({
      msg: `Acesso liberado · ${analisando.nome}${tag} · e-mail enviado`,
      kind: "ok",
    });
    closeModal();
    await reload();
  }

  return (
    <AppShell title="Acessos e permissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Acessos e permissões</h1>
          <div className="sub">
            Aprove novos cadastros e classifique cada usuário por modelo de franquia
          </div>
        </div>
      </div>

      <div className="toggle" style={{ marginBottom: 18 }}>
        <button className={tab === "pend" ? "on" : ""} onClick={() => setTab("pend")}>
          Pendentes de aprovação <span style={{ opacity: 0.7 }}>({pendentes.length})</span>
        </button>
        <button className={tab === "deslig" ? "on" : ""} onClick={() => setTab("deslig")}>
          Desligamentos <span style={{ opacity: 0.7 }}>({deslig.length})</span>
        </button>
        <button className={tab === "modelos" ? "on" : ""} onClick={() => setTab("modelos")}>
          Personalização geral
        </button>
      </div>

      {err && <div className="banner alert" style={{ marginBottom: 14 }}>{err}</div>}

      {tab === "pend" && (
        <>
          {pendentes.length === 0 ? (
            <div className="card">
              <div className="card-b" style={{ textAlign: "center", padding: "48px 22px" }}>
                <div style={{ color: "var(--ok)", marginBottom: 8 }}>
                  <Icon id="check-circle" size={40} />
                </div>
                <h3 style={{ margin: "0 0 4px", color: "var(--slate)" }}>
                  Nenhum cadastro pendente
                </h3>
                <div className="muted small">
                  Todos os cadastros foram analisados. Novos pedidos aparecem aqui automaticamente.
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
                <table className="table-pipe">
                  <thead>
                    <tr>
                      <th>Solicitante</th>
                      <th>Tipo</th>
                      <th>Documento</th>
                      <th>Contato</th>
                      <th>Enviado em</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendentes.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.nome}</strong>
                          <div className="small muted">
                            {p.cidade ? `${p.cidade}${p.uf ? " · " + p.uf : ""}` : "—"}
                          </div>
                        </td>
                        <td>
                          {p.tipo === "pj" ? (
                            <span className="chip chip-slate">Pessoa Jurídica</span>
                          ) : (
                            <span className="chip chip-outline">Pessoa Física</span>
                          )}
                        </td>
                        <td>{p.documento}</td>
                        <td>
                          {p.email ?? "—"}
                          <div className="small muted">{p.celular ?? p.telefone ?? ""}</div>
                        </td>
                        <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-yellow btn-sm"
                            onClick={() => openAnalisar(p)}
                          >
                            <Icon id="shield" size={13} /> Analisar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "deslig" && (
        <div className="card">
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Email</th>
                  <th>Motivo</th>
                  <th>Desligado em</th>
                </tr>
              </thead>
              <tbody>
                {deslig.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                      Nenhum desligamento registrado.
                    </td>
                  </tr>
                )}
                {deslig.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.nome}</strong></td>
                    <td>{d.email}</td>
                    <td>{d.desligado_motivo ?? "—"}</td>
                    <td>{new Date(d.desligado_em).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "modelos" && (
        <PersoGeral
          sub={persoSub}
          setSub={setPersoSub}
          modelos={modelos.filter((m) => m.tipo === "franqueada")}
          setModelos={(updater) =>
            setModelos((prev) => {
              const fran = prev.filter((m) => m.tipo === "franqueada");
              const next = typeof updater === "function" ? updater(fran) : updater;
              return [...next, ...prev.filter((m) => m.tipo !== "franqueada")];
            })
          }
          clt={clt}
          setClt={setClt}
          onToast={(msg, kind) => setToast({ msg, kind })}
          onError={(e) => setErr(e)}
          reload={reload}
        />
      )}

      {analisando && (
        <AnalisarModal
          pendente={analisando}
          modelos={modelos.filter((m) => m.tipo === "franqueada")}
          modelSel={modelSel}
          setModelSel={setModelSel}
          fullForm={fullForm}
          setFullForm={setFullForm}
          onClose={closeModal}
          onRecusar={recusar}
          onLiberar={liberar}
          busy={busy}
        />
      )}

      {toast && (
        <div
          className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-alert"}`}
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            background: toast.kind === "ok" ? "var(--ok)" : "var(--alert)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            zIndex: 80,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}
    </AppShell>
  );
}

function AnalisarModal({
  pendente,
  modelos,
  modelSel,
  setModelSel,
  fullForm,
  setFullForm,
  onClose,
  onRecusar,
  onLiberar,
  busy,
}: {
  pendente: Pendente;
  modelos: Modelo[];
  modelSel: string;
  setModelSel: (s: string) => void;
  fullForm: boolean;
  setFullForm: (b: boolean) => void;
  onClose: () => void;
  onRecusar: () => void;
  onLiberar: () => void;
  busy: boolean;
}) {
  const isPF = pendente.tipo === "pf";
  const tipoChip = isPF ? (
    <span className="chip chip-outline">Pessoa Física</span>
  ) : (
    <span className="chip chip-slate">Pessoa Jurídica</span>
  );

  const formRows = useMemo(() => {
    const dados = (pendente.dados_cadastro ?? {}) as Record<string, unknown>;
    const entries = Object.entries(dados).filter(([, v]) => v != null && v !== "");
    return entries.map(([k, v]) => [FIELD_LABELS[k] ?? k, String(v)] as [string, string]);
  }, [pendente]);

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal lg">
        <div className="modal-h">
          <Icon id={fullForm ? "file" : "shield"} size={18} />
          <h3>
            {fullForm ? "Formulário completo" : "Classificar acesso"} — {pendente.nome}
          </h3>
          <div className="x" onClick={onClose}>
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <div
            className="acc-sol"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
          >
            <div>
              <div>
                {tipoChip} <strong style={{ marginLeft: 6 }}>{pendente.documento}</strong>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {pendente.email ?? "—"} · {pendente.celular ?? pendente.telefone ?? "—"}
                {pendente.cidade ? ` · ${pendente.cidade}${pendente.uf ? "/" + pendente.uf : ""}` : ""}
              </div>
            </div>
            {!fullForm && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFullForm(true)}>
                <Icon id="file" size={13} /> Formulário completo
              </button>
            )}
          </div>

          {fullForm ? (
            <table className="table-pipe ff-table" style={{ marginTop: 14 }}>
              <tbody>
                {formRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted small" style={{ padding: 16 }}>
                      Sem dados adicionais informados no cadastro.
                    </td>
                  </tr>
                ) : (
                  formRows.map(([k, v]) => (
                    <tr key={k}>
                      <td className="ff-k">{k}</td>
                      <td className="ff-v">{v}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : isPF ? (
            <>
              <div className="acc-sec-t">Parâmetros do vendedor (CLT)</div>
              <div className="acc-grid">
                <div className="field-group">
                  <label>Equipe</label>
                  <select className="input" defaultValue="Novas Vendas">
                    <option>Novas Vendas</option>
                    <option>Remalho</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Leads · média/dia útil</label>
                  <select className="input" defaultValue={FAIXAS[1][1]}>
                    {FAIXAS.map(([nome, qtd]) => (
                      <option key={nome} value={qtd}>{nome} — {qtd}/dia</option>
                    ))}
                  </select>
                </div>
                <div className="field-group">
                  <label>Salário base (R$)</label>
                  <input className="input" placeholder="ex.: 1.800,00" />
                </div>
                <div className="field-group">
                  <label>Bônus de campanha</label>
                  <input className="input" placeholder="ex.: +5% em julho" />
                </div>
              </div>
              <div className="clt-note">
                <Icon id="info" size={15} />
                <div>
                  A comissão segue o <strong>Modelo CLT</strong>: progressiva por faturamento
                  (2%–3,5%) × fator de comissão média da equipe, somada à tabela Ituran (planos e
                  adicionais). Apuração do dia 26 ao 25 · pagamento de comissão + salário + DSR no{" "}
                  <strong>5º dia útil</strong>. Edite as tabelas em Personalização geral › Modelo
                  CLT.
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="acc-sec-t">Modelo de franquia</div>
              <div className="acc-pills">
                {modelos.length === 0 && (
                  <span className="muted small">Nenhum modelo cadastrado em Personalização geral.</span>
                )}
                {modelos.map((m) => (
                  <button
                    key={m.id}
                    className={`acc-pill ${m.id === modelSel ? "on" : ""}`}
                    onClick={() => setModelSel(m.id)}
                  >
                    {m.nome}
                  </button>
                ))}
              </div>
              <div className="acc-sec-t">
                Parâmetros{" "}
                <span className="muted small" style={{ fontWeight: 500 }}>
                  — preenchidos pelo modelo, edite se necessário
                </span>
              </div>
              <div className="acc-grid">
                {PARAMS.map((p) => (
                  <div className="field-group" key={p.k}>
                    <label>{p.l}</label>
                    {p.k === "leads" ? (
                      <select className="input" defaultValue={FAIXAS[1][1]}>
                        {FAIXAS.map(([nome, qtd]) => (
                          <option key={nome} value={qtd}>{nome} — {qtd}/dia</option>
                        ))}
                      </select>
                    ) : p.k === "comVenda" ? (
                      <input
                        className="input"
                        defaultValue={`${Number(
                          modelos.find((m) => m.id === modelSel)?.perc_comissao_padrao ?? 0,
                        ).toFixed(2)}%`}
                      />
                    ) : (
                      <input className="input" defaultValue="—" />
                    )}
                  </div>
                ))}
              </div>
              <div className="acc-sec-t">Condições adicionais</div>
              <div className="acc-grid">
                <div className="field-group">
                  <label>Dia de pagamento</label>
                  <input className="input" defaultValue="10" />
                </div>
                <div className="field-group">
                  <label>Bônus de campanha</label>
                  <input className="input" placeholder="ex.: +5% em julho" />
                </div>
                <div className="field-group">
                  <label>Faixa: acima de (R$)</label>
                  <input className="input" placeholder="ex.: 50.000" />
                </div>
                <div className="field-group">
                  <label>…comissão passa a</label>
                  <input className="input" placeholder="ex.: 55%" />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-f">
          {fullForm ? (
            <button className="btn btn-yellow" onClick={() => setFullForm(false)}>
              <Icon id="chevron-left" size={14} /> Voltar à classificação
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={onRecusar}>
                <Icon id="x" size={14} /> Recusar
              </button>
              <button className="btn btn-yellow" disabled={busy} onClick={onLiberar}>
                <Icon id="check" size={14} /> {busy ? "Processando…" : "Liberar acesso"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personalização geral — sub-tabs Modelo Franquia / Modelo CLT
// ---------------------------------------------------------------------------

function PersoGeral({
  sub, setSub, modelos, setModelos, clt, setClt, onToast, onError, reload,
}: {
  sub: PersoSub;
  setSub: (s: PersoSub) => void;
  modelos: Modelo[];
  setModelos: (updater: (prev: Modelo[]) => Modelo[]) => void;
  clt: CltConfig;
  setClt: (c: CltConfig) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
  reload: () => Promise<void>;
}) {
  return (
    <>
      <div className="toggle toggle-sub" style={{ marginBottom: 16 }}>
        <button className={sub === "franquia" ? "on" : ""} onClick={() => setSub("franquia")}>
          Modelo Franquia
        </button>
        <button className={sub === "clt" ? "on" : ""} onClick={() => setSub("clt")}>
          Modelo CLT
        </button>
      </div>
      {sub === "franquia" ? (
        <ModeloFranquiaPanel
          modelos={modelos}
          setModelos={setModelos}
          onToast={onToast}
          onError={onError}
          reload={reload}
        />
      ) : (
        <ModeloCltPanel clt={clt} setClt={setClt} onToast={onToast} onError={onError} />
      )}
    </>
  );
}

function ModeloFranquiaPanel({
  modelos, setModelos, onToast, onError, reload,
}: {
  modelos: Modelo[];
  setModelos: (updater: (prev: Modelo[]) => Modelo[]) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  function patchModelo(id: string, patch: Partial<Modelo> & { params?: ModeloParams }) {
    setModelos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch, params: { ...m.params, ...(patch.params ?? {}) } } : m)),
    );
  }
  function patchParam(id: string, key: string, value: string) {
    setModelos((prev) => prev.map((m) => (m.id === id ? { ...m, params: { ...m.params, [key]: value } } : m)));
  }

  async function salvar() {
    setBusy(true);
    const updates = modelos.map((m) =>
      supabase
        .from("modelos_franquia")
        .update({ nome: m.nome, params: m.params, ordem: m.ordem })
        .eq("id", m.id),
    );
    const res = await Promise.all(updates);
    setBusy(false);
    const erro = res.find((r) => r.error);
    if (erro?.error) { onError(erro.error.message); return; }
    onToast("Parâmetros dos modelos atualizados", "ok");
  }

  async function adicionar() {
    if (!novoNome.trim()) return;
    setBusy(true);
    const ordem = (modelos.reduce((a, m) => Math.max(a, m.ordem), 0) ?? 0) + 1;
    const { error } = await supabase.from("modelos_franquia").insert({
      nome: novoNome.trim(),
      tipo: "franqueada",
      perc_comissao_padrao: 0,
      ordem,
      params: {
        leads: "—", comVenda: "—", comRenov: "—", incentivo: "—",
        software: "—", franquia: "—", royalties: "—",
      },
    });
    setBusy(false);
    if (error) { onError(error.message); return; }
    setNovoNome("");
    setAddOpen(false);
    onToast(`Modelo "${novoNome.trim()}" adicionado`, "ok");
    await reload();
  }

  async function remover(m: Modelo) {
    if (!confirm(`Remover o modelo "${m.nome}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("modelos_franquia").delete().eq("id", m.id);
    setBusy(false);
    if (error) { onError(error.message); return; }
    onToast(`Modelo "${m.nome}" removido`, "alert");
    await reload();
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3><Icon id="building" size={16} /> Modelo Franquia</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen((v) => !v)}>
            <Icon id="plus" size={13} /> Adicionar modelo
          </button>
          <button className="btn btn-slate btn-sm" disabled={busy} onClick={salvar}>
            <Icon id="check" size={13} /> Salvar parâmetros
          </button>
        </div>
      </div>
      {addOpen && (
        <div className="card-b" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Nome do novo modelo"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="btn btn-yellow btn-sm" disabled={busy || !novoNome.trim()} onClick={adicionar}>
            <Icon id="check" size={13} /> Criar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAddOpen(false); setNovoNome(""); }}>
            Cancelar
          </button>
        </div>
      )}
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th>Modelo</th>
              {PARAMS.map((p) => <th key={p.k}>{p.l}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {modelos.length === 0 && (
              <tr>
                <td colSpan={PARAMS.length + 2} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  Nenhum modelo cadastrado. Use “Adicionar modelo”.
                </td>
              </tr>
            )}
            {modelos.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    className="input input-mini"
                    value={m.nome}
                    onChange={(e) => patchModelo(m.id, { nome: e.target.value })}
                    style={{ fontWeight: 700, minWidth: 110 }}
                  />
                </td>
                {PARAMS.map((p) => (
                  <td key={p.k}>
                    <input
                      className="input input-mini"
                      value={m.params[p.k] ?? ""}
                      onChange={(e) => patchParam(m.id, p.k, e.target.value)}
                    />
                  </td>
                ))}
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => remover(m)} title="Remover">
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b">
        <div className="muted small">
          <Icon id="info" size={13} /> Valores padrão aplicados ao classificar um franqueado (PJ) neste modelo — a matriz pode sobrescrever caso a caso na aprovação.
        </div>
      </div>
    </div>
  );
}

function ModeloCltPanel({
  clt, setClt, onToast, onError,
}: {
  clt: CltConfig;
  setClt: (c: CltConfig) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    const { error } = await supabase
      .from("clt_config")
      .update({
        progressiva: clt.progressiva,
        fator_novas: clt.fator_novas,
        fator_remalho: clt.fator_remalho,
        regras: clt.regras,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", "default");
    setBusy(false);
    if (error) { onError(error.message); return; }
    onToast("Modelo CLT atualizado", "ok");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted small">
          <Icon id="info" size={13} /> Regras de remuneração do vendedor CLT (equipe interna), com base nas políticas SUP_POL_01 e SUP_POL_04.
        </div>
        <button className="btn btn-slate btn-sm" disabled={busy} onClick={salvar}>
          <Icon id="check" size={13} /> Salvar Modelo CLT
        </button>
      </div>

      <DynamicRangeCard
        title="Comissão de seguros — progressiva"
        icon="percent"
        lh="Faturamento comissão (R$)"
        vh="% comissionado"
        rows={clt.progressiva}
        onChange={(rows) => setClt({ ...clt, progressiva: rows })}
        footer={
          <div className="muted small">
            <Icon id="info" size={13} /> Base: prêmio líquido = prêmio bruto − juros − IOF (7,38%). O % vem da faixa do faturamento mensal de comissão.
          </div>
        }
      />

      <div className="acc-two">
        <DynamicRangeCard
          title="Fator comissão média · Novas Vendas"
          icon="users"
          lh="Comissão média"
          vh="Fator"
          rows={clt.fator_novas}
          onChange={(rows) => setClt({ ...clt, fator_novas: rows })}
        />
        <DynamicRangeCard
          title="Fator comissão média · Remalho"
          icon="users"
          lh="Comissão média"
          vh="Fator"
          rows={clt.fator_remalho}
          onChange={(rows) => setClt({ ...clt, fator_remalho: rows })}
        />
      </div>

      <DynamicTrioCard
        title="Seguradora — comissão por plano (R$)"
        icon="car"
        lh="Plano"
        vh="Comissão (R$)"
        rows={clt.ituran_planos}
        onChange={(rows) => setClt({ ...clt, ituran_planos: rows })}
      />
      <DynamicTrioCard
        title="Seguradora — serviços adicionais (R$)"
        icon="shield"
        lh="Adicional"
        vh="Comissão (R$)"
        rows={clt.ituran_adic}
        onChange={(rows) => setClt({ ...clt, ituran_adic: rows })}
      />

      <div className="card">
        <div className="card-h"><h3><Icon id="info" size={16} /> Regras gerais de remuneração</h3></div>
        <div className="card-b">
          <div className="acc-grid">
            <div className="field-group">
              <label>Apuração — do dia</label>
              <input className="input" value={clt.regras.apuracao_ini}
                onChange={(e) => setClt({ ...clt, regras: { ...clt.regras, apuracao_ini: e.target.value } })} />
            </div>
            <div className="field-group">
              <label>…até o dia</label>
              <input className="input" value={clt.regras.apuracao_fim}
                onChange={(e) => setClt({ ...clt, regras: { ...clt.regras, apuracao_fim: e.target.value } })} />
            </div>
            <div className="field-group">
              <label>Pagamento</label>
              <input className="input" value={clt.regras.pagamento}
                onChange={(e) => setClt({ ...clt, regras: { ...clt.regras, pagamento: e.target.value } })} />
            </div>
            <div className="field-group">
              <label>IOF</label>
              <input className="input" value={clt.regras.iof}
                onChange={(e) => setClt({ ...clt, regras: { ...clt.regras, iof: e.target.value } })} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="acc-sec-t" style={{ marginTop: 0 }}>Regras adicionais</div>
            {clt.regras.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  className="input"
                  value={r}
                  onChange={(e) => {
                    const next = [...clt.regras.rules];
                    next[i] = e.target.value;
                    setClt({ ...clt, regras: { ...clt.regras, rules: next } });
                  }}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const next = clt.regras.rules.filter((_, j) => j !== i);
                  setClt({ ...clt, regras: { ...clt.regras, rules: next } });
                }}>
                  <Icon id="trash" size={13} />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => {
              setClt({ ...clt, regras: { ...clt.regras, rules: [...clt.regras.rules, ""] } });
            }}>
              <Icon id="plus" size={13} /> Adicionar regra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DynamicPairCard({
  title, icon, lh, vh, rows, onChange, footer,
}: {
  title: string; icon: string; lh: string; vh: string;
  rows: Pair[]; onChange: (rows: Pair[]) => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-h">
        <h3><Icon id={icon} size={16} /> {title}</h3>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => onChange([...rows, ["", ""]])}>
          <Icon id="plus" size={13} /> Adicionar linha
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead><tr><th>{lh}</th><th>{vh}</th><th style={{ width: 60 }}></th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Sem linhas.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input className="input input-mini" value={r[0]}
                    onChange={(e) => { const next = rows.map((x, j) => j === i ? [e.target.value, x[1]] as Pair : x); onChange(next); }} />
                </td>
                <td>
                  <input className="input input-mini" value={r[1]}
                    onChange={(e) => { const next = rows.map((x, j) => j === i ? [x[0], e.target.value] as Pair : x); onChange(next); }} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="card-b">{footer}</div>}
    </div>
  );
}

function parseRange(label: string): [string, string] {
  if (!label) return ["", ""];
  const sep = label.match(/^\s*(.+?)\s*(?:–|—|-| a | até )\s*(.+?)\s*$/i);
  if (sep) return [sep[1], sep[2]];
  if (label.trim().endsWith("+")) return [label.trim().slice(0, -1).trim(), ""];
  const lt = label.match(/^<\s*(.+)$/);
  if (lt) return ["", lt[1].trim()];
  const gt = label.match(/^(?:>|acima de)\s*(.+)$/i);
  if (gt) return [gt[1].trim(), ""];
  return [label, ""];
}
function formatRange(de: string, ate: string): string {
  const d = de.trim(), a = ate.trim();
  if (!d && !a) return "";
  if (!d) return `< ${a}`;
  if (!a) return `${d}+`;
  return `${d} – ${a}`;
}

function DynamicRangeCard({
  title, icon, lh, vh, rows, onChange, footer,
}: {
  title: string; icon: string; lh: string; vh: string;
  rows: Pair[]; onChange: (rows: Pair[]) => void;
  footer?: React.ReactNode;
}) {
  function update(i: number, de: string, ate: string, val: string) {
    const next = rows.map((x, j) => j === i ? [formatRange(de, ate), val] as Pair : x);
    onChange(next);
  }
  return (
    <div className="card">
      <div className="card-h">
        <h3><Icon id={icon} size={16} /> {title}</h3>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => onChange([...rows, ["", ""]])}>
          <Icon id="plus" size={13} /> Adicionar faixa
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th colSpan={2}>{lh}</th>
              <th>{vh}</th>
              <th style={{ width: 60 }}></th>
            </tr>
            <tr>
              <th style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>De</th>
              <th style={{ fontWeight: 500, fontSize: 11, color: "var(--muted)" }}>Até</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Sem faixas.</td></tr>
            )}
            {rows.map((r, i) => {
              const [de, ate] = parseRange(r[0]);
              return (
                <tr key={i}>
                  <td>
                    <input className="input input-mini" placeholder="0" value={de}
                      onChange={(e) => update(i, e.target.value, ate, r[1])} />
                  </td>
                  <td>
                    <input className="input input-mini" placeholder="∞" value={ate}
                      onChange={(e) => update(i, de, e.target.value, r[1])} />
                  </td>
                  <td>
                    <input className="input input-mini" value={r[1]}
                      onChange={(e) => { const next = rows.map((x, j) => j === i ? [x[0], e.target.value] as Pair : x); onChange(next); }} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <Icon id="trash" size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer && <div className="card-b">{footer}</div>}
    </div>
  );
}

function toTrio(x: unknown): Trio {
  if (Array.isArray(x)) {
    if (x.length >= 3) return [String(x[0] ?? ""), String(x[1] ?? ""), String(x[2] ?? "")];
    if (x.length === 2) return ["Ituran", String(x[0] ?? ""), String(x[1] ?? "")];
  }
  return ["", "", ""];
}

function DynamicTrioCard({
  title, icon, lh, vh, rows, onChange,
}: {
  title: string; icon: string; lh: string; vh: string;
  rows: Trio[]; onChange: (rows: Trio[]) => void;
}) {
  function patch(i: number, k: 0 | 1 | 2, v: string) {
    onChange(rows.map((x, j) => {
      if (j !== i) return x;
      const n: Trio = [x[0], x[1], x[2]];
      n[k] = v;
      return n;
    }));
  }
  return (
    <div className="card">
      <div className="card-h">
        <h3><Icon id={icon} size={16} /> {title}</h3>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={() => onChange([...rows, ["", "", ""]])}>
          <Icon id="plus" size={13} /> Adicionar linha
        </button>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead><tr><th style={{ width: 200 }}>Seguradora</th><th>{lh}</th><th style={{ width: 160 }}>{vh}</th><th style={{ width: 60 }}></th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Sem linhas.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <select className="input input-mini" value={r[0]} onChange={(e) => patch(i, 0, e.target.value)}>
                    <option value="">— Seguradora —</option>
                    {SEGURADORAS.map((s) => <option key={s} value={s}>{s}</option>)}
                    {r[0] && !SEGURADORAS.includes(r[0]) && <option value={r[0]}>{r[0]}</option>}
                  </select>
                </td>
                <td>
                  <input className="input input-mini" value={r[1]} onChange={(e) => patch(i, 1, e.target.value)} />
                </td>
                <td>
                  <input className="input input-mini" value={r[2]} onChange={(e) => patch(i, 2, e.target.value)} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
