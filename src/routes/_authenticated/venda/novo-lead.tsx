import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import type { Form } from "@/components/venda/novo-lead/types";
import { useClassificarPerda } from "@/components/venda/novo-lead/hooks/useClassificarPerda";
import { useCepLookup } from "@/components/venda/novo-lead/hooks/useCepLookup";
import { useFipe } from "@/components/venda/novo-lead/hooks/useFipe";
import { useConsultaPlaca } from "@/components/venda/novo-lead/hooks/useConsultaPlaca";
import { useValidacaoEtapas } from "@/components/venda/novo-lead/hooks/useValidacaoEtapas";
import { useSimulacaoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import { useTutorialWizardPreview } from "@/components/venda/novo-lead/hooks/useTutorialWizardPreview";
import { NovoLeadHeader } from "@/components/venda/novo-lead/NovoLeadHeader";
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
import { LeadManualGate } from "@/components/venda/novo-lead/LeadManualGate";
import { useTutorialController } from "@/components/tutorial/tutorial-controller-context";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Lead Manual · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { id?: string; step?: number } => ({
    id: typeof s.id === "string" ? s.id : undefined,
    step:
      typeof s.step === "number" ? s.step : typeof s.step === "string" ? Number(s.step) : undefined,
  }),
  component: Page,
});

// O robô Quiver (Playwright) não suporta essas 8 das 18 seguradoras
// semeadas no banco (ver SEGURADORA_QUIVER em quiver.functions.ts) — não
// oferecer a opção evita que o vendedor marque só não suportadas e o robô
// acabe cotando todas por padrão.
const SEGURADORAS_SEM_ROBO = new Set([
  "Itaú",
  "Ezze",
  "Zurich",
  "Alfa",
  "Darwin",
  "Pier",
  "Indiana",
  "Sompo",
]);

