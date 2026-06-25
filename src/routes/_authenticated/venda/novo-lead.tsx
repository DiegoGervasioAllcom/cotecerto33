import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  component: Page,
});

// ---------- máscaras ----------
function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}
function maskCpfCnpj(raw: string) {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function maskCel(raw: string) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
function maskFixo(raw: string) {
  const d = onlyDigits(raw).slice(0, 10);
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
}
function maskCep(raw: string) {
  const d = onlyDigits(raw).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

type Form = {
  cpf: string;
  pessoa: string;
  nome: string;
  nomeSocial: string;
  nasc: string;
  sexo: string;
  estadoCivil: string;
  celular: string;
  telRes: string;
  email: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  sms: "sim" | "nao";
};

const STEPS = ["Segurado", "Seguro", "Veículo", "Perfil", "Coberturas", "Cálculo"];

function Page() {
  const [step, setStep] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [f, setF] = useState<Form>({
    cpf: "", pessoa: "Física", nome: "", nomeSocial: "", nasc: "", sexo: "",
    estadoCivil: "", celular: "", telRes: "", email: "",
    cep: "", logradouro: "", bairro: "", cidade: "", uf: "", sms: "nao",
  });
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  async function lookupCep(cep: string) {
    const d = onlyDigits(cep);
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setF((p) => ({
          ...p,
          logradouro: j.logradouro || "",
          bairro: j.bairro || "",
          cidade: j.localidade || "",
          uf: j.uf || "",
        }));
      }
    } catch { /* noop */ } finally {
      setCepLoading(false);
    }
  }

  return (
    <AppShell title="Novo lead">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Nova cotação <span className="chip chip-slate" style={{ marginLeft: 6, verticalAlign: "middle" }}>Novo</span></h1>
          <div className="sub">Multi cálculo · Padrão Automóvel · espelha o fluxo de cotação do Quiver com a cara da Supper.</div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-message" /></svg> WhatsApp</button>
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-history" /></svg> Histórico</button>
          <button className="btn btn-ghost"><svg width="14" height="14"><use href="#i-flag" /></svg> Classificar perda</button>
        </div>
      </div>

      <div className="stepper">
        {STEPS.map((label, i) => (
          <span key={label} style={{ display: "contents" }}>
            <div className={"step " + (i === step ? "current" : "")} onClick={() => setStep(i)} style={{ cursor: "pointer" }}>
              <div className="n">{i + 1}</div>
              <div className="lbl">{label}</div>
            </div>
            {i < STEPS.length - 1 && <div className="line " />}
          </span>
        ))}
        <span className="ready "><svg width="12" height="12"><use href="#i-check" /></svg> Pronto para cotar</span>
      </div>

      <div className="lead-shell">
        <div className="wizard-card">
          {step === 0 ? (
            <>
              <h2>Dados do Segurado</h2>
              <div className="sub">Digite o CPF/CNPJ que o sistema busca o cadastro. Se for novo, preenche o resto manualmente.</div>
              <div className="wizard-grid">
                <div className="field-group">
                  <label>CPF ou CNPJ<span className="req">*</span></label>
                  <input className="input" value={f.cpf} inputMode="numeric"
                    onChange={(e) => up("cpf", maskCpfCnpj(e.target.value))}
                    placeholder="000.000.000-00" />
                </div>
                <div className="field-group">
                  <label>Pessoa</label>
                  <select className="input" value={f.pessoa} onChange={(e) => up("pessoa", e.target.value)}>
                    <option>Física</option><option>Jurídica</option>
                  </select>
                </div>
                <div className="field-group full">
                  <label>Nome<span className="req">*</span></label>
                  <input className="input" value={f.nome} onChange={(e) => up("nome", e.target.value)} placeholder="Aparece automaticamente após CPF" />
                </div>
                <div className="field-group full">
                  <label>Nome social</label>
                  <input className="input" value={f.nomeSocial} onChange={(e) => up("nomeSocial", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="field-group">
                  <label>Data de nascimento<span className="req">*</span></label>
                  <input className="input" type="date" value={f.nasc} onChange={(e) => up("nasc", e.target.value)} />
                </div>
                <div className="field-group">
                  <label>Sexo<span className="req">*</span></label>
                  <div className="row" style={{ gap: 8, paddingTop: 4 }}>
                    {["Masculino", "Feminino"].map((s) => (
                      <span key={s}
                        className={"chip " + (f.sexo === s ? "chip-slate" : "chip-outline")}
                        style={{ cursor: "pointer" }}
                        onClick={() => up("sexo", s)}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Estado civil<span className="req">*</span></label>
                  <select className="input" value={f.estadoCivil} onChange={(e) => up("estadoCivil", e.target.value)}>
                    <option value="">Selecione</option>
                    <option>Casado(a)</option><option>Solteiro(a)</option><option>Viúvo(a)</option>
                    <option>Divorciado(a)</option><option>Separado(a)</option><option>União estável</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Telefone celular<span className="req">*</span> <span className="hint">WhatsApp</span></label>
                  <input className="input" value={f.celular} inputMode="numeric"
                    onChange={(e) => up("celular", maskCel(e.target.value))}
                    placeholder="(00) 00000-0000" />
                </div>
                <div className="field-group">
                  <label>Telefone residencial</label>
                  <input className="input" value={f.telRes} inputMode="numeric"
                    onChange={(e) => up("telRes", maskFixo(e.target.value))}
                    placeholder="(00) 0000-0000" />
                </div>
                <div className="field-group full">
                  <label>E-mail</label>
                  <input className="input" type="email" value={f.email}
                    onChange={(e) => up("email", e.target.value)} placeholder="cliente@email.com" />
                </div>
                <div className="field-group">
                  <label>CEP residencial<span className="req">*</span></label>
                  <input className="input" value={f.cep} inputMode="numeric"
                    onChange={(e) => {
                      const v = maskCep(e.target.value);
                      up("cep", v);
                      if (onlyDigits(v).length === 8) lookupCep(v);
                    }}
                    onBlur={() => lookupCep(f.cep)}
                    placeholder="00000-000" />
                  {cepLoading && <span className="hint">Buscando CEP…</span>}
                </div>
                <div className="field-group">
                  <label>Logradouro</label>
                  <input className="input" value={f.logradouro} onChange={(e) => up("logradouro", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>Bairro</label>
                  <input className="input" value={f.bairro} onChange={(e) => up("bairro", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>Cidade</label>
                  <input className="input" value={f.cidade} onChange={(e) => up("cidade", e.target.value)} placeholder="Preenche via CEP" />
                </div>
                <div className="field-group">
                  <label>UF</label>
                  <input className="input" value={f.uf} maxLength={2}
                    onChange={(e) => up("uf", e.target.value.toUpperCase())}
                    placeholder="UF" />
                </div>
                <div className="field-group">
                  <label>Autorizo o envio de informações por SMS</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label><input type="radio" name="sms" checked={f.sms === "sim"} onChange={() => up("sms", "sim")} /> Sim</label>
                    <label><input type="radio" name="sms" checked={f.sms === "nao"} onChange={() => up("sms", "nao")} /> Não</label>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2>{STEPS[step]}</h2>
              <div className="sub">Etapa em construção neste protótipo navegável.</div>
            </>
          )}

          <div className="wizard-foot">
            <button className="btn btn-ghost" disabled={step === 0}
              style={step === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <svg width="14" height="14"><use href="#i-chevron-left" /></svg> Voltar
            </button>
            <span className="spacer" />
            <span className="muted small">Passo {step + 1} de {STEPS.length}</span>
            <button className="btn btn-slate" disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Próximo <svg width="14" height="14"><use href="#i-chevron-right" /></svg>
            </button>
          </div>
        </div>

        <div className="resumo">
          <div className="head"><svg width="16" height="16"><use href="#i-clock" /></svg><h3>Resumo da cotação</h3></div>
          <div className="body">
            {f.nome || f.cpf || f.celular ? (
              <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                {f.nome && <div><b>Nome:</b> {f.nome}</div>}
                {f.cpf && <div><b>{f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> {f.cpf}</div>}
                {f.nasc && <div><b>Nascimento:</b> {f.nasc}</div>}
                {f.sexo && <div><b>Sexo:</b> {f.sexo}</div>}
                {f.estadoCivil && <div><b>Estado civil:</b> {f.estadoCivil}</div>}
                {f.celular && <div><b>Celular:</b> {f.celular}</div>}
                {f.email && <div><b>E-mail:</b> {f.email}</div>}
                {(f.cidade || f.uf) && <div><b>Cidade/UF:</b> {f.cidade}{f.uf ? `/${f.uf}` : ""}</div>}
              </div>
            ) : (
              <div className="empty">Conforme você preenche, o resumo aparece aqui.<br />Clique nos valores para editar inline.</div>
            )}
          </div>
          <div className="insurers-row">
            <span className="ins-chip"><svg width="12" height="12"><use href="#i-shield" /></svg> 5 seguradoras no cálculo</span>
          </div>
          <div className="footer">
            <button className="btn btn-yellow" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
              <svg width="14" height="14"><use href="#i-bolt" /></svg> Calcular
            </button>
            <button className="btn btn-ghost btn-sm">
              <svg width="13" height="13"><use href="#i-download" /></svg> Salvar rascunho
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
