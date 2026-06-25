import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { printHtml, escapeHtml, fmtBRL } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/venda/cotacoes/$id")({
  head: () => ({ meta: [{ title: "Comparativo · CoteCerto" }] }),
  component: Page,
});

type Premio = { id: string; seguradora: string; cobertura: string | null; premio: number };
type Data = {
  id: string;
  numero: number;
  status: string;
  criado_em: string;
  segurado: { nome: string | null; cpf_cnpj: string | null } | null;
  veiculo: { marca_nome: string | null; modelo_nome: string | null; ano_modelo: string | null; placa: string | null } | null;
  coberturas: {
    casco_valor: string | null;
    franquia: string | null;
    rcf_dm: string | null;
    rcf_dc: string | null;
    app_morte: string | null;
    carro_reserva: string | null;
    vidros: boolean | null;
    assist_24: string | null;
  } | null;
  premios: Premio[];
};

const money = (n: number | null) =>
  n != null
    ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : "—";
const pad = (n: number) => String(n).padStart(5, "0");
const cotNum = (numero: number, criado: string) =>
  `COT-${new Date(criado).getFullYear()}-${pad(numero)}`;

function Page() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: d, error } = await supabase
        .from("cotacoes")
        .select(
          "id,numero,status,criado_em," +
            "segurado:cotacao_segurado(nome,cpf_cnpj)," +
            "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa)," +
            "coberturas:cotacao_coberturas(casco_valor,franquia,rcf_dm,rcf_dc,app_morte,carro_reserva,vidros,assist_24)," +
            "premios:cotacao_premios(id,seguradora,cobertura,premio)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) setErr(error.message);
      setData(d as unknown as Data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppShell title="Comparativo"><div className="muted">Carregando…</div></AppShell>;
  if (err || !data) return (
    <AppShell title="Comparativo">
      <ProtoIcons />
      <div className="alert alert-err">{err || "Cotação não encontrada."}</div>
      <Link to="/venda/cotacoes" className="btn">Voltar para lista</Link>
    </AppShell>
  );

  const headName = data.segurado?.nome || "—";
  const v = data.veiculo;
  const headCar = v
    ? `${v.marca_nome ?? ""} ${v.modelo_nome ?? ""} ${v.ano_modelo ?? ""}`.trim() || "—"
    : "—";
  const offers = (data.premios ?? []).sort((a, b) => Number(a.premio) - Number(b.premio));
  const cobs = data.coberturas;
  const seals: Record<string, "cheap" | "best" | "most"> = {};
  if (offers[0]) seals[offers[0].seguradora] = "cheap";
  if (offers[1]) seals[offers[1].seguradora] = "most";
  if (offers[2]) seals[offers[2].seguradora] = "best";

  const rows: Array<[string, string, (o: Premio) => string]> = [
    ["Cobertura compreensiva", "Casco + roubo/furto + incêndio", () => cobs?.casco_valor || "100% FIPE"],
    ["Franquia · casco", "Valor pago pelo cliente em sinistro", () => cobs?.franquia || "—"],
    ["RCF · danos materiais", "Cobre danos a terceiros", () => cobs?.rcf_dm || "—"],
    ["RCF · danos corporais", "Lesões a terceiros", () => cobs?.rcf_dc || "—"],
    ["APP por passageiro", "Acidentes pessoais", () => cobs?.app_morte || "—"],
    ["Carro reserva", "Em sinistro de média/grande monta", () => cobs?.carro_reserva || "—"],
    ["Vidros · faróis · retrovisores", "Cobertura específica", () => (cobs?.vidros ? "incluído" : "opcional")],
    ["Assistência 24h", "Guincho, chaveiro, pane", () => cobs?.assist_24 || "Padrão"],
  ];

  const doPrint = (only?: string) => {
    const list = only ? offers.filter((o) => o.seguradora === only) : offers;
    const head = `
      <div class="grid">
        <div class="kv"><b>Cliente:</b> ${escapeHtml(headName)}</div>
        <div class="kv"><b>CPF/CNPJ:</b> ${escapeHtml(data.segurado?.cpf_cnpj || "—")}</div>
        <div class="kv"><b>Veículo:</b> ${escapeHtml(headCar)}</div>
        <div class="kv"><b>Placa:</b> ${escapeHtml(v?.placa || "—")}</div>
        <div class="kv"><b>Cotação:</b> #${escapeHtml(cotNum(data.numero, data.criado_em))}</div>
        <div class="kv"><b>Status:</b> ${escapeHtml(data.status)}</div>
      </div>`;
    const thead = `<tr><th>Cobertura</th>${list
      .map((o) => `<th>${escapeHtml(o.seguradora)}</th>`)
      .join("")}</tr>`;
    const trs = rows
      .map(
        ([t, s, fn]) =>
          `<tr><td><strong>${escapeHtml(t)}</strong><br/><small style="color:#64748b">${escapeHtml(
            s
          )}</small></td>${list.map((o) => `<td>${escapeHtml(fn(o))}</td>`).join("")}</tr>`
      )
      .join("");
    const totals = `<tr><td><strong>Prêmio total</strong><br/><small style="color:#64748b">à vista ou 12x</small></td>${list
      .map(
        (o) =>
          `<td class="num"><div class="price">${fmtBRL(Number(o.premio))}</div><small style="color:#64748b">12x ${fmtBRL(
            Number(o.premio) / 12
          )}</small></td>`
      )
      .join("")}</tr>`;
    const body = `
      <h1>Comparativo de cotação</h1>
      <div class="sub">Gerado a partir de #${escapeHtml(cotNum(data.numero, data.criado_em))}</div>
      ${head}
      <h2>Coberturas & prêmios</h2>
      <table>${thead}${trs}${totals}</table>
      <p style="font-size:11px;color:#64748b">Cotação válida por 5 dias. Sujeita à aceitação da seguradora.</p>`;
    printHtml(only ? `Cotação · ${only}` : "Comparativo de cotação", body);
  };

  const rowCmp = (title: string, sub: string, fn: (o: Premio) => string) => (
    <tr>
      <td className="cov-name">{title}<small>{sub}</small></td>
      {offers.map((o) => (
        <td key={o.id} className="cell"><span className="v-lmi">{fn(o)}</span></td>
      ))}
    </tr>
  );

  return (
    <AppShell title="Comparativo">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Comparativo · {headName}</h1>
          <div className="sub">
            {headCar} {v?.placa ? `· ${v.placa}` : ""} · cotação <strong>#{cotNum(data.numero, data.criado_em)}</strong>
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost" onClick={() => nav({ to: "/venda/cotacoes" })}>‹ Voltar para lista</button>
          <Link to="/venda/novo-lead" search={{ id: data.id }} className="btn btn-ghost">
            + Comparar com mais seguradoras
          </Link>
        </div>
      </div>

      <div className="compare-bar">
        <label
          className="switch on"
          onClick={(e) => e.currentTarget.classList.toggle("on")}
        >
          <span className="track" />
          <span className="label">Aplicar alterações em todas as seguradoras</span>
        </label>
        <span className="muted small">(desligado: edição valida apenas a coluna)</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="chip chip-yellow">Última atualização {new Date(data.criado_em).toLocaleString("pt-BR")}</span>
        <button className="btn btn-slate btn-sm" onClick={() => window.location.reload()}>Recalcular tudo</button>
      </div>

      {offers.length === 0 ? (
        <div className="card">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhum prêmio calculado ainda.
          </div>
        </div>
      ) : (
        <>
        <div className="compare-table">
          <table className="ctable">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>COBERTURA</th>
                {offers.map((o) => (
                  <th key={o.id} className="col-ins">
                    {o.seguradora}
                    {seals[o.seguradora] && (
                      <>
                        <br />
                        <span className={`seal ${seals[o.seguradora]}`}>
                          {seals[o.seguradora] === "cheap" ? "Menor preço" : seals[o.seguradora] === "best" ? "Melhor cobertura" : "Mais escolhido"}
                        </span>
                      </>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowCmp("Cobertura compreensiva", "Casco + roubo/furto + incêndio", () => cobs?.casco_valor || "100% FIPE")}
              {rowCmp("Franquia · casco", "Valor pago pelo cliente em sinistro", () => cobs?.franquia || "—")}
              {rowCmp("RCF · danos materiais", "Cobre danos a terceiros", () => cobs?.rcf_dm || "—")}
              {rowCmp("RCF · danos corporais", "Lesões a terceiros", () => cobs?.rcf_dc || "—")}
              {rowCmp("APP por passageiro", "Acidentes pessoais", () => cobs?.app_morte || "—")}
              {rowCmp("Carro reserva", "Em sinistro de média/grande monta", () => cobs?.carro_reserva || "—")}
              {rowCmp("Vidros · faróis · retrovisores", "Cobertura específica", () =>
                cobs?.vidros ? "incluído" : "opcional"
              )}
              {rowCmp("Assistência 24h", "Guincho, chaveiro, pane", () => cobs?.assist_24 || "Padrão")}
              <tr className="total-row">
                <td className="cov-name">PRÊMIO TOTAL <small style={{ textTransform: "none", letterSpacing: 0 }}>à vista ou parcelado</small></td>
                {offers.map((o) => (
                  <td key={o.id} className="cell">
                    {money(Number(o.premio))}
                    <span className="parc">12x {money(Number(o.premio) / 12)}</span>
                  </td>
                ))}
              </tr>
              <tr className="actions-row">
                <td></td>
                {offers.map((o) => (
                  <td key={o.id}>
                    <div className="ins-actions">
                      <Link to="/venda/propostas" className="btn btn-yellow">Gerar proposta</Link>
                      <button className="btn btn-ghost" type="button">Enviar</button>
                      <button className="btn btn-ghost" type="button" onClick={() => window.print()}>Imprimir</button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="compare-foot">
            <span>Coberturas editáveis: clique em qualquer valor (LMI, franquia) para ajustar inline.</span>
            <span>Cotação válida por <strong>5 dias</strong></span>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div className="card card-yellow" style={{ padding: "14px 18px" }}>
            <div className="row" style={{ gap: 10, marginBottom: 4 }}>
              <strong style={{ color: "var(--slate)", fontSize: 13 }}>Recomendação CoteCerto</strong>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
              {offers[0] ? <>A <strong>{offers[0].seguradora}</strong> apresenta o menor prêmio ({money(Number(offers[0].premio))}) entre as seguradoras cotadas.</> : "Sem recomendação."}
            </p>
          </div>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row" style={{ gap: 10, marginBottom: 4, color: "var(--slate)" }}>
              <strong style={{ fontSize: 13 }}>Por que só {offers.length} seguradora{offers.length === 1 ? "" : "s"}?</strong>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
              As demais não cobrem este perfil específico (veículo / faixa etária / região). Use <strong>Comparar com mais seguradoras</strong> para forçar.
            </p>
          </div>
          <div className="card" style={{ padding: "14px 18px" }}>
            <div className="row" style={{ gap: 10, marginBottom: 4, color: "var(--slate)" }}>
              <strong style={{ fontSize: 13 }}>Histórico do cliente</strong>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
              {data.segurado?.cpf_cnpj ? `CPF/CNPJ ${data.segurado.cpf_cnpj}.` : "Sem histórico anterior registrado."}
            </p>
          </div>
        </div>
        </>
      )}
    </AppShell>
  );
}
