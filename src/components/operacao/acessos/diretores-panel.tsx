// Aba "Personalização geral" — sub-aba "Diretores" (G6.4). Dupla aprovação
// para incluir/remover diretor (G6.3): quem propõe precisa de outro diretor
// confirmando com a própria senha de login antes da marcação mudar de fato —
// nenhuma das duas RPCs aplica a mudança sozinha (propor_alteracao_diretor /
// confirmar_alteracao_diretor).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SenhaDiretorModal } from "@/components/acessos/senha-diretor-modal";
import { Icon } from "./icon";

type Pessoa = { id: string; nome: string; email: string };

type Acao = "incluir" | "remover";

type Proposta = {
  id: string;
  alvoId: string;
  alvoNome: string;
  acao: Acao;
  propostoPor: string;
  propostoPorNome: string;
  criadoEm: string;
};

type AcaoPendente =
  | { tipo: "propor"; acao: Acao; alvoId: string; alvoNome: string }
  | { tipo: "confirmar"; propostaId: string; aprovar: boolean; alvoNome: string; acao: Acao };

export function DiretoresPanel() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [diretores, setDiretores] = useState<Pessoa[]>([]);
  const [candidatos, setCandidatos] = useState<Pessoa[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);
  const [busca, setBusca] = useState("");
  const [candidatoId, setCandidatoId] = useState("");
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const [diretoresRes, propostasRes, candidatosBaseRes] = await Promise.all([
      supabase.from("profiles").select("id,nome,email").eq("diretor", true).order("nome"),
      supabase
        .from("diretor_propostas")
        .select("id,alvo_id,acao,proposto_por,criado_em")
        .eq("status", "pendente")
        .order("criado_em"),
      supabase
        .from("profiles")
        .select("id,nome,email,cargo_id,empresa_id")
        .eq("diretor", false)
        .is("desligado_em", null)
        .not("empresa_id", "is", null),
    ]);

    if (diretoresRes.error) {
      setErr(diretoresRes.error.message);
      setLoading(false);
      return;
    }
    if (propostasRes.error) {
      setErr(propostasRes.error.message);
      setLoading(false);
      return;
    }
    if (candidatosBaseRes.error) {
      setErr(candidatosBaseRes.error.message);
      setLoading(false);
      return;
    }

    setDiretores(diretoresRes.data ?? []);

    // Candidatos a diretor: mesmo recorte de "colaborador interno da Matriz"
    // usado em Cadastros (cargo_id definido, OU Vendedor Matriz — role
    // 'vendedor' cuja empresa não tem modelo de franquia). Diretor é conceito
    // só de Matriz (V11.0.5), então franqueados/rede nunca entram aqui.
    type CandidatoBase = {
      id: string;
      nome: string;
      email: string;
      cargo_id: string | null;
      empresa_id: string;
    };
    const base = (candidatosBaseRes.data ?? []) as CandidatoBase[];
    const baseIds = base.map((p) => p.id);
    const empresaIds = Array.from(new Set(base.map((p) => p.empresa_id)));

    const [rolesRes, empresasRes] = await Promise.all([
      supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", baseIds.length ? baseIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase
        .from("empresas")
        .select("id,modelo_id")
        .in("id", empresaIds.length ? empresaIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const roleByUser = new Map(
      ((rolesRes.data ?? []) as { user_id: string; role: string }[]).map((r) => [
        r.user_id,
        r.role,
      ]),
    );
    const modeloPorEmpresa = new Map(
      ((empresasRes.data ?? []) as { id: string; modelo_id: string | null }[]).map((e) => [
        e.id,
        e.modelo_id,
      ]),
    );
    const internos = base.filter((p) => {
      if (p.cargo_id) return true;
      return roleByUser.get(p.id) === "vendedor" && modeloPorEmpresa.get(p.empresa_id) == null;
    });
    setCandidatos(
      internos
        .map((p) => ({ id: p.id, nome: p.nome, email: p.email }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    );

    const propostasBrutas = (propostasRes.data ?? []) as {
      id: string;
      alvo_id: string;
      acao: string;
      proposto_por: string;
      criado_em: string;
    }[];
    const idsEnvolvidos = Array.from(
      new Set(propostasBrutas.flatMap((p) => [p.alvo_id, p.proposto_por])),
    );
    const { data: nomesData } = await supabase
      .from("profiles")
      .select("id,nome,email")
      .in("id", idsEnvolvidos.length ? idsEnvolvidos : ["00000000-0000-0000-0000-000000000000"]);
    const nomeById = new Map(((nomesData ?? []) as Pessoa[]).map((p) => [p.id, p.nome || p.email]));
    setPropostas(
      propostasBrutas.map((p) => ({
        id: p.id,
        alvoId: p.alvo_id,
        alvoNome: nomeById.get(p.alvo_id) ?? "—",
        acao: p.acao as Acao,
        propostoPor: p.proposto_por,
        propostoPorNome: nomeById.get(p.proposto_por) ?? "—",
        criadoEm: p.criado_em,
      })),
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const candidatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return candidatos;
    return candidatos.filter(
      (c) => c.nome.toLowerCase().includes(termo) || c.email.toLowerCase().includes(termo),
    );
  }, [busca, candidatos]);

  function proporRemocao(d: Pessoa) {
    setErr(null);
    setAcaoPendente({ tipo: "propor", acao: "remover", alvoId: d.id, alvoNome: d.nome });
  }

  function proporInclusao() {
    setErr(null);
    const candidato = candidatos.find((c) => c.id === candidatoId);
    if (!candidato) {
      setErr("Selecione um cadastro para propor como diretor.");
      return;
    }
    setAcaoPendente({
      tipo: "propor",
      acao: "incluir",
      alvoId: candidato.id,
      alvoNome: candidato.nome,
    });
  }

  function confirmarOuRejeitar(p: Proposta, aprovar: boolean) {
    setErr(null);
    setAcaoPendente({
      tipo: "confirmar",
      propostaId: p.id,
      aprovar,
      alvoNome: p.alvoNome,
      acao: p.acao,
    });
  }

  async function executarComSenha(senha: string): Promise<{ error: string | null }> {
    if (!acaoPendente) return { error: "Nenhuma ação pendente." };
    setBusy(true);

    if (acaoPendente.tipo === "propor") {
      const { error } = await supabase.rpc("propor_alteracao_diretor", {
        p_senha: senha,
        p_alvo_id: acaoPendente.alvoId,
        p_acao: acaoPendente.acao,
      });
      setBusy(false);
      if (error) return { error: error.message };
      setToast({
        msg: `Proposta de ${acaoPendente.acao === "incluir" ? "inclusão" : "remoção"} de diretor enviada — aguardando outro diretor confirmar`,
        kind: "ok",
      });
      setCandidatoId("");
      setBusca("");
    } else {
      const { error } = await supabase.rpc("confirmar_alteracao_diretor", {
        p_senha: senha,
        p_proposta_id: acaoPendente.propostaId,
        p_aprovar: acaoPendente.aprovar,
      });
      setBusy(false);
      if (error) return { error: error.message };
      setToast({
        msg: acaoPendente.aprovar
          ? "Proposta confirmada — diretor atualizado"
          : "Proposta rejeitada",
        kind: acaoPendente.aprovar ? "ok" : "alert",
      });
    }

    setAcaoPendente(null);
    await reload();
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando diretores…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="shield" size={16} /> Diretores
          </h3>
        </div>
        {err && (
          <div className="card-b">
            <div className="banner alert">{err}</div>
          </div>
        )}
        <div className="card-b">
          <div className="muted small" style={{ marginBottom: 12 }}>
            <Icon id="info" size={13} /> São no mínimo dois — só eles alteram comissionamento e
            configurações sensíveis, sempre confirmando a própria senha de login. Incluir ou remover
            um diretor exige a proposta de um diretor e a confirmação de outro.
          </div>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Diretor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {diretores.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center", padding: 24 }}>
                    <span className="muted small">Nenhum diretor cadastrado.</span>
                  </td>
                </tr>
              )}
              {diretores.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.nome}</strong>
                    <div className="small muted">{d.email}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => proporRemocao(d)}
                    >
                      <Icon id="x" size={13} /> Propor remoção
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="plus" size={16} /> Propor novo diretor
          </h3>
        </div>
        <div
          className="card-b"
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
        >
          <input
            className="input"
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ maxWidth: 240 }}
          />
          <select
            className="input"
            style={{ maxWidth: 300 }}
            value={candidatoId}
            onChange={(e) => setCandidatoId(e.target.value)}
          >
            <option value="">Selecione um cadastro…</option>
            {candidatosFiltrados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} — {c.email}
              </option>
            ))}
          </select>
          <button
            className="btn btn-slate btn-sm"
            disabled={busy || !candidatoId}
            onClick={proporInclusao}
          >
            <Icon id="check" size={13} /> Propor inclusão
          </button>
        </div>
        {candidatos.length === 0 && (
          <div className="card-b">
            <span className="muted small">
              Nenhum colaborador interno elegível (time da Matriz com cargo ou Vendedor Matriz sem
              franquia vinculada).
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="clock" size={16} /> Propostas pendentes
          </h3>
        </div>
        <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Proposto por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {propostas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24 }}>
                    <span className="muted small">Nenhuma proposta pendente.</span>
                  </td>
                </tr>
              )}
              {propostas.map((p) => {
                const souEu = uid !== null && p.propostoPor === uid;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={`chip ${p.acao === "incluir" ? "chip-ok" : "chip-alert"}`}>
                        {p.acao === "incluir" ? "Incluir" : "Remover"}
                      </span>
                    </td>
                    <td>{p.alvoNome}</td>
                    <td>{p.propostoPorNome}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {souEu ? (
                        <span className="muted small">
                          <Icon id="clock" size={12} /> aguardando outro diretor
                        </span>
                      ) : (
                        <>
                          <button
                            className="btn btn-slate btn-sm"
                            disabled={busy}
                            onClick={() => confirmarOuRejeitar(p, true)}
                          >
                            <Icon id="check" size={13} /> Confirmar
                          </button>{" "}
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => confirmarOuRejeitar(p, false)}
                          >
                            <Icon id="x" size={13} /> Rejeitar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {acaoPendente && (
        <SenhaDiretorModal
          label={
            acaoPendente.tipo === "propor"
              ? `a proposta de ${acaoPendente.acao === "incluir" ? "inclusão" : "remoção"} de diretor para ${acaoPendente.alvoNome}`
              : `a confirmação da proposta de ${acaoPendente.acao === "incluir" ? "inclusão" : "remoção"} de diretor para ${acaoPendente.alvoNome}`
          }
          onConfirm={executarComSenha}
          onClose={() => setAcaoPendente(null)}
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
    </div>
  );
}
