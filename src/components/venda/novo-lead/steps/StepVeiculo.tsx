import { onlyDigits } from "@/lib/masks";
import { maskPlaca, maskAno, maskKm, maskCep } from "@/components/venda/novo-lead/masks";
import { UsoVeiculoFields } from "@/components/venda/novo-lead/steps/veiculo/UsoVeiculoFields";
import { DadosComplementaresFold } from "@/components/venda/novo-lead/steps/veiculo/DadosComplementaresFold";
import { AcessoriosFold } from "@/components/venda/novo-lead/steps/veiculo/AcessoriosFold";
import type { Form } from "@/components/venda/novo-lead/types";
import type { StatusPlaca } from "@/components/venda/novo-lead/hooks/useConsultaPlaca";
import type { PrecificadorFipe } from "@/lib/placa-decodificador";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
  marcas: { codigo: string; nome: string }[];
  modelos: { codigo: number; nome: string }[];
  fipeValor: string;
  /** Integração de placa (useConsultaPlaca). */
  placaConsultando: boolean;
  placaStatus: StatusPlaca | null;
  placaVersoes: PrecificadorFipe[];
  onConsultarPlaca: (placa: string, opts?: { forcar?: boolean }) => void;
  onEscolherVersao: (v: PrecificadorFipe) => void;
};

const brl = (v: number | null) =>
  v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CORES_STATUS: Record<StatusPlaca["tipo"], string> = {
  ok: "var(--ok)",
  aviso: "var(--info)",
  erro: "var(--alert)",
};

