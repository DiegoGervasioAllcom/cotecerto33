// Linha da lista unificada da tela "Minha agenda" (Frente 9 · V12).
// Reaproveita o padrão visual `.action-row` já usado em dashboard-alerts.tsx
// e inicio.tsx — ícone quadrado + corpo (título/texto) + chip de urgência à
// direita, com "marcar como feito" para retorno/lembrete.

import { classificarUrgencia, FONTE_LABEL, type AgendaItem } from "@/lib/agenda";
import { LEMBRETE_TIPO_ICON } from "@/lib/schemas/lembrete.schema";

function iconePorItem(item: AgendaItem): string {
  if (item.fonte === "retorno") return "i-clock";
  if (item.fonte === "risco") return "i-trending-up";
  return LEMBRETE_TIPO_ICON[item.tipoLembrete ?? "tarefa"];
}

function tomPorUrgencia(ord: number): "alert" | "warn" | "info" {
  if (ord === 0) return "alert";
  if (ord === 1) return "warn";
  return "info";
}

export function AgendaItemRow({
  item,
  busy = false,
  onOpen,
  onConcluir,
}: {
  item: AgendaItem;
  busy?: boolean;
  onOpen: () => void;
  onConcluir?: () => void;
}) {
  const urgencia = classificarUrgencia(item.data);
  const clicavel = item.fonte === "risco" || !!item.leadId;

  return (
    <div
      className="action-row"
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={clicavel ? onOpen : undefined}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onOpen();
            }
          : undefined
      }
      style={clicavel ? { cursor: "pointer" } : { cursor: "default" }}
    >
      <div className={`ic-square ${tomPorUrgencia(urgencia.ord)}`}>
        <svg width={18} height={18} aria-hidden="true">
          <use href={`#${iconePorItem(item)}`} />
        </svg>
      </div>
      <div className="body">
        <h4>{item.titulo}</h4>
        <p>{item.texto}</p>
        <span className="chip chip-outline" style={{ marginTop: 4, width: "fit-content" }}>
          {FONTE_LABEL[item.fonte]}
        </span>
      </div>
      <div className="row-actions" style={{ alignItems: "center", flex: "none" }}>
        <span className={`chip ${urgencia.chipClass}`} style={{ whiteSpace: "nowrap" }}>
          {urgencia.label}
          {item.hora ? ` · ${item.hora.slice(0, 5)}` : ""}
        </span>
        {onConcluir && (
          <button
            type="button"
            className="ic-mini"
            title="Marcar como feito"
            aria-label="Marcar como feito"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onConcluir();
            }}
          >
            <svg width={15} height={15} aria-hidden="true">
              <use href="#i-check" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
