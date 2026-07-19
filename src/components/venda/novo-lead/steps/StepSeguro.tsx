import type { Form, BonusFieldKey } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  setF: React.Dispatch<React.SetStateAction<Form>>;
  seguradorasDb: string[];
};

export function StepSeguro({ f, up, setF, seguradorasDb }: Props) {
  const SEG_HABILITADAS = seguradorasDb;
  const INSURERS = seguradorasDb;
  const bonusClasses = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
  const isRenov = (f.tipoSeguro || "").includes("Renovação");
  return (
    <>
      <h2>Dados do Seguro</h2>
      <div className="sub">Seguradoras para o cálculo, tipo de seguro e vigência.</div>

      <div className="field-group full" style={{ marginBottom: 6 }}>
        <label>
          Seguradoras disponíveis <span className="hint">marque e desmarque para o cálculo</span>
        </label>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", paddingTop: 6 }}>
          {SEG_HABILITADAS.map((s) => {
            const on = f.seguradorasSel.includes(s);
            return (
              <span
                key={s}
                className={"chip " + (on ? "chip-yellow" : "chip-outline")}
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                onClick={() =>
                  up(
                    "seguradorasSel",
                    on ? f.seguradorasSel.filter((x) => x !== s) : [...f.seguradorasSel, s],
                  )
                }
              >
                {on && (
                  <svg width="12" height="12">
                    <use href="#i-check" />
                  </svg>
                )}
                {s}
              </span>
            );
          })}
        </div>
      </div>

      <div className="wizard-grid cols-3">
        <div className="field-group">
          <label>
            Tipo de seguro<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.tipoSeguro}
            onChange={(e) => up("tipoSeguro", e.target.value)}
          >
            {["Seguro novo", "Renovação com nossa corretora", "Renovação de outra corretora"].map(
              (o) => (
                <option key={o}>{o}</option>
              ),
            )}
          </select>
        </div>
        <div className="field-group">
          <label>Tipo de cálculo</label>
          <select
            className="input"
            value={f.tipoCalculo}
            onChange={(e) => {
              const tc = e.target.value;
              const yearsMap: Record<string, number> = {
                Anual: 1,
                Bianual: 2,
                Trianual: 3,
                Quadrianual: 4,
                Quinquenal: 5,
              };
              const add = yearsMap[tc];
              let fim = f.vigFim;
              if (f.vigIni && add) {
                const d = new Date(f.vigIni + "T00:00:00");
                d.setFullYear(d.getFullYear() + add);
                d.setDate(d.getDate() - 1);
                fim = d.toISOString().slice(0, 10);
              }
              setF((s) => ({ ...s, tipoCalculo: tc, vigFim: fim }));
            }}
          >
            {[
              "Anual",
              "Bianual",
              "Trianual",
              "Quadrianual",
              "Quinquenal",
              "Plurianual",
              "Prazo curto",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Tipo de cobertura</label>
          <select
            className="input"
            value={f.tipoCobertura}
            onChange={(e) => up("tipoCobertura", e.target.value)}
          >
            {[
              "Compreensiva",
              "Casco (Incêndio, Roubo e Furto)",
              "Casco (Colisão e Incêndio)",
              "RCF (Somente terceiros)",
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>
            Período de vigência<span className="req">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={f.vigIni}
            onChange={(e) => {
              const ini = e.target.value;
              const yearsMap: Record<string, number> = {
                Anual: 1,
                Bianual: 2,
                Trianual: 3,
                Quadrianual: 4,
                Quinquenal: 5,
              };
              const add = yearsMap[f.tipoCalculo];
              let fim = f.vigFim;
              if (ini && add) {
                const d = new Date(ini + "T00:00:00");
                d.setFullYear(d.getFullYear() + add);
                d.setDate(d.getDate() - 1);
                fim = d.toISOString().slice(0, 10);
              }
              setF((s) => ({ ...s, vigIni: ini, vigFim: fim }));
            }}
          />
        </div>
        <div className="field-group">
          <label>Até</label>
          <input
            className="input"
            type="date"
            value={f.vigFim}
            onChange={(e) => up("vigFim", e.target.value)}
          />
        </div>
        <div className="field-group">
          <label>
            Grupo de produção<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.grupoProducao}
            onChange={(e) => up("grupoProducao", e.target.value)}
            placeholder="Busca o produtor"
          />
        </div>
      </div>

      <div className="wizard-grid">
        <div className="field-group">
          <label>Campanha</label>
          <select
            className="input"
            value={f.campanha}
            onChange={(e) => up("campanha", e.target.value)}
          >
            <option value="">Selecione</option>
            <option>Campanha Supper Auto 2026</option>
            <option>Indique e ganhe</option>
          </select>
        </div>
        <div className="field-group full">
          <label>Observações para a cotação</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Anotações internas desta cotação"
            value={f.observacoesCot}
            onChange={(e) => up("observacoesCot", e.target.value)}
          />
        </div>
      </div>

      {isRenov && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            background: "var(--cream-soft)",
          }}
        >
          <div
            className="sec-title"
            style={{
              margin: "0 0 8px",
              color: "var(--slate)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <svg width="14" height="14">
              <use href="#i-history" />
            </svg>{" "}
            Dados da apólice anterior <span className="hint">obrigatório em renovação</span>
          </div>
          <div className="wizard-grid cols-3">
            <div className="field-group">
              <label>
                Seguradora anterior<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.seguradoraAnterior}
                onChange={(e) => up("seguradoraAnterior", e.target.value)}
              >
                <option value="">Selecione</option>
                {INSURERS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Sucursal / endosso <span className="hint">Bradesco e Porto</span>
              </label>
              <input
                className="input"
                value={f.sucursalAnterior}
                onChange={(e) => up("sucursalAnterior", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>
                Nº da apólice anterior<span className="req">*</span>
              </label>
              <input
                className="input"
                value={f.apoliceAnterior}
                onChange={(e) => up("apoliceAnterior", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>
                Cobertura anterior<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.coberturaAnterior}
                onChange={(e) => up("coberturaAnterior", e.target.value)}
              >
                {[
                  "Compreensiva",
                  "Casco (Incêndio, Roubo e Furto)",
                  "Casco (Colisão e Incêndio)",
                  "RCF (Somente terceiros)",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Status da apólice anterior<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.statusApoliceAnterior}
                onChange={(e) => up("statusApoliceAnterior", e.target.value)}
              >
                {["Em vigor", "Vencida", "Cancelada"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Item da apólice anterior</label>
              <input
                className="input"
                value={f.itemApoliceAnterior}
                onChange={(e) => up("itemApoliceAnterior", e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="field-group">
              <label>
                Início vigência anterior<span className="req">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={f.inicioVigenciaAnterior}
                onChange={(e) => up("inicioVigenciaAnterior", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>
                Fim vigência anterior<span className="req">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={f.fimVigenciaAnterior}
                onChange={(e) => up("fimVigenciaAnterior", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>
                Renovação para o mesmo veículo?<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.renovacaoMesmoVeiculo}
                onChange={(e) => up("renovacaoMesmoVeiculo", e.target.value)}
              >
                {["Sim", "Não"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Inclusão de casco <span className="hint">Yelum, Mapfre, Aliro</span>
              </label>
              <select
                className="input"
                value={f.renovacaoInclusaoCasco}
                onChange={(e) => up("renovacaoInclusaoCasco", e.target.value)}
              >
                {["Não", "Sim"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Qtd. sinistros parciais anterior</label>
              <input
                className="input"
                value={f.qtdSinistrosParcialAnterior}
                onChange={(e) => up("qtdSinistrosParcialAnterior", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field-group">
              <label>CI da apólice anterior</label>
              <input
                className="input"
                value={f.ciApoliceAnterior}
                onChange={(e) => up("ciApoliceAnterior", e.target.value)}
                placeholder="opcional"
              />
            </div>
            <div className="field-group">
              <label>Classe de bônus anterior</label>
              <select
                className="input"
                value={f.classeBonusAnterior}
                onChange={(e) => up("classeBonusAnterior", e.target.value)}
              >
                {bonusClasses.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Comissão da apólice anterior (%)</label>
              <input
                className="input"
                value={f.comissaoApoliceAnterior}
                onChange={(e) => up("comissaoApoliceAnterior", e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>

          <div
            className="sec-title"
            style={{
              margin: "14px 0 6px",
              color: "var(--slate)",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Bônus por seguradora
          </div>
          <div className="wizard-grid cols-3">
            {[
              ["bonusRenovacaoTodasSeguradoras", "Bônus — todas as seguradoras", true],
              ["bonusAllianz", "Bônus Allianz", false],
              ["bonusSuhai", "Bônus Suhai", false],
              ["bonusPortoAzulItau", "Bônus Porto / Azul / Itaú", false],
              ["bonusMapfre", "Bônus Mapfre", false],
              ["bonusTokio", "Bônus Tokio Marine", false],
              ["bonusHdi", "Bônus HDI", false],
              ["bonusBradesco", "Bônus Bradesco", false],
              ["bonusYelumAliroIndiana", "Bônus Yelum / Aliro / Indiana", false],
            ].map(([key, label, req]) => (
              <div key={key as string} className="field-group">
                <label>
                  {label as string}
                  {req && <span className="req">*</span>}
                </label>
                <select
                  className="input"
                  value={f[key as BonusFieldKey]}
                  onChange={(e) => up(key as keyof Form, e.target.value)}
                >
                  {bonusClasses.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
