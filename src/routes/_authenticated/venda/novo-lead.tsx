import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import type { Form } from "@/components/venda/novo-lead/types";
import { useClassificarPerda } from "@/components/venda/novo-lead/hooks/useClassificarPerda";
import { useCepLookup } from "@/components/venda/novo-lead/hooks/useCepLookup";
import { useFipe } from "@/components/venda/novo-lead/hooks/useFipe";
import { useValidacaoEtapas } from "@/components/venda/novo-lead/hooks/useValidacaoEtapas";
import { useSimulacaoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import { StepSegurado } from "@/components/venda/novo-lead/steps/StepSegurado";
import { StepSeguro } from "@/components/venda/novo-lead/steps/StepSeguro";
import { StepVeiculo } from "@/components/venda/novo-lead/steps/StepVeiculo";
import { StepPerfil } from "@/components/venda/novo-lead/steps/StepPerfil";
import { StepCoberturas } from "@/components/venda/novo-lead/steps/StepCoberturas";
import { StepCalculo } from "@/components/venda/novo-lead/steps/StepCalculo";
import { Stepper } from "@/components/venda/novo-lead/Stepper";
import { WizardFooter } from "@/components/venda/novo-lead/WizardFooter";
import { ResumoCotacao } from "@/components/venda/novo-lead/ResumoCotacao";
import { ClassificarPerdaModal } from "@/components/venda/novo-lead/ClassificarPerdaModal";

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
    tipoUso: "Particular",
    usoTrabalho: "Não trabalha",
    usoEstudo: "Não estuda",
    usoComercialDoisDias: "nao",
    categoriaTaxi: "",
    utilizacaoLocadora: "",
    condutoresQueUtilizam: "",
    cepCirculacao: "",
    numPassageiros: "5",
    chassiRemarcado: "nao",
    isencaoImposto: "Sem isenção",
    pcdCnhEspecial: "nao",
    valorAdaptacaoPcd: "",
    possuiAntifurtoPorto: "nao",
    hdiSegurosBasico: "nao",
    antifurto: "Não",
    antifurtoDetalhes: {},
    blindagemAtiva: "nao",
    coberturaBlindagem: "",
    valorBlindagem: "",
    comFranquiaBlindagem: "nao",
    kitGasAtivo: "nao",
    coberturaKitGas: "nao",
    valorKitGas: "",
    comFranquiaKitGas: "nao",
    acessoriosAtivo: "nao",
    kitAcessoriosAtivo: "nao",
    opcionaisAtivo: "nao",
    equipamentosAtivo: "nao",
    acessoriosDetalhes: {},
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

      <Stepper step={step} setStep={setStep} podeCalcular={podeCalcular} />

      <div className="lead-shell" style={step === 5 ? { display: "block" } : undefined}>
        <div className="wizard-card">
          {step === 0 && (
            <StepSegurado
              f={f}
              up={up}
              erros={erros}
              cepLoading={cepLoading}
              lookupCep={lookupCep}
            />
          )}

          {step === 1 && <StepSeguro f={f} up={up} setF={setF} seguradorasDb={seguradorasDb} />}

          {step === 2 && (
            <StepVeiculo
              f={f}
              up={up}
              erros={erros}
              marcas={marcas}
              modelos={modelos}
              fipeValor={fipeValor}
            />
          )}

          {step === 3 && <StepPerfil f={f} up={up} erros={erros} />}

          {step === 4 && <StepCoberturas f={f} up={up} erros={erros} />}

          {step === 5 && (
            <StepCalculo
              f={f}
              resultados={resultados}
              calculando={calculando}
              podeCalcular={podeCalcular}
              cotacaoId={cotacaoId}
              doSimularCalculo={doSimularCalculo}
            />
          )}

          <WizardFooter
            step={step}
            setStep={setStep}
            resultados={resultados}
            validarEtapa={validarEtapa}
            podeCalcular={podeCalcular}
            doSimularCalculo={doSimularCalculo}
          />
        </div>

        {step !== 5 && (
          <ResumoCotacao
            f={f}
            marcas={marcas}
            modelos={modelos}
            fipeValor={fipeValor}
            podeCalcular={podeCalcular}
            setStep={setStep}
            doSimularCalculo={doSimularCalculo}
            persistir={persistir}
            saveState={saveState}
            lastSavedAt={lastSavedAt}
            cotacaoId={cotacaoId}
          />
        )}
      </div>
      {perdaOpen && (
        <ClassificarPerdaModal
          nomeSegurado={f.nome}
          perdaMotivos={perdaMotivos}
          perdaSubs={perdaSubs}
          perdaForm={perdaForm}
          setPerdaForm={setPerdaForm}
          perdaSaving={perdaSaving}
          setPerdaOpen={setPerdaOpen}
          confirmarPerda={confirmarPerda}
        />
      )}
    </AppShell>
  );
}
