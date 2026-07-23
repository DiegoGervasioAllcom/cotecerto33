import { maskBRL } from "@/components/venda/novo-lead/masks";
import {
  PLANO_COBERTURA,
  MODALIDADE_COBERTURA,
  FRANQUIA_OPCOES,
  RCF_VALORES,
  DESPESAS_EXTRAS_OPCOES,
  SEG_HABILITADAS,
} from "@/components/venda/novo-lead/enumsCoberturas";
import { DescontosFold } from "@/components/venda/novo-lead/steps/coberturas/DescontosFold";
import { ComissoesFold } from "@/components/venda/novo-lead/steps/coberturas/ComissoesFold";
import { CondicoesEspeciaisFold } from "@/components/venda/novo-lead/steps/coberturas/CondicoesEspeciaisFold";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
};

function money(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function StepCoberturas({ f, up, erros }: Props) {
  const seguradoras = f.seguradorasSel.length ? f.seguradorasSel : SEG_HABILITADAS;

  return (
    <>
      <h2>Coberturas</h2>
      <div className="sub">
        Escolha um plano pronto ou personalize. Você ajusta tudo depois no comparativo.
      </div>

      <div className="field-group full">
        <label>Plano de Coberturas</label>
        <div className="row" style={{ gap: 10, paddingTop: 4, flexWrap: "wrap" }}>
          {PLANO_COBERTURA.map((t) => (
            <span
              key={t}
              className={"chip " + (f.tipoCobertura === t ? "chip-yellow" : "chip-outline")}
              style={{ cursor: "pointer" }}
              onClick={() => up("tipoCobertura", t)}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="wizard-grid cols-3" style={{ marginTop: 8 }}>
        <div className="field-group">
          <label>Modalidade</label>
          <select
            className="input"
            value={f.modalidade}
            onChange={(e) => up("modalidade", e.target.value)}
          >
            {MODALIDADE_COBERTURA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>% ajuste</label>
          <input
            className="input"
            value={f.percentualAjuste}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => up("percentualAjuste", e.target.value)}
          />
        </div>
        <div className="field-group">
          <label>1ª opção de franquia</label>
          <select
            className="input"
            value={f.franquiaPrimeiraOpcao}
            onChange={(e) => up("franquiaPrimeiraOpcao", e.target.value)}
          >
            {FRANQUIA_OPCOES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>2ª opção de franquia</label>
          <select
            className="input"
            value={f.franquiaSegundaOpcao}
            onChange={(e) => up("franquiaSegundaOpcao", e.target.value)}
          >
            {FRANQUIA_OPCOES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Danos materiais a terceiros</label>
          <select className="input" value={f.rcfDm} onChange={(e) => up("rcfDm", e.target.value)}>
            {RCF_VALORES.map((v) => (
              <option key={v} value={String(v)}>
                {money(v)}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Danos corporais a terceiros</label>
          <select className="input" value={f.rcfDc} onChange={(e) => up("rcfDc", e.target.value)}>
            {RCF_VALORES.map((v) => (
              <option key={v} value={String(v)}>
                {money(v)}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>APP Morte (por passageiro)</label>
          <input
            className="input"
            value={f.appMorte}
            maxLength={100}
            onChange={(e) => up("appMorte", maskBRL(e.target.value))}
            placeholder="R$ 10.000,00"
          />
          {erros.appMorte && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.appMorte}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>APP Invalidez (por passageiro)</label>
          <input
            className="input"
            value={f.appInval}
            maxLength={100}
            onChange={(e) => up("appInval", maskBRL(e.target.value))}
            placeholder="R$ 10.000,00"
          />
          {erros.appInvalidez && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.appInvalidez}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Danos Morais</label>
          <input
            className="input"
            value={f.danosMorais}
            maxLength={100}
            onChange={(e) => up("danosMorais", maskBRL(e.target.value))}
            placeholder="R$ 10.000,00"
          />
        </div>
        <div className="field-group">
          <label>Despesas Extras</label>
          <select
            className="input"
            value={f.despesasExtras}
            onChange={(e) => up("despesasExtras", e.target.value)}
          >
            {DESPESAS_EXTRAS_OPCOES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Casco</label>
          <select className="input" value={f.casco} onChange={(e) => up("casco", e.target.value)}>
            <option>100% Tabela FIPE</option>
            <option>95% Tabela FIPE</option>
            <option>110% Tabela FIPE</option>
            <option>Valor determinado</option>
          </select>
        </div>
        {f.casco === "Valor determinado" && (
          <div className="field-group">
            <label>Valor determinado</label>
            <input
              className="input"
              value={f.cascoValor}
              maxLength={100}
              onChange={(e) => up("cascoValor", maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
            {erros.cascoValor && (
              <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                {erros.cascoValor}
              </span>
            )}
          </div>
        )}
        <div className="field-group">
          <label>Franquia</label>
          <select
            className="input"
            value={f.franquia}
            onChange={(e) => up("franquia", e.target.value)}
          >
            <option>Reduzida</option>
            <option>Normal</option>
            <option>Majorada</option>
          </select>
        </div>
      </div>

      <div className="field-group full" style={{ marginTop: 10 }}>
        <label>Adicionais</label>
        <div className="row" style={{ gap: 18, paddingTop: 6, flexWrap: "wrap" }}>
          <label
            className={`switch ${f.vidros ? "on" : ""}`}
            onClick={() => up("vidros", !f.vidros)}
          >
            <span className="track"></span>
            <span className="label">Vidros · faróis · retrovisores</span>
          </label>
          <label
            className={`switch ${f.pequenosReparos ? "on" : ""}`}
            onClick={() => up("pequenosReparos", !f.pequenosReparos)}
          >
            <span className="track"></span>
            <span className="label">Pequenos reparos</span>
          </label>
        </div>
        <div className="wizard-grid" style={{ marginTop: 8 }}>
          <div className="field-group">
            <label>Carro reserva</label>
            <select
              className="input"
              value={f.carroReserva}
              onChange={(e) => up("carroReserva", e.target.value)}
            >
              <option>Não</option>
              <option>7 dias</option>
              <option>15 dias</option>
              <option>30 dias</option>
            </select>
          </div>
          <div className="field-group">
            <label>Assistência 24h</label>
            <select
              className="input"
              value={f.assist24}
              onChange={(e) => up("assist24", e.target.value)}
            >
              <option>Básica</option>
              <option>Intermediária</option>
              <option>Premium</option>
            </select>
          </div>
        </div>
      </div>

      <div className="field-group full" style={{ marginTop: 10 }}>
        <label>Mais Assistências</label>
        <div
          className="row"
          style={{ gap: 18, paddingTop: 6, flexWrap: "wrap", alignItems: "center" }}
        >
          <label
            className={`switch ${f.maisAssistencias ? "on" : ""}`}
            onClick={() => up("maisAssistencias", !f.maisAssistencias)}
          >
            <span className="track"></span>
            <span className="label">Contratar pacote de mais assistências</span>
          </label>
          {f.maisAssistencias && (
            <div className="field-group" style={{ margin: 0, minWidth: 240 }}>
              <label>
                Seguradora do pacote<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.maisAssistenciasSeguradora}
                onChange={(e) => up("maisAssistenciasSeguradora", e.target.value)}
              >
                <option value="">Selecione</option>
                {seguradoras.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <DescontosFold f={f} up={up} seguradoras={seguradoras} />
      <ComissoesFold f={f} up={up} seguradoras={seguradoras} />
      <CondicoesEspeciaisFold f={f} up={up} />
    </>
  );
}
