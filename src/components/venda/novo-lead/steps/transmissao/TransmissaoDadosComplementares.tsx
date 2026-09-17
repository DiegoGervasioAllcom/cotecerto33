import { useMemo, useState } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import {
  dadosComplementaresTransmissaoSchema,
  type DadosComplementaresTransmissao,
} from "../TransmissaoDadosComplementares.schema";

export type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

type Props = {
  f: Form;
  resultado: ResultadoCalculo;
  formaPagamento: string;
  parcelas: string;
  subPassoLabel: string;
  onVoltar: () => void;
  onConfirmar: (dados: DadosComplementaresTransmissao) => void;
};

type Erros = Partial<Record<keyof DadosComplementaresTransmissao, string>>;

export function TransmissaoDadosComplementares({
  f,
  resultado,
  formaPagamento,
  parcelas,
  subPassoLabel,
  onVoltar,
  onConfirmar,
}: Props) {
  const [dados, setDados] = useState<DadosComplementaresTransmissao>({
    rg: "",
    dataEmissaoRg: "",
    orgaoEmissorRg: "",
    cepResidencial: f.cep,
    numeroEndereco: f.numero,
    mesmoEnderecoCorrespondencia: true,
    renavam: f.renavam.replace(/\D/g, ""),
    corVeiculo: f.cor,
    diaVencimentoDemaisParcelas: "",
    desejaReceberPropostaPorEmail: "Não",
  });
  const [erros, setErros] = useState<Erros>({});
  const endereco = useMemo(
    () =>
      [f.logradouro, f.bairro, f.cidade && f.uf ? `${f.cidade}/${f.uf}` : f.cidade || f.uf]
        .filter(Boolean)
        .join(" · "),
    [f.logradouro, f.bairro, f.cidade, f.uf],
  );

  function up<K extends keyof DadosComplementaresTransmissao>(
    key: K,
    value: DadosComplementaresTransmissao[K],
  ) {
    setDados((atual) => ({ ...atual, [key]: value }));
    setErros((atual) => ({ ...atual, [key]: undefined }));
  }

  function confirmar() {
    const validacao = dadosComplementaresTransmissaoSchema.safeParse(dados);
    if (!validacao.success) {
      const proximos: Erros = {};
      for (const issue of validacao.error.issues) {
        const key = issue.path[0] as keyof DadosComplementaresTransmissao;
        if (!proximos[key]) proximos[key] = issue.message;
      }
      setErros(proximos);
      return;
    }
    onConfirmar(validacao.data);
  }

  const field = (
    key: keyof DadosComplementaresTransmissao,
    label: string,
    placeholder = "",
    inputMode?: "numeric",
  ) => (
    <div className="field-group">
      <label htmlFor={`transmissao-${key}`}>{label}</label>
      <input
        id={`transmissao-${key}`}
        className="input"
        value={String(dados[key])}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(erros[key])}
        onChange={(e) => up(key, e.target.value as never)}
      />
      {erros[key] && (
        <span className="small" style={{ color: "var(--alert)" }}>
          {erros[key]}
        </span>
      )}
    </div>
  );

  return (
    <>
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dados complementares</h2>
          <div className="sub" style={{ margin: "4px 0 0" }}>
            Confira apenas os dados exigidos para transmitir a proposta à seguradora.
          </div>
        </div>
        <span className="spacer" />
        <span className="chip chip-yellow">{subPassoLabel}</span>
      </div>

      <div className="acc-sol" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <span className="muted small">Cotação</span>
            <br />
            <strong>{f.nome || "—"}</strong>
          </div>
          <div>
            <span className="muted small">Seguradora</span>
            <br />
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <SeguradoraBadge nome={resultado.seguradora} tam="xs" />
              {resultado.seguradora}
            </strong>
          </div>
          <div>
            <span className="muted small">Pagamento</span>
            <br />
            <strong>
              {formaPagamento} · {parcelas || "À vista"}
            </strong>
          </div>
          <div>
            <span className="muted small">Vigência</span>
            <br />
            <strong>
              {f.vigIni || "—"} a {f.vigFim || "—"}
            </strong>
          </div>
          <div>
            <span className="muted small">Modalidade</span>
            <br />
            <strong>
              {f.modalidade || "—"}
              {f.percentualAjuste ? ` · ${f.percentualAjuste}% FIPE` : ""}
            </strong>
          </div>
        </div>
      </div>

      <div className="acc-sec-t">Dados básicos do segurado</div>
      <div className="wizard-grid cols-3">
        <div className="field-group">
          <label>CPF</label>
          <input className="input" value={f.cpf} disabled />
        </div>
        <div className="field-group">
          <label>Nome do segurado</label>
          <input className="input" value={f.nome} disabled />
        </div>
        {field("rg", "RG", "00.000.000-0")}
        {field("dataEmissaoRg", "Data de emissão", "dd/mm/aaaa", "numeric")}
        {field("orgaoEmissorRg", "Órgão emissor", "SSP")}
        <div className="field-group">
          <label>E-mail</label>
          <input className="input" value={f.email} disabled />
        </div>
      </div>

      <div className="acc-sec-t">Endereço residencial</div>
      <div className="wizard-grid cols-3">
        {field("cepResidencial", "CEP", "00000-000", "numeric")}
        <div className="field-group" style={{ gridColumn: "span 2" }}>
          <label>Endereço</label>
          <input className="input" value={endereco} disabled />
        </div>
        {field("numeroEndereco", "Número")}
      </div>
      <div className="acc-pills" style={{ margin: "10px 0 20px" }}>
        <button
          type="button"
          className={"acc-pill" + (dados.mesmoEnderecoCorrespondencia ? " on" : "")}
          onClick={() =>
            up("mesmoEnderecoCorrespondencia", !dados.mesmoEnderecoCorrespondencia as true)
          }
        >
          <svg width="13" height="13" style={{ marginRight: 4, verticalAlign: -2 }}>
            <use href={dados.mesmoEnderecoCorrespondencia ? "#i-check" : "#i-x"} />
          </svg>
          Endereço de correspondência é o mesmo
        </button>
      </div>
      {erros.mesmoEnderecoCorrespondencia && (
        <div className="small" style={{ color: "var(--alert)" }}>
          {erros.mesmoEnderecoCorrespondencia}
        </div>
      )}

      <div className="acc-sec-t">Dados complementares do veículo</div>
      <div className="wizard-grid cols-3">
        <div className="field-group" style={{ gridColumn: "span 3" }}>
          <label>Modelo</label>
          <input
            className="input"
            value={[f.marca, f.modelo, f.anoModelo].filter(Boolean).join(" ")}
            disabled
          />
        </div>
        <div className="field-group">
          <label>Placa</label>
          <input className="input" value={f.placa} disabled />
        </div>
        {field("renavam", "Renavam", "11 dígitos", "numeric")}
        {field("corVeiculo", "Cor", "Ex.: Branco")}
      </div>

      <div className="acc-sec-t">Transmissão e envio</div>
      <div className="wizard-grid cols-3">
        <div className="field-group">
          <label htmlFor="transmissao-dia-vencimento">Dia de vencimento das demais parcelas</label>
          <select
            id="transmissao-dia-vencimento"
            className="input"
            value={dados.diaVencimentoDemaisParcelas}
            onChange={(e) => up("diaVencimentoDemaisParcelas", e.target.value)}
          >
            <option value="">Selecione</option>
            {Array.from({ length: 30 }, (_, i) => String(i + 1)).map((dia) => (
              <option key={dia}>{dia}</option>
            ))}
          </select>
          {erros.diaVencimentoDemaisParcelas && (
            <span className="small" style={{ color: "var(--alert)" }}>
              {erros.diaVencimentoDemaisParcelas}
            </span>
          )}
        </div>
        <div className="field-group">
          <label htmlFor="transmissao-email">Receber proposta/boleto por e-mail?</label>
          <select
            id="transmissao-email"
            className="input"
            value={dados.desejaReceberPropostaPorEmail}
            onChange={(e) => up("desejaReceberPropostaPorEmail", e.target.value as "Sim" | "Não")}
          >
            <option>Não</option>
            <option>Sim</option>
          </select>
        </div>
      </div>

      <div className="wizard-foot">
        <button className="btn btn-ghost" type="button" onClick={onVoltar}>
          Voltar ao cálculo
        </button>
        <span className="spacer" />
        <button className="btn btn-yellow" type="button" onClick={confirmar}>
          Continuar
        </button>
      </div>
    </>
  );
}
