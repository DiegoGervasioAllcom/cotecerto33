import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/mensagens-prontas")({
  head: () => ({ meta: [{ title: "Mensagens prontas · CoteCerto" }] }),
  component: Page,
});

type Msg = {
  id: string;
  escopo: "global" | "pessoal";
  owner_id: string | null;
  titulo: string;
  conteudo: string;
  ativo: boolean;
  atualizado_em: string;
};

function Page() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [isMatriz, setIsMatriz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Msg> | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      .order("escopo", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) setErr(error.message);
    setRows((data ?? []) as Msg[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function novaPessoal() {
    setEditing({ escopo: "pessoal", titulo: "", conteudo: "", ativo: true });
  }
  function novaGlobal() {
    setEditing({ escopo: "global", titulo: "", conteudo: "", ativo: true });
  }

  async function salvar() {
    if (!editing || !editing.titulo || !editing.conteudo) return;
    setBusy(true);
    const payload = {
      titulo: editing.titulo,
      conteudo: editing.conteudo,
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

  async function copiar(m: Msg) {
    try {
      await navigator.clipboard.writeText(m.conteudo);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <AppShell title="Mensagens prontas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Mensagens prontas</h1>
          <div className="sub">Templates globais (Matriz) e suas mensagens pessoais</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isMatriz && (
            <button className="btn" onClick={novaGlobal}>
              Nova global
            </button>
          )}
          <button className="btn btn-primary" onClick={novaPessoal}>
            Nova mensagem
          </button>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {editing && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-h">
            <strong>{editing.id ? "Editar" : "Nova"} mensagem</strong>
            <span className={`chip ${editing.escopo === "global" ? "chip-info" : "chip-slate"}`}>
              {editing.escopo}
            </span>
          </div>
          <div className="card-b" style={{ display: "grid", gap: 10 }}>
            <div>
              <div className="label">Título</div>
              <input
                className="input"
                value={editing.titulo ?? ""}
                onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
              />
            </div>
            <div>
              <div className="label">Conteúdo</div>
              <textarea
                className="input"
                rows={5}
                value={editing.conteudo ?? ""}
                onChange={(e) => setEditing({ ...editing, conteudo: e.target.value })}
              />
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={busy} onClick={salvar}>
                {busy ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && !editing && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Nenhuma mensagem cadastrada.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((m) => {
          const mine = m.owner_id === me;
          const canEdit = mine || (m.escopo === "global" && isMatriz);
          return (
            <div key={m.id} className="card">
              <div className="card-h">
                <div>
                  <strong>{m.titulo}</strong>{" "}
                  <span
                    className={`chip ${m.escopo === "global" ? "chip-info" : "chip-slate"}`}
                    style={{ marginLeft: 6 }}
                  >
                    {m.escopo}
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn" onClick={() => copiar(m)}>
                    {copiedId === m.id ? "Copiado!" : "Copiar"}
                  </button>
                  {canEdit && (
                    <>
                      <button className="btn" onClick={() => setEditing(m)}>
                        Editar
                      </button>
                      <button className="btn" onClick={() => excluir(m.id)}>
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="card-b">
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    margin: 0,
                    color: "var(--text)",
                  }}
                >
                  {m.conteudo}
                </pre>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
