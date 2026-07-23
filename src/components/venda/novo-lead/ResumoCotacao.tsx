import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";

type Props = {
  f: Form;
  marcas: { codigo: string; nome: string }[];
  modelos: { codigo: number; nome: string }[];
  fipeValor: string;
  podeCalcular: boolean;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  doSimularCalculo: () => void;
  persistir: (extra?: { premios?: ResultadoCalculo[] }) => Promise<void>;
  saveState: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  cotacaoId: string | null;
};

export function ResumoCotacao({
  f,
  marcas,
  modelos,
  fipeValor,
  podeCalcular,
  setStep,
  doSimularCalculo,
  persistir,
  saveState,
  lastSavedAt,
  cotacaoId,
}: Props) {
  return (
    <div className="resumo">
      <div className="head">
        <svg width="16" height="16">
          <use href="#i-clock" />
        </svg>
        <h3>Resumo da cotação</h3>
        {podeCalcular && (
          <span className="chip chip-ok" style={{ marginLeft: "auto" }}>
            Pronto
          </span>
        )}
      </div>
      <div className="body">
        {f.nome || f.cpf || f.marca || f.tipoCobertura || f.placa || f.condNome ? (
          <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
            {(f.nome ||
              f.cpf ||
              f.celular ||
              f.cidade ||
              f.nasc ||
              f.sexo ||
              f.estadoCivil ||
              f.cep) && (
              <div style={{ display: "grid", gap: 4 }}>
                <div
                  className="muted small"
                  style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Segurado
                </div>
                {f.cpf && (
                  <div>
                    <b>{f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> {f.cpf}
                  </div>
                )}
                {f.nome && (
                  <div>
                    <b>Nome:</b> {f.nome}
                  </div>
                )}
                {f.nasc && (
                  <div>
                    <b>Nascimento:</b> {f.nasc}
                  </div>
                )}
                {f.sexo && (
                  <div>
                    <b>Sexo:</b> {f.sexo}
                  </div>
                )}
                {f.estadoCivil && (
                  <div>
                    <b>Estado civil:</b> {f.estadoCivil}
                  </div>
                )}
                {f.celular && (
                  <div>
                    <b>Celular:</b> {f.celular}
                  </div>
                )}
                {f.cep && (
                  <div>
                    <b>CEP:</b> {f.cep}
                  </div>
                )}
                {f.cidade && (
                  <div>
                    <b>Cidade:</b> {f.cidade}
                    {f.uf ? `/${f.uf}` : ""}
                  </div>
                )}
              </div>
            )}
            {f.tipoSeguro && (
              <div style={{ display: "grid", gap: 4 }}>
                <div
                  className="muted small"
                  style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Seguro
                </div>
                <div>
                  <b>Tipo:</b> {f.tipoSeguro}
                  {f.ramo ? ` · ${f.ramo}` : ""}
                  {f.categoria ? ` · ${f.categoria}` : ""}
                </div>
              </div>
            )}
            {(f.marca || f.placa || f.modelo || f.anoModelo) && (
              <div style={{ display: "grid", gap: 4 }}>
                <div
                  className="muted small"
                  style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Veículo
                </div>
                {f.placa && (
                  <div>
                    <b>Placa:</b> {f.placa}
                  </div>
                )}
                {f.marca && (
                  <div>
                    <b>Marca:</b> {marcas.find((m) => m.codigo === f.marca)?.nome || f.marca}
                  </div>
                )}
                {f.modelo && (
                  <div>
                    <b>Modelo:</b>{" "}
                    {modelos.find((m) => String(m.codigo) === f.modelo)?.nome || f.modelo}
                  </div>
                )}
                {f.anoModelo && (
                  <div>
                    <b>Ano:</b> {f.anoModelo}
                    {f.anoFab ? `/${f.anoFab}` : ""}
                  </div>
                )}
                {fipeValor && (
                  <div>
                    <b>FIPE:</b> {fipeValor}
                  </div>
                )}
                {f.combustivel && (
                  <div>
                    <b>Combustível:</b> {f.combustivel}
                  </div>
                )}
                {f.cor && (
                  <div>
                    <b>Cor:</b> {f.cor}
                  </div>
                )}
                {f.chassi && (
                  <div>
                    <b>Chassi:</b> {f.chassi}
                  </div>
                )}
                {f.renavam && (
                  <div>
                    <b>Renavam:</b> {f.renavam}
                  </div>
                )}
                {(f.zeroKm || f.blindado || f.alienado) && (
                  <div>
                    <b>Flags:</b>{" "}
                    {[
                      f.zeroKm && "0km",
                      f.blindado && "Blindado",
                      f.alienado && `Alienado${f.banco ? ` (${f.banco})` : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {f.usoComercial && (
                  <div>
                    <b>Uso comercial:</b> {f.usoComercial}
                  </div>
                )}
                {f.kmMensal && (
                  <div>
                    <b>Km/mês:</b> {f.kmMensal}
                  </div>
                )}
              </div>
            )}
            {(f.condNome || f.condCpf || f.profissao || f.cepPernoite) && (
              <div style={{ display: "grid", gap: 4 }}>
                <div
                  className="muted small"
                  style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Perfil
                </div>
                <div>
                  <b>Condutor:</b>{" "}
                  {f.condutorMesmo === "sim" ? "Mesmo segurado" : f.condNome || "—"}
                </div>
                {f.condCpf && f.condutorMesmo === "nao" && (
                  <div>
                    <b>CPF cond.:</b> {f.condCpf}
                  </div>
                )}
                {f.profissao && (
                  <div>
                    <b>Profissão:</b> {f.profissao}
                  </div>
                )}
                {f.cepPernoite && (
                  <div>
                    <b>CEP pernoite:</b> {f.cepPernoite}
                  </div>
                )}
                {f.tipoGaragem && (
                  <div>
                    <b>Garagem:</b> {f.tipoGaragem}
                  </div>
                )}
                {f.jovens1825 === "sim" && (
                  <div>
                    <b>Jovens 18-25:</b> Sim
                  </div>
                )}
              </div>
            )}
            {(f.tipoCobertura || f.casco || f.franquia) && (
              <div style={{ display: "grid", gap: 4 }}>
                <div
                  className="muted small"
                  style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                >
                  Coberturas
                </div>
                {f.tipoCobertura && (
                  <div>
                    <b>Tipo:</b> {f.tipoCobertura}
                  </div>
                )}
                {f.casco && (
                  <div>
                    <b>Casco:</b> {f.casco}
                    {f.cascoValor ? ` · ${f.cascoValor}` : ""}
                  </div>
                )}
                {f.franquia && (
                  <div>
                    <b>Franquia:</b> {f.franquia}
                  </div>
                )}
                {(f.appMorte || f.appInval) && (
                  <div>
                    <b>APP:</b> M {f.appMorte || "—"} / I {f.appInval || "—"}
                  </div>
                )}
                {(f.rcfDm || f.rcfDc) && (
                  <div>
                    <b>RCF:</b> DM {f.rcfDm || "—"} / DC {f.rcfDc || "—"}
                  </div>
                )}
                {f.dmh && (
                  <div>
                    <b>DMH:</b> {f.dmh}
                  </div>
                )}
                {f.carroReserva && (
                  <div>
                    <b>Carro reserva:</b> {f.carroReserva}
                  </div>
                )}
                {f.assist24 && (
                  <div>
                    <b>Assist. 24h:</b> {f.assist24}
                  </div>
                )}
                {f.vidros && (
                  <div>
                    <b>Vidros:</b> Sim
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="empty">Conforme você preenche, o resumo aparece aqui.</div>
        )}
      </div>
      <div className="insurers-row">
        <span className="ins-chip">
          <svg width="12" height="12">
            <use href="#i-shield" />
          </svg>{" "}
          {f.seguradorasSel.length} seguradoras no cálculo
        </span>
      </div>
      <div className="footer">
        <button
          className="btn btn-yellow"
          disabled={!podeCalcular}
          style={!podeCalcular ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          onClick={() => {
            setStep(5);
            doSimularCalculo();
          }}
        >
          <svg width="14" height="14">
            <use href="#i-bolt" />
          </svg>{" "}
          Calcular
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => void persistir()}
          disabled={saveState === "saving"}
        >
          <svg width="13" height="13">
            <use href="#i-download" />
          </svg>
          {saveState === "saving" ? " Salvando…" : " Salvar rascunho"}
        </button>
        <div className="muted small" style={{ marginTop: 6 }}>
          {saveState === "saving" && "Salvando…"}
          {saveState === "saved" &&
            lastSavedAt &&
            `Salvo às ${lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
          {saveState === "error" && (
            <span style={{ color: "#dc2626" }}>Erro ao salvar — tente novamente</span>
          )}
          {cotacaoId && (
            <div style={{ fontSize: 11, opacity: 0.6 }}>ID: {cotacaoId.slice(0, 8)}…</div>
          )}
        </div>
      </div>
    </div>
  );
}
