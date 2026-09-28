// Preview estático de um item da agenda para o tutorial do vendedor
// (V12.3.10) — usado quando `useTutorialPreview()` volta "agenda-exemplo".
// Mesmo padrão de `extrato-tutorial-preview.tsx`: markup estático com as
// mesmas classes de `AgendaItemRow` (`action-row`/`ic-square`/`ic-mini`),
// selo "Exemplo do tutorial", sem gravar nada — o "visto" fica desabilitado.
//
// Necessário porque um vendedor novo pode não ter nenhum retorno, negócio em
// risco, pendência, aprovação ou lembrete ainda — e os passos "Clicar leva
// para a origem" e "Marcar como feito" (cap. 2) precisam de uma linha de
// verdade pra apontar (`data-tour="agenda-item"`/`"agenda-concluir"`).
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";

export function AgendaTutorialPreviewRow() {
  const tutorialPreview = useTutorialPreview();
  if (tutorialPreview !== "agenda-exemplo") return null;

  return (
    <div className="action-row" data-tour="agenda-item" aria-readonly="true">
      <div className="ic-square warn">
        <svg width={18} height={18} aria-hidden="true">
          <use href="#i-clock" />
        </svg>
      </div>

      <div className="body">
        <h4>Fernanda Souza</h4>
        <p>Retorno agendado — confirmar se o boleto chegou</p>
        <span className="chip chip-outline" style={{ marginTop: 4, width: "fit-content" }}>
          Exemplo do tutorial
        </span>
      </div>
      <div className="row-actions" style={{ alignItems: "center", flex: "none" }}>
        <span className="chip chip-yellow" style={{ whiteSpace: "nowrap" }}>
          Hoje · 14:00
        </span>
        <button
          type="button"
          className="ic-mini"
          data-tour="agenda-concluir"
          title="Marcar como feito"
          aria-label="Marcar como feito"
          disabled
        >
          <svg width={15} height={15} aria-hidden="true">
            <use href="#i-check" />
          </svg>
        </button>
      </div>
    </div>
  );
}
