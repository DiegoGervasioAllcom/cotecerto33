import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { printHtml, escapeHtml, fmtBRL } from "@/lib/print";
import { onlyDigits, maskCpfCnpj } from "@/lib/masks";
import {
  maskCel,
  maskFixo,
  maskCep,
  maskPlaca,
  maskAno,
  maskBRL,
  maskKm,
} from "@/components/venda/novo-lead/masks";
import {
  STEPS,
  SEGURADORAS,
  type Form,
  type BonusFieldKey,
} from "@/components/venda/novo-lead/types";
import { useClassificarPerda } from "@/components/venda/novo-lead/hooks/useClassificarPerda";
import { useCepLookup } from "@/components/venda/novo-lead/hooks/useCepLookup";
import { useFipe } from "@/components/venda/novo-lead/hooks/useFipe";
import { useValidacaoEtapas } from "@/components/venda/novo-lead/hooks/useValidacaoEtapas";
import { useSimulacaoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Novo lead · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { id?: string; step?: number } => ({
    id: typeof s.id === "string" ? s.id : undefined,
    step:
      typeof s.step === "number" ? s.step : typeof s.step === "string" ? Number(s.step) : undefined,
  }),
  component: Page,
});

function Page() {
  const [step, setStep] = useState(0);
  const [seguradorasDb, setSeguradorasDb] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("seguradoras")
      .select("nome")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        if (data) setSeguradorasDb(data.map((x) => x.nome));
      });
  }, []);

  const [f, setF] = useState<Form>({
    cpf: "",
    pessoa: "Física",
    nome: "",
    nomeSocial: "",
    nasc: "",
    sexo: "",
    estadoCivil: "",
    celular: "",
    telRes: "",
    email: "",
    cep: "",
    logradouro: "",
    bairro: "",
    cidade: "",
    uf: "",
    sms: "nao",
    tipoSeguro: "Seguro novo",
    ramo: "Automóvel",
    categoria: "Particular",
    vigIni: "",
    vigFim: "",
    ciaAtual: "",
    apoliceAtual: "",
    ciAtual: "",
    classeBonus: "0",
    seguradorasSel: ["Mapfre", "Aliro", "Yelum", "HDI", "Suhai"],
    tipoCalculo: "Anual",
    grupoProducao: "",
    campanha: "",
    observacoesCot: "",
    seguradoraAnterior: "",
    sucursalAnterior: "",
    apoliceAnterior: "",
    coberturaAnterior: "Compreensiva",
    statusApoliceAnterior: "Em vigor",
    itemApoliceAnterior: "",
    inicioVigenciaAnterior: "",
    fimVigenciaAnterior: "",
    renovacaoMesmoVeiculo: "Sim",
    renovacaoInclusaoCasco: "Não",
    qtdSinistrosParcialAnterior: "",
    ciApoliceAnterior: "",
    classeBonusAnterior: "0",
    comissaoApoliceAnterior: "",
    bonusRenovacaoTodasSeguradoras: "0",
    bonusAllianz: "0",
    bonusSuhai: "0",
    bonusPortoAzulItau: "0",
    bonusMapfre: "0",
    bonusTokio: "0",
    bonusHdi: "0",
    bonusBradesco: "0",
    bonusYelumAliroIndiana: "0",
    placa: "",
    chassi: "",
    renavam: "",
    marca: "",
    modelo: "",
    anoModelo: "",
    anoFab: "",
    combustivel: "Flex",
    cor: "",
    zeroKm: false,
    blindado: false,
    alienado: false,
    banco: "",
    usoComercial: "Não",
    kmMensal: "",
    condutorMesmo: "sim",
    condCpf: "",
    condNome: "",
    condNasc: "",
    condSexo: "",
    condEstadoCivil: "",
    profissao: "",
    cepPernoite: "",
    garagemResid: true,
    garagemTrab: false,
    garagemEsc: false,
    jovens1825: "nao",
    tipoCobertura: "Compreensiva",
    casco: "100% Tabela FIPE",
    cascoValor: "",
    franquia: "Normal",
    appMorte: "",
    appInval: "",
    dmh: "",
    rcfDm: "",
    rcfDc: "",
    vidros: true,
    carroReserva: "7 dias",
    assist24: "Básica",
  });
  const up = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const { cepLoading, lookupCep } = useCepLookup(setF);
  const { marcas, setMarcas, modelos, setModelos, fipeValor, setFipeValor } = useFipe(
    f.marca,
    f.modelo,
    f.anoModelo,
    f.combustivel,
  );
  const { erros, validarEtapa } = useValidacaoEtapas(f, marcas, modelos, fipeValor);
  const { calculando, resultados, setResultados, simularCalculo, podeCalcular } =
    useSimulacaoCalculo(f, fipeValor);

  const { id: routeId, step: routeStep } = Route.useSearch();
  const { cotacaoId, saveState, lastSavedAt, loading, persistir } = useCotacaoRascunho({
    f,
    setF,
    step,
    setStep,
    marcas,
    setMarcas,
    modelos,
    setModelos,
    fipeValor,
    setFipeValor,
    setResultados,
    routeId,
    routeStep,
  });

  const {
    perdaOpen,
    setPerdaOpen,
    perdaMotivos,
    perdaSubs,
    perdaForm,
    setPerdaForm,
    perdaSaving,
    abrirPerda,
    confirmarPerda,
  } = useClassificarPerda(cotacaoId, persistir);

  function doSimularCalculo() {
    simularCalculo((novos) => {
      void persistir({
        premios: novos.map((r) => ({
          cia: r.cia,
          premio: r.premio,
          cobertura: r.cobertura,
        })) as never,
      });
    });
  }

  return (
    <AppShell title="Novo lead">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>
            Nova cotação{" "}
            <span className="chip chip-slate" style={{ marginLeft: 6, verticalAlign: "middle" }}>
              Novo
            </span>
          </h1>
          <div className="sub">
            Multi cálculo · Padrão Automóvel · espelha o fluxo de cotação do Quiver com a cara da
            Supper.
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost">
            <svg width="14" height="14">
              <use href="#i-message" />
            </svg>{" "}
            WhatsApp
          </button>
          <button className="btn btn-ghost">
            <svg width="14" height="14">
              <use href="#i-history" />
            </svg>{" "}
            Histórico
          </button>
          <button className="btn btn-ghost" onClick={() => void abrirPerda()}>
            <svg width="14" height="14">
              <use href="#i-flag" />
            </svg>{" "}
            Classificar perda
          </button>
        </div>
      </div>
      {loading && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Carregando rascunho…
        </div>
      )}

      <div className="stepper">
        {STEPS.map((label, i) => (
          <span key={label} style={{ display: "contents" }}>
            <div
              className={"step " + (i === step ? "current" : "")}
              onClick={() => setStep(i)}
              style={{ cursor: "pointer" }}
            >
              <div className="n">{i + 1}</div>
              <div className="lbl">{label}</div>
            </div>
            {i < STEPS.length - 1 && <div className="line " />}
          </span>
        ))}
        {podeCalcular && (
          <span className="ready ">
            <svg width="12" height="12">
              <use href="#i-check" />
            </svg>{" "}
            Pronto para cotar
          </span>
        )}
      </div>

      <div className="lead-shell">
        <div className="wizard-card">
          {step === 0 && (
            <>
              <h2>Dados do Segurado</h2>
              <div className="sub">
                Digite o CPF/CNPJ que o sistema busca o cadastro. Se for novo, preenche o resto
                manualmente.
              </div>
              <div className="wizard-grid">
                <div className="field-group">
                  <label>
                    CPF ou CNPJ<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    value={f.cpf}
                    inputMode="numeric"
                    maxLength={18}
                    onChange={(e) => up("cpf", maskCpfCnpj(e.target.value))}
                    placeholder="000.000.000-00"
                  />
                  {erros.cpf && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.cpf}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>Pessoa</label>
                  <select
                    className="input"
                    value={f.pessoa}
                    onChange={(e) => up("pessoa", e.target.value)}
                  >
                    <option>Física</option>
                    <option>Jurídica</option>
                  </select>
                </div>
                <div className="field-group full">
                  <label>
                    Nome<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    value={f.nome}
                    maxLength={150}
                    onChange={(e) => up("nome", e.target.value)}
                    placeholder="Nome completo"
                  />
                  {erros.nome && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.nome}
                    </span>
                  )}
                </div>
                <div className="field-group full">
                  <label>Nome social</label>
                  <input
                    className="input"
                    value={f.nomeSocial}
                    maxLength={150}
                    onChange={(e) => up("nomeSocial", e.target.value)}
                    placeholder="Opcional"
                  />
                  {erros.nomeSocial && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.nomeSocial}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>
                    Data de nascimento<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    type="date"
                    value={f.nasc}
                    onChange={(e) => up("nasc", e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>
                    Sexo<span className="req">*</span>
                  </label>
                  <div className="row" style={{ gap: 8, paddingTop: 4 }}>
                    {["Masculino", "Feminino"].map((s) => (
                      <span
                        key={s}
                        className={"chip " + (f.sexo === s ? "chip-slate" : "chip-outline")}
                        style={{ cursor: "pointer" }}
                        onClick={() => up("sexo", s)}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>
                    Estado civil<span className="req">*</span>
                  </label>
                  <select
                    className="input"
                    value={f.estadoCivil}
                    onChange={(e) => up("estadoCivil", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option>Casado(a)</option>
                    <option>Solteiro(a)</option>
                    <option>Viúvo(a)</option>
                    <option>Divorciado(a)</option>
                    <option>Separado(a)</option>
                    <option>União estável</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>
                    Telefone celular<span className="req">*</span>{" "}
                    <span className="hint">WhatsApp</span>
                  </label>
                  <input
                    className="input"
                    value={f.celular}
                    inputMode="numeric"
                    maxLength={15}
                    onChange={(e) => up("celular", maskCel(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                  {erros.celular && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.celular}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>Telefone residencial</label>
                  <input
                    className="input"
                    value={f.telRes}
                    inputMode="numeric"
                    maxLength={14}
                    onChange={(e) => up("telRes", maskFixo(e.target.value))}
                    placeholder="(00) 0000-0000"
                  />
                  {erros.telRes && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.telRes}
                    </span>
                  )}
                </div>
                <div className="field-group full">
                  <label>E-mail</label>
                  <input
                    className="input"
                    type="email"
                    value={f.email}
                    maxLength={254}
                    onChange={(e) => up("email", e.target.value)}
                    placeholder="cliente@email.com"
                  />
                  {erros.email && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.email}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>
                    CEP residencial<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    value={f.cep}
                    inputMode="numeric"
                    maxLength={9}
                    onChange={(e) => {
                      const v = maskCep(e.target.value);
                      up("cep", v);
                      if (onlyDigits(v).length === 8) lookupCep(v);
                    }}
                    onBlur={() => lookupCep(f.cep)}
                    placeholder="00000-000"
                  />
                  {cepLoading && <span className="hint">Buscando CEP…</span>}
                  {erros.cep && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.cep}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>Logradouro</label>
                  <input
                    className="input"
                    value={f.logradouro}
                    maxLength={2000}
                    onChange={(e) => up("logradouro", e.target.value)}
                    placeholder="Preenche via CEP"
                  />
                </div>
                <div className="field-group">
                  <label>Bairro</label>
                  <input
                    className="input"
                    value={f.bairro}
                    maxLength={2000}
                    onChange={(e) => up("bairro", e.target.value)}
                    placeholder="Preenche via CEP"
                  />
                </div>
                <div className="field-group">
                  <label>Cidade</label>
                  <input
                    className="input"
                    value={f.cidade}
                    maxLength={150}
                    onChange={(e) => up("cidade", e.target.value)}
                    placeholder="Preenche via CEP"
                  />
                </div>
                <div className="field-group">
                  <label>UF</label>
                  <input
                    className="input"
                    value={f.uf}
                    maxLength={2}
                    onChange={(e) => up("uf", e.target.value.toUpperCase())}
                    placeholder="UF"
                  />
                </div>
                <div className="field-group">
                  <label>Autorizo o envio por SMS</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label>
                      <input
                        type="radio"
                        name="sms"
                        checked={f.sms === "sim"}
                        onChange={() => up("sms", "sim")}
                      />{" "}
                      Sim
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="sms"
                        checked={f.sms === "nao"}
                        onChange={() => up("sms", "nao")}
                      />{" "}
                      Não
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 &&
            (() => {
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
                      Seguradoras disponíveis{" "}
                      <span className="hint">marque e desmarque para o cálculo</span>
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
                                on
                                  ? f.seguradorasSel.filter((x) => x !== s)
                                  : [...f.seguradorasSel, s],
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
                        {[
                          "Seguro novo",
                          "Renovação com nossa corretora",
                          "Renovação de outra corretora",
                        ].map((o) => (
                          <option key={o}>{o}</option>
                        ))}
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
                        Dados da apólice anterior{" "}
                        <span className="hint">obrigatório em renovação</span>
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
            })()}

          {step === 2 && (
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
                    placeholder="AAA-0A00"
                  />
                  {erros.placa && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.placa}
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
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Perfil do Condutor</h2>
              <div className="sub">
                Quem dirige o veículo na maior parte do tempo e detalhes de uso.
              </div>
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
                      <label>Estado civil</label>
                      <select
                        className="input"
                        value={f.condEstadoCivil}
                        onChange={(e) => up("condEstadoCivil", e.target.value)}
                      >
                        <option value="">Selecione</option>
                        <option>Casado(a)</option>
                        <option>Solteiro(a)</option>
                        <option>Viúvo(a)</option>
                        <option>Divorciado(a)</option>
                        <option>União estável</option>
                      </select>
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
                <div className="field-group full">
                  <label>Garagem</label>
                  <div className="row" style={{ gap: 18, paddingTop: 6 }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={f.garagemResid}
                        onChange={(e) => up("garagemResid", e.target.checked)}
                      />{" "}
                      Residência
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={f.garagemTrab}
                        onChange={(e) => up("garagemTrab", e.target.checked)}
                      />{" "}
                      Trabalho
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={f.garagemEsc}
                        onChange={(e) => up("garagemEsc", e.target.checked)}
                      />{" "}
                      Escola/Faculdade
                    </label>
                  </div>
                </div>
                <div className="field-group">
                  <label>Condutores entre 18-25 anos?</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label>
                      <input
                        type="radio"
                        name="j1825"
                        checked={f.jovens1825 === "sim"}
                        onChange={() => up("jovens1825", "sim")}
                      />{" "}
                      Sim
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="j1825"
                        checked={f.jovens1825 === "nao"}
                        onChange={() => up("jovens1825", "nao")}
                      />{" "}
                      Não
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2>Coberturas</h2>
              <div className="sub">Defina o tipo de cobertura, casco, franquia e adicionais.</div>
              <div className="wizard-grid">
                <div className="field-group full">
                  <label>
                    Tipo de cobertura<span className="req">*</span>
                  </label>
                  <div className="row" style={{ gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
                    {["Compreensiva", "Incêndio + Roubo", "RCF"].map((t) => (
                      <span
                        key={t}
                        className={
                          "chip " + (f.tipoCobertura === t ? "chip-slate" : "chip-outline")
                        }
                        style={{ cursor: "pointer" }}
                        onClick={() => up("tipoCobertura", t)}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="field-group">
                  <label>Casco</label>
                  <select
                    className="input"
                    value={f.casco}
                    onChange={(e) => up("casco", e.target.value)}
                  >
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
                <div className="field-group">
                  <label>APP — Morte</label>
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
                  <label>APP — Invalidez</label>
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
                  <label>DMH (despesas médicas)</label>
                  <input
                    className="input"
                    value={f.dmh}
                    maxLength={100}
                    onChange={(e) => up("dmh", maskBRL(e.target.value))}
                    placeholder="R$ 5.000,00"
                  />
                  {erros.dmh && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.dmh}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>RCF — Danos materiais</label>
                  <input
                    className="input"
                    value={f.rcfDm}
                    maxLength={100}
                    onChange={(e) => up("rcfDm", maskBRL(e.target.value))}
                    placeholder="R$ 100.000,00"
                  />
                  {erros.rcfDm && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.rcfDm}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>RCF — Danos corporais</label>
                  <input
                    className="input"
                    value={f.rcfDc}
                    maxLength={100}
                    onChange={(e) => up("rcfDc", maskBRL(e.target.value))}
                    placeholder="R$ 100.000,00"
                  />
                  {erros.rcfDc && (
                    <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                      {erros.rcfDc}
                    </span>
                  )}
                </div>
                <div className="field-group">
                  <label>Vidros</label>
                  <div className="row" style={{ gap: 14, paddingTop: 6 }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={f.vidros}
                        onChange={(e) => up("vidros", e.target.checked)}
                      />{" "}
                      Incluir cobertura
                    </label>
                  </div>
                </div>
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
            </>
          )}

          {step === 5 && (
            <>
              <div className="row" style={{ alignItems: "center", marginBottom: 14 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Coberturas e valores</h2>
                  <div className="sub" style={{ margin: 0 }}>
                    {resultados.length > 0
                      ? `${resultados.length} seguradoras calculadas · ${f.tipoCobertura || "Compreensiva"}`
                      : (f.seguradorasSel?.length ?? 0) > 0
                        ? `${f.seguradorasSel.length} seguradoras selecionadas · clique em Calcular agora`
                        : "Selecione seguradoras no passo Seguro"}
                  </div>
                </div>
                <span className="spacer" style={{ flex: 1 }} />
                {cotacaoId && (
                  <Link
                    to="/venda/cotacoes/$id"
                    params={{ id: cotacaoId }}
                    className="btn btn-slate btn-sm"
                  >
                    <svg width="13" height="13">
                      <use href="#i-shield" />
                    </svg>{" "}
                    Comparativo lado a lado
                  </Link>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!podeCalcular || calculando}
                  onClick={doSimularCalculo}
                >
                  <svg width="13" height="13">
                    <use href="#i-refresh" />
                  </svg>{" "}
                  {calculando ? "Calculando…" : "Recalcular"}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={resultados.length === 0}
                  onClick={() => {
                    const sorted = [...resultados].sort((a, b) => a.premio - b.premio);
                    const head = `
                      <div class="grid">
                        <div class="kv"><b>Cliente:</b> ${escapeHtml(f.nome || "—")}</div>
                        <div class="kv"><b>${f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> ${escapeHtml(f.cpf || "—")}</div>
                        <div class="kv"><b>Celular:</b> ${escapeHtml(f.celular || "—")}</div>
                        <div class="kv"><b>Cidade/UF:</b> ${escapeHtml((f.cidade || "—") + (f.uf ? "/" + f.uf : ""))}</div>
                        <div class="kv"><b>Veículo:</b> ${escapeHtml(`${f.marca || ""} ${f.modelo || ""} ${f.anoModelo || ""}`.trim() || "—")}</div>
                        <div class="kv"><b>Placa:</b> ${escapeHtml(f.placa || "—")}</div>
                        <div class="kv"><b>Tipo de cobertura:</b> ${escapeHtml(f.tipoCobertura || "Compreensiva")}</div>
                        <div class="kv"><b>Tipo de cálculo:</b> ${escapeHtml(f.tipoCalculo || "—")}</div>
                      </div>`;
                    const cards = sorted
                      .map((r) => {
                        const reduz = Math.round(r.premio * 1.18);
                        return `<div class="card">
                          <div style="display:flex;justify-content:space-between;align-items:baseline">
                            <strong style="font-size:14px">${escapeHtml(r.cia)}</strong>
                            <span style="color:#64748b;font-size:11px">${escapeHtml(r.cobertura || f.tipoCobertura || "Compreensiva")}</span>
                          </div>
                          <table style="margin-top:8px">
                            <tr><th>Plano</th><th>Franquia</th><th class="num">À vista</th><th class="num">Parcelado</th></tr>
                            <tr><td>Normal 100%</td><td>R$ ${Math.round(r.premio * 1.5).toLocaleString("pt-BR")}</td><td class="num"><strong>${fmtBRL(r.premio)}</strong></td><td class="num">10x ${fmtBRL(r.premio / 10)}</td></tr>
                            <tr><td>Reduzida 50%</td><td>R$ ${Math.round(r.premio * 0.75).toLocaleString("pt-BR")}</td><td class="num"><strong>${fmtBRL(reduz)}</strong></td><td class="num">10x ${fmtBRL(reduz / 10)}</td></tr>
                          </table>
                        </div>`;
                      })
                      .join("");
                    const cob = `
                      <h2>Coberturas</h2>
                      <table>
                        <tr><th>Item</th><th>Valor</th></tr>
                        <tr><td>Valor de mercado</td><td>100% FIPE</td></tr>
                        <tr><td>RCF · Danos materiais</td><td>R$ ${(Number(onlyDigits(f.rcfDm || "")) || 100000).toLocaleString("pt-BR")}</td></tr>
                        <tr><td>RCF · Danos corporais</td><td>R$ ${(Number(onlyDigits(f.rcfDc || "")) || 100000).toLocaleString("pt-BR")}</td></tr>
                        <tr><td>APP por passageiro</td><td>${f.appMorte ? "R$ " + Number(onlyDigits(f.appMorte)).toLocaleString("pt-BR") : "R$ 5.000"}</td></tr>
                        <tr><td>Assistência 24h</td><td>${escapeHtml(f.assist24 || "Padrão")}</td></tr>
                        <tr><td>Carro reserva</td><td>${escapeHtml(f.carroReserva || "30 dias")}</td></tr>
                        <tr><td>Vidros</td><td>${f.vidros ? "Sim" : "—"}</td></tr>
                      </table>`;
                    printHtml(
                      "Cotação · " + (f.nome || "Cliente"),
                      `<h1>Resumo da cotação</h1><div class="sub">${sorted.length} seguradora(s) calculada(s)</div>${head}<h2>Prêmios</h2>${cards}${cob}<p style="font-size:11px;color:#64748b">Cotação válida por 5 dias. Sujeita à aceitação da seguradora.</p>`,
                    );
                  }}
                >
                  <svg width="13" height="13">
                    <use href="#i-download" />
                  </svg>{" "}
                  Imprimir
                </button>
              </div>

              {resultados.length === 0 && !calculando && (
                <div style={{ padding: "12px 0", marginBottom: 8 }}>
                  <button
                    className="btn btn-yellow"
                    disabled={!podeCalcular}
                    onClick={doSimularCalculo}
                  >
                    <svg width="14" height="14">
                      <use href="#i-bolt" />
                    </svg>
                    {podeCalcular ? " Calcular agora" : " Selecione seguradoras no passo Seguro"}
                  </button>
                </div>
              )}

              {resultados.length > 0 && (
                <div className="calc-grid">
                  {resultados
                    .sort((a, b) => a.premio - b.premio)
                    .map((r) => {
                      const aVista = r.premio;
                      const reduz = Math.round(r.premio * 1.18);
                      const fmt = (n: number) =>
                        "R$ " +
                        n.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      const fr1 = Math.round(r.premio * 1.5).toLocaleString("pt-BR");
                      const fr2 = Math.round(r.premio * 0.75).toLocaleString("pt-BR");
                      return (
                        <div className="calc-card" key={r.cia}>
                          <div className="calc-head">
                            <div className="calc-ins">
                              <svg width="16" height="16">
                                <use href="#i-shield" />
                              </svg>{" "}
                              {r.cia}
                            </div>
                            <select className="select-mini">
                              <option>Customizado</option>
                              <option>Plano Fácil</option>
                              <option>Plano Pleno</option>
                            </select>
                            <span className="chip chip-slate" style={{ marginLeft: "auto" }}>
                              {r.cobertura || "Compreensiva"}
                            </span>
                          </div>
                          <div className="calc-tiers">
                            <div className="calc-tier">
                              <div className="t-lbl">normal 100%</div>
                              <div className="t-fr">Franquia R$ {fr1}</div>
                              <div className="t-vista">à vista {fmt(aVista)}</div>
                              <div className="t-parc">10x sem juros</div>
                            </div>
                            <div className="calc-tier">
                              <div className="t-lbl">reduzida 50%</div>
                              <div className="t-fr">Franquia R$ {fr2}</div>
                              <div className="t-vista">à vista {fmt(reduz)}</div>
                              <div className="t-parc">10x sem juros</div>
                            </div>
                          </div>
                          <div className="calc-cobs">
                            <div className="cob-col">
                              <div className="cob-h">Coberturas básicas</div>
                              <div className="cob-row">
                                <span>Valor mercado</span>
                                <b>100% FIPE</b>
                              </div>
                              <div className="cob-row">
                                <span>Danos materiais</span>
                                <b>
                                  R${" "}
                                  {Number(onlyDigits(f.rcfDm || ""))
                                    ? Number(onlyDigits(f.rcfDm)).toLocaleString("pt-BR")
                                    : "100.000"}
                                </b>
                              </div>
                              <div className="cob-row">
                                <span>Danos corporais</span>
                                <b>
                                  R${" "}
                                  {Number(onlyDigits(f.rcfDc || ""))
                                    ? Number(onlyDigits(f.rcfDc)).toLocaleString("pt-BR")
                                    : "100.000"}
                                </b>
                              </div>
                              <div className="cob-row">
                                <span>APP / passageiro</span>
                                <b>
                                  {f.appMorte
                                    ? "R$ " + Number(onlyDigits(f.appMorte)).toLocaleString("pt-BR")
                                    : "R$ 5.000"}
                                </b>
                              </div>
                            </div>
                            <div className="cob-col">
                              <div className="cob-h">Adicionais</div>
                              <div className="cob-row">
                                <span>Assistência</span>
                                <b>{f.assist24 || "Padrão"}</b>
                              </div>
                              <div className="cob-row">
                                <span>Carro reserva</span>
                                <b>{f.carroReserva || "30 dias"}</b>
                              </div>
                              <div className="cob-row">
                                <span>Vidros</span>
                                <b>{f.vidros ? "Sim" : "—"}</b>
                              </div>
                            </div>
                          </div>
                          <div className="calc-foot">
                            <select className="select-mini" style={{ flex: 1 }}>
                              <option>Débito em Conta</option>
                              <option>Cartão de crédito</option>
                              <option>Boleto</option>
                            </select>
                            <button className="ic-btn" title="Observações">
                              <svg width="15" height="15">
                                <use href="#i-message" />
                              </svg>
                            </button>
                            <button className="ic-btn" title="Enviar">
                              <svg width="15" height="15">
                                <use href="#i-download" />
                              </svg>
                            </button>
                            <button className="ic-btn ok" title="Gerar proposta">
                              <svg width="15" height="15">
                                <use href="#i-check" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}

          <div className="wizard-foot">
            {step === 5 ? (
              <>
                <button className="btn btn-ghost" onClick={() => setStep(4)}>
                  <svg width="14" height="14">
                    <use href="#i-chevron-left" />
                  </svg>{" "}
                  Voltar às coberturas
                </button>
                <span className="spacer" />
                <button className="btn btn-yellow pulse" disabled={resultados.length === 0}>
                  <svg width="14" height="14">
                    <use href="#i-check" />
                  </svg>{" "}
                  Gerar proposta
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-ghost"
                  disabled={step === 0}
                  style={step === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <svg width="14" height="14">
                    <use href="#i-chevron-left" />
                  </svg>{" "}
                  Voltar
                </button>
                <span className="spacer" />
                <span className="muted small">
                  Passo {step + 1} de {STEPS.length}
                </span>
                {step === 4 ? (
                  <button
                    className="btn btn-yellow pulse"
                    onClick={() => {
                      if (!validarEtapa(4)) return;
                      setStep(5);
                      if (podeCalcular) doSimularCalculo();
                    }}
                  >
                    <svg width="14" height="14">
                      <use href="#i-bolt" />
                    </svg>{" "}
                    Calcular
                  </button>
                ) : (
                  <button
                    className="btn btn-slate"
                    onClick={() => {
                      if (!validarEtapa(step)) return;
                      setStep((s) => Math.min(STEPS.length - 1, s + 1));
                    }}
                  >
                    Próximo{" "}
                    <svg width="14" height="14">
                      <use href="#i-chevron-right" />
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="resumo">
          <div className="head">
            <svg width="16" height="16">
              <use href="#i-clock" />
            </svg>
            <h3>Resumo da cotação</h3>
          </div>
          <div className="body">
            {f.nome || f.cpf || f.marca || f.tipoCobertura || f.placa || f.condNome ? (
              <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                {(f.nome || f.cpf || f.celular || f.cidade) && (
                  <div style={{ display: "grid", gap: 4 }}>
                    <div
                      className="muted small"
                      style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
                    >
                      Segurado
                    </div>
                    {f.nome && (
                      <div>
                        <b>Nome:</b> {f.nome}
                      </div>
                    )}
                    {f.cpf && (
                      <div>
                        <b>{f.pessoa === "Jurídica" ? "CNPJ" : "CPF"}:</b> {f.cpf}
                      </div>
                    )}
                    {f.celular && (
                      <div>
                        <b>Celular:</b> {f.celular}
                      </div>
                    )}
                    {(f.cidade || f.uf) && (
                      <div>
                        <b>Cidade/UF:</b> {f.cidade}
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
                    {(f.garagemResid || f.garagemTrab || f.garagemEsc) && (
                      <div>
                        <b>Garagem:</b>{" "}
                        {[
                          f.garagemResid && "Resid.",
                          f.garagemTrab && "Trab.",
                          f.garagemEsc && "Escola",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
              {SEGURADORAS.length} seguradoras no cálculo
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
      </div>
      {perdaOpen &&
        (() => {
          const motivoObj = perdaMotivos.find((m) => m.nome === perdaForm.motivo);
          const subs = motivoObj ? perdaSubs.filter((s) => s.motivo_id === motivoObj.id) : [];
          const ready = !!(perdaForm.motivo && perdaForm.sub);
          return (
            <div
              onClick={() => setPerdaOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="modal-box"
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  padding: 22,
                  width: "100%",
                  maxWidth: 600,
                  textAlign: "left",
                  boxShadow: "0 24px 48px rgba(15,23,42,.25)",
                }}
              >
                <div
                  className="row"
                  style={{ alignItems: "center", marginBottom: 4, display: "flex" }}
                >
                  <strong
                    style={{
                      color: "var(--slate)",
                      fontSize: 17,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg width="16" height="16">
                      <use href="#i-flag" />
                    </svg>{" "}
                    Classificar perda
                  </strong>
                  <span style={{ flex: 1 }} />
                  <button className="ic-btn" onClick={() => setPerdaOpen(false)} title="Fechar">
                    <svg width="16" height="16">
                      <use href="#i-x" />
                    </svg>
                  </button>
                </div>
                <div className="muted small" style={{ marginBottom: 14 }}>
                  O lead
                  {f.nome ? (
                    <>
                      {" "}
                      de <strong>{f.nome}</strong>
                    </>
                  ) : null}{" "}
                  volta para a matriz com o motivo registrado. A{" "}
                  <strong>central de distribuição</strong> faz a triagem final (remalho ou
                  descarte). A classificação fica visível e filtrável.
                </div>

                <label
                  style={{
                    display: "block",
                    fontWeight: 700,
                    color: "var(--slate)",
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Motivo
                </label>
                <div
                  className="row"
                  style={{ flexWrap: "wrap", gap: 8, marginBottom: 14, display: "flex" }}
                >
                  {perdaMotivos.map((m) => (
                    <span
                      key={m.id}
                      className={`chip ${perdaForm.motivo === m.nome ? "chip-yellow" : "chip-outline"}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setPerdaForm({ motivo: m.nome, sub: "", obs: perdaForm.obs })}
                    >
                      {m.nome}
                    </span>
                  ))}
                </div>

                {perdaForm.motivo && (
                  <>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 700,
                        color: "var(--slate)",
                        fontSize: 12,
                        marginBottom: 6,
                      }}
                    >
                      Sub-motivo
                    </label>
                    <div
                      className="row"
                      style={{ flexWrap: "wrap", gap: 8, marginBottom: 14, display: "flex" }}
                    >
                      {subs.map((s) => (
                        <span
                          key={s.id}
                          className={`chip ${perdaForm.sub === s.nome ? "chip-yellow" : "chip-outline"}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => setPerdaForm({ ...perdaForm, sub: s.nome })}
                        >
                          {s.nome}
                        </span>
                      ))}
                    </div>
                  </>
                )}

                {perdaForm.sub && (
                  <>
                    <div className="wizard-grid" style={{ marginBottom: 6 }}>
                      <div className="field-group full">
                        <label>
                          Observação <span className="hint">opcional</span>
                        </label>
                        <textarea
                          className="input"
                          rows={2}
                          placeholder="Detalhe livre para a matriz"
                          value={perdaForm.obs}
                          onChange={(e) => setPerdaForm({ ...perdaForm, obs: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="audit-note" style={{ marginTop: 4 }}>
                      <svg width="15" height="15">
                        <use href="#i-info" />
                      </svg>{" "}
                      A triagem <strong style={{ margin: "0 4px" }}>remalho × descarte</strong> é
                      feita pela central de distribuição (Matriz).
                    </div>
                  </>
                )}

                <div
                  className="row"
                  style={{ marginTop: 16, gap: 10, justifyContent: "flex-end", display: "flex" }}
                >
                  <button className="btn btn-ghost" onClick={() => setPerdaOpen(false)}>
                    Cancelar
                  </button>
                  <button
                    className={`btn ${ready ? "btn-slate" : ""}`}
                    disabled={!ready || perdaSaving}
                    style={
                      !ready || perdaSaving ? { opacity: 0.4, cursor: "not-allowed" } : undefined
                    }
                    onClick={() => void confirmarPerda()}
                  >
                    <svg width="14" height="14">
                      <use href="#i-send" />
                    </svg>{" "}
                    {perdaSaving ? " Enviando…" : " Devolver à matriz"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </AppShell>
  );
}
