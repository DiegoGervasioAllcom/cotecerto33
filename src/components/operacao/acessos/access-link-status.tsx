import { useState } from "react";
import { Icon } from "./icon";

export type AccessActivationStatus = "novo" | "pendente" | "ativo";

export function activationStatus(status: string | null | undefined): AccessActivationStatus {
  // Emissões começaram a ser registradas na V11. Um perfil sem emissão é um
  // acesso legado já provisionado, não um convite novo a ser reenviado.
  if (status == null) return "ativo";
  return status === "ativo" || status === "pendente" ? status : "novo";
}

type AccessLinkStatusProps = {
  status: AccessActivationStatus;
  envioConfirmadoEm: string | null;
  numeroEmissao: number | null;
  onEnviarNovoLink: () => Promise<void>;
  disabled?: boolean;
};

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

export function AccessLinkStatus({
  status,
  envioConfirmadoEm,
  numeroEmissao,
  onEnviarNovoLink,
  disabled = false,
}: AccessLinkStatusProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoLinkEnviado, setNovoLinkEnviado] = useState(false);
  // A expiração é regra fixa do GoTrue (48 h); a emissão guarda apenas o
  // instante de confirmação, nunca o link ou qualquer token recuperável.
  const expiraEm = envioConfirmadoEm
    ? new Date(new Date(envioConfirmadoEm).getTime() + 48 * 60 * 60 * 1000).toISOString()
    : null;
  const expirado = Boolean(expiraEm && new Date(expiraEm).getTime() <= Date.now());
  const chip =
    status === "ativo" ? "chip-ok" : status === "pendente" ? "chip-yellow" : "chip-outline";
  const rotulo = status === "ativo" ? "Ativo" : status === "pendente" ? "Pendente" : "Novo";

  async function confirmarReenvio() {
    setEnviando(true);
    try {
      await onEnviarNovoLink();
      setConfirmando(false);
      setErro(null);
      setNovoLinkEnviado(true);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o novo link.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <span className={`chip ${chip}`}>{rotulo}</span>
      {status !== "ativo" && (
        <div className="small muted" style={{ marginTop: 4 }}>
          {envioConfirmadoEm
            ? expirado
              ? `Link expirado em ${formatarData(expiraEm!)}`
              : expiraEm
                ? `Válido até ${formatarData(expiraEm)}`
                : `Enviado em ${formatarData(envioConfirmadoEm)}`
            : "Link ainda não confirmado"}
          {numeroEmissao ? ` · emissão ${numeroEmissao}` : ""}
        </div>
      )}
      {status !== "ativo" && !confirmando && (
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={disabled || enviando}
          style={{ marginTop: 7 }}
          onClick={() => setConfirmando(true)}
        >
          <Icon id="send" size={12} /> Enviar novo link
        </button>
      )}
      {novoLinkEnviado && (
        <div className="small" style={{ color: "var(--ok)", marginTop: 6 }} role="status">
          Novo link enviado. A lista foi atualizada.
        </div>
      )}
      {status !== "ativo" && confirmando && (
        <div className="audit-note" style={{ marginTop: 7, alignItems: "flex-start" }}>
          <Icon id="alert-triangle" size={15} />
          <div>
            <strong>Enviar um novo link?</strong> O link anterior será invalidado, mesmo que ainda
            esteja dentro da validade.
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={enviando}
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-yellow btn-sm"
                type="button"
                disabled={disabled || enviando}
                onClick={() => void confirmarReenvio()}
              >
                <Icon id="send" size={12} /> {enviando ? "Enviando…" : "Confirmar novo link"}
              </button>
            </div>
          </div>
        </div>
      )}
      {erro && (
        <div className="small" style={{ color: "var(--alert)", marginTop: 6 }}>
          {erro}
        </div>
      )}
    </div>
  );
}
