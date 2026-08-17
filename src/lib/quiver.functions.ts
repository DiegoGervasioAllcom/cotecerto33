// Integração com a API real de cotação (Quiver — robô Playwright que
// preenche o portal da seguradora e devolve prêmios). Ver
// /Users/diego.gervasio/Documents/playwright/doc/EXTERNAL_API_GUIDE.md
// para o contrato completo do payload.
//
// Segue o mesmo padrão de server function de admin-users.functions.ts:
// client com service_role + validação manual do usuário via caller_token
// (a RLS de `cotacoes` não se aplica aqui porque o client é service_role).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { normalizePlaca } from "@/lib/masks";

function getAdmin() {
  const url =
    import.meta.env?.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.SELF_SUPABASE_URL;
  const serviceKey = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Configuração do servidor ausente.");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertDonoCotacao(
  admin: ReturnType<typeof getAdmin>,
  token: string,
  cotacaoId: string,
) {
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) throw new Error("Não autenticado.");
  const { data: cot, error: cotErr } = await admin
    .from("cotacoes")
    .select("id,responsavel_id")
    .eq("id", cotacaoId)
    .maybeSingle();
  if (cotErr) throw new Error(cotErr.message);
  if (!cot) throw new Error("Cotação não encontrada.");
  if (cot.responsavel_id !== userData.user.id) throw new Error("Permissão negada.");
}

const onlyDigits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const simNao = (v: boolean | null | undefined) => (v ? "Sim" : "Não");
// Campos de valor monetário (appMorte/appInvalidez/danosMorais) são salvos com a
// máscara de exibição "R$ 50.000,00" (maskBRL, novo-lead/masks.ts); a Quiver exige
// só o número (ex.: "10000,00" ou "10.000,00") e rejeita com HTTP 422 se receber o
// prefixo "R$ " (jul/2026).
const semPrefixoMoeda = (v: string | null | undefined) => (v ?? "").replace(/^R\$\s*/, "").trim();

// Nome canônico aceito pela Quiver (seguro.seguradorasDisponiveis) a partir
// do nome exibido no app. Cobre os 12 canônicos + variações mais comuns;
// qualquer seguradora fora dessa lista não é enviada (a Quiver rejeitaria).
const SEGURADORA_QUIVER: Record<string, string> = {
  aliro: "aliro",
  allianz: "allianz",
  azul: "azul",
  "azul seguros": "azul",
  bradesco: "bradesco",
  "bradesco auto": "bradesco",
  hdi: "hdi seguros",
  "hdi seguros": "hdi seguros",
  mapfre: "mapfre",
  porto: "porto",
  "porto seguro": "porto",
  suhai: "suhai",
  tokio: "tokio",
  yelum: "yelum",
};

function mapSeguradoras(sel: string[] | null | undefined): string[] {
  return (sel ?? [])
    .map((s) => SEGURADORA_QUIVER[s.trim().toLowerCase()])
    .filter((s): s is string => !!s);
}

// yyyy-mm-dd (<input type=date>) -> DD/MM/AAAA (formato exigido pelo validator
// para proprietarioNascimento/principalCondutorNascimento).
function toDDMMYYYY(v: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v ?? "");
}

