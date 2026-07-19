import { Link } from "@tanstack/react-router";
import { printHtml, escapeHtml, fmtBRL } from "@/lib/print";
import { onlyDigits } from "@/lib/masks";
import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";

type Props = {
  f: Form;
  resultados: ResultadoCalculo[];
  calculando: boolean;
  podeCalcular: boolean;
  cotacaoId: string | null;
  doSimularCalculo: () => void;
};

export function StepCalculo({
  f,
  resultados,
  calculando,
  podeCalcular,
  cotacaoId,
  doSimularCalculo,
}: Props) {
  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0 }}>Coberturas e valores</h2>
          <div className="sub" style={{ margin: 0 }}>
            {resultados.length > 0
              ? `${resultados.length} seguradoras calculadas · ${f.tipoCobertura || "Compreensiva"}`
              : (f.seguradorasSel?.length ?? 0) > 0
                ? `${f.seguradorasSel.length} seguradoras selecionadas · clique em Calcular agora`
                : "Selecione seguradoras no passo Seguro"}
          </div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        {cotacaoId && (
          <Link
            to="/venda/cotacoes/$id"
            params={{ id: cotacaoId }}
            className="btn btn-slate btn-sm"
          >
            <svg width="13" height="13">
              <use href="#i-shield" />
            </svg>{" "}
            Comparativo lado a lado
          </Link>
        )}
        <button
          className="btn btn-ghost btn-sm"
          disabled={!podeCalcular || calculando}
          onClick={doSimularCalculo}
        >
          <svg width="13" height="13">
            <use href="#i-refresh" />
          </svg>{" "}
          {calculando ? "Calculando…" : "Recalcular"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={resultados.length === 0}
          onClick={() => {
            const sorted = [...resultados].sort((a, b) => a.premio - b.premio);
            const head = `
              <div class="grid">
                <div class="kv"><b>Cliente:</b> ${escapeHtml(f.nome || "—")}</div>
                <div class="kv"><b>${f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> ${escapeHtml(f.cpf || "—")}</div>
                <div class="kv"><b>Celular:</b> ${escapeHtml(f.celular || "—")}</div>
                <div class="kv"><b>Cidade/UF:</b> ${escapeHtml((f.cidade || "—") + (f.uf ? "/" + f.uf : ""))}</div>
                <div class="kv"><b>Veículo:</b> ${escapeHtml(`${f.marca || ""} ${f.modelo || ""} ${f.anoModelo || ""}`.trim() || "—")}</div>
                <div class="kv"><b>Placa:</b> ${escapeHtml(f.placa || "—")}</div>
                <div class="kv"><b>Tipo de cobertura:</b> ${escapeHtml(f.tipoCobertura || "Compreensiva")}</div>
                <div class="kv"><b>Tipo de cálculo:</b> ${escapeHtml(f.tipoCalculo || "—")}</div>
              </div>`;
            const cards = sorted
              .map((r) => {
                const reduz = Math.round(r.premio * 1.18);
                return `<div class="card">
                  <div style="display:flex;justify-content:space-between;align-items:baseline">
                    <strong style="font-size:14px">${escapeHtml(r.cia)}</strong>
                    <span style="color:#64748b;font-size:11px">${escapeHtml(r.cobertura || f.tipoCobertura || "Compreensiva")}</span>
                  </div>
                  <table style="margin-top:8px">
                    <tr><th>Plano</th><th>Franquia</th><th class="num">À vista</th><th class="num">Parcelado</th></tr>
                    <tr><td>Normal 100%</td><td>R$ ${Math.round(r.premio * 1.5).toLocaleString("pt-BR")}</td><td class="num"><strong>${fmtBRL(r.premio)}</strong></td><td class="num">10x ${fmtBRL(r.premio / 10)}</td></tr>
                    <tr><td>Reduzida 50%</td><td>R$ ${Math.round(r.premio * 0.75).toLocaleString("pt-BR")}</td><td class="num"><strong>${fmtBRL(reduz)}</strong></td><td class="num">10x ${fmtBRL(reduz / 10)}</td></tr>
                  </table>
                </div>`;
              })
              .join("");
            const cob = `
              <h2>Coberturas</h2>
              <table>
                <tr><th>Item</th><th>Valor</th></tr>
                <tr><td>Valor de mercado</td><td>100% FIPE</td></tr>
                <tr><td>RCF · Danos materiais</td><td>R$ ${(Number(onlyDigits(f.rcfDm || "")) || 100000).toLocaleString("pt-BR")}</td></tr>
                <tr><td>RCF · Danos corporais</td><td>R$ ${(Number(onlyDigits(f.rcfDc || "")) || 100000).toLocaleString("pt-BR")}</td></tr>
                <tr><td>APP por passageiro</td><td>${f.appMorte ? "R$ " + Number(onlyDigits(f.appMorte)).toLocaleString("pt-BR") : "R$ 5.000"}</td></tr>
                <tr><td>Assistência 24h</td><td>${escapeHtml(f.assist24 || "Padrão")}</td></tr>
                <tr><td>Carro reserva</td><td>${escapeHtml(f.carroReserva || "30 dias")}</td></tr>
                <tr><td>Vidros</td><td>${f.vidros ? "Sim" : "—"}</td></tr>
              </table>`;
            printHtml(
              "Cotação · " + (f.nome || "Cliente"),
              `<h1>Resumo da cotação</h1><div class="sub">${sorted.length} seguradora(s) calculada(s)</div>${head}<h2>Prêmios</h2>${cards}${cob}<p style="font-size:11px;color:#64748b">Cotação válida por 5 dias. Sujeita à aceitação da seguradora.</p>`,
            );
          }}
        >
          <svg width="13" height="13">
            <use href="#i-download" />
          </svg>{" "}
          Imprimir
        </button>
      </div>

      {resultados.length === 0 && !calculando && (
        <div style={{ padding: "12px 0", marginBottom: 8 }}>
          <button className="btn btn-yellow" disabled={!podeCalcular} onClick={doSimularCalculo}>
            <svg width="14" height="14">
              <use href="#i-bolt" />
            </svg>
            {podeCalcular ? " Calcular agora" : " Selecione seguradoras no passo Seguro"}
          </button>
        </div>
      )}

      {resultados.length > 0 && (
        <div className="calc-grid">
          {resultados
            .sort((a, b) => a.premio - b.premio)
            .map((r) => {
              const aVista = r.premio;
              const reduz = Math.round(r.premio * 1.18);
              const fmt = (n: number) =>
                "R$ " +
                n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const fr1 = Math.round(r.premio * 1.5).toLocaleString("pt-BR");
              const fr2 = Math.round(r.premio * 0.75).toLocaleString("pt-BR");
              return (
                <div className="calc-card" key={r.cia}>
                  <div className="calc-head">
                    <div className="calc-ins">
                      <svg width="16" height="16">
                        <use href="#i-shield" />
                      </svg>{" "}
                      {r.cia}
                    </div>
                    <select className="select-mini">
                      <option>Customizado</option>
                      <option>Plano Fácil</option>
                      <option>Plano Pleno</option>
                    </select>
                    <span className="chip chip-slate" style={{ marginLeft: "auto" }}>
                      {r.cobertura || "Compreensiva"}
                    </span>
                  </div>
                  <div className="calc-tiers">
                    <div className="calc-tier">
                      <div className="t-lbl">normal 100%</div>
                      <div className="t-fr">Franquia R$ {fr1}</div>
                      <div className="t-vista">à vista {fmt(aVista)}</div>
                      <div className="t-parc">10x sem juros</div>
                    </div>
                    <div className="calc-tier">
                      <div className="t-lbl">reduzida 50%</div>
                      <div className="t-fr">Franquia R$ {fr2}</div>
                      <div className="t-vista">à vista {fmt(reduz)}</div>
                      <div className="t-parc">10x sem juros</div>
                    </div>
                  </div>
                  <div className="calc-cobs">
                    <div className="cob-col">
                      <div className="cob-h">Coberturas básicas</div>
                      <div className="cob-row">
                        <span>Valor mercado</span>
                        <b>100% FIPE</b>
                      </div>
                      <div className="cob-row">
                        <span>Danos materiais</span>
                        <b>
                          R${" "}
                          {Number(onlyDigits(f.rcfDm || ""))
                            ? Number(onlyDigits(f.rcfDm)).toLocaleString("pt-BR")
                            : "100.000"}
                        </b>
                      </div>
                      <div className="cob-row">
                        <span>Danos corporais</span>
                        <b>
                          R${" "}
                          {Number(onlyDigits(f.rcfDc || ""))
                            ? Number(onlyDigits(f.rcfDc)).toLocaleString("pt-BR")
                            : "100.000"}
                        </b>
                      </div>
                      <div className="cob-row">
                        <span>APP / passageiro</span>
                        <b>
                          {f.appMorte
                            ? "R$ " + Number(onlyDigits(f.appMorte)).toLocaleString("pt-BR")
                            : "R$ 5.000"}
                        </b>
                      </div>
                    </div>
                    <div className="cob-col">
                      <div className="cob-h">Adicionais</div>
                      <div className="cob-row">
                        <span>Assistência</span>
                        <b>{f.assist24 || "Padrão"}</b>
                      </div>
                      <div className="cob-row">
                        <span>Carro reserva</span>
                        <b>{f.carroReserva || "30 dias"}</b>
                      </div>
                      <div className="cob-row">
                        <span>Vidros</span>
                        <b>{f.vidros ? "Sim" : "—"}</b>
                      </div>
                    </div>
                  </div>
                  <div className="calc-foot">
                    <select className="select-mini" style={{ flex: 1 }}>
                      <option>Débito em Conta</option>
                      <option>Cartão de crédito</option>
                      <option>Boleto</option>
                    </select>
                    <button className="ic-btn" title="Observações">
                      <svg width="15" height="15">
                        <use href="#i-message" />
                      </svg>
                    </button>
                    <button className="ic-btn" title="Enviar">
                      <svg width="15" height="15">
                        <use href="#i-download" />
                      </svg>
                    </button>
                    <button className="ic-btn ok" title="Gerar proposta">
                      <svg width="15" height="15">
                        <use href="#i-check" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}
