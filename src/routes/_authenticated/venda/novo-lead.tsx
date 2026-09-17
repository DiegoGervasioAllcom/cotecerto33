import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { transmitirPropostaQuiver } from "@/lib/quiver.functions";
import type { Form } from "@/components/venda/novo-lead/types";
import { useClassificarPerda } from "@/components/venda/novo-lead/hooks/useClassificarPerda";
import { useCepLookup } from "@/components/venda/novo-lead/hooks/useCepLookup";
import { useFipe } from "@/components/venda/novo-lead/hooks/useFipe";
import { useConsultaPlaca } from "@/components/venda/novo-lead/hooks/useConsultaPlaca";
import { useConsultaCpf } from "@/components/venda/novo-lead/hooks/useConsultaCpf";
import { useValidacaoEtapas } from "@/components/venda/novo-lead/hooks/useValidacaoEtapas";
import { useSimulacaoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import { useTutorialWizardPreview } from "@/components/venda/novo-lead/hooks/useTutorialWizardPreview";
import { NovoLeadHeader } from "@/components/venda/novo-lead/NovoLeadHeader";
import { StepSegurado } from "@/components/venda/novo-lead/steps/StepSegurado";
import { StepSeguro, vigenciaAPartirDeHoje } from "@/components/venda/novo-lead/steps/StepSeguro";
import { StepVeiculo } from "@/components/venda/novo-lead/steps/StepVeiculo";
import { StepPerfil } from "@/components/venda/novo-lead/steps/StepPerfil";
import { StepCoberturas } from "@/components/venda/novo-lead/steps/StepCoberturas";
import {
  StepCalculo,
  type OfertaTransmissao,
} from "@/components/venda/novo-lead/steps/StepCalculo";
import { StepTransmissao } from "@/components/venda/novo-lead/steps/transmissao/StepTransmissao";
import type { DadosComplementaresTransmissao } from "@/components/venda/novo-lead/steps/transmissao/TransmissaoDadosComplementares";
import type { ResultadoTransmissaoEstado } from "@/components/venda/novo-lead/steps/transmissao/TransmissaoResultado";
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

  const vigenciaInicial = vigenciaAPartirDeHoje(1);
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
    vigIni: vigenciaInicial.ini,
    vigFim: vigenciaInicial.fim,
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
    alienado: false,
    banco: "",
    kmMensal: "",
    tipoUso: "Particular",
    usoTrabalho: "Não trabalha",
    usoEstudo: "Não estuda",
    usoComercialDoisDias: "nao",
    categoriaTaxi: "",
    utilizacaoLocadora: "",
    condutoresQueUtilizam: "",
    cepCirculacao: "",
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
    appMorte: "",
    appInval: "",
    rcfDm: "",
    rcfDc: "",
    vidros: "Não contratada",
    carroReserva: "Não contratada",
    assist24: "Não contratada",
    modalidade: "Valor de Mercado",
    percentualAjuste: "100",
    franquiaPrimeiraOpcao: "Normal 100%",
    franquiaSegundaOpcao: "Reduzida 50%",
    danosMorais: "",
    despesasExtras: "Não contratada",
    pequenosReparos: false,
    valorDeterminado: "",
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
    consultando: cpfConsultando,
    status: cpfStatus,
    consultar: consultarCpf,
  } = useConsultaCpf({ setF, cotacaoId });
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

  // Etapa 7 (Transmissão) — subiu de StepCalculo.tsx pra cá porque a oferta
  // escolhida precisa sobreviver à troca de passo do wizard (setVisibleStep).
  const POLL_TRANSMISSAO_MS = 4000;
  const [oferta, setOferta] = useState<OfertaTransmissao | null>(null);
  const [enviandoProposta, setEnviandoProposta] = useState(false);
  const [erroProposta, setErroProposta] = useState<string | null>(null);
  // Onda 3 (T.10): enquanto uma transmissão está em andamento, a Etapa 7
  // mostra só o resultado (via polling em `cotacao_transmissoes`, mesmo
  // padrão de `useSimulacaoCalculo`).
  const [transmissaoEmAndamento, setTransmissaoEmAndamento] = useState<{
    tentativaId: string;
  } | null>(null);
  const [resultadoTransmissao, setResultadoTransmissao] =
    useState<ResultadoTransmissaoEstado | null>(null);
  const pollTransmissaoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function pararPollingTransmissao() {
    if (pollTransmissaoTimer.current) {
      clearInterval(pollTransmissaoTimer.current);
      pollTransmissaoTimer.current = null;
    }
  }

  useEffect(() => {
    return () => pararPollingTransmissao();
  }, []);

  function iniciarPollingTransmissao(tentativaId: string) {
    pararPollingTransmissao();
    pollTransmissaoTimer.current = setInterval(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("cotacao_transmissoes")
          .select("status,motivo,mensagem,proposta_id")
          .eq("id", tentativaId)
          .maybeSingle();
        if (error || !data) return;
        if (data.status !== "enviada") {
          pararPollingTransmissao();
          setResultadoTransmissao({
            status: data.status as ResultadoTransmissaoEstado["status"],
            motivo: data.motivo,
            mensagem: data.mensagem,
            propostaId: data.proposta_id,
          });
        }
      })();
    }, POLL_TRANSMISSAO_MS);
  }

  function tentarNovamenteTransmissao() {
    pararPollingTransmissao();
    setTransmissaoEmAndamento(null);
    setResultadoTransmissao(null);
  }

  function onEscolherOferta(escolha: OfertaTransmissao) {
    setOferta(escolha);
    setErroProposta(null);
    setVisibleStep(6);
  }

  // Etapa 7 só existe depois de escolher uma oferta no Cálculo (é estado local,
  // não persiste no rascunho). Sem isso, reabrir uma cotação salva com
  // `step_atual = 6` (autosave) ou clicar direto em "Transmissão" no Stepper
  // deixaria o wizard-card em branco (nem StepTransmissao nem WizardFooter
  // renderizam para visibleStep === 6 sem oferta).
  useEffect(() => {
    if (visibleStep === 6 && !oferta) setVisibleStep(5);
  }, [visibleStep, oferta, setVisibleStep]);

  async function onTransmitir(dadosComplementares: DadosComplementaresTransmissao) {
    if (!cotacaoId || !oferta) return;
    const { resultado: r, formaPagamento, parcelas, premio } = oferta;
    setResultadoTransmissao(null);
    setErroProposta(null);
    setEnviandoProposta(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resposta = await transmitirPropostaQuiver({
        data: {
          cotacaoId,
          caller_token: sess.session?.access_token ?? "",
          seguradora: r.seguradora,
          produtoId: r.produtoId,
          produto: r.produto || r.nome || undefined,
          formaPagamento,
          parcelas,
          premio,
          dadosComplementares,
        },
      });
      // O 201 significa só que o robô aceitou a solicitação: o resultado real
      // (transmitido / recusado pelo portal) chega depois, pelo webhook —
      // entramos em modo "transmitindo" e fazemos polling da tentativa.
      setTransmissaoEmAndamento({ tentativaId: resposta.tentativaId });
      iniciarPollingTransmissao(resposta.tentativaId);
    } catch (e) {
      setErroProposta(e instanceof Error ? e.message : "Falha ao gerar a proposta.");
    } finally {
      setEnviandoProposta(false);
    }
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
        setStep={(i) => {
          // Sem oferta escolhida ainda, a Etapa 7 não tem o que mostrar —
          // não deixa clicar direto nela pelo Stepper (ver useEffect acima).
          if (i === 6 && !oferta) return;
          setVisibleStep(i);
        }}
        // Na Etapa 7 a cotação já foi calculada e está em transmissão — o
        // aviso "Pronto para cotar" não faz mais sentido ali.
        podeCalcular={(podeCalcular || showTutorialReady) && visibleStep !== 6}
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
              cpfConsultando={cpfConsultando}
              cpfStatus={cpfStatus}
              consultarCpf={consultarCpf}
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
              onEscolherOferta={onEscolherOferta}
            />
          )}

          {visibleStep === 6 && oferta && (
            <StepTransmissao
              f={f}
              oferta={oferta}
              enviando={enviandoProposta}
              erroEnvio={erroProposta}
              transmissaoEmAndamento={transmissaoEmAndamento !== null}
              resultadoTransmissao={resultadoTransmissao}
              onTransmitir={(dados) => void onTransmitir(dados)}
              onVoltarCalculo={() => {
                setOferta(null);
                setErroProposta(null);
                setVisibleStep(5);
              }}
              onTentarNovamente={tentarNovamenteTransmissao}
            />
          )}

          {visibleStep <= 5 && (
            <WizardFooter
              step={visibleStep}
              setStep={setVisibleStep}
              validarEtapa={validarEtapa}
              podeCalcular={podeCalcular}
              doSimularCalculo={doSimularCalculo}
            />
          )}
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
