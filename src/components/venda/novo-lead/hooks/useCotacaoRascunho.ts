import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { maskCpfCnpj, normalizePlaca } from "@/lib/masks";
import { maskCel, maskCep } from "../masks";
import type { Form } from "../types";

type MarcaOpt = { codigo: string; nome: string };
type ModeloOpt = { codigo: number; nome: string };

/**
 * Persistência da cotação (rascunho) no Supabase: monta o payload,
 * salva via RPC `salvar_cotacao_rascunho` (autosave debounced), e carrega
 * um rascunho existente quando a rota tem `?id=`.
 */
export function useCotacaoRascunho(params: {
  f: Form;
  setF: React.Dispatch<React.SetStateAction<Form>>;
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  marcas: MarcaOpt[];
  setMarcas: React.Dispatch<React.SetStateAction<MarcaOpt[]>>;
  modelos: ModeloOpt[];
  setModelos: React.Dispatch<React.SetStateAction<ModeloOpt[]>>;
  fipeValor: string;
  setFipeValor: React.Dispatch<React.SetStateAction<string>>;
  routeId: string | undefined;
  routeStep: number | undefined;
}) {
  const {
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
  } = params;

  const [cotacaoId, setCotacaoId] = useState<string | null>(routeId ?? null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);
  const loadingRef = useRef<boolean>(!!routeId);
  const [loading, setLoading] = useState<boolean>(!!routeId);

  function buildPayload() {
    return {
      step_atual: step,
      segurado: {
        cpf: f.cpf,
        pessoa: f.pessoa,
        nome: f.nome,
        nome_social: f.nomeSocial,
        nasc: f.nasc,
        sexo: f.sexo,
        estado_civil: f.estadoCivil,
        celular: f.celular,
        email: f.email,
        cep: f.cep,
        numero: f.numero,
        logradouro: f.logradouro,
        bairro: f.bairro,
        cidade: f.cidade,
        uf: f.uf,
      },
      seguro: {
        tipo_seguro: f.tipoSeguro,
        ramo: f.ramo,
        categoria: f.categoria,
        vig_ini: f.vigIni,
        vig_fim: f.vigFim,
        // cia_atual/apolice_atual/ci_atual/classe_bonus são as 4 colunas legadas
        // de "apólice anterior" (schema 2024); a tela atual (StepSeguro, bloco
        // "Dados da apólice anterior") renomeou esses campos para o sufixo
        // *Anterior e nunca os persistia — reaproveitamos as colunas existentes
        // para fechar a Onda 3 / R.8. As outras 5 colunas do bloco vieram na
        // migration 20260817010000 (ver doc/PLANO_REVISAO_FORM_ROBO.md, R.8).
        cia_atual: f.seguradoraAnterior,
        apolice_atual: f.apoliceAnterior,
        ci_atual: f.ciApoliceAnterior,
        classe_bonus: f.classeBonusAnterior,
        sucursal_anterior: f.sucursalAnterior,
        cobertura_anterior: f.coberturaAnterior,
        status_apolice_anterior: f.statusApoliceAnterior,
        inicio_vigencia_anterior: f.inicioVigenciaAnterior,
        fim_vigencia_anterior: f.fimVigenciaAnterior,
        seguradoras_sel: f.seguradorasSel,
        tipo_calculo: f.tipoCalculo,
        tipo_cobertura: f.tipoCobertura,
        observacoes: f.observacoesCot,
      },
      veiculo: {
        placa: normalizePlaca(f.placa),
        chassi: f.chassi,
        renavam: f.renavam,
        marca_codigo: f.marca,
        marca_nome: marcas.find((m) => m.codigo === f.marca)?.nome || "",
        modelo_codigo: f.modelo,
        modelo_nome: modelos.find((m) => String(m.codigo) === f.modelo)?.nome || "",
        ano_modelo: f.anoModelo,
        ano_fab: f.anoFab,
        combustivel: f.combustivel,
        cor: f.cor,
        tipo_cambio: f.tipoCambio,
        zero_km: f.zeroKm,
        data_saida_concessionaria: f.dataSaidaConcessionaria,
        odometro: f.odometro,
        alienado: f.alienado,
        banco: f.banco,
        km_mensal: f.kmMensal,
        fipe_valor: fipeValor,
        tipo_uso: f.tipoUso,
        uso_trabalho: f.usoTrabalho,
        uso_estudo: f.usoEstudo,
        uso_comercial_dois_dias: f.usoComercialDoisDias === "sim",
        categoria_taxi: f.categoriaTaxi,
        utilizacao_locadora: f.utilizacaoLocadora,
        condutores_que_utilizam: f.condutoresQueUtilizam,
        cep_circulacao: f.cepCirculacao,
        chassi_remarcado: f.chassiRemarcado === "sim",
        leilao: f.leilao,
        isencao_imposto: f.isencaoImposto,
        pcd_cnh_especial: f.pcdCnhEspecial === "sim",
        valor_adaptacao_pcd: f.valorAdaptacaoPcd,
        possui_antifurto_porto: f.possuiAntifurtoPorto === "sim",
        hdi_seguros_basico: f.hdiSegurosBasico === "sim",
        antifurto: f.antifurto,
        antifurto_detalhes: f.antifurtoDetalhes,
        blindagem: f.blindagemAtiva === "sim",
        cobertura_blindagem: f.coberturaBlindagem,
        valor_blindagem: f.valorBlindagem,
        com_franquia_blindagem: f.comFranquiaBlindagem === "sim",
        kit_gas: f.kitGasAtivo === "sim",
        cobertura_kit_gas: f.coberturaKitGas === "sim",
        valor_kit_gas: f.valorKitGas,
        com_franquia_kit_gas: f.comFranquiaKitGas === "sim",
        acessorios: f.acessoriosAtivo === "sim",
        kit_acessorios: f.kitAcessoriosAtivo === "sim",
        opcionais: f.opcionaisAtivo === "sim",
        equipamentos: f.equipamentosAtivo === "sim",
        acessorios_detalhes: f.acessoriosDetalhes,
      },
      perfil: {
        condutor_mesmo: f.condutorMesmo === "sim",
        cond_cpf: f.condCpf,
        cond_nome: f.condNome,
        cond_nasc: f.condNasc,
        cond_sexo: f.condSexo,
        cond_estado_civil: f.condEstadoCivil,
        cond_relacao: f.condRelacao,
        cond_nome_social: f.condNomeSocial,
        cond_tempo_habilitacao: f.condTempoHabilitacao,
        profissao: f.profissao,
        cep_pernoite: f.cepPernoite,
        tipo_garagem: f.tipoGaragem,
        seg_proprietario: f.segProprietario,
        relacao_com_proprietario: f.relacaoComProprietario,
        proprietario_tipo_pessoa: f.proprietarioTipoPessoa,
        proprietario_cpf: f.proprietarioCpf,
        proprietario_cnpj: f.proprietarioCnpj,
        proprietario_nome: f.proprietarioNome,
        proprietario_nome_social: f.proprietarioNomeSocial,
        proprietario_sexo: f.proprietarioSexo,
        proprietario_nascimento: f.proprietarioNascimento,
        proprietario_estado_civil: f.proprietarioEstadoCivil,
        tipo_residencia: f.tipoResidencia,
        tipo_atividade_empresa: f.tipoAtividadeEmpresa,
        ramo_atividade: f.ramoAtividade,
        profissao_principal_condutor: f.profissaoPrincipalCondutor,
        seguro_corretor_proximo: f.seguroCorretorProximo === "sim",
        jovens_18_25: f.jovens1825 === "sim",
        jovens_18_25_detalhes: f.jovens18a25Detalhes,
      },
      coberturas: {
        tipo_cobertura: f.tipoCobertura,
        casco: f.casco,
        casco_valor: f.cascoValor,
        app_morte: f.appMorte,
        app_invalidez: f.appInval,
        rcf_dm: f.rcfDm,
        rcf_dc: f.rcfDc,
        vidros: f.vidros,
        carro_reserva: f.carroReserva,
        assist_24: f.assist24,
        modalidade: f.modalidade,
        percentual_ajuste: f.percentualAjuste,
        franquia_primeira_opcao: f.franquiaPrimeiraOpcao,
        franquia_segunda_opcao: f.franquiaSegundaOpcao,
        danos_morais: f.danosMorais,
        despesas_extras: f.despesasExtras,
        pequenos_reparos: f.pequenosReparos,
      },
    };
  }

  async function persistir() {
    // só persiste se tiver algo identificador mínimo
    if (!f.cpf && !f.nome && !cotacaoId) return;
    setSaveState("saving");
    const { data, error } = await supabase.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: cotacaoId as string, // a RPC aceita null: cria rascunho novo
      p_payload: buildPayload() as never,
      // Canal capturado no gate "Lead Manual — origem" (só importa na criação
      // do lead; a RPC ignora em updates). Sempre explícito — nunca undefined,
      // pra não depender de resolução de overload no PostgREST.
      p_origem: f.canalOrigem || "cotacao",
    });
    if (error) {
      console.error("[cotacao] save error", error);
      setSaveState("error");
      return;
    }
    if (data && !cotacaoId) setCotacaoId(data as string);
    setSaveState("saved");
    setLastSavedAt(new Date());
  }

  // auto-save com debounce
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (loadingRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persistir();
    }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, step]);

  // carregar rascunho existente quando ?id=
  useEffect(() => {
    if (!routeId) return;
    let cancel = false;
    (async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select(
          "id,step_atual,ramo,segurado:cotacao_segurado(*),seguro:cotacao_seguro(*),veiculo:cotacao_veiculo(*),perfil:cotacao_perfil(*),coberturas:cotacao_coberturas(*)",
        )
        .eq("id", routeId)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        loadingRef.current = false;
        setLoading(false);
        return;
      }
      const s = data.segurado ?? ({} as NonNullable<typeof data.segurado>);
      const sg = data.seguro ?? ({} as NonNullable<typeof data.seguro>);
      const v = data.veiculo ?? ({} as NonNullable<typeof data.veiculo>);
      const p = data.perfil ?? ({} as NonNullable<typeof data.perfil>);
      const c = data.coberturas ?? ({} as NonNullable<typeof data.coberturas>);
      setStep(
        routeStep != null && !Number.isNaN(routeStep) ? routeStep : Number(data.step_atual ?? 0),
      );
      setF((prev) => ({
        ...prev,
        cpf: s.cpf_cnpj ? maskCpfCnpj(s.cpf_cnpj) : "",
        pessoa: s.pessoa ?? prev.pessoa,
        nome: s.nome ?? "",
        nomeSocial: s.nome_social ?? "",
        nasc: s.nascimento ?? "",
        sexo: s.sexo ?? "",
        estadoCivil: s.estado_civil ?? "",
        celular: s.celular ? maskCel(s.celular) : "",
        email: s.email ?? "",
        cep: s.cep ? maskCep(s.cep) : "",
        numero: s.numero ?? "",
        logradouro: s.logradouro ?? "",
        bairro: s.bairro ?? "",
        cidade: s.cidade ?? "",
        uf: s.uf ?? "",
        tipoSeguro: sg.tipo_seguro ?? prev.tipoSeguro,
        ramo: sg.ramo ?? prev.ramo,
        categoria: sg.categoria ?? prev.categoria,
        vigIni: sg.vig_ini ?? "",
        vigFim: sg.vig_fim ?? "",
        seguradoraAnterior: sg.cia_atual ?? prev.seguradoraAnterior,
        apoliceAnterior: sg.apolice_atual ?? prev.apoliceAnterior,
        ciApoliceAnterior: sg.ci_atual ?? prev.ciApoliceAnterior,
        classeBonusAnterior: sg.classe_bonus ?? prev.classeBonusAnterior,
        sucursalAnterior: sg.sucursal_anterior ?? prev.sucursalAnterior,
        coberturaAnterior: sg.cobertura_anterior ?? prev.coberturaAnterior,
        statusApoliceAnterior: sg.status_apolice_anterior ?? prev.statusApoliceAnterior,
        inicioVigenciaAnterior: sg.inicio_vigencia_anterior ?? prev.inicioVigenciaAnterior,
        fimVigenciaAnterior: sg.fim_vigencia_anterior ?? prev.fimVigenciaAnterior,
        seguradorasSel: Array.isArray(sg.seguradoras_sel)
          ? sg.seguradoras_sel
          : prev.seguradorasSel,
        tipoCalculo: sg.tipo_calculo ?? prev.tipoCalculo,
        tipoCobertura: sg.tipo_cobertura ?? prev.tipoCobertura,
        observacoesCot: sg.observacoes ?? prev.observacoesCot,
        placa: normalizePlaca(v.placa),
        chassi: v.chassi ?? "",
        renavam: v.renavam ?? "",
        marca: v.marca_codigo ?? "",
        modelo: v.modelo_codigo ?? "",
        anoModelo: v.ano_modelo ?? "",
        anoFab: v.ano_fab ?? "",
        combustivel: v.combustivel ?? prev.combustivel,
        cor: v.cor ?? "",
        tipoCambio: v.tipo_cambio ?? "",
        zeroKm: !!v.zero_km,
        dataSaidaConcessionaria: v.data_saida_concessionaria ?? "",
        odometro: v.odometro ?? "",
        alienado: !!v.alienado,
        banco: v.banco ?? "",
        kmMensal: v.km_mensal ?? "",
        tipoUso: v.tipo_uso ?? prev.tipoUso,
        usoTrabalho: v.uso_trabalho ?? prev.usoTrabalho,
        usoEstudo: v.uso_estudo ?? prev.usoEstudo,
        usoComercialDoisDias: v.uso_comercial_dois_dias ? "sim" : "nao",
        categoriaTaxi: v.categoria_taxi ?? "",
        utilizacaoLocadora: v.utilizacao_locadora ?? "",
        condutoresQueUtilizam: v.condutores_que_utilizam ?? "",
        cepCirculacao: v.cep_circulacao ? maskCep(v.cep_circulacao) : "",
        chassiRemarcado: v.chassi_remarcado ? "sim" : "nao",
        leilao: v.leilao ?? prev.leilao,
        isencaoImposto: v.isencao_imposto ?? prev.isencaoImposto,
        pcdCnhEspecial: v.pcd_cnh_especial ? "sim" : "nao",
        valorAdaptacaoPcd: v.valor_adaptacao_pcd ?? "",
        possuiAntifurtoPorto: v.possui_antifurto_porto ? "sim" : "nao",
        hdiSegurosBasico: v.hdi_seguros_basico ? "sim" : "nao",
        antifurto: v.antifurto ?? prev.antifurto,
        antifurtoDetalhes: (v.antifurto_detalhes as Record<string, string>) ?? {},
        blindagemAtiva: v.blindagem ? "sim" : "nao",
        coberturaBlindagem: v.cobertura_blindagem ?? "",
        valorBlindagem: v.valor_blindagem ?? "",
        comFranquiaBlindagem: v.com_franquia_blindagem ? "sim" : "nao",
        kitGasAtivo: v.kit_gas ? "sim" : "nao",
        coberturaKitGas: v.cobertura_kit_gas ? "sim" : "nao",
        valorKitGas: v.valor_kit_gas ?? "",
        comFranquiaKitGas: v.com_franquia_kit_gas ? "sim" : "nao",
        acessoriosAtivo: v.acessorios ? "sim" : "nao",
        kitAcessoriosAtivo: v.kit_acessorios ? "sim" : "nao",
        opcionaisAtivo: v.opcionais ? "sim" : "nao",
        equipamentosAtivo: v.equipamentos ? "sim" : "nao",
        acessoriosDetalhes: (v.acessorios_detalhes as Record<string, string>) ?? {},
        condutorMesmo: p.condutor_mesmo === false ? "nao" : "sim",
        condCpf: p.cond_cpf ? maskCpfCnpj(p.cond_cpf) : "",
        condNome: p.cond_nome ?? "",
        condNasc: p.cond_nasc ?? "",
        condSexo: p.cond_sexo ?? "",
        condEstadoCivil: p.cond_estado_civil ?? "",
        condRelacao: p.cond_relacao ?? "",
        condNomeSocial: p.cond_nome_social ?? "",
        condTempoHabilitacao: p.cond_tempo_habilitacao ?? "",
        profissao: p.profissao ?? "",
        cepPernoite: p.cep_pernoite ? maskCep(p.cep_pernoite) : "",
        tipoGaragem: p.tipo_garagem ?? prev.tipoGaragem,
        segProprietario: p.seg_proprietario ?? prev.segProprietario,
        relacaoComProprietario: p.relacao_com_proprietario ?? "",
        proprietarioTipoPessoa:
          (p.proprietario_tipo_pessoa as "Física" | "Jurídica" | null) ??
          prev.proprietarioTipoPessoa,
        proprietarioCpf: p.proprietario_cpf ?? "",
        proprietarioCnpj: p.proprietario_cnpj ?? "",
        proprietarioNome: p.proprietario_nome ?? "",
        proprietarioNomeSocial: p.proprietario_nome_social ?? "",
        proprietarioSexo: p.proprietario_sexo ?? "",
        proprietarioNascimento: p.proprietario_nascimento ?? "",
        proprietarioEstadoCivil: p.proprietario_estado_civil ?? "",
        tipoResidencia: p.tipo_residencia ?? prev.tipoResidencia,
        tipoAtividadeEmpresa: p.tipo_atividade_empresa ?? prev.tipoAtividadeEmpresa,
        ramoAtividade: p.ramo_atividade ?? "",
        profissaoPrincipalCondutor: p.profissao_principal_condutor ?? "",
        seguroCorretorProximo: p.seguro_corretor_proximo ? "sim" : "nao",
        jovens1825: p.jovens_18_25 ? "sim" : "nao",
        jovens18a25Detalhes:
          (p.jovens_18_25_detalhes as { nome: string; idade: string; parentesco: string }[]) ?? [],
        casco: c.casco ?? prev.casco,
        cascoValor: c.casco_valor ?? "",
        appMorte: c.app_morte ?? "",
        appInval: c.app_invalidez ?? "",
        rcfDm: c.rcf_dm ?? "",
        rcfDc: c.rcf_dc ?? "",
        vidros: c.vidros ?? prev.vidros,
        carroReserva: c.carro_reserva ?? prev.carroReserva,
        assist24: c.assist_24 ?? prev.assist24,
        modalidade: c.modalidade ?? prev.modalidade,
        percentualAjuste: c.percentual_ajuste ?? prev.percentualAjuste,
        franquiaPrimeiraOpcao: c.franquia_primeira_opcao ?? prev.franquiaPrimeiraOpcao,
        franquiaSegundaOpcao: c.franquia_segunda_opcao ?? prev.franquiaSegundaOpcao,
        danosMorais: c.danos_morais ?? "",
        despesasExtras: c.despesas_extras ?? prev.despesasExtras,
        pequenosReparos: !!c.pequenos_reparos,
      }));
      if (v.fipe_valor) setFipeValor(v.fipe_valor);
      if (v.marca_codigo && v.marca_nome) {
        const marcaCodigo = v.marca_codigo;
        const marcaNome = v.marca_nome;
        setMarcas((m) =>
          m.some((x) => x.codigo === marcaCodigo)
            ? m
            : [...m, { codigo: marcaCodigo, nome: marcaNome }],
        );
      }
      if (v.modelo_codigo && v.modelo_nome) {
        const modeloCodigo = v.modelo_codigo;
        const modeloNome = v.modelo_nome;
        setModelos((m) =>
          m.some((x) => String(x.codigo) === String(modeloCodigo))
            ? m
            : [...m, { codigo: Number(modeloCodigo), nome: modeloNome }],
        );
      }
      setCotacaoId(routeId);
      setLastSavedAt(new Date());
      setSaveState("saved");
      // libera autosave após dois ticks pra evitar disparo pelo setF
      setTimeout(() => {
        loadingRef.current = false;
        setLoading(false);
      }, 50);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  return { cotacaoId, saveState, lastSavedAt, loading, buildPayload, persistir };
}
