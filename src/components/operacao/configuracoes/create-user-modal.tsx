// Modal de criação de um novo usuário (Matriz/Franqueado/Vendedor).
import { useState } from "react";
import { email as emailSchema, password as passwordSchema } from "@/lib/schemas/common";
import { nomeUsuarioSchema } from "./constants";
import { ModalShell } from "./modal-shell";
import type { Empresa } from "./types";

export function CreateUserModal({
  role,
  empresas,
  onClose,
  onCreated,
  createFn,
}: {
  role: "matriz" | "franqueado" | "vendedor";
  empresas: Empresa[];
  onClose: () => void;
  onCreated: () => void;
  createFn: (p: {
    email: string;
    password: string;
    nome: string;
    role: "matriz" | "franqueado" | "vendedor";
    empresa_id: string | null;
  }) => Promise<unknown>;
}) {
  const [form, setForm] = useState({ nome: "", email: "", password: "", empresa_id: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const nomeCheck = nomeUsuarioSchema.safeParse(form.nome);
    if (!nomeCheck.success) {
      setErr(nomeCheck.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    const emailCheck = emailSchema.safeParse(form.email);
    if (!emailCheck.success) {
      setErr(emailCheck.error.issues[0]?.message ?? "E-mail inválido.");
      return;
    }
    const passwordCheck = passwordSchema.safeParse(form.password);
    if (!passwordCheck.success) {
      setErr(passwordCheck.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await createFn({
        nome: nomeCheck.data,
        email: emailCheck.data.toLowerCase(),
        password: passwordCheck.data,
        role,
        empresa_id: form.empresa_id || null,
      });
      onCreated();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title={`Novo usuário · ${role}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy || !form.nome || !form.email || form.password.length < 6}
          >
            {busy ? "Criando…" : "Criar usuário"}
          </button>
        </>
      }
    >
      {err && (
        <div className="small" style={{ color: "#991b1b", marginBottom: 10 }}>
          {err}
        </div>
      )}
      <div className="field-group">
        <label>Nome</label>
        <input
          className="input"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          maxLength={150}
        />
      </div>
      <div className="field-group">
        <label>E-mail</label>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          maxLength={254}
        />
      </div>
      <div className="field-group">
        <label>Senha (mín. 6)</label>
        <input
          className="input"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      {role !== "matriz" && (
        <div className="field-group">
          <label>{role === "franqueado" ? "Franquia" : "Unidade"}</label>
          <select
            className="input"
            value={form.empresa_id}
            onChange={(e) => setForm({ ...form, empresa_id: e.target.value })}
          >
            <option value="">— Selecionar —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
      )}
    </ModalShell>
  );
}