function normalizeText(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Replica a classificação de complementares.relacaoSeguradoComProprietario
// do validator real (substring match case/acento-insensível) — decide se
// os dados do proprietário são exigidos e se podem ser Pessoa Jurídica.
const RELACOES_PROPRIETARIO_PF = [
  "conjuge",
  "ascendente",
  "descendente",
  "enteado",
  "irmao",
  "parente",
];
const RELACOES_PROPRIETARIO_PF_OU_PJ = [
  "empregado",
  "espolio",
  "executivo",
  "socio",
  "outros",
  "propria empresa",
  "empresas do mesmo grupo",
  "representantes legais",
  "alugados",
];
function exigeDadosProprietario(relacao: string): boolean {
  const n = normalizeText(relacao);
  return (
    RELACOES_PROPRIETARIO_PF.some((r) => n.includes(r)) ||
    RELACOES_PROPRIETARIO_PF_OU_PJ.some((r) => n.includes(r))
  );
}
function proprietarioPodeSerJuridica(relacao: string): boolean {
  const n = normalizeText(relacao);
  return RELACOES_PROPRIETARIO_PF_OU_PJ.some((r) => n.includes(r));
}

// Monta o payload no formato do EXTERNAL_API_GUIDE.md a partir das 5 tabelas
// filhas de `cotacoes`. O objeto `cobertura` (plano/franquia detalhados)
// ainda não tem coluna própria no schema — ver Fase 4 do plano "novo-lead:
// fechar com o protótipo v10"; fica com o default mais seguro/comum
// documentado no guia até existir.
export type CotacaoRow = {
  id: string;
  segurado: Record<string, unknown> | null;
  seguro: Record<string, unknown> | null;
  veiculo: Record<string, unknown> | null;
  perfil: Record<string, unknown> | null;
  coberturas: Record<string, unknown> | null;
};

export function montarPayloadQuiver(cot: CotacaoRow) {
  const s = cot.segurado ?? {};
  const sg = cot.seguro ?? {};
  const v = cot.veiculo ?? {};
  const p = cot.perfil ?? {};
  const c = cot.coberturas ?? {};

  const condutorMesmo = (p.condutor_mesmo as boolean | null) ?? true;
  const alienado = (v.alienado as boolean | null) ?? false;
  const seguradorasQuiver = mapSeguradoras(sg.seguradoras_sel as string[]);

  return {
    id: cot.id,
    segurado: {
      cpf: onlyDigits(s.cpf_cnpj as string),
      nomeSocial: (s.nome_social as string) || (s.nome as string) || "",
      telefone: onlyDigits((s.celular as string) || (s.tel_res as string)),
      email: s.email ?? "",
      cep: onlyDigits(s.cep as string),
      nome: s.nome ?? undefined,
      sexo: s.sexo ?? undefined,
      estadoCivil: s.estado_civil ?? undefined,
    },
    seguro: {
      tipo: (sg.tipo_seguro as string) || "Seguro novo",
      seguradorasDisponiveis: seguradorasQuiver.length ? seguradorasQuiver : undefined,
    },
    veiculo: {
      placa: normalizePlaca(v.placa as string | null | undefined),
      chassiRemarcado: simNao(v.chassi_remarcado as boolean),
      financiado: simNao(alienado),
      ...(alienado && v.banco ? { alienacaoFiduciaria: v.banco as string } : {}),
      antifurto: (v.antifurto as string) || "Não",
      // sub-campos por seguradora (bloqueadorAllianz, rastreadorPorto etc.)
      ...((v.antifurto_detalhes as Record<string, string> | null) ?? {}),
      ...(v.possui_antifurto_porto != null
        ? { possuiAntifurtoPorto: simNao(v.possui_antifurto_porto as boolean) }
        : {}),
      cepPernoite: onlyDigits(p.cep_pernoite as string),
      cepCirculacao: onlyDigits((v.cep_circulacao as string) || (p.cep_pernoite as string)),
      kmMes: onlyDigits(v.km_mensal as string),
      tipoUso: (v.tipo_uso as string) || "Particular",
      usoTrabalho: (v.uso_trabalho as string) || "Não trabalha",
      usoEstudo: (v.uso_estudo as string) || "Não estuda",
      ...((v.tipo_uso as string) === "Particular" || !v.tipo_uso
        ? { usoComercialDoisOuMaisDias: simNao(v.uso_comercial_dois_dias as boolean) }
        : {}),
      // categoriaTaxi/utilizacaoLocadora ficam sempre editáveis na UI (igual
      // ao protótipo), mas a Quiver rejeita se enviados com tipoUso diferente
      // do exigido — por isso o guard também confere tipo_uso, não só o valor.
      ...(v.tipo_uso === "Táxi" && v.categoria_taxi
        ? { categoriaTaxiVeiculo: v.categoria_taxi as string }
        : {}),
      ...(v.tipo_uso === "Locadora (Contrato)" && v.utilizacao_locadora
        ? { utilizacaoLocadoraContrato: v.utilizacao_locadora as string }
        : {}),
      ...(v.isencao_imposto ? { isencaoImposto: v.isencao_imposto as string } : {}),
      ...(v.hdi_seguros_basico != null
        ? { hdiSegurosBasico: simNao(v.hdi_seguros_basico as boolean) }
        : {}),
      ...(v.pcd_cnh_especial != null
        ? { pcdCnhEspecial: simNao(v.pcd_cnh_especial as boolean) }
        : {}),
      ...(v.pcd_cnh_especial && v.valor_adaptacao_pcd
        ? { valorAdaptacaoPcd: semPrefixoMoeda(v.valor_adaptacao_pcd as string) }
        : {}),
      ...(v.blindagem != null ? { blindagem: simNao(v.blindagem as boolean) } : {}),
      ...(v.blindagem
        ? {
            coberturaBlindagem: v.cobertura_blindagem as string,
            valorBlindagem: semPrefixoMoeda(v.valor_blindagem as string),
            comFranquia: simNao(v.com_franquia_blindagem as boolean),
          }
        : {}),
      ...(v.kit_gas != null ? { kitGas: simNao(v.kit_gas as boolean) } : {}),
      ...(v.kit_gas
        ? {
            coberturaKitGas: simNao(v.cobertura_kit_gas as boolean),
            ...(v.cobertura_kit_gas
              ? { valorKitGas: semPrefixoMoeda(v.valor_kit_gas as string) }
              : {}),
            comFranquiaKitGas: simNao(v.com_franquia_kit_gas as boolean),
          }
        : {}),
      ...(v.acessorios != null ? { acessorios: simNao(v.acessorios as boolean) } : {}),
      ...(v.acessorios
        ? {
            kitacessorios: simNao(v.kit_acessorios as boolean),
            opcionais: simNao(v.opcionais as boolean),
            equipamentos: simNao(v.equipamentos as boolean),
            ...Object.fromEntries(
              Object.entries((v.acessorios_detalhes as Record<string, string> | null) ?? {}).map(
                ([k, val]) => [k, semPrefixoMoeda(val)],
              ),
            ),
          }
        : {}),
    },
    complementares: {
      tipoGaragem: (p.tipo_garagem as string) || "Não",
      relacaoSeguradoProprietario: simNao((p.seg_proprietario as boolean | null) ?? true),
      ...(p.seg_proprietario === false && p.relacao_com_proprietario
        ? (() => {
            const relacao = p.relacao_com_proprietario as string;
            if (!exigeDadosProprietario(relacao)) {
              return { relacaoSeguradoComProprietario: relacao };
            }
            const podeSerJuridica = proprietarioPodeSerJuridica(relacao);
            const ehJuridica = podeSerJuridica && p.proprietario_tipo_pessoa === "Jurídica";
            return {
              relacaoSeguradoComProprietario: relacao,
              ...(podeSerJuridica
                ? { proprietarioTipoPessoa: (p.proprietario_tipo_pessoa as string) || "Física" }
                : {}),
              proprietarioNome: (p.proprietario_nome as string) ?? "",
              ...(ehJuridica
                ? { proprietarioCnpj: onlyDigits(p.proprietario_cnpj as string) }
                : {
                    proprietarioCpf: onlyDigits(p.proprietario_cpf as string),
                    proprietarioSexo: (p.proprietario_sexo as string) ?? "",
                    proprietarioNascimento: toDDMMYYYY(p.proprietario_nascimento as string),
                    proprietarioEstadoCivil: (p.proprietario_estado_civil as string) ?? "",
                    ...(p.proprietario_nome_social
                      ? { proprietarioNomeSocial: p.proprietario_nome_social as string }
                      : {}),
                  }),
            };
          })()
        : {}),
      principalCondutor: simNao(condutorMesmo),
      ...(!condutorMesmo
        ? {
            principalCondutorRelacaoSegurado: (p.cond_relacao as string) || "Outro(s)",
            principalCondutorCpf: onlyDigits(p.cond_cpf as string),
            principalCondutorNome: p.cond_nome ?? "",
            ...(p.cond_nome_social
              ? { principalCondutorNomeSocial: p.cond_nome_social as string }
              : {}),
            principalCondutorSexo: p.cond_sexo ?? "",
            principalCondutorNascimento: toDDMMYYYY(p.cond_nasc as string),
            principalCondutorEstadoCivil: p.cond_estado_civil ?? "",
          }
        : {}),
      tipoResidencia: (p.tipo_residencia as string) || "Casa",
      // ramoAtividadeComercialProfissional/profissaoPrincipalCondutor: exigidos
      // pela Quiver quando tipoUso <> "Particular", proibidos quando é
      // "Particular" — nunca enviar os dois casos ao mesmo tempo.
      ...(v.tipo_uso && v.tipo_uso !== "Particular"
        ? {
            ...(p.tipo_atividade_empresa
              ? { tipoAtividadeEmpresa: p.tipo_atividade_empresa as string }
              : {}),
            ramoAtividadeComercialProfissional: (p.ramo_atividade as string) || "",
            profissaoPrincipalCondutor: (p.profissao_principal_condutor as string) || "",
          }
        : {}),
      seguroCorretorProximo: simNao(p.seguro_corretor_proximo as boolean),
      // condutoresQueUtilizam é campo de `complementares` na Quiver (não de
      // `veiculo`, apesar de guardado em cotacao_veiculo) — só enviar quando
      // aplicável evita HTTP 422 por campo desconhecido.
      ...((v.tipo_uso === "Transporte por aplicativos - Veículo próprio" ||
        v.tipo_uso === "Transporte de funcionários") &&
      v.condutores_que_utilizam
        ? { condutoresQueUtilizam: v.condutores_que_utilizam as string }
        : {}),
      pessoas17a25: simNao(p.jovens_18_25 as boolean),
    },
    cobertura: {
      plano: (c.tipo_cobertura as string) || "Fácil",
      ...(c.modalidade ? { modalidade: c.modalidade as string } : {}),
      ...(c.percentual_ajuste ? { percentualAjuste: c.percentual_ajuste as string } : {}),
      ...(c.franquia_primeira_opcao
        ? { franquiaPrimeiraOpcao: c.franquia_primeira_opcao as string }
        : {}),
      ...(c.franquia_segunda_opcao
        ? { franquiaSegundaOpcao: c.franquia_segunda_opcao as string }
        : {}),
      danosMateriaisTerceiros: c.rcf_dm === "" ? undefined : (c.rcf_dm ?? undefined),
      danosCorporaisTerceiros: c.rcf_dc === "" ? undefined : (c.rcf_dc ?? undefined),
      ...(c.app_morte ? { appMortePorPassageiro: semPrefixoMoeda(c.app_morte as string) } : {}),
      ...(c.app_invalidez
        ? { appInvalidezPorPassageiro: semPrefixoMoeda(c.app_invalidez as string) }
        : {}),
      ...(c.danos_morais ? { danosMorais: semPrefixoMoeda(c.danos_morais as string) } : {}),
      ...(c.despesas_extras ? { despesasExtras: c.despesas_extras as string } : {}),
      ...(c.mais_assistencias
        ? {
            maisAssistencias: "Sim",
            ...(() => {
              // maisAssistenciasSeguradoras exige que a seguradora esteja em
              // seguro.seguradorasDisponiveis (quando enviado) — omitir em vez
              // de arriscar HTTP 422 se não conseguir canonicalizar/validar.
              const canon = mapSeguradoras([c.mais_assistencias_seguradora as string])[0];
              if (!canon) return {};
              if (seguradorasQuiver.length && !seguradorasQuiver.includes(canon)) return {};
              return { maisAssistenciasSeguradoras: canon };
            })(),
          }
        : {}),
    },
  };
}

type EnviarCotacaoPayload = { cotacaoId: string; caller_token: string };

export const enviarCotacaoQuiver = createServerFn({ method: "POST" })
  .inputValidator((data: EnviarCotacaoPayload) => {
    if (!data?.cotacaoId) throw new Error("cotacaoId obrigatório.");
    if (!data?.caller_token) throw new Error("Sem token.");
    return data;
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();
    await assertDonoCotacao(admin, data.caller_token, data.cotacaoId);

    const apiUrl = process.env.SELF_QUIVER_API_URL;
    if (!apiUrl) throw new Error("SELF_QUIVER_API_URL não configurada.");

    const { data: cot, error: cotErr } = await admin
      .from("cotacoes")
      .select(
        "id," +
          "segurado:cotacao_segurado(*)," +
          "seguro:cotacao_seguro(*)," +
          "veiculo:cotacao_veiculo(*)," +
          "perfil:cotacao_perfil(*)," +
          "coberturas:cotacao_coberturas(*)",
      )
      .eq("id", data.cotacaoId)
      .maybeSingle();
    if (cotErr) throw new Error(cotErr.message);
    if (!cot) throw new Error("Cotação não encontrada.");

    const payload = montarPayloadQuiver(cot as unknown as CotacaoRow);

    let res: Response;
    try {
      res = await fetch(`${apiUrl}/cotacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("Não foi possível conectar à API de cotação (Quiver).");
    }

    if (res.status !== 201) {
      let details: string[] = [];
      try {
        // Formato real da API (validateCotacao.ts): { error: { code, message, details: string[] } }.
        // Não é { details, error: string } — ler assim fazia `[body.error]` virar um array com o
        // OBJETO de erro inteiro, e o .join(...) mais abaixo coagia isso pra "[object Object]"
        // em vez da mensagem de validação real (ex.: "Campo veiculo.kmMes é obrigatório").
        const body = (await res.json()) as {
          error?: { code?: string; message?: string; details?: string[] };
        };
        details = body.error?.details?.length
          ? body.error.details
          : body.error?.message
            ? [body.error.message]
            : [];
      } catch {
        /* resposta sem JSON — segue sem detalhes */
      }
      throw new Error(
        details.length
          ? `Cotação rejeitada pela Quiver: ${details.join("; ")}`
          : `Falha ao enviar cotação (HTTP ${res.status}).`,
      );
    }

    const { error: updErr } = await admin
      .from("cotacoes")
      .update({ status: "enviada_quiver", quiver_enviado_em: new Date().toISOString() })
      .eq("id", data.cotacaoId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

type Segurado = {
  cpf_cnpj?: string | null;
  nome?: string | null;
  celular?: string | null;
  cep?: string | null;
};

type VeiculoTransmissao = {
  renavam?: string | null;
  cor?: string | null;
  chassi_remarcado?: boolean | null;
};

type TransmitirPropostaPayload = {
  cotacaoId: string;
  caller_token: string;
  /** Seguradora do card escolhido pelo cliente (ex.: "Suhai"). */
  seguradora: string;
  /** Forma de pagamento escolhida (ex.: "Boleto Bancário"). */
  formaPagamento: string;
  /** Parcelamento escolhido: "À vista", "2x" … "12x". */
  parcelas?: string;
  /** Código do produto no portal (ex.: "10290_81") — chave exata. */
  produtoId?: string;
  /** Texto do produto — serve de conferência contra o `produtoId`. */
  produto?: string;
};

/**
 * Dispara a TRANSMISSÃO (efetivação da venda) no robô Playwright.
 *
 * Espelha `enviarCotacaoQuiver`, com duas diferenças importantes:
 * 1. O endpoint `/transmissao` do robô EXIGE autenticação por headers
 *    (`x-client-key`/`x-client-secret`) — diferente de `/cotacao`, que não
 *    tem auth. Sem as env vars configuradas o robô devolve 401 (fail-closed).
 * 2. O robô localiza a cotação pelo NÚMERO DO PORTAL (ex.: "155010"), que é
 *    diferente do `numero` interno do CoteCerto. Esse número chega no webhook
 *    de cotação e fica em `cotacoes.quiver_resultado_raw.numeroCotacao`.
 *
 * Os dados do formulário de efetivação (RG, endereço, renavam…) são opcionais
 * no robô: o portal costuma trazê-los do cadastro do cliente. Enviamos o que
 * temos; se o portal exigir algo que falta, a transmissão falha com
 * `motivo: CAMPOS_PENDENTES` no webhook, listando exatamente o que pedir.
 */
export const transmitirPropostaQuiver = createServerFn({ method: "POST" })
  .inputValidator((data: TransmitirPropostaPayload) => {
    if (!data?.cotacaoId) throw new Error("cotacaoId obrigatório.");
    if (!data?.caller_token) throw new Error("Sem token.");
    if (!data?.seguradora) throw new Error("Selecione a seguradora do card.");
    if (!data?.formaPagamento) throw new Error("Selecione a forma de pagamento.");
    return data;
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();
    await assertDonoCotacao(admin, data.caller_token, data.cotacaoId);

    const apiUrl = process.env.SELF_QUIVER_API_URL;
    if (!apiUrl) throw new Error("SELF_QUIVER_API_URL não configurada.");
    const clientKey = process.env.SELF_QUIVER_TRANSMISSAO_CLIENT_KEY;
    const clientSecret = process.env.SELF_QUIVER_TRANSMISSAO_CLIENT_SECRET;
    if (!clientKey || !clientSecret) {
      throw new Error(
        "SELF_QUIVER_TRANSMISSAO_CLIENT_KEY/SECRET não configuradas — o endpoint de transmissão exige autenticação.",
      );
    }

    const { data: cot, error: cotErr } = await admin
      .from("cotacoes")
      .select(
        "id,quiver_resultado_raw," +
          "segurado:cotacao_segurado(cpf_cnpj,nome,celular,cep)," +
          "veiculo:cotacao_veiculo(renavam,cor,chassi_remarcado)",
      )
      .eq("id", data.cotacaoId)
      .maybeSingle();
    if (cotErr) throw new Error(cotErr.message);
    if (!cot) throw new Error("Cotação não encontrada.");

    // O select com joins vem tipado de forma imprecisa pelo supabase-js
    // (relações podem ser objeto ou array); normalizamos aqui.
    const cotacao = cot as unknown as {
      quiver_resultado_raw?: Record<string, unknown> | null;
      segurado?: Segurado | Segurado[] | null;
      veiculo?: VeiculoTransmissao | VeiculoTransmissao[] | null;
    };

    const raw = cotacao.quiver_resultado_raw;
    const numeroCotacao =
      raw && typeof raw.numeroCotacao === "string" ? raw.numeroCotacao : undefined;

    const segurado = Array.isArray(cotacao.segurado) ? cotacao.segurado[0] : cotacao.segurado;
    const veiculo = Array.isArray(cotacao.veiculo) ? cotacao.veiculo[0] : cotacao.veiculo;

    // Sem o número do portal o robô cai na busca por nome do cliente, que é
    // ambígua quando o mesmo cliente tem várias cotações — por isso avisamos.
    if (!numeroCotacao && !segurado?.nome) {
      throw new Error(
        "Cotação sem número do portal e sem nome do cliente — o robô não conseguiria localizá-la.",
      );
    }

    const soDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");
    const celular = soDigitos(segurado?.celular);

    const payload = {
      numeroCotacao,
      nomeCliente: segurado?.nome ?? undefined,
      cotacaoId: data.cotacaoId,
      seguradora: data.seguradora,
      produtoId: data.produtoId,
      produto: data.produto,
      formaPagamento: data.formaPagamento,
      parcelas: data.parcelas,
      // Campos opcionais do formulário de efetivação — enviamos só o que o
      // CoteCerto já tem cadastrado.
      renavam: veiculo?.renavam ?? undefined,
      corVeiculo: veiculo?.cor ?? undefined,
      chassiRemarcado:
        veiculo?.chassi_remarcado === null || veiculo?.chassi_remarcado === undefined
          ? undefined
          : veiculo.chassi_remarcado
            ? "Sim"
            : "Não",
      cepResidencial: segurado?.cep ?? undefined,
      dddCelular: celular.length >= 2 ? celular.slice(0, 2) : undefined,
    };

    let res: Response;
    try {
      res = await fetch(`${apiUrl}/transmissao`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-key": clientKey,
          "x-client-secret": clientSecret,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("Não foi possível conectar à API de transmissão (Quiver).");
    }

    if (res.status !== 201) {
      let details: string[] = [];
      try {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string; details?: string[] };
        };
        details = body.error?.details?.length
          ? body.error.details
          : body.error?.message
            ? [body.error.message]
            : [];
      } catch {
        /* resposta sem JSON — segue sem detalhes */
      }
      throw new Error(
        details.length
          ? `Transmissão rejeitada: ${details.join("; ")}`
          : `Falha ao transmitir (HTTP ${res.status}).`,
      );
    }

    // O resultado real (transmitido: true/false, motivo, mensagem) chega
    // depois, de forma assíncrona, no webhook — este 201 significa apenas
    // que o robô aceitou a solicitação e começou a processar.
    return { ok: true, numeroCotacao };
  });
