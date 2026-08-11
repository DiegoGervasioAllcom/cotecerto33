// V11 · D7 — confirmação de senha de diretor (regra 1: alterações sensíveis
// exigem diretor com a própria senha de login, gravadas no histórico
// imutável via fn_registrar_alteracao). Primeiro consumidor de front de um
// RPC diretor-gated (V11.0.5/V11.0.6 só tinham a infra no banco até aqui) —
// reusável para os próximos.
import { useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";

export function SenhaDiretorModal({
  label,
  onConfirm,
  onClose,
}: {
  label: string;
  onConfirm: (senha: string) => Promise<{ error: string | null }>;
  onClose: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmar() {
    if (!senha) {
      setErr("Informe sua senha de login.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await onConfirm(senha);
    setBusy(false);
    if (error) {
      setErr(error);
      setSenha("");
      return;
    }
    onClose();
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-h">
          <Icon id="lock" size={18} />
          <h3>Confirmação de diretor</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <p className="small" style={{ margin: "0 0 12px" }}>
            Alterar <strong>{label}</strong> exige confirmar com a sua senha de login — só se você
            for diretor. A alteração entra no histórico imutável.
          </p>
          <div className="field-group">
            <label>Senha de login</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                className="input"
                type={visivel ? "text" : "password"}
                placeholder="••••••••"
                autoFocus
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmar();
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="pw-toggle"
                title="Mostrar/ocultar a senha"
                onClick={() => setVisivel((v) => !v)}
              >
                {visivel ? (
                  "OCULTAR"
                ) : (
                  <svg>
                    <use href="#i-eye" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {err && (
            <div className="banner alert" style={{ marginTop: 10 }}>
              {err}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-yellow" type="button" disabled={busy} onClick={confirmar}>
            <Icon id="check" size={14} /> Confirmar e salvar
          </button>
        </div>
      </div>
    </div>
  );
}
