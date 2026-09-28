// Cartão "O que fazer agora" do Início (V12.3.1) — fila unificada da agenda
// (retornos agendados, negócios em risco e lembretes pessoais), mostrando só
// os primeiros `HOME_FILA_N` itens (`selecionarFilaHome`, @/lib/agenda).
// Substitui os antigos blocos "Sua missão de hoje" e "O que fazer agora (com
// retorno)" — o placar continua sendo o "quanto falta", este cartão é o
// "o que fazer no minuto".
import { Link } from "@tanstack/react-router";
import { AgendaItemRow } from "@/components/venda/agenda/agenda-item-row";
import { classificarUrgencia, selecionarFilaHome } from "@/lib/agenda";
import { useAgendaItens } from "@/lib/use-agenda-itens";

export function FilaDoDiaCard() {
  const { itens, loading, busyId, marcarFeito, abrirItem } = useAgendaItens();

  const urgentes = itens.filter((i) => classificarUrgencia(i.data).ord <= 1).length;
  const fila = selecionarFilaHome(itens);

  return (
    <div className="card card-yellow" data-tour="home-fila">
      <div className="card-h">
        <h3>
          <svg width="16" height="16">
            <use href="#i-clock" />
          </svg>{" "}
          O que fazer agora
        </h3>
        <span className={`chip ${urgentes ? "chip-alert" : "chip-yellow"}`}>
          {urgentes ? `${urgentes} para hoje` : "nada atrasado"}
        </span>
      </div>
      <div className="card-b">
        {loading && <div className="muted">Carregando…</div>}
        {!loading && fila.length === 0 && (
          <p className="small muted" style={{ padding: "14px 2px", margin: 0 }}>
            Nada pendente agora. Aproveite para prospectar.
          </p>
        )}
        {!loading &&
          fila.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onOpen={() => void abrirItem(item)}
              onConcluir={item.fonte !== "risco" ? () => void marcarFeito(item) : undefined}
            />
          ))}
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <Link to="/venda/agenda" className="btn btn-ghost btn-sm">
            <svg width="13" height="13">
              <use href="#i-calendar" />
            </svg>{" "}
            Ver minha agenda ({itens.length})
          </Link>
          <span className="spacer" />
          <span className="small muted">em ordem de urgência — atrasados primeiro</span>
        </div>
      </div>
    </div>
  );
}
