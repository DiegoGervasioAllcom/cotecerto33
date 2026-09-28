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
import { useRecalcularSeguradora } from "@/components/venda/novo-lead/hooks/useRecalcularSeguradora";
import { useCotacaoRascunho } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import {
  useRetomarTransmissao,
  useAplicarRetomadaTransmissao,
  gravarTransmissaoOfertaSnapshot,
  limparTransmissaoOfertaSnapshot,
} from "@/components/venda/novo-lead/hooks/useRetomarTransmissao";
import { useTutorialWizardPreview } from "@/components/venda/novo-lead/hooks/useTutorialWizardPreview";
import { NovoLeadHeader } from "@/components/venda/novo-lead/NovoLeadHeader";
import { FocoBarra } from "@/components/venda/foco-barra";
import { useFocoAoChegar } from "@/lib/use-foco-ao-chegar";
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
import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";
import { CalculoListaTutorialPreview } from "@/components/venda/calculo-lista-tutorial-preview";
import {
  TransmissaoConfirmacaoTutorialPreview,
  TransmissaoDadosTutorialPreview,
} from "@/components/venda/transmissao-tutorial-preview";
import { TransmitidaTutorialPreview } from "@/components/venda/transmitida-tutorial-preview";

export const Route = createFileRoute("/_authenticated/venda/novo-lead")({
  head: () => ({ meta: [{ title: "Lead Manual · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { id?: string; step?: number; foco?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
    step:
      typeof s.step === "number" ? s.step : typeof s.step === "string" ? Number(s.step) : undefined,
    // V12.3.11 — só a faixa "de onde você veio" no topo (sem destaque de
    // linha: o wizard não tem uma lista pra destacar item nenhum).
    foco: typeof s.foco === "string" ? s.foco : undefined,
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
  const focoNavigate = useNavigate({ from: Route.fullPath });
  const { foco: focoBusca } = Route.useSearch();
  const foco = useFocoAoChegar(focoBusca, () => {
    void focoNavigate({ search: (s) => ({ ...s, foco: undefined }) });
  });
  // V12: mantém a URL (`?step=`) em sincronia com o passo visível ao entrar
  // na Etapa 7 / voltar ao Cálculo — sem isso, um F5 sempre relia o `step`
  // da navegação original (ex.: o link "Continuar" de Em finalização manda
  // `step=6` fixo, mas um "Voltar ao Cálculo" preso na URL antiga fazia o
  // rascunho reimpor `step=5` depois da retomada já ter avançado pra 6; ver
  // `useRetomarTransmissao.ts`).
  function sincronizarStepNaUrl(next: number) {
    void focoNavigate({ search: (s) => ({ ...s, step: next }), replace: true });
  }
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
  const tutorialPreview = useTutorialPreview();
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
    recalcularSeguradora,
    podeCalcular,
    camposFaltantes,
  } = useSimulacaoCalculo(f, cotacaoId, persistir);
  // `.seg-acoes` · V12.3.6 — extraído em `useRecalcularSeguradora.ts` (regra 9).
  const descontoAcoes = useRecalcularSeguradora({
    cotacaoId,
    resultados,
    setF,
    recalcularSeguradora,
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
    // Best-effort: os resultados anteriores (e a oferta escolhida sobre
    // eles) deixam de valer quando o cálculo é refeito.
    if (cotacaoId) void limparTransmissaoOfertaSnapshot(cotacaoId);
    void simularCalculo();
  }

  // Etapa 7 (Transmissão) — subiu de StepCalculo.tsx pra cá porque a oferta
  // escolhida precisa sobreviver à troca de passo do wizard (setVisibleStep).
  const POLL_TRANSMISSAO_MS = 4000;
  const [oferta, setOferta] = useState<OfertaTransmissao | null>(null);
  // V12: em que sub-passo a Etapa 7 deve nascer — normalmente "dados", mas
  // uma transmissão retomada (`useRetomarTransmissao`) pode reabrir direto
  // em "resultado" (falha/transmitida/aguardando).
  const [faseInicialTransmissao, setFaseInicialTransmissao] = useState<
    "dados" | "confirmacao" | "pagamento" | "resultado"
  >("dados");
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

  // Best-effort: só granularidade pro Pipeline (`cotacoes.transmissao_fase`),
  // nunca deve bloquear ou interromper o wizard — falha aqui não pode
  // interferir no fluxo real de transmissão (que roda via cotacao_transmissoes).
  function onFaseTransmissaoChange(faseTransmissao: "dados" | "confirmacao" | "pagamento") {
    if (!cotacaoId) return;
    void supabase
      .from("cotacoes")
      .update({ transmissao_fase: faseTransmissao })
      .eq("id", cotacaoId)
      .then(({ error }) => {
        if (error && import.meta.env.DEV) {
          console.error("Falha ao gravar transmissao_fase (best-effort):", error);
        }
      });
  }

  function onEscolherOferta(escolha: OfertaTransmissao) {
    setOferta(escolha);
    setFaseInicialTransmissao("dados");
    setErroProposta(null);
    setVisibleStep(6);
    sincronizarStepNaUrl(6);
    // Best-effort: snapshot da oferta escolhida (sem dado pessoal), pra
    // reabrir a Etapa 7 em "Dados complementares" mesmo antes da primeira
    // tentativa real de transmissão (ver `useRetomarTransmissao`).
    if (cotacaoId) void gravarTransmissaoOfertaSnapshot(cotacaoId, escolha);
  }

  // V12: reabre a Etapa 7 no ponto certo em vez de sempre voltar ao Cálculo
  // (última tentativa em `cotacao_transmissoes` + snapshot em
  // `cotacoes.transmissao_oferta`). Durante a resolução (`resolvendo`), o
  // wizard-card mostra um "carregando" em vez de piscar o Cálculo.
  //
  // `loading` (rascunho) atrasa o início da busca da retomada, não só por
  // otimização: o load do rascunho (`useCotacaoRascunho`) e a retomada
  // disputam `setStep`, e o do rascunho é mais lento (5 tabelas). Sem
  // esperar `loading` virar `false` antes de sequer buscar, a ordem de
  // chegada era imprevisível — quando o rascunho resolvia DEPOIS da
  // retomada, `setStep(routeStep ?? step_atual)` sobrescrevia o passo 6 de
  // volta pro 5, e como a retomada só se aplica 1x por cotação, o wizard
  // ficava preso no Cálculo mesmo com a transmissão em andamento de verdade.
  const { resolvendo: resolvendoTransmissao, retomado: transmissaoRetomada } =
    useRetomarTransmissao(cotacaoId, !tutorialPreview, loading);
  useAplicarRetomadaTransmissao({
    cotacaoId,
    resolvendo: resolvendoTransmissao,
    retomado: transmissaoRetomada,
    oferta,
    visibleStep,
    setVisibleStep,
    setOferta,
    setFaseInicialTransmissao,
    setTransmissaoEmAndamento,
    setResultadoTransmissao,
    iniciarPollingTransmissao,
    sincronizarStepNaUrl,
  });

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

  // Etapa 7 (Cálculo/Transmissão) do tutorial do vendedor: essas telas
  // dependem de uma cotação calculada/transmitida de verdade — o tutorial
  // mostra um exemplo estático (mesmo padrão de `aceite-tutorial-preview`),
  // sem tocar no wizard real nem disparar cálculo/transmissão nenhuma.
  if (
    tutorialPreview === "lead-calculo-lista" ||
    tutorialPreview === "lead-transmissao-dados" ||
    tutorialPreview === "lead-transmissao-confirmacao" ||
    tutorialPreview === "lead-transmitida"
  ) {
    return (
      <AppShell title="Lead Manual">
        <ProtoIcons />
        {tutorialPreview === "lead-calculo-lista" && <CalculoListaTutorialPreview />}
        {tutorialPreview === "lead-transmissao-dados" && <TransmissaoDadosTutorialPreview />}
        {tutorialPreview === "lead-transmissao-confirmacao" && (
          <TransmissaoConfirmacaoTutorialPreview />
        )}
        {tutorialPreview === "lead-transmitida" && <TransmitidaTutorialPreview />}
      </AppShell>
    );
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
              ramo: dados.ramo,
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
      <FocoBarra ativo={foco.ativo} fonte={foco.fonte} id={foco.id} onLimpar={foco.limpar} />
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
              descontoAcoes={descontoAcoes}
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
                if (cotacaoId) void limparTransmissaoOfertaSnapshot(cotacaoId);
                setVisibleStep(5);
                sincronizarStepNaUrl(5);
              }}
              onTentarNovamente={tentarNovamenteTransmissao}
              onFaseChange={onFaseTransmissaoChange}
              faseInicial={faseInicialTransmissao}
            />
          )}

          {visibleStep === 6 && !oferta && resolvendoTransmissao && (
            <div className="muted" style={{ padding: 20, textAlign: "center" }}>
              Carregando transmissão…
            </div>
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
