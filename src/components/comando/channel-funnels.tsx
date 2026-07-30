import type { Database } from "@/integrations/supabase/database.types";

export type ChannelFunnel =
  Database["public"]["Functions"]["funis_por_canal_visao_geral"]["Returns"][number];

function channelFunnelPercentage(value: number, indications: number) {
  return indications > 0 ? Math.round((value / indications) * 100) : 0;
}

function channelFunnelStages(funnel: ChannelFunnel) {
  return [
    { label: "Indicações", value: funnel.indicacoes, showPercentage: false },
    { label: "Contato", value: funnel.contatos, showPercentage: true },
    { label: "Cotação", value: funnel.cotacoes, showPercentage: true },
    { label: "Negociação", value: funnel.negociacoes, showPercentage: true },
    { label: "Transmissão", value: funnel.transmissoes, showPercentage: true, highlighted: true },
    { label: "Pendentes", value: funnel.pendentes, showPercentage: true },
    { label: "Venda emitida", value: funnel.vendas_emitidas, showPercentage: true, total: true },
  ];
}

type ChannelFunnelsProps = {
  funnels: ChannelFunnel[];
  periodLabel: string;
  isLoading: boolean;
  error: Error | null;
};

export function ChannelFunnels({ funnels, periodLabel, isLoading, error }: ChannelFunnelsProps) {
  return (
    <section aria-labelledby="channel-funnels-title">
      <div className="small muted" style={{ margin: "18px 0 6px" }}>
        <svg width="14" height="14" aria-hidden="true">
          <use href="#i-trending-up"></use>
        </svg>{" "}
        <strong id="channel-funnels-title">Performance por canal</strong> — funil de conversão ·{" "}
        <span style={{ textTransform: "capitalize" }}>{periodLabel}</span>{" "}
        <span className="muted">(percentuais sobre as indicações do canal)</span>
      </div>

      {isLoading && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-b">
            <span className="small muted">Carregando funis por canal…</span>
          </div>
        </div>
      )}

      {error && (
        <div
          className="audit-note"
          role="alert"
          style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 18 }}
        >
          Não foi possível carregar os funis por canal: {error.message}
        </div>
      )}

      {!isLoading && !error && funnels.length !== 4 && (
        <div
          className="audit-note"
          role="alert"
          style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 18 }}
        >
          A configuração dos quatro canais do funil está incompleta.
        </div>
      )}

      {!isLoading && !error && funnels.length === 4 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(230px, 1fr))",
            gap: 14,
            marginBottom: 18,
            overflowX: "auto",
          }}
        >
          {funnels.map((funnel) => {
            const conversion = channelFunnelPercentage(funnel.vendas_emitidas, funnel.indicacoes);

            return (
              <div className="card" key={funnel.canal_id}>
                <div className="card-h">
                  <h3>
                    <svg width="15" height="15" aria-hidden="true">
                      <use href="#i-target"></use>
                    </svg>{" "}
                    {funnel.canal_nome}
                  </h3>
                  <span className="chip chip-yellow" style={{ fontSize: 10.5 }}>
                    {conversion}% conv.
                  </span>
                </div>
                <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
                  <table className="table-pipe">
                    <thead>
                      <tr>
                        <th>Etapa</th>
                        <th style={{ textAlign: "right" }}>Qtde</th>
                        <th style={{ textAlign: "right" }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelFunnelStages(funnel).map((stage) => {
                        const percentage = channelFunnelPercentage(stage.value, funnel.indicacoes);

                        return (
                          <tr
                            key={stage.label}
                            style={
                              stage.highlighted
                                ? { background: "var(--yellow-soft, #FFF6E0)" }
                                : undefined
                            }
                          >
                            <td
                              style={
                                stage.total ? { fontWeight: 800, color: "var(--slate)" } : undefined
                              }
                            >
                              {stage.label}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: stage.total ? 800 : 700,
                                color: stage.total ? "var(--slate)" : undefined,
                              }}
                            >
                              {stage.value}
                            </td>
                            <td
                              className={stage.total ? undefined : "muted"}
                              style={{
                                textAlign: "right",
                                fontWeight: stage.total ? 800 : undefined,
                                color: stage.total ? "var(--slate)" : undefined,
                              }}
                            >
                              {stage.showPercentage ? `${percentage}%` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
