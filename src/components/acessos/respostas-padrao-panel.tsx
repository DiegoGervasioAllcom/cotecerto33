// Aba "Personalização geral" — Respostas padrão (G3.6). Textos rápidos que o
// aprovador pode inserir na observação ao decidir um pedido de desconto.
// `seguradora_id` NULL = geral (vale pra todas as seguradoras). Grava via
// fn_salvar_resposta_padrao/fn_excluir_resposta_padrao (G6.1) — gate de
// diretor, escrita direta é fechada pra authenticated desde então.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import { SenhaDiretorModal } from "./senha-diretor-modal";

const TITULO_MAX = 100;
const TEXTO_MAX = 1000;

type Seguradora = { id: string; nome: string };

export type RespostaPadrao = {
  id: string;
  seguradora_id: string | null;
  titulo: string;
  texto: string;
  ativo: boolean;
};

type FormState = {
  titulo: string;
  texto: string;
  seguradoraId: string; // "" = geral
  ativo: boolean;
};

const EMPTY_FORM: FormState = { titulo: "", texto: "", seguradoraId: "", ativo: true };

type AcaoPendente =
  | { tipo: "criar"; form: FormState }
  | { tipo: "editar"; id: string; form: FormState }
  | { tipo: "toggle"; resposta: RespostaPadrao }
  | { tipo: "excluir"; resposta: RespostaPadrao };