export function StepVeiculo({
  f,
  up,
  erros,
  marcas,
  modelos,
  fipeValor,
  placaConsultando,
  placaStatus,
  placaVersoes,
  onConsultarPlaca,
  onEscolherVersao,
}: Props) {
  return (
    <>
      <h2>Dados do Veículo</h2>
      <div className="sub">
        Marca / Modelo via Tabela FIPE. Valor sugerido aparece automaticamente.
      </div>
      <div className="wizard-grid">
        <div className="field-group">
          <label>Placa</label>
          <input
            className="input"
            value={f.placa}
            maxLength={8}
            onChange={(e) => up("placa", maskPlaca(e.target.value))}
            // A consulta dispara ao sair do campo, com a placa completa. O
            // hook ignora repetição da mesma placa, então voltar ao campo
            // sem editar não gasta uma nova consulta.
            onBlur={(e) => onConsultarPlaca(e.target.value)}
            placeholder="AAA0A00"
          />
          {erros.placa && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.placa}
            </span>
          )}
          {placaConsultando && (
            <span className="hint" style={{ display: "block" }}>
              Consultando placa…
            </span>
          )}
          {!placaConsultando && placaStatus && (
            <span
              className="hint"
              style={{ color: CORES_STATUS[placaStatus.tipo], display: "block" }}
            >
              {placaStatus.texto}{" "}
              <button
                type="button"
                className="btn-link"
                // Sem o padding do .btn-link o link flui junto da mensagem em
                // vez de descer para uma linha própria e indentada.
                style={{ padding: 0, font: "inherit", textDecoration: "underline" }}
                onClick={() => onConsultarPlaca(f.placa, { forcar: true })}
              >
                Consultar novamente
              </button>
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Chassi</label>
          <input
            className="input"
            value={f.chassi}
            maxLength={17}
            onChange={(e) => up("chassi", e.target.value.toUpperCase())}
            placeholder="17 caracteres"
          />
          {erros.chassi && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.chassi}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Renavam</label>
          <input
            className="input"
            value={f.renavam}
            inputMode="numeric"
            maxLength={11}
            onChange={(e) => up("renavam", onlyDigits(e.target.value).slice(0, 11))}
          />
        </div>
        <div className="field-group">
          <label>Zero KM</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.zeroKm}
                onChange={(e) => up("zeroKm", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        {f.zeroKm && (
          <>
            <div className="field-group">
              <label>Data de saída da concessionária *</label>
              <input
                className="input"
                type="date"
                value={f.dataSaidaConcessionaria}
                onChange={(e) => up("dataSaidaConcessionaria", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Odômetro (km) *</label>
              <input
                className="input"
                inputMode="numeric"
                value={f.odometro}
                onChange={(e) => up("odometro", onlyDigits(e.target.value))}
              />
            </div>
          </>
        )}
        {placaVersoes.length > 1 && (
          <div className="field-group full">
            <label>Versão do veículo (consulta da placa)</label>
            <div className="sub">
              A placa corresponde a mais de uma versão na FIPE. Escolha a correta para preencher
              marca, modelo e valor.
            </div>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, paddingTop: 6 }}>
              {placaVersoes.map((v) => (
                <button
                  key={v.codigo || v.modelo}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onEscolherVersao(v)}
                >
                  {v.modelo}
                  {v.valor != null ? ` · ${brl(v.valor)}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field-group">
          <label>
            Marca<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.marca}
            onChange={(e) => {
              up("marca", e.target.value);
              up("modelo", "");
            }}
          >
            <option value="">Selecione</option>
            {marcas.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group full">
          <label>
            Modelo<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.modelo}
            onChange={(e) => up("modelo", e.target.value)}
            disabled={!f.marca}
          >
            <option value="">{f.marca ? "Selecione" : "Selecione a marca antes"}</option>
            {modelos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>
            Ano modelo<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.anoModelo}
            inputMode="numeric"
            onChange={(e) => up("anoModelo", maskAno(e.target.value))}
            placeholder="2024"
          />
        </div>
        <div className="field-group">
          <label>Ano fabricação</label>
          <input
            className="input"
            value={f.anoFab}
            inputMode="numeric"
            onChange={(e) => up("anoFab", maskAno(e.target.value))}
            placeholder="2023"
          />
        </div>
        <div className="field-group">
          <label>Combustível</label>
          <select
            className="input"
            aria-label="Combustível"
            value={f.combustivel}
            onChange={(e) => up("combustivel", e.target.value)}
          >
            <option>Flex</option>
            <option>Gasolina</option>
            <option>Álcool</option>
            <option>Diesel</option>
            <option>Elétrico</option>
          </select>
        </div>
        <div className="field-group">
          <label>Cor</label>
          <input
            className="input"
            value={f.cor}
            maxLength={50}
            onChange={(e) => up("cor", e.target.value)}
          />
          {erros.cor && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cor}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Tipo de Câmbio</label>
          <select
            className="input"
            aria-label="Tipo de Câmbio"
            value={f.tipoCambio}
            onChange={(e) => up("tipoCambio", e.target.value)}
          >
            <option value="">Deixar o portal inferir (recomendado)</option>
            <option value="Manual">Manual</option>
            <option value="Automático">Automático</option>
            <option value="Semiautomático">Semiautomático</option>
          </select>
          {erros.tipoCambio && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.tipoCambio}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Valor FIPE</label>
          <input
            className="input"
            value={fipeValor}
            readOnly
            style={{ background: "var(--offwhite)" }}
            placeholder="Preenche via FIPE"
          />
        </div>
        <div className="field-group">
          <label>Blindado</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.blindado}
                onChange={(e) => up("blindado", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>Alienado</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.alienado}
                onChange={(e) => up("alienado", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        {f.alienado && (
          <div className="field-group">
            <label>Banco / Financeira</label>
            <input
              className="input"
              value={f.banco}
              maxLength={150}
              onChange={(e) => up("banco", e.target.value)}
            />
            {erros.banco && (
              <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                {erros.banco}
              </span>
            )}
          </div>
        )}
        <div className="field-group">
          <label>Uso comercial</label>
          <select
            className="input"
            value={f.usoComercial}
            onChange={(e) => up("usoComercial", e.target.value)}
          >
            <option>Não</option>
            <option>Sim</option>
          </select>
        </div>
        <div className="field-group">
          <label>KM mensal</label>
          <input
            className="input"
            value={f.kmMensal}
            inputMode="numeric"
            onChange={(e) => up("kmMensal", maskKm(e.target.value))}
            placeholder="1.000 km"
          />
        </div>
        <div className="field-group">
          <label>CEP de circulação</label>
          <input
            className="input"
            value={f.cepCirculacao}
            inputMode="numeric"
            onChange={(e) => up("cepCirculacao", maskCep(e.target.value))}
            placeholder="00000-000"
          />
        </div>
        <div className="field-group">
          <label>Nº de passageiros</label>
          <input
            className="input"
            value={f.numPassageiros}
            inputMode="numeric"
            maxLength={2}
            onChange={(e) => up("numPassageiros", onlyDigits(e.target.value).slice(0, 2))}
          />
        </div>
      </div>

      <UsoVeiculoFields f={f} up={up} />
      <DadosComplementaresFold f={f} up={up} />
      <AcessoriosFold f={f} up={up} />
    </>
  );
}
