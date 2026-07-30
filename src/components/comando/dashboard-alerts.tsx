import type { NavigateFn } from "@tanstack/react-router";
import type { DashboardAlert } from "@/lib/dashboard-alerts";

export function DashboardAlerts({
  alerts,
  navigate,
  isLoading = false,
}: {
  alerts: DashboardAlert[];
  navigate: NavigateFn;
  isLoading?: boolean;
}) {
  return (
    <div className="actions-list">
      {isLoading && (
        <div className="muted small" style={{ padding: 12 }}>
          Carregando alertas…
        </div>
      )}
      {!isLoading &&
        alerts.map((alert) => (
          <button
            key={alert.kind}
            type="button"
            className="action-row"
            onClick={() => navigate({ to: alert.to, search: alert.search })}
            aria-label={`${alert.title}. ${alert.action}`}
            style={{ width: "100%", textAlign: "left" }}
          >
            <div className={`ic-square ${alert.tone}`}>
              <svg width="18" height="18" aria-hidden="true">
                <use href={`#${alert.icon}`}></use>
              </svg>
            </div>
            <div className="body">
              <h4>{alert.title}</h4>
              <p>{alert.description}</p>
            </div>
            <div className={alert.tone === "alert" ? "meta" : "meta muted"}>{alert.action}</div>
          </button>
        ))}
      {!isLoading && alerts.length === 0 && (
        <div className="muted small" style={{ padding: 12 }}>
          Sem pendências críticas — bom trabalho. 🎉
        </div>
      )}
    </div>
  );
}
