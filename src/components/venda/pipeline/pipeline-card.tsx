// Card do Kanban do Pipeline — Pipeline V12, T9.
// Extraído de pipeline.tsx (regra 9 do AGENTS.md) para manter o arquivo da
// rota enxuto: reúne todo o "estado visual" de um lead (chip de produto,
// veículo, ponto exato no funil, dias parado, retorno agendado, timer de
// volta pra Matriz, bloqueio e motivo de perda).
import { ATENDER_AGORA_LIMITE_MS, formatRemaining } from "@/lib/nav-badges";
import type { PipelineLeadRow, PipelineRetornoPendente } from "@/lib/pipeline-data";
import {
  ageDays,
  diasLabel,
  pontoExato,
  proximaAcao,
  retornoLabel,
  veiculoResumo,
} from "./pipeline-format";

export function PipelineCard({
  lead,
  opening,
  retorno,
  atenderRestanteMs,
  onOpen,
}: {
  lead: PipelineLeadRow;
  /** `true` quando este ou outro card está em navegação (`openLead` em andamento). */
  opening: boolean;
  /** Retorno agendado (`lead_agendamentos`, done=false) mais próximo deste lead, se houver. */
  retorno: PipelineRetornoPendente | null;
  /**
   * ms restantes até o lead voltar pra fila da Matriz — só para leads no
   * bucket "novo" que estão na fila "Atender agora" do vendedor logado
   * (mesmo critério de `fetchAtenderAgoraLeads`/`useNavBadges`). `null`
   * quando não se aplica.
   */
  atenderRestanteMs: number | null;
  onOpen: () => void;
}) {
  const isPerdido = lead.etapa === "perdido";
  const ponto = pontoExato(lead);
  const acao = proximaAcao(lead);
  const veiculo = veiculoResumo(lead);
  const ramo = lead.ramo;
  const dias = ageDays(lead.criado_em);
  const { texto: diasTexto, titulo: diasTitulo } = diasLabel(dias);

  return (
    <div
      className="kcard"
      role="button"
      tabIndex={opening ? -1 : 0}
      aria-disabled={opening}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        opacity: opening ? 0.6 : isPerdido ? 0.85 : 1,
        cursor: opening ? "wait" : "pointer",
      }}
    >
      {isPerdido && lead.motivo_perda && (
        <div className="kcard-sub">
          <span
            className="chip chip-alert"
            style={{ fontSize: 9.5, padding: "2px 8px", width: "100%" }}
          >
            {lead.motivo_perda}
          </span>
        </div>
      )}
      {retorno && (
        <div className="kcard-sub">
          <span
            className="chip chip-yellow"
            style={{ fontSize: 9.5, padding: "2px 8px", width: "100%" }}
          >
            <svg width={9} height={9}>
              <use href="#i-clock" />
            </svg>{" "}
            {retornoLabel(retorno)}
          </span>
        </div>
      )}
      {lead.em_avaliacao_matriz && (
        <div className="kcard-matrix" title="Aguardando avaliação da Matriz">
          <div className="kcard-matrix-info">
            <svg width={10} height={10}>
              <use href="#i-clock" />
            </svg>
            <span style={{ fontWeight: 700 }}>Aguardando Matriz</span>
          </div>
        </div>
      )}
      {atenderRestanteMs != null && (
        <div
          className="kcard-matrix"
          title="Sem interação em 3 min o lead volta pra fila da Matriz e é redistribuído"
        >
          <div className="kcard-matrix-bar">
            <div
              className="kcard-matrix-fill"
              style={{
                width: `${Math.max(0, Math.min(100, (atenderRestanteMs / ATENDER_AGORA_LIMITE_MS) * 100))}%`,
                background:
                  atenderRestanteMs < 60_000
                    ? "var(--alert)"
                    : atenderRestanteMs < 120_000
                      ? "var(--yellow)"
                      : "var(--ok)",
              }}
            />
          </div>
          <div
            className="kcard-matrix-info"
            style={{ color: atenderRestanteMs < 60_000 ? "var(--alert)" : "var(--slate-soft)" }}
          >
            <svg width={10} height={10}>
              <use href="#i-clock" />
            </svg>
            <span style={{ fontWeight: 700 }}>{formatRemaining(atenderRestanteMs)}</span>
            <span style={{ opacity: 0.7, fontWeight: 500 }}>até voltar p/ Matriz</span>
          </div>
        </div>
      )}
      {ponto && (
        <div className="kcard-estado">
          <span className="kcard-ponto">{ponto}</span>
          <span className="kcard-dias" title={diasTitulo}>
            {diasTexto}
          </span>
        </div>
      )}
      <div className="top">
        <span className="name">{lead.nome || "Sem nome"}</span>
        {ramo && (
          <span
            className="chip chip-slate"
            style={{ fontSize: 10, textTransform: "capitalize" }}
            title="Tipo de seguro"
          >
            {ramo}
          </span>
        )}
        {lead.bloqueado && (
          <span title="Lead bloqueado">
            <svg width={13} height={13}>
              <use href="#i-lock" />
            </svg>
          </span>
        )}
      </div>
      {veiculo && (
        <div className="car">
          <svg width={12} height={12}>
            <use href="#i-car" />
          </svg>{" "}
          {veiculo}
        </div>
      )}
      {acao && <div className="next">{acao}</div>}
    </div>
  );
}
