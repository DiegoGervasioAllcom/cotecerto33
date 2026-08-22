import { maskBRL } from "@/components/venda/novo-lead/masks";
import {
  PLANO_COBERTURA,
  MODALIDADE_COBERTURA,
  FRANQUIA_OPCOES,
  FRANQUIA_SEGUNDA_OPCOES,
  RCF_VALORES,
  DESPESAS_EXTRAS_OPCOES,
  NIVEL_COBERTURA_OPCOES,
} from "@/components/venda/novo-lead/enumsCoberturas";
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

// Presets aplicados pela Quiver ao trocar o Plano de Coberturas
// (confirmado ao vivo no portal real, cotação 155651). "Personalizado" não
// tem preset próprio — mantém os valores já preenchidos.
const PLANO_PRESETS: Record<
  Exclude<(typeof PLANO_COBERTURA)[number], "Personalizado">,
  {
    modalidade: (typeof MODALIDADE_COBERTURA)[number];
    percentualAjuste: string;
    franquiaPrimeiraOpcao: (typeof FRANQUIA_OPCOES)[number];
    franquiaSegundaOpcao: (typeof FRANQUIA_SEGUNDA_OPCOES)[number];
    rcfDm: string;
    rcfDc: string;
    appMorte: string;
    appInval: string;
    danosMorais: string;
    despesasExtras: (typeof DESPESAS_EXTRAS_OPCOES)[number];
  }
> = {
  Fácil: {
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    rcfDm: "100000",
    rcfDc: "100000",
    appMorte: "R$ 10.000,00",
    appInval: "R$ 10.000,00",
    danosMorais: "R$ 10.000,00",
    despesasExtras: "Não contratada",
  },
  Pleno: {
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    rcfDm: "50000",
    rcfDc: "50000",
    appMorte: "R$ 5.000,00",
    appInval: "R$ 5.000,00",
    danosMorais: "R$ 0,00",
    despesasExtras: "Não contratada",
  },
  Total: {
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    rcfDm: "100000",
    rcfDc: "100000",
    appMorte: "R$ 10.000,00",
    appInval: "R$ 10.000,00",
    danosMorais: "R$ 10.000,00",
    despesasExtras: "Não contratada",
  },
};

export function StepCoberturas({ f, up, erros }: Props) {
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
              onClick={() => {
                up("tipoCobertura", t);
                if (t === "Personalizado") return;
                const preset = PLANO_PRESETS[t];
                up("modalidade", preset.modalidade);
                up("percentualAjuste", preset.percentualAjuste);
                up("franquiaPrimeiraOpcao", preset.franquiaPrimeiraOpcao);
                up("franquiaSegundaOpcao", preset.franquiaSegundaOpcao);
                up("rcfDm", preset.rcfDm);
                up("rcfDc", preset.rcfDc);
                up("appMorte", preset.appMorte);
                up("appInval", preset.appInval);
                up("danosMorais", preset.danosMorais);
                up("despesasExtras", preset.despesasExtras);
              }}
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
            {FRANQUIA_SEGUNDA_OPCOES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Danos materiais a terceiros</label>
          <select className="input" value={f.rcfDm} onChange={(e) => up("rcfDm", e.target.value)}>
            <option value="">Selecione</option>
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
            <option value="">Selecione</option>
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
        {f.modalidade === "Valor Determinado" && (
          <div className="field-group">
            <label>Valor determinado (Casco)</label>
            <input
              className="input"
              value={f.valorDeterminado}
              maxLength={100}
              onChange={(e) => up("valorDeterminado", maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
            {erros.valorDeterminado && (
              <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                {erros.valorDeterminado}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="field-group full" style={{ marginTop: 10 }}>
        <label>Adicionais</label>
        <div className="row" style={{ gap: 18, paddingTop: 6, flexWrap: "wrap" }}>
          <label
            className={`switch ${f.pequenosReparos ? "on" : ""}`}
            onClick={() => up("pequenosReparos", !f.pequenosReparos)}
          >
            <span className="track"></span>
            <span className="label">Pequenos reparos</span>
          </label>
        </div>
        <div className="wizard-grid cols-3" style={{ marginTop: 8 }}>
          <div className="field-group">
            <label>Vidros · faróis · retrovisores</label>
            <select
              className="input"
              value={f.vidros}
              onChange={(e) => up("vidros", e.target.value)}
            >
              {NIVEL_COBERTURA_OPCOES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Assistência 24h</label>
            <select
              className="input"
              value={f.assist24}
              onChange={(e) => up("assist24", e.target.value)}
            >
              {NIVEL_COBERTURA_OPCOES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label>Carro reserva</label>
            <select
              className="input"
              value={f.carroReserva}
              onChange={(e) => up("carroReserva", e.target.value)}
            >
              {NIVEL_COBERTURA_OPCOES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