export function RespostasPadraoPanel() {
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);
  const [respostas, setRespostas] = useState<RespostaPadrao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [acaoPendente, setAcaoPendente] = useState<AcaoPendente | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [segRes, respRes] = await Promise.all([
      supabase.from("seguradoras").select("id,nome").eq("ativo", true).order("ordem"),
      supabase
        .from("respostas_padrao")
        .select("id,seguradora_id,titulo,texto,ativo")
        .order("titulo"),
    ]);
    if (segRes.error) {
      setErr(segRes.error.message);
      setLoading(false);
      return;
    }
    if (respRes.error) {
      setErr(respRes.error.message);
      setLoading(false);
      return;
    }
    setSeguradoras(segRes.data ?? []);
    setRespostas(respRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function segNome(id: string | null) {
    if (id == null) return "Geral";
    return seguradoras.find((s) => s.id === id)?.nome ?? "—";
  }

  function validar(f: FormState): string | null {
    const titulo = f.titulo.trim();
    const texto = f.texto.trim();
    if (!titulo) return "Informe um título.";
    if (titulo.length > TITULO_MAX) return `Título deve ter no máximo ${TITULO_MAX} caracteres.`;
    if (!texto) return "Informe o texto da resposta.";
    if (texto.length > TEXTO_MAX) return `Texto deve ter no máximo ${TEXTO_MAX} caracteres.`;
    return null;
  }

  function criar() {
    const problema = validar(form);
    if (problema) {
      setErr(problema);
      return;
    }
    setErr(null);
    setAcaoPendente({ tipo: "criar", form });
  }

  function iniciarEdicao(r: RespostaPadrao) {
    setEditingId(r.id);
    setEditForm({
      titulo: r.titulo,
      texto: r.texto,
      seguradoraId: r.seguradora_id ?? "",
      ativo: r.ativo,
    });
    setErr(null);
  }

  function cancelarEdicao() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  function salvarEdicao(id: string) {
    const problema = validar(editForm);
    if (problema) {
      setErr(problema);
      return;
    }
    setErr(null);
    setAcaoPendente({ tipo: "editar", id, form: editForm });
  }

  function alternarAtivo(r: RespostaPadrao) {
    setErr(null);
    setAcaoPendente({ tipo: "toggle", resposta: r });
  }

  function excluir(r: RespostaPadrao) {
    if (!confirm(`Excluir a resposta padrão "${r.titulo}"?`)) return;
    setErr(null);
    setAcaoPendente({ tipo: "excluir", resposta: r });
  }

  async function confirmarComSenha(senha: string): Promise<{ error: string | null }> {
    if (!acaoPendente) return { error: "Nenhuma ação pendente." };
    setBusy(true);
    let resultado: { error: string | null };
    if (acaoPendente.tipo === "excluir") {
      const { error } = await supabase.rpc("fn_excluir_resposta_padrao", {
        p_senha: senha,
        p_id: acaoPendente.resposta.id,
      });
      resultado = { error: error?.message ?? null };
    } else {
      const f =
        acaoPendente.tipo === "toggle"
          ? {
              titulo: acaoPendente.resposta.titulo,
              texto: acaoPendente.resposta.texto,
              seguradoraId: acaoPendente.resposta.seguradora_id ?? "",
              ativo: !acaoPendente.resposta.ativo,
            }
          : acaoPendente.form;
      const { error } = await supabase.rpc("fn_salvar_resposta_padrao", {
        p_senha: senha,
        p_id:
          acaoPendente.tipo === "editar"
            ? acaoPendente.id
            : acaoPendente.tipo === "toggle"
              ? acaoPendente.resposta.id
              : undefined,
        p_seguradora_id: f.seguradoraId || undefined,
        p_titulo: f.titulo.trim(),
        p_texto: f.texto.trim(),
        p_ativo: f.ativo,
      });
      resultado = { error: error?.message ?? null };
    }
    setBusy(false);
    if (resultado.error) return resultado;

    if (acaoPendente.tipo === "criar") {
      setForm(EMPTY_FORM);
      setAddOpen(false);
      setToast({ msg: "Resposta padrão criada", kind: "ok" });
    } else if (acaoPendente.tipo === "editar") {
      cancelarEdicao();
      setToast({ msg: "Resposta padrão atualizada", kind: "ok" });
    } else if (acaoPendente.tipo === "toggle") {
      setToast({
        msg: acaoPendente.resposta.ativo ? "Resposta desativada" : "Resposta ativada",
        kind: "ok",
      });
    } else {
      setToast({ msg: "Resposta padrão excluída", kind: "alert" });
    }
    setAcaoPendente(null);
    await reload();
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-b muted small">Carregando respostas padrão…</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-h">
        <h3>
          <Icon id="message" size={16} /> Respostas padrão
        </h3>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen((v) => !v)}>
            <Icon id="plus" size={13} /> Nova resposta
          </button>
        </div>
      </div>

      {err && (
        <div className="card-b">
          <div className="banner alert">{err}</div>
        </div>
      )}

      {addOpen && (
        <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            className="input"
            placeholder="Título"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            maxLength={TITULO_MAX}
          />
          <textarea
            className="input"
            rows={3}
            placeholder="Texto da resposta"
            value={form.texto}
            onChange={(e) => setForm((f) => ({ ...f, texto: e.target.value }))}
            maxLength={TEXTO_MAX}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="input input-mini"
              style={{ maxWidth: 220 }}
              value={form.seguradoraId}
              onChange={(e) => setForm((f) => ({ ...f, seguradoraId: e.target.value }))}
            >
              <option value="">Geral (todas as seguradoras)</option>
              {seguradoras.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
            <label
              className="small muted"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              />
              Ativa
            </label>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setAddOpen(false);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </button>
              <button className="btn btn-yellow btn-sm" disabled={busy} onClick={criar}>
                <Icon id="check" size={13} /> Criar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Título</th>
              <th>Texto</th>
              <th>Seguradora</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {respostas.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: 32 }}>
                  <span className="muted small">Nenhuma resposta padrão cadastrada.</span>
                </td>
              </tr>
            )}
            {respostas.map((r) =>
              editingId === r.id ? (
                <tr key={r.id}>
                  <td colSpan={5}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
                      <input
                        className="input"
                        placeholder="Título"
                        value={editForm.titulo}
                        onChange={(e) => setEditForm((f) => ({ ...f, titulo: e.target.value }))}
                        maxLength={TITULO_MAX}
                      />
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Texto da resposta"
                        value={editForm.texto}
                        onChange={(e) => setEditForm((f) => ({ ...f, texto: e.target.value }))}
                        maxLength={TEXTO_MAX}
                      />
                      <div
                        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <select
                          className="input input-mini"
                          style={{ maxWidth: 220 }}
                          value={editForm.seguradoraId}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, seguradoraId: e.target.value }))
                          }
                        >
                          <option value="">Geral (todas as seguradoras)</option>
                          {seguradoras.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nome}
                            </option>
                          ))}
                        </select>
                        <label
                          className="small muted"
                          style={{ display: "flex", alignItems: "center", gap: 6 }}
                        >
                          <input
                            type="checkbox"
                            checked={editForm.ativo}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, ativo: e.target.checked }))
                            }
                          />
                          Ativa
                        </label>
                        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                          <button className="btn btn-ghost btn-sm" onClick={cancelarEdicao}>
                            Cancelar
                          </button>
                          <button
                            className="btn btn-yellow btn-sm"
                            disabled={busy}
                            onClick={() => salvarEdicao(r.id)}
                          >
                            <Icon id="check" size={13} /> Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.titulo}</td>
                  <td className="small muted" style={{ maxWidth: 360 }}>
                    {r.texto.length > 120 ? `${r.texto.slice(0, 120)}…` : r.texto}
                  </td>
                  <td>{segNome(r.seguradora_id)}</td>
                  <td>
                    {r.ativo ? (
                      <span className="chip chip-ok">Ativa</span>
                    ) : (
                      <span className="chip chip-outline">Inativa</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => iniciarEdicao(r)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => alternarAtivo(r)}
                    >
                      {r.ativo ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => excluir(r)}
                    >
                      <Icon id="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {acaoPendente && (
        <SenhaDiretorModal
          label={
            acaoPendente.tipo === "excluir"
              ? `a exclusão de "${acaoPendente.resposta.titulo}"`
              : "as respostas padrão"
          }
          onConfirm={confirmarComSenha}
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
