import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useRequireRole } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/operacao/mensagens")({
  head: () => ({ meta: [{ title: "Mensagens prontas · CoteCerto" }] }),
  component: Page,
});

type Msg = {
  id: string;
  escopo: "global" | "pessoal";
  owner_id: string | null;
  titulo: string;
  conteudo: string;
  categoria: string | null;
  objetivo: string | null;
  ativo: boolean;
  atualizado_em: string;
};

const CATEGORIAS = [
  "Primeiro contato",
  "Follow-up",
  "Reativação",
  "Lead recebido",
  "Pós-cotação",
  "Documentos",
  "Fechamento",
  "Pós-venda",
];

function Page() {
  const denied = useRequireRole("matriz");
  const [rows, setRows] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [isMatriz, setIsMatriz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Msg> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? null;
    setMe(uid);
    if (uid) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      setIsMatriz(!!roles?.some((r) => r.role === "matriz"));
    }
    const { data, error } = await supabase
      .from("mensagens_prontas")
      .select("*")
      .order("categoria", { ascending: true, nullsFirst: false })
      .order("titulo", { ascending: true });
    if (error) setErr(error.message);
    setRows((data ?? []) as Msg[]);
    setLoading(false);
  }
  useEffect(() => {
    if (denied) return;
    load();
  }, [denied]);

  function nova() {
    setEditing({
      escopo: isMatriz ? "global" : "pessoal",
      titulo: "",
      conteudo: "",
      categoria: "",
      objetivo: "",
      ativo: true,
    });
  }

  async function salvar() {
    if (!editing || !editing.titulo || !editing.conteudo) return;
    setBusy(true);
    const payload = {
      titulo: editing.titulo,
      conteudo: editing.conteudo,
      categoria: editing.categoria || null,
      objetivo: editing.objetivo || null,
      escopo: editing.escopo,
      ativo: editing.ativo ?? true,
      owner_id: editing.escopo === "pessoal" ? me : null,
      atualizado_em: new Date().toISOString(),
    };
    const { error } = editing.id
      ? await supabase.from("mensagens_prontas").update(payload).eq("id", editing.id)
      : await supabase.from("mensagens_prontas").insert(payload);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setEditing(null);
    await load();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta mensagem?")) return;
    const { error } = await supabase.from("mensagens_prontas").delete().eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  async function toggleAtivo(m: Msg) {
    const { error } = await supabase
      .from("mensagens_prontas")
      .update({ ativo: !m.ativo, atualizado_em: new Date().toISOString() })
      .eq("id", m.id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  const kpis = useMemo(() => {
    const total = rows.length;
    const oficiais = rows.filter((r) => r.escopo === "global" && r.ativo).length;
    const cats = new Set(rows.map((r) => r.categoria).filter(Boolean));
    return { total, oficiais, categorias: cats.size };
  }, [rows]);

  if (denied) return denied;

  return (
    <AppShell title="Mensagens prontas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Mensagens prontas</h1>
          <div className="sub">
            Curadoria da comunicação — inclua, edite, remova e marque as mensagens oficiais
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-yellow" onClick={nova}>
            <svg width={14} height={14}>
              <use href="#i-plus" />
            </svg>{" "}
            Nova mensagem
          </button>
        </div>
      </div>

      <div className="summary-chips">
        <div className="sum-chip">
          <div className="sc-val">{kpis.total}</div>
          <div className="sc-lbl">Mensagens</div>
        </div>
        <div className="sum-chip ok">
          <div className="sc-val">{kpis.oficiais}</div>
          <div className="sc-lbl">Oficiais (visíveis)</div>
        </div>
        <div className="sum-chip info">
          <div className="sc-val">{kpis.categorias}</div>
          <div className="sc-lbl">Categorias</div>
        </div>
      </div>

      <div className="audit-note" style={{ marginBottom: 12 }}>
        <svg width={16} height={16}>
          <use href="#i-shield" />
        </svg>{" "}
        Só mensagens <strong style={{ margin: "0 4px" }}>oficiais</strong> aparecem para os
        vendedores. Padronize a comunicação da marca e evite promessas indevidas de cobertura.
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {editing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h">
            <strong>{editing.id ? "Editar" : "Nova"} mensagem</strong>
          </div>
          <div className="card-b" style={{ display: "grid", gap: 10 }}>
            <div
              className="grid-2"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              <div className="field-group">
                <label>Etapa / Título</label>
                <input
                  className="input"
                  value={editing.titulo ?? ""}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                  placeholder="Ex.: Dia 1 — WhatsApp inicial"
                />
              </div>
              <div className="field-group">
                <label>Categoria</label>
                <input
                  className="input"
                  list="msg-categorias"
                  value={editing.categoria ?? ""}
                  onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}
                  placeholder="Ex.: Follow-up"
                />
                <datalist id="msg-categorias">
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="field-group">
              <label>Objetivo</label>
              <input
                className="input"
                value={editing.objetivo ?? ""}
                onChange={(e) => setEditing({ ...editing, objetivo: e.target.value })}
                placeholder="O que esta mensagem deve provocar no cliente"
              />
            </div>
            <div className="field-group">
              <label>Conteúdo</label>
              <textarea
                className="input"
                rows={6}
                value={editing.conteudo ?? ""}
                onChange={(e) => setEditing({ ...editing, conteudo: e.target.value })}
              />
            </div>
            <div className="row" style={{ gap: 12, alignItems: "center" }}>
              {isMatriz && (
                <label className="row" style={{ gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={editing.escopo === "global"}
                    onChange={(e) =>
                      setEditing({ ...editing, escopo: e.target.checked ? "global" : "pessoal" })
                    }
                  />
                  Oficial (visível para vendedores)
                </label>
              )}
              <label className="row" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={editing.ativo ?? true}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                />
                Ativa
              </label>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button className="btn btn-yellow" disabled={busy} onClick={salvar}>
                  {busy ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <table className="table-pipe" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Etapa</th>
              <th style={{ textAlign: "left" }}>Categoria</th>
              <th style={{ textAlign: "left" }}>Objetivo</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
                  Nenhuma mensagem cadastrada.
                </td>
              </tr>
            )}
            {rows.map((m) => {
              const mine = m.owner_id === me;
              const canEdit = mine || (m.escopo === "global" && isMatriz);
              const oficial = m.escopo === "global" && m.ativo;
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.titulo}</td>
                  <td style={{ color: "#2563eb" }}>{m.categoria ?? "—"}</td>
                  <td style={{ color: "var(--muted)" }}>{m.objetivo ?? "—"}</td>
                  <td>
                    <span className={`chip ${oficial ? "chip-ok" : "chip-slate"}`}>
                      {oficial ? "Oficial" : m.escopo === "global" ? "Inativa" : "Pessoal"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                      {canEdit && (
                        <>
                          <button className="ic-mini" title="Editar" onClick={() => setEditing(m)}>
                            <svg width={15} height={15}>
                              <use href="#i-edit" />
                            </svg>
                          </button>
                          <button
                            className="ic-mini"
                            title={m.ativo ? "Desativar" : "Ativar"}
                            onClick={() => toggleAtivo(m)}
                          >
                            <svg width={15} height={15}>
                              <use href="#i-check" />
                            </svg>
                          </button>
                          <button
                            className="ic-mini danger"
                            title="Excluir"
                            onClick={() => excluir(m.id)}
                          >
                            <svg width={15} height={15}>
                              <use href="#i-trash" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
