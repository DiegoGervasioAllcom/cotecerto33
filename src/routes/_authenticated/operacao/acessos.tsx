import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
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
  created_at: string;
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

function Page() {
  const [tab, setTab] = useState<Tab>("pend");
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [deslig, setDeslig] = useState<Deslig[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    const [p, d, m] = await Promise.all([
      supabase
        .from("empresas")
        .select("id,nome,tipo,documento,cidade,uf,email,telefone,created_at")
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

  const aprovar = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("aprovar_empresa", { empresa_id: id });
    if (error) setErr(error.message);
    await reload();
    setBusyId(null);
  };

  const recusar = async (id: string) => {
    const motivo = window.prompt("Motivo da recusa (opcional):") ?? null;
    setBusyId(id);
    const { error } = await supabase.rpc("recusar_empresa", { empresa_id: id, motivo });
    if (error) setErr(error.message);
    await reload();
    setBusyId(null);
  };

  return (
    <AppShell title="Acessos e permissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Acessos e permissões</h1>
          <div className="sub">Aprove novos cadastros e classifique cada usuário por modelo de franquia</div>
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

      {err && <div className="alert alert-error">{err}</div>}

      {tab === "pend" && (
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
                {pendentes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                      Nenhum cadastro pendente.
                    </td>
                  </tr>
                )}
                {pendentes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nome}</strong>
                      <div className="small muted">
                        {p.cidade ? `${p.cidade} · ${p.uf ?? ""}` : "—"}
                      </div>
                    </td>
                    <td>
                      <span className="chip chip-slate">
                        {p.tipo === "pj" ? "Pessoa Jurídica" : "Pessoa Física"}
                      </span>
                    </td>
                    <td>{p.documento}</td>
                    <td>
                      <div>{p.email ?? "—"}</div>
                      <div className="small muted">{p.telefone ?? ""}</div>
                    </td>
                    <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <button
                        className="btn btn-ghost"
                        disabled={busyId === p.id}
                        onClick={() => recusar(p.id)}
                      >
                        Recusar
                      </button>{" "}
                      <button
                        className="btn btn-primary"
                        disabled={busyId === p.id}
                        onClick={() => aprovar(p.id)}
                      >
                        Aprovar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                    <td>
                      <strong>{d.nome}</strong>
                    </td>
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
                    <td>
                      <strong>{m.nome}</strong>
                    </td>
                    <td>
                      <span className="chip chip-slate">
                        {m.tipo === "clt" ? "CLT" : "Franqueada"}
                      </span>
                    </td>
                    <td>
                      <strong>{Number(m.perc_comissao_padrao).toFixed(2)}%</strong>
                    </td>
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
    </AppShell>
  );
}
