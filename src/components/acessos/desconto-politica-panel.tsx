// Aba "Personalização geral" — Política de alçada (desconto máximo) (G3.5).
// Grade seguradora x modelo com o % máximo de desconto que cada modelo pode
// conceder por seguradora. Célula vazia = sem alçada definida (o pedido é
// escalado direto à Matriz). Grava/limpa em `desconto_politicas` via RLS
// (escrita restrita à matriz).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";

type Seguradora = { id: string; nome: string };

const MODELOS = [
  { k: "franquia_individual", l: "Franquia Individual" },
  { k: "franquia_full", l: "Franquia Full" },
  { k: "master", l: "Master" },
  { k: "supervisor", l: "Supervisor" },
] as const;

type ModeloKey = (typeof MODELOS)[number]["k"];

function key(modelo: string, seguradoraId: string) {
  return `${modelo}:${seguradoraId}`;
}

export function DescontoPoliticaPanel() {
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [segRes, polRes] = await Promise.all([
      supabase.from("seguradoras").select("id,nome").eq("ativo", true).order("ordem"),
      supabase.from("desconto_politicas").select("modelo,seguradora_id,pct_maximo"),
    ]);
    if (segRes.error) {
      setErr(segRes.error.message);
      setLoading(false);
      return;
    }
    if (polRes.error) {
      setErr(polRes.error.message);
      setLoading(false);
      return;
    }
    setSeguradoras(segRes.data ?? []);
    const map: Record<string, string> = {};
    for (const p of polRes.data ?? []) {
      map[key(p.modelo, p.seguradora_id)] = String(p.pct_maximo);
    }
    setGrid(map);
    setOriginal(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  function setCell(modelo: ModeloKey, seguradoraId: string, value: string) {
    setGrid((prev) => ({ ...prev, [key(modelo, seguradoraId)]: value }));
  }

  async function salvar() {
    setErr(null);
    const keys = new Set([...Object.keys(grid), ...Object.keys(original)]);
    const toUpsert: { modelo: string; seguradora_id: string; pct_maximo: number }[] = [];
    const toDelete: { modelo: string; seguradora_id: string }[] = [];

    for (const k of keys) {
      const [modelo, seguradoraId] = k.split(":");
      const raw = (grid[k] ?? "").trim();
      const hadOriginal = original[k] !== undefined;

      if (raw === "") {
        if (hadOriginal) toDelete.push({ modelo, seguradora_id: seguradoraId });
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        const segNome = seguradoras.find((s) => s.id === seguradoraId)?.nome ?? seguradoraId;
        const modeloLabel = MODELOS.find((m) => m.k === modelo)?.l ?? modelo;
        setErr(`% inválido para ${modeloLabel} × ${segNome}: informe um número entre 0 e 100.`);
        return;
      }
      if (String(n) !== original[k]) {
        toUpsert.push({ modelo, seguradora_id: seguradoraId, pct_maximo: n });
      }
    }

    if (toUpsert.length === 0 && toDelete.length === 0) {
      setToast({ msg: "Nada para salvar.", kind: "ok" });
      return;
    }

    setBusy(true);
    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from("desconto_politicas")
        .upsert(toUpsert, { onConflict: "modelo,seguradora_id" });
      if (error) {
        setBusy(false);
        setErr(error.message);
        return;
      }
    }
    for (const d of toDelete) {
      const { error } = await supabase
        .from("desconto_politicas")
        .delete()
        .eq("modelo", d.modelo)
        .eq("seguradora_id", d.seguradora_id);
      if (error) {
        setBusy(false);
        setErr(error.message);
        return;
      }
    }
    setBusy(false);
    setToast({ msg: "Política de alçada atualizada", kind: "ok" });
    await reload();
  }

  if (loading) {
    return (
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-b muted small">Carregando política de alçada…</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-h">
        <h3>
          <Icon id="percent" size={16} /> Política de alçada (desconto máximo)
        </h3>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-slate btn-sm" disabled={busy} onClick={salvar}>
            <Icon id="check" size={13} /> Salvar política
          </button>
        </div>
      </div>
      {err && (
        <div className="card-b">
          <div className="banner alert">{err}</div>
        </div>
      )}
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th>Seguradora</th>
              {MODELOS.map((m) => (
                <th key={m.k}>{m.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seguradoras.length === 0 && (
              <tr>
                <td colSpan={MODELOS.length + 1} style={{ textAlign: "center", padding: 32 }}>
                  <span className="muted small">Nenhuma seguradora ativa cadastrada.</span>
                </td>
              </tr>
            )}
            {seguradoras.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 700 }}>{s.nome}</td>
                {MODELOS.map((m) => (
                  <td key={m.k}>
                    <input
                      className="input input-mini"
                      inputMode="decimal"
                      placeholder="—"
                      style={{ maxWidth: 90 }}
                      value={grid[key(m.k, s.id)] ?? ""}
                      onChange={(e) => setCell(m.k, s.id, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b">
        <div className="muted small">
          <Icon id="info" size={13} /> Célula vazia = sem alçada definida: o pedido é escalado
          direto à Matriz.
        </div>
      </div>
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
