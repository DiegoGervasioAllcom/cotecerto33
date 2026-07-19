import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { mensagemFormSchema } from "@/lib/schemas/mensagem.schema";

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
  categoria: string | null;
  objetivo: string | null;
  dia: number | null;
  ativo: boolean;
  atualizado_em: string;
};

type EditingMsg = Partial<Msg> & { titulo?: string; conteudo?: string };

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size}>
      <use href={`#i-${name}`} />
    </svg>
  );
}

function Page() {
  const [rows, setRows] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [isMatriz, setIsMatriz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingMsg | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");

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
      .order("titulo", { ascending: true });
    if (error) setErr(error.message);
    setRows((data ?? []) as Msg[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function novaPessoal() {
    setEditing({
      escopo: "pessoal",
      titulo: "",
      conteudo: "",
      categoria: "",
      objetivo: "",
      dia: null,
      ativo: true,
    });
  }
  function novaGlobal() {
    setEditing({
      escopo: "global",
      titulo: "",
      conteudo: "",
      categoria: "",
      objetivo: "",
      dia: null,
      ativo: true,
    });
  }

  async function salvar() {
    if (!editing) return;
    const diaNorm =
      editing.dia === undefined || editing.dia === null || Number.isNaN(editing.dia)
        ? null
        : editing.dia;
    const parsed = mensagemFormSchema.safeParse({
      titulo: editing.titulo,
      conteudo: editing.conteudo,
      categoria: editing.categoria,
      objetivo: editing.objetivo,
      dia: diaNorm,
    });
    if (!parsed.success) {
      setErr(parsed.error.issues[0]?.message ?? "Verifique os campos.");
      return;
    }
    setBusy(true);
    const payload = {
      titulo: parsed.data.titulo,
      conteudo: parsed.data.conteudo,
      escopo: editing.escopo ?? "pessoal",
      categoria: parsed.data.categoria?.trim() || null,
      objetivo: parsed.data.objetivo?.trim() || null,
      dia: diaNorm,
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

  function enviarWhatsapp(m: Msg) {
    window.open(`https://wa.me/?text=${encodeURIComponent(m.conteudo)}`, "_blank");
  }

  const categorias = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((m) => {
      if (m.categoria) set.add(m.categoria);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((m) => (cat ? m.categoria === cat : true))
      .filter((m) => {
        if (!q) return true;
        return [m.titulo, m.objetivo ?? "", m.categoria ?? "", m.conteudo]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const da = a.dia ?? Number.POSITIVE_INFINITY;
        const db = b.dia ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = (a.categoria ?? "").localeCompare(b.categoria ?? "");
        if (ca !== 0) return ca;
        return a.titulo.localeCompare(b.titulo);
      });
  }, [rows, search, cat]);

  return (
    <AppShell title="Mensagens prontas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Mensagens prontas</h1>
          <div className="sub">Sua biblioteca de mensagens</div>
        </div>
        <div className="tools row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ maxWidth: 260 }}
            placeholder="Buscar mensagem…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

      <div className="audit-note" style={{ marginBottom: 14 }}>
        <Icon name="spark" size={16} /> As mensagens oficiais são curadas pela Matriz. Antes de
        enviar, troque as variáveis <strong style={{ margin: "0 4px" }}>{"{cliente}"}</strong>,{" "}
        <strong style={{ margin: "0 4px" }}>{"{veiculo}"}</strong> e{" "}
        <strong style={{ margin: "0 4px" }}>{"{vendedor}"}</strong> pelos dados reais.
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
            <div className="field-group">
              <label>Título</label>
              <input
                className="input"
                maxLength={160}
                value={editing.titulo ?? ""}
                onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
              />
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field-group" style={{ flex: 1 }}>
                <label>Categoria</label>
                <input
                  className="input"
                  maxLength={80}
                  value={editing.categoria ?? ""}
                  onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}
                />
              </div>
              <div className="field-group" style={{ width: 120 }}>
                <label>Dia (opcional)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  value={editing.dia ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      dia: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="field-group">
              <label>Objetivo</label>
              <input
                className="input"
                maxLength={200}
                value={editing.objetivo ?? ""}
                onChange={(e) => setEditing({ ...editing, objetivo: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Conteúdo</label>
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

      <div className="msg-cat-bar">
        <span className={`chip ${!cat ? "chip-slate" : "chip-outline"}`} onClick={() => setCat("")}>
          Todas
        </span>
        {categorias.map((c) => (
          <span
            key={c}
            className={`chip ${cat === c ? "chip-slate" : "chip-outline"}`}
            onClick={() => setCat(c)}
          >
            {c}
          </span>
        ))}
      </div>

      {!loading && filtered.length === 0 && !editing && (
        <div className="card">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            Nenhuma mensagem encontrada.
          </div>
        </div>
      )}

      <div className="msg-grid">
        {filtered.map((m) => {
          const mine = m.owner_id === me;
          const canEdit = mine || (m.escopo === "global" && isMatriz);
          return (
            <div key={m.id} className="msg-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="chip chip-yellow">{m.categoria ?? "Sem categoria"}</span>
                <div className="row" style={{ gap: 6 }}>
                  {m.dia !== null && <span className="chip chip-outline">Dia {m.dia}</span>}
                  {m.escopo === "global" && (
                    <span className="chip chip-ok">
                      <Icon name="check" size={11} /> Oficial
                    </span>
                  )}
                </div>
              </div>
              <strong style={{ color: "var(--slate)", fontSize: 14 }}>{m.titulo}</strong>
              {m.objetivo && <div className="mc-obj">{m.objetivo}</div>}
              <div className="msg-body">{m.conteudo}</div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => copiar(m)}
                >
                  <Icon name="file" size={13} /> {copiedId === m.id ? "Copiado!" : "Copiar"}
                </button>
                <button
                  className="btn btn-wa btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => enviarWhatsapp(m)}
                >
                  <Icon name="message" size={13} /> WhatsApp
                </button>
              </div>
              {canEdit && (
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setEditing(m)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => excluir(m.id)}
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
