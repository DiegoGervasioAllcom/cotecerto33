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

type Modelo = {
  id: string;
  nome: string;
  tipo: "franqueada" | "clt";
  perc_comissao_padrao: number;
  descricao: string | null;
  ativo: boolean;
};

type Tab = "pend" | "deslig" | "modelos";

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
  const [err, setErr] = useState<string | null>(null);

  const [analisando, setAnalisando] = useState<Pendente | null>(null);
  const [modelSel, setModelSel] = useState<string>("");
  const [fullForm, setFullForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    const [p, d, m] = await Promise.all([
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
      supabase.from("modelos_franquia").select("*").order("nome"),
    ]);
    if (p.error) setErr(p.error.message);
    setPendentes((p.data ?? []) as Pendente[]);
    setDeslig((d.data ?? []) as Deslig[]);
    setModelos((m.data ?? []) as Modelo[]);
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
        <div className="card">
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Tipo</th>
                  <th>Comissão padrão</th>
                  <th>Descrição</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {modelos.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                      Nenhum modelo cadastrado.
                    </td>
                  </tr>
                )}
                {modelos.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.nome}</strong></td>
                    <td>
                      <span className="chip chip-slate">
                        {m.tipo === "clt" ? "CLT" : "Franqueada"}
                      </span>
                    </td>
                    <td><strong>{Number(m.perc_comissao_padrao).toFixed(2)}%</strong></td>
                    <td>{m.descricao ?? "—"}</td>
                    <td>
                      {m.ativo ? (
                        <span className="chip chip-ok">Ativo</span>
                      ) : (
                        <span className="chip chip-alert">Inativo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