function Page() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const { visibleStep, setVisibleStep, showTutorialReady } = useTutorialWizardPreview(
    step,
    setStep,
  );
  const [seguradorasDb, setSeguradorasDb] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("seguradoras")
      .select("nome")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        // Só oferece as seguradoras suportadas pelo robô Quiver — o banco
        // semeia 18, mas 8 (Itaú, Ezze, Zurich, Alfa, Darwin, Pier, Indiana,
        // Sompo) não são aceitas pelo robô e antes eram descartadas em
        // silêncio do payload (ver mapSeguradoras em quiver.functions.ts),
        // o que fazia o robô cotar TODAS as seguradoras quando o vendedor
        // marcava só não suportadas.
        if (data)
          setSeguradorasDb(data.map((x) => x.nome).filter((n) => !SEGURADORAS_SEM_ROBO.has(n)));
      });
  }, []);

  const [f, setF] = useState<Form>({
    canalOrigem: "",
    cpf: "",
    pessoa: "Física",
    nome: "",
    nomeSocial: "",
    nasc: "",
    sexo: "",
    estadoCivil: "",
    celular: "",
    email: "",
    cep: "",
    numero: "",
    logradouro: "",
    bairro: "",
    cidade: "",
    uf: "",
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
    tipoCambio: "",
    zeroKm: false,
    dataSaidaConcessionaria: "",
    odometro: "",
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
    leilao: "Não possui histórico de leilão",
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
    condRelacao: "",
    condNomeSocial: "",
    condTempoHabilitacao: "",
    profissao: "",
    cepPernoite: "",
    tipoGaragem: "Sim, com portão manual",
    segProprietario: true,
    relacaoComProprietario: "",
    proprietarioTipoPessoa: "Física",
    proprietarioCpf: "",
    proprietarioCnpj: "",
    proprietarioNome: "",
    proprietarioNomeSocial: "",
    proprietarioSexo: "",
    proprietarioNascimento: "",
    proprietarioEstadoCivil: "",
    tipoResidencia: "Casa",
    tipoAtividadeEmpresa: "Comércio",
    ramoAtividade: "",
    profissaoPrincipalCondutor: "",
    seguroCorretorProximo: "nao",
    jovens1825: "nao",
    jovens18a25Detalhes: [],
    tipoCobertura: "Fácil",
    categoriaCoberturaLegado: "Compreensiva",
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
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    danosMorais: "",
    despesasExtras: "Não contratada",
    pequenosReparos: false,
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

  const { id: routeId, step: routeStep } = Route.useSearch();
  // V11 · Lead Manual — origem: quem retoma um rascunho (?id=) já passou por
  // aqui; só lead novo (sem SLA da Central) vê o gate. O tour guiado também
  // pula o gate enquanto está aberto — é a única forma de chegar em
  // /venda/novo-lead sem ?id= durante uma demonstração, e alguns passos do
  // tour (ex.: "Agende um retorno", que mira o botão Histórico do wizard)
  // não redeclaram um `prepare` próprio, então não dá pra usar só o valor
  // atual de `tutorialPreview` — teria buracos no meio da mesma jornada.
  const { isOpen: tutorialIsOpen } = useTutorialController();
  const [leadManualDone, setLeadManualDone] = useState(!!routeId);
  const leadManualGateAtivo = !leadManualDone && !tutorialIsOpen;
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
    routeId,
    routeStep,
  });
  // Integração de placa: depende de `marcas` (para casar a marca FIPE) e de
  // `cotacaoId` (para amarrar a consulta à cotação no histórico).
  const {
    consultando: placaConsultando,
    status: placaStatus,
    versoes: placaVersoes,
    consultar: consultarPlaca,
    escolherVersao: escolherVersaoPlaca,
  } = useConsultaPlaca({
    setF,
    marcas,
    setModelos,
    cotacaoId,
    placaAtual: f.placa,
    carregandoRascunho: loading,
    // Marca já preenchida = uma consulta de placa já resolveu esse veículo
    // antes (rascunho reaberto). Sem marca, mesmo com placa preenchida (ex.:
    // lead assumido via assumir_lead, que grava a placa sem consultar), a
    // primeira saída do campo precisa disparar a consulta de verdade.
    veiculoJaResolvido: !!f.marca,
  });
  const {
    calculando,
    resultados,
    erro: erroCalculo,
    simularCalculo,
    podeCalcular,
    camposFaltantes,
  } = useSimulacaoCalculo(f, cotacaoId, persistir);

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
    void simularCalculo();
  }

  if (leadManualGateAtivo) {
    return (
      <AppShell title="Lead Manual">
        <ProtoIcons />
        <LeadManualGate
          onIniciar={(dados) => {
            setF((p) => ({
              ...p,
              nome: dados.nome,
              celular: dados.celular,
              placa: dados.placa,
              canalOrigem: dados.canal,
            }));
            setLeadManualDone(true);
          }}
          onCancelar={() => void navigate({ to: "/venda/pipeline" })}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Lead Manual">
      <ProtoIcons />
      <NovoLeadHeader onClassificarPerda={() => void abrirPerda()} />
      {loading && (
        <div className="muted" style={{ marginBottom: 8 }}>
          Carregando rascunho…
        </div>
      )}

      <Stepper
        step={visibleStep}
        setStep={setVisibleStep}
        podeCalcular={podeCalcular || showTutorialReady}
      />

      <div className="lead-shell" style={visibleStep === 5 ? { display: "block" } : undefined}>
        <div className="wizard-card">
          {visibleStep === 0 && (
            <StepSegurado
              f={f}
              up={up}
              erros={erros}
              cepLoading={cepLoading}
              lookupCep={lookupCep}
            />
          )}

          {visibleStep === 1 && (
            <StepSeguro f={f} up={up} setF={setF} seguradorasDb={seguradorasDb} />
          )}

          {visibleStep === 2 && (
            <StepVeiculo
              f={f}
              up={up}
              erros={erros}
              marcas={marcas}
              modelos={modelos}
              fipeValor={fipeValor}
              placaConsultando={placaConsultando}
              placaStatus={placaStatus}
              placaVersoes={placaVersoes}
              onConsultarPlaca={consultarPlaca}
              onEscolherVersao={escolherVersaoPlaca}
            />
          )}

          {visibleStep === 3 && <StepPerfil f={f} up={up} erros={erros} />}

          {visibleStep === 4 && <StepCoberturas f={f} up={up} erros={erros} />}

          {visibleStep === 5 && (
            <StepCalculo
              f={f}
              resultados={resultados}
              calculando={calculando}
              erro={erroCalculo}
              podeCalcular={podeCalcular}
              camposFaltantes={camposFaltantes}
              cotacaoId={cotacaoId}
              doSimularCalculo={doSimularCalculo}
            />
          )}

          <WizardFooter
            step={visibleStep}
            setStep={setVisibleStep}
            resultados={resultados}
            validarEtapa={validarEtapa}
            podeCalcular={podeCalcular}
            doSimularCalculo={doSimularCalculo}
          />
        </div>

        {visibleStep !== 5 && (
          <ResumoCotacao
            f={f}
            marcas={marcas}
            modelos={modelos}
            fipeValor={fipeValor}
            podeCalcular={podeCalcular}
            camposFaltantes={camposFaltantes}
            setStep={setVisibleStep}
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
