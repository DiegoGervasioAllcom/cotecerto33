// Coluna lateral do preview ("Como deseja enviar?") do modal de impressão.
// E-mail/SMS/WhatsApp/Gerar link seguem desabilitados (e-mail adiado; os
// demais sem provedor) e, com comissão marcada, a trava `envioExternoPermitido`
// mantém tudo bloqueado mesmo quando esses canais forem ligados.
import type { ImprimirCotacaoConfig } from "@/lib/schemas/imprimirCotacao.schema";
import { AVISO_DOC_INTERNO, envioExternoPermitido } from "./comissao-impressao";

/** Aviso curto nos controles ainda não ligados. */
export const AVISO_IMPRESSAO_EM_BREVE = "Disponível em breve";

/** Nenhum canal externo está ligado nesta fatia (e-mail adiado). */
const CANAL_EXTERNO_LIGADO = false;

export function ImprimirEnvioLateral({
  config,
  ocupado,
  mensagem,
  onBaixar,
}: {
  config: ImprimirCotacaoConfig;
  ocupado: boolean;
  mensagem: { tipo: "erro" | "aviso"; texto: string } | null;
  onBaixar: () => void;
}) {
  const envioLiberado = CANAL_EXTERNO_LIGADO && envioExternoPermitido(config);
  const motivo = config.comComissao ? AVISO_DOC_INTERNO : AVISO_IMPRESSAO_EM_BREVE;
  const bloqueado = { opacity: 0.5, cursor: "not-allowed" } as const;
  return (
    <div className="pv-lado">
      <div className="pv-h">Como deseja enviar?</div>
      {(
        [
          ["mail", "E-mail", "com o PDF anexado"],
          ["message", "SMS", "com o link da cotação"],
          ["message", "WhatsApp", "o caminho mais usado"],
        ] as const
      ).map(([ico, rotulo, sub]) => (
        <button
          type="button"
          key={rotulo}
          className="pv-env"
          disabled={!envioLiberado}
          aria-disabled={!envioLiberado}
          title={`${rotulo} — ${motivo}`}
          style={envioLiberado ? undefined : bloqueado}
        >
          <svg width={17} height={17}>
            <use href={`#i-${ico}`} />
          </svg>
          <span>
            <strong>{rotulo}</strong>
            <small>{sub}</small>
          </span>
        </button>
      ))}
      {config.comComissao && (
        <div className="doc-aviso" role="alert" style={{ marginTop: 8 }}>
          {AVISO_DOC_INTERNO}
        </div>
      )}
      <div className="pv-sep" />
      <button
        type="button"
        className="btn btn-ghost btn-sm pv-btn"
        disabled={!envioLiberado}
        aria-disabled={!envioLiberado}
        title={`Gerar link — ${motivo}`}
        style={envioLiberado ? undefined : bloqueado}
      >
        <svg width={13} height={13}>
          <use href="#i-share" />
        </svg>{" "}
        Gerar link
      </button>
      <button
        type="button"
        className="btn btn-slate btn-sm pv-btn"
        onClick={onBaixar}
        disabled={ocupado}
      >
        <svg width={13} height={13}>
          <use href="#i-download" />
        </svg>{" "}
        Baixar PDF
      </button>
      {mensagem && (
        <div
          role="alert"
          className="muted small"
          style={{ color: "var(--alert)", marginTop: 6 }}
          data-testid="impressao-mensagem"
        >
          {mensagem.texto}
        </div>
      )}
      <div className="pv-resumo">
        <div>
          <span>Versão</span>
          <strong>{config.tipo === "detalhada" ? "Detalhada" : "Resumida"}</strong>
        </div>
        <div>
          <span>Seguradoras</span>
          <strong>{config.seguradorasSelecionadas.length}</strong>
        </div>
        <div>
          <span>Parcelas</span>
          <strong>{config.parcelas.length}</strong>
        </div>
      </div>
    </div>
  );
}
