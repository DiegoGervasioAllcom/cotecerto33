import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

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
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
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
    load();
  }, []);

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
          <button className="btn btn-primary" onClick={nova}>
            + Nova mensagem
          </button>
        </div>
      </div>

      <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,180px))", gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ borderLeft: "4px solid var(--accent, #f59e0b)" }}>
          <div className="card-b">
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpis.total}</div>
            <div className="muted">Mensagens</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: "4px solid #16a34a" }}>
          <div className="card-b">
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpis.oficiais}</div>
            <div className="muted">Oficiais (visíveis)</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: "4px solid #2563eb" }}>
          <div className="card-b">
            <div style={{ fontSize: 24, fontWeight: 700 }}>{kpis.categorias}</div>
            <div className="muted">Categorias</div>
          </div>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 12 }}>
        Só mensagens <strong>oficiais</strong> aparecem para os vendedores. Padronize a comunicação da marca e evite promessas indevidas de cobertura.
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {editing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h">
            <strong>{editing.id ? "Editar" : "Nova"} mensagem</strong>
          </div>
          <div className="card-b" style={{ display: "grid", gap: 10 }}>
            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="label">Etapa / Título</div>
                <input
                  className="input"
                  value={editing.titulo ?? ""}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                  placeholder="Ex.: Dia 1 — WhatsApp inicial"
                />
              </div>
              <div>
                <div className="label">Categoria</div>
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
            <div>
              <div className="label">Objetivo</div>
              <input
                className="input"
                value={editing.objetivo ?? ""}
                onChange={(e) => setEditing({ ...editing, objetivo: e.target.value })}
                placeholder="O que esta mensagem deve provocar no cliente"
              />
            </div>
            <div>
              <div className="label">Conteúdo</div>
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
                <button className="btn btn-primary" disabled={busy} onClick={salvar}>
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
                    <span className={`chip ${oficial ? "chip-success" : "chip-slate"}`}>
                      {oficial ? "Oficial" : m.escopo === "global" ? "Inativa" : "Pessoal"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      {canEdit && (
                        <>
                          <button className="btn btn-icon" title="Editar" onClick={() => setEditing(m)}>
                            ✎
                          </button>
                          <button
                            className="btn btn-icon"
                            title={m.ativo ? "Desativar" : "Ativar"}
                            onClick={() => toggleAtivo(m)}
                          >
                            ✓
                          </button>
                          <button className="btn btn-icon" title="Excluir" onClick={() => excluir(m.id)}>
                            🗑
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
