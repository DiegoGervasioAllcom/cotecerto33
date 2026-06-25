import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

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
          <Link
            to="/venda/novo-lead"
            search={{ id: data.id }}
            className="btn btn-ghost"
          >
            Editar cotação
          </Link>
        </div>
      </div>

      <div className="compare-bar">
        <span className="chip chip-yellow">Última atualização {new Date(data.criado_em).toLocaleString("pt-BR")}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span className="muted small">{offers.length} seguradora{offers.length === 1 ? "" : "s"} cotada{offers.length === 1 ? "" : "s"}</span>
      </div>

      {offers.length === 0 ? (
        <div className="card">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhum prêmio calculado ainda.
          </div>
        </div>
      ) : (
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
                    <span className="parc">12x sem juros</span>
                  </td>
                ))}
              </tr>
              <tr className="actions-row">
                <td></td>
                {offers.map((o) => (
                  <td key={o.id}>
                    <div className="ins-actions">
                      <Link
                        to="/venda/propostas"
                        className="btn btn-yellow"
                      >
                        Gerar proposta
                      </Link>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="compare-foot">
            <span>Coberturas vêm do passo 5 (Coberturas) do wizard de cotação.</span>
            <span>Cotação válida por <strong>5 dias</strong></span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
