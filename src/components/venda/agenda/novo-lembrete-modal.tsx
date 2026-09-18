// Modal "Novo lembrete" (Frente 9 · V12 · Minha agenda).
// Espelha lembreteModal() do protótipo v12: tipo (pills), título, data/hora,
// cliente opcional e observação opcional. Insere direto em `lembretes` com
// vendedor_id = auth.uid() — RLS garante que só o próprio dono vê/edita.
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LEMBRETE_TIPOS,
  LEMBRETE_TIPO_ICON,
  LEMBRETE_TIPO_LABEL,
  lembreteFormSchema,
  type LembreteForm,
} from "@/lib/schemas/lembrete.schema";

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NovoLembreteModal({
  vendedorId,
  onClose,
  onCreated,
}: {
  vendedorId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LembreteForm>({
    resolver: zodResolver(lembreteFormSchema),
    defaultValues: {
      tipo: "tarefa",
      titulo: "",
      nota: "",
      data: hojeISO(),
      hora: "09:00",
      lead_id: "",
    },
  });
  const tipo = watch("tipo");

  const leadsQuery = useQuery({
    queryKey: ["agenda", "leads-para-lembrete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id,nome")
        .neq("status_pipeline", "perdido")
        .order("nome")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onSubmit(values: LembreteForm) {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.from("lembretes").insert({
      vendedor_id: vendedorId,
      tipo: values.tipo,
      titulo: values.titulo.trim(),
      nota: values.nota?.trim() || null,
      data: values.data,
      hora: values.hora || null,
      lead_id: values.lead_id || null,
      done: false,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onCreated();
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <h3>
            <svg width={18} height={18} aria-hidden="true">
              <use href="#i-bell" />
            </svg>{" "}
            Novo lembrete
          </h3>
          <div className="x" onClick={onClose}>
            ×
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="modal-b">
            {err && (
              <div className="alert alert-err" style={{ marginBottom: 12 }}>
                {err}
              </div>
            )}
            <div className="clt-note" style={{ marginTop: 0, marginBottom: 14 }}>
              <svg width={15} height={15} aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <div>
                Um lembrete <strong>não precisa de cliente</strong>. Vincule só quando o compromisso
                for sobre um atendimento específico — aí ele leva você direto ao lead.
              </div>
            </div>

            <div className="acc-sec-t" style={{ marginTop: 0 }}>
              Tipo
            </div>
            <div className="acc-pills" style={{ marginBottom: 14 }}>
              {LEMBRETE_TIPOS.map((k) => (
                <button
                  type="button"
                  key={k}
                  className={`acc-pill${tipo === k ? " on" : ""}`}
                  onClick={() => setValue("tipo", k)}
                >
                  <svg width={13} height={13} aria-hidden="true">
                    <use href={`#${LEMBRETE_TIPO_ICON[k]}`} />
                  </svg>{" "}
                  {LEMBRETE_TIPO_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="field-group">
              <label>O que precisa ser feito *</label>
              <input
                className="input"
                maxLength={2000}
                placeholder="Ex.: Ligar para o contador sobre a nota"
                {...register("titulo")}
              />
              {errors.titulo && (
                <div className="small" style={{ color: "var(--alert)" }}>
                  {errors.titulo.message}
                </div>
              )}
            </div>

            <div className="acc-grid">
              <div className="field-group">
                <label>Data *</label>
                <input className="input" type="date" {...register("data")} />
                {errors.data && (
                  <div className="small" style={{ color: "var(--alert)" }}>
                    {errors.data.message}
                  </div>
                )}
              </div>
              <div className="field-group">
                <label>
                  Hora <span className="muted">(opcional)</span>
                </label>
                <input className="input" type="time" {...register("hora")} />
              </div>
            </div>

            <div className="field-group">
              <label>
                Cliente <span className="muted">(opcional)</span>
              </label>
              <select className="input" {...register("lead_id")}>
                <option value="">Nenhum — lembrete solto</option>
                {(leadsQuery.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label>
                Observação <span className="muted">(opcional)</span>
              </label>
              <textarea
                className="input"
                rows={2}
                maxLength={2000}
                placeholder="Detalhes que ajudam na hora de fazer"
                {...register("nota")}
              />
              {errors.nota && (
                <div className="small" style={{ color: "var(--alert)" }}>
                  {errors.nota.message}
                </div>
              )}
            </div>
          </div>
          <div className="modal-f">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-yellow" disabled={busy}>
              <svg width={14} height={14} aria-hidden="true">
                <use href="#i-check" />
              </svg>{" "}
              {busy ? "Salvando…" : "Salvar lembrete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
