import { maskCpfCnpj } from "@/lib/masks";
import { maskCep } from "@/components/venda/novo-lead/masks";
import {
  TIPO_GARAGEM,
  RELACAO_COM_PROPRIETARIO,
  ESTADO_CIVIL,
  CONDUTOR_RELACAO,
  TIPO_RESIDENCIA,
  TIPO_ATIVIDADE_EMPRESA,
  RAMO_ATIVIDADE,
} from "@/components/venda/novo-lead/enumsPerfil";
import {
  CONDUTORES_QUE_UTILIZAM,
  TIPOS_USO_COM_CONDUTORES,
} from "@/components/venda/novo-lead/enumsQuiver";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
};

export function StepPerfil({ f, up, erros }: Props) {
  const isPessoaFisica = f.proprietarioTipoPessoa === "Física";
  const naoParticular = !!f.tipoUso && f.tipoUso !== "Particular";
  const precisaCondutores = (TIPOS_USO_COM_CONDUTORES as readonly string[]).includes(f.tipoUso);

  function addJovem() {
    up("jovens18a25Detalhes", [...f.jovens18a25Detalhes, { nome: "", idade: "", parentesco: "" }]);
  }
  function updJovem(i: number, patch: Partial<Form["jovens18a25Detalhes"][number]>) {
    up(
      "jovens18a25Detalhes",
      f.jovens18a25Detalhes.map((j, idx) => (idx === i ? { ...j, ...patch } : j)),
    );
  }
  function removeJovem(i: number) {
    up(
      "jovens18a25Detalhes",
      f.jovens18a25Detalhes.filter((_, idx) => idx !== i),
    );
  }

  return (
    <>
      <h2>Perfil</h2>
      <div className="sub">Garagem, proprietário e principal condutor.</div>

      <div className="wizard-grid">
        <div className="field-group full">
          <label>O segurado guarda o veículo em garagem?</label>
          <select
            className="input"
            value={f.tipoGaragem}
            onChange={(e) => up("tipoGaragem", e.target.value)}
          >
            {TIPO_GARAGEM.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sec-title">Proprietário do veículo</div>
      <label
        className={`switch ${f.segProprietario ? "on" : ""}`}
        onClick={() => up("segProprietario", !f.segProprietario)}
      >
        <span className="track"></span>
        <span className="label">O segurado é o proprietário do veículo</span>
      </label>
      {!f.segProprietario && (
        <div style={{ marginTop: 10 }}>
          <div className="wizard-grid">
            <div className="field-group">
              <label>
                Relação do segurado com o proprietário<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.relacaoComProprietario}
                onChange={(e) => up("relacaoComProprietario", e.target.value)}
              >
                <option value="">Selecione</option>
                {RELACAO_COM_PROPRIETARIO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Tipo de pessoa do proprietário<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.proprietarioTipoPessoa}
                onChange={(e) =>
                  up("proprietarioTipoPessoa", e.target.value as "Física" | "Jurídica")
                }
              >
                <option>Física</option>
                <option>Jurídica</option>
              </select>
            </div>
            {isPessoaFisica ? (
              <div className="field-group">
                <label>
                  CPF do proprietário<span className="req">*</span>
                </label>
                <input
                  className="input"
                  value={f.proprietarioCpf}
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(e) => up("proprietarioCpf", maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                />
                {erros.proprietarioCpf && (
                  <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                    {erros.proprietarioCpf}
                  </span>
                )}
              </div>
            ) : (
              <div className="field-group">
                <label>
                  CNPJ do proprietário<span className="req">*</span>
                </label>
                <input
                  className="input"
                  value={f.proprietarioCnpj}
                  inputMode="numeric"
                  maxLength={18}
                  onChange={(e) => up("proprietarioCnpj", maskCpfCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                />
                {erros.proprietarioCnpj && (
                  <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                    {erros.proprietarioCnpj}
                  </span>
                )}
              </div>
            )}
            <div className="field-group full">
              <label>
                Nome do proprietário<span className="req">*</span>
              </label>
              <input
                className="input"
                value={f.proprietarioNome}
                maxLength={150}
                onChange={(e) => up("proprietarioNome", e.target.value)}
              />
            </div>
            {isPessoaFisica && (
              <>
                <div className="field-group full">
                  <label>Nome social do proprietário</label>
                  <input
                    className="input"
                    value={f.proprietarioNomeSocial}
                    maxLength={150}
                    onChange={(e) => up("proprietarioNomeSocial", e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="field-group">
                  <label>
                    Sexo do proprietário<span className="req">*</span>
                  </label>
                  <select
                    className="input"
                    value={f.proprietarioSexo}
                    onChange={(e) => up("proprietarioSexo", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option>Masculino</option>
                    <option>Feminino</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>
                    Data de nascimento do proprietário<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={f.proprietarioNascimento}
                    onChange={(e) => up("proprietarioNascimento", e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>
                    Estado civil do proprietário<span className="req">*</span>
                  </label>
                  <select
                    className="input"
                    value={f.proprietarioEstadoCivil}
                    onChange={(e) => up("proprietarioEstadoCivil", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {ESTADO_CIVIL.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="sec-title">Principal condutor</div>
      <div className="wizard-grid">
        <div className="field-group full">
          <label>Condutor principal é o próprio segurado?</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="radio"
                name="cond"
                checked={f.condutorMesmo === "sim"}
                onChange={() => up("condutorMesmo", "sim")}
              />{" "}
              Sim
            </label>
            <label>
              <input
                type="radio"
                name="cond"
                checked={f.condutorMesmo === "nao"}
                onChange={() => up("condutorMesmo", "nao")}
              />{" "}
              Não
            </label>
          </div>
        </div>
        {f.condutorMesmo === "nao" && (
          <>
            <div className="field-group">
              <label>Relação do condutor com o segurado</label>
              <select
                className="input"
                value={f.condRelacao}
                onChange={(e) => up("condRelacao", e.target.value)}
              >
                <option value="">Selecione</option>
                {CONDUTOR_RELACAO.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>CPF do condutor</label>
              <input
                className="input"
                value={f.condCpf}
                inputMode="numeric"
                maxLength={14}
                onChange={(e) => up("condCpf", maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
              />
              {erros.condCpf && (
                <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                  {erros.condCpf}
                </span>
              )}
            </div>
            <div className="field-group full">
              <label>Nome do condutor</label>
              <input
                className="input"
                value={f.condNome}
                maxLength={150}
                onChange={(e) => up("condNome", e.target.value)}
              />
              {erros.condNome && (
                <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                  {erros.condNome}
                </span>
              )}
            </div>
            <div className="field-group full">
              <label>Nome social do condutor</label>
              <input
                className="input"
                value={f.condNomeSocial}
                maxLength={150}
                onChange={(e) => up("condNomeSocial", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="field-group">
              <label>Sexo</label>
              <select
                className="input"
                value={f.condSexo}
                onChange={(e) => up("condSexo", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Masculino</option>
                <option>Feminino</option>
              </select>
            </div>
            <div className="field-group">
              <label>Nascimento</label>
              <input
                className="input"
                type="date"
                value={f.condNasc}
                onChange={(e) => up("condNasc", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Estado civil</label>
              <select
                className="input"
                value={f.condEstadoCivil}
                onChange={(e) => up("condEstadoCivil", e.target.value)}
              >
                <option value="">Selecione</option>
                {ESTADO_CIVIL.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Tempo de habilitação (anos)</label>
              <input
                className="input"
                value={f.condTempoHabilitacao}
                inputMode="numeric"
                maxLength={2}
                onChange={(e) => up("condTempoHabilitacao", e.target.value)}
              />
            </div>
          </>
        )}
        <div className="field-group">
          <label>Profissão</label>
          <input
            className="input"
            value={f.profissao}
            maxLength={150}
            onChange={(e) => up("profissao", e.target.value)}
          />
          {erros.profissao && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.profissao}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>CEP de pernoite</label>
          <input
            className="input"
            value={f.cepPernoite}
            inputMode="numeric"
            maxLength={9}
            onChange={(e) => up("cepPernoite", maskCep(e.target.value))}
            placeholder="00000-000"
          />
          {erros.cepPernoite && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cepPernoite}
            </span>
          )}
        </div>
      </div>

      <div className="wizard-grid" style={{ marginTop: 16 }}>
        <div className="field-group full">
          <label>
            Tipo de residência do principal condutor<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.tipoResidencia}
            onChange={(e) => up("tipoResidencia", e.target.value)}
          >
            {TIPO_RESIDENCIA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {naoParticular && (
        <>
          <div className="sec-title">
            Atividade (uso não-particular){" "}
            <span className="lbl-soft">obrigatório para {f.tipoUso}</span>
          </div>
          <div className="wizard-grid">
            <div className="field-group">
              <label>
                Tipo de atividade da empresa<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.tipoAtividadeEmpresa}
                onChange={(e) => up("tipoAtividadeEmpresa", e.target.value)}
              >
                {TIPO_ATIVIDADE_EMPRESA.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Ramo de atividade comercial / profissional<span className="req">*</span>
              </label>
              <select
                className="input"
                value={f.ramoAtividade}
                onChange={(e) => up("ramoAtividade", e.target.value)}
              >
                <option value="">Selecione</option>
                {RAMO_ATIVIDADE.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>
                Profissão do principal condutor<span className="req">*</span>
              </label>
              <input
                className="input"
                value={f.profissaoPrincipalCondutor}
                maxLength={150}
                onChange={(e) => up("profissaoPrincipalCondutor", e.target.value)}
                placeholder="Ex.: Motorista de aplicativo"
              />
            </div>
            {precisaCondutores && (
              <div className="field-group full">
                <label>
                  Quantos condutores utilizam o veículo?<span className="req">*</span>
                </label>
                <select
                  className="input"
                  value={f.condutoresQueUtilizam}
                  onChange={(e) => up("condutoresQueUtilizam", e.target.value)}
                >
                  <option value="">Selecione</option>
                  {CONDUTORES_QUE_UTILIZAM.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <label
          className={`switch ${f.seguroCorretorProximo === "sim" ? "on" : ""}`}
          onClick={() =>
            up("seguroCorretorProximo", f.seguroCorretorProximo === "sim" ? "nao" : "sim")
          }
        >
          <span className="track"></span>
          <span className="label">Seguro do corretor ou pessoa com relacionamento próximo</span>
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <label
          className={`switch ${f.jovens1825 === "sim" ? "on" : ""}`}
          onClick={() => up("jovens1825", f.jovens1825 === "sim" ? "nao" : "sim")}
        >
          <span className="track"></span>
          <span className="label">
            Existem pessoas na faixa etária de 17 a 25 anos, que residem ou não com o condutor?
          </span>
        </label>
      </div>
      {f.jovens1825 === "sim" && (
        <div style={{ marginTop: 10 }}>
          <div
            className="card"
            style={{
              padding: "14px 16px",
              background: "var(--cream-soft)",
              borderRadius: 12,
              boxShadow: "none",
              border: "1px solid var(--border-soft)",
            }}
          >
            <strong style={{ color: "var(--slate)", fontSize: 13 }}>
              Jovens condutores (17–25 anos)
            </strong>
            {f.jovens18a25Detalhes.map((j, i) => (
              <div className="wizard-grid cols-3" style={{ marginTop: 10 }} key={i}>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Nome</label>
                  <input
                    className="input"
                    value={j.nome}
                    onChange={(e) => updJovem(i, { nome: e.target.value })}
                    placeholder="Nome do condutor"
                  />
                </div>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Idade</label>
                  <input
                    className="input"
                    value={j.idade}
                    inputMode="numeric"
                    maxLength={2}
                    onChange={(e) => updJovem(i, { idade: e.target.value })}
                    placeholder="19"
                  />
                </div>
                <div
                  className="field-group"
                  style={{ margin: 0, display: "flex", gap: 8, alignItems: "flex-end" }}
                >
                  <div style={{ flex: 1 }}>
                    <label>Parentesco / reside?</label>
                    <select
                      className="input"
                      value={j.parentesco}
                      onChange={(e) => updJovem(i, { parentesco: e.target.value })}
                    >
                      <option>Filho(a) — reside</option>
                      <option>Filho(a) — não reside</option>
                      <option>Outro</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeJovem(i)}
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 10 }}
              onClick={addJovem}
            >
              + Adicionar condutor jovem
            </button>
          </div>
        </div>
      )}
    </>
  );
}
