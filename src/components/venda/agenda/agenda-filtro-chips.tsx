// Chips de filtro por tipo da tela "Minha agenda" (V12.3.2).
// Espelha os chips de `AG_TIPOS`/`agSetFiltro()` do protótipo v12: um chip
// por fonte, com contador, que filtra a lista ao clicar (clicar de novo
// limpa o filtro).
import { FONTE_LABEL, type FonteAgenda } from "@/lib/agenda";

const ORDEM: FonteAgenda[] = ["retorno", "risco", "seguradora", "aprovacao", "lembrete"];

const ICONE: Record<FonteAgenda, string> = {
  retorno: "i-clock",
  risco: "i-trending-up",
  seguradora: "i-alert-triangle",
  aprovacao: "i-award",
  lembrete: "i-bell",
};

const DESCRICAO: Record<FonteAgenda, string> = {
  retorno: "Compromissos que você marcou com o cliente",
  risco: "Cotação expirando, proposta sem resposta, lead parado",
  seguradora: "O que trava a emissão da apólice",
  aprovacao: "Desconto esperando resposta de quem aprova",
  lembrete: "Tarefas e compromissos que você mesmo criou, com ou sem cliente",
};

export function AgendaFiltroChips({
  contagem,
  filtro,
  onFiltrar,
}: {
  contagem: Record<FonteAgenda, number>;
  filtro: FonteAgenda | "todos";
  onFiltrar: (fonte: FonteAgenda | "todos") => void;
}) {
  return (
    <div className="filters-bar" data-tour="agenda-filtros">
      <span className="label">FILTRAR POR</span>
      {ORDEM.map((fonte) => {
        const on = filtro === fonte;
        return (
          <button
            key={fonte}
            type="button"
            className={`acc-pill${on ? " on" : ""}`}
            title={DESCRICAO[fonte]}
            onClick={() => onFiltrar(on ? "todos" : fonte)}
          >
            <svg width={13} height={13} aria-hidden="true" style={{ marginRight: 4 }}>
              <use href={`#${ICONE[fonte]}`} />
            </svg>
            {FONTE_LABEL[fonte]}
            <span className="chip chip-outline" style={{ marginLeft: 6 }}>
              {contagem[fonte]}
            </span>
          </button>
        );
      })}
      {filtro !== "todos" && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onFiltrar("todos")}>
          <svg width={12} height={12} aria-hidden="true">
            <use href="#i-x" />
          </svg>{" "}
          Limpar filtro
        </button>
      )}
    </div>
  );
}
