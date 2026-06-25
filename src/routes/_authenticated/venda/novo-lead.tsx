import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  component: NovoLeadPage,
});

function NovoLeadPage() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    contato: "",
    origem: "manual",
    valor: "",
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const valorNum = form.valor ? Number(form.valor.replace(",", ".")) : 0;
    const { error } = await supabase.from("leads").insert({
      nome: form.nome,
      contato: form.contato,
      origem: form.origem,
      valor: valorNum,
      empresa_id: profile?.empresa_id ?? null,
      responsavel_id: session?.user.id ?? null,
      status_pipeline: "novo",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/venda/pipeline" });
  };

  return (
    <AppShell title="Novo lead" crumbs="Venda · Captação manual">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-h"><h3>Cadastrar lead</h3></div>
        <form className="card-b" onSubmit={submit} style={{ display: "grid", gap: 16 }}>
          <label className="field">
            <span>Nome do lead</span>
            <input required value={form.nome} onChange={update("nome")} placeholder="Ex: João da Silva" />
          </label>
          <label className="field">
            <span>Contato (telefone / e-mail)</span>
            <input value={form.contato} onChange={update("contato")} placeholder="(11) 99999-0000" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <label className="field">
              <span>Origem</span>
              <select value={form.origem} onChange={update("origem")}>
                <option value="manual">Manual</option>
                <option value="indicacao">Indicação</option>
                <option value="site">Site</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="matriz">Distribuído pela Matriz</option>
              </select>
            </label>
            <label className="field">
              <span>Valor estimado (R$)</span>
              <input value={form.valor} onChange={update("valor")} placeholder="0,00" inputMode="decimal" />
            </label>
          </div>
          {err && <div className="alert alert-err">{err}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => history.back()}>Cancelar</button>
            <button type="submit" className="btn btn-yellow" disabled={busy}>
              {busy ? "Salvando…" : "Cadastrar lead"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
