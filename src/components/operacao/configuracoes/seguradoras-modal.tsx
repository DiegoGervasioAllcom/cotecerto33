// Modal "Gerenciar seguradoras" — CRUD com busca, filtro por status e paginação.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seguradoraSchema } from "@/lib/schemas/catalogos.schema";
import { ModalShell } from "./modal-shell";
import type { Seguradora } from "./types";

export function SeguradorasModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Seguradora[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [nova, setNova] = useState({ nome: "", codigo: "" });
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativa" | "inativa">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("seguradoras")
      .select("id,nome,codigo,ativo,ordem")
      .order("ordem")
      .order("nome");
    if (error) setErr(error.message);
    setRows((data ?? []) as Seguradora[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    const r = seguradoraSchema.safeParse(nova);
    if (!r.success) {
      setErr(r.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setBusy(true);
    setErr(null);
    const ordem = (rows.at(-1)?.ordem ?? 0) + 1;
    const { error } = await supabase
      .from("seguradoras")
      .insert({ nome: r.data.nome, codigo: r.data.codigo?.trim() || null, ordem });
    if (error) setErr(error.message);
    setNova({ nome: "", codigo: "" });
    setBusy(false);
    void load();
  }

  async function toggle(r: Seguradora) {
    const { error } = await supabase.from("seguradoras").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function rename(r: Seguradora, nome: string) {
    if (nome === r.nome || !nome.trim()) return;
    const check = seguradoraSchema.shape.nome.safeParse(nome);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    const { error } = await supabase
      .from("seguradoras")
      .update({ nome: check.data })
      .eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function updateCodigo(r: Seguradora, codigo: string) {
    const novo = codigo.trim() || null;
    if (novo === r.codigo) return;
    const check = seguradoraSchema.shape.codigo.safeParse(codigo);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Código inválido.");
      return;
    }
    const { error } = await supabase.from("seguradoras").update({ codigo: novo }).eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  async function remove(r: Seguradora) {
    if (!confirm(`Remover ${r.nome}?`)) return;
    const { error } = await supabase.from("seguradoras").delete().eq("id", r.id);
    if (error) setErr(error.message);
    void load();
  }

  const filtered = rows.filter((r) => {
    if (statusFilter === "ativa" && !r.ativo) return false;
    if (statusFilter === "inativa" && r.ativo) return false;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      if (!r.nome.toLowerCase().includes(t) && !(r.codigo ?? "").toLowerCase().includes(t))
        return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const ativas = rows.filter((r) => r.ativo).length;

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter]);

  return (
    <ModalShell title="Gerenciar seguradoras" onClose={onClose} wide>
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="muted small" style={{ marginRight: "auto" }}>
          <strong style={{ color: "#0f172a" }}>{rows.length}</strong> seguradoras · {ativas}{" "}
          ativa(s)
        </div>
        <input
          className="input"
          placeholder="Buscar por nome ou código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 260 }}
        />
        <div style={{ display: "inline-flex", gap: 4 }}>
          {(["all", "ativa", "inativa"] as const).map((s) => (
            <button
              key={s}
              className={`chip ${statusFilter === s ? "chip-ok" : "chip-outline"}`}
              onClick={() => setStatusFilter(s)}
              style={{ cursor: "pointer", textTransform: "capitalize" }}
            >
              {s === "all" ? "Todas" : s}
            </button>
          ))}
        </div>
      </div>

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
          Adicionar nova seguradora
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8 }}>
          <input
            className="input"
            placeholder="Nome da seguradora"
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            maxLength={150}
          />
          <input
            className="input"
            placeholder="Código (opcional)"
            value={nova.codigo}
            onChange={(e) => setNova({ ...nova, codigo: e.target.value })}
            maxLength={30}
          />
          <button className="btn btn-primary" onClick={add} disabled={busy || !nova.nome.trim()}>
            Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="muted small">Carregando…</div>
      ) : (
        <>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <table className="table" style={{ margin: 0 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={{ width: 48, textAlign: "center" }}>#</th>
                  <th>Nome</th>
                  <th style={{ width: 160 }}>Código</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 110, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="muted small" style={{ textAlign: "center" }}>
                      {(pageSafe - 1) * pageSize + i + 1}
                    </td>
                    <td>
                      <input
                        className="input"
                        defaultValue={r.nome}
                        onBlur={(e) => rename(r, e.target.value)}
                        maxLength={150}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        defaultValue={r.codigo ?? ""}
                        placeholder="—"
                        onBlur={(e) => updateCodigo(r, e.target.value)}
                        maxLength={30}
                      />
                    </td>
                    <td>
                      <span
                        className={`chip ${r.ativo ? "chip-ok" : "chip-outline"}`}
                        onClick={() => toggle(r)}
                        style={{ cursor: "pointer" }}
                      >
                        {r.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => remove(r)}
                        style={{ color: "#b91c1c" }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="muted small"
                      style={{ textAlign: "center", padding: 24 }}
                    >
                      {filtered.length === 0
                        ? "Nenhuma seguradora encontrada."
                        : "Nenhum resultado nesta página."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <div className="muted small">
              Mostrando {pageRows.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1}–
              {(pageSafe - 1) * pageSize + pageRows.length} de {filtered.length}
            </div>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={pageSafe <= 1}
                onClick={() => setPage(pageSafe - 1)}
              >
                ← Anterior
              </button>
              <span className="small muted">
                Página {pageSafe} de {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={pageSafe >= totalPages}
                onClick={() => setPage(pageSafe + 1)}
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}
