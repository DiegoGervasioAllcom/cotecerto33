// Modal de edição de nome/empresa de um usuário existente.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { nomeUsuarioSchema } from "./constants";
import { ModalShell } from "./modal-shell";
import type { Empresa, UserFull } from "./types";

export function EditUserModal({
  user,
  empresas,
  role,
  onClose,
  onSaved,
}: {
  user: UserFull;
  empresas: Empresa[];
  role: "matriz" | "franqueado" | "vendedor";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(user.nome);
  const [empresaId, setEmpresaId] = useState<string>(user.empresa_id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const check = nomeUsuarioSchema.safeParse(nome);
    if (!check.success) {
      setErr(check.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("admin_atualizar_usuario", {
      p_user_id: user.id,
      p_nome: check.data,
      p_empresa_id: (empresaId || null) as unknown as string, // SQL aceita null (remove vínculo); tipo gerado exige string
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  }

  return (
    <ModalShell
      title={`Editar · ${user.email}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Salvar
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
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={150}
        />
      </div>
      <div className="field-group">
        <label>E-mail</label>
        <input className="input" value={user.email} disabled />
      </div>
      {role !== "matriz" && (
        <div className="field-group">
          <label>{role === "franqueado" ? "Franquia" : "Unidade"}</label>
          <select
            className="input"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
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
