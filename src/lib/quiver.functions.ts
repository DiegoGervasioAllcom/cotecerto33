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

// Monta o payload no formato do EXTERNAL_API_GUIDE.md a partir das 5 tabelas
// filhas de `cotacoes`. Vários campos que a Quiver aceita ainda não têm
// coluna própria no schema (uso do veículo, antifurto, garagem detalhada,
// proprietário do veículo, plano de cobertura etc. — ver Fases 2-4 do plano
// "novo-lead: fechar com o protótipo v10"); esses ficam com o default mais
// seguro/comum documentado no guia, e passam a vir do formulário real assim
// que as colunas existirem — não precisa reescrever esta função, só
// adicionar os campos que já vêm nas tabelas filhas.
type CotacaoRow = {
  id: string;
  segurado: Record<string, unknown> | null;
  seguro: Record<string, unknown> | null;
  veiculo: Record<string, unknown> | null;
  perfil: Record<string, unknown> | null;
  coberturas: Record<string, unknown> | null;
};

function montarPayloadQuiver(cot: CotacaoRow) {
  const s = cot.segurado ?? {};
  const sg = cot.seguro ?? {};
  const v = cot.veiculo ?? {};
  const p = cot.perfil ?? {};
  const c = cot.coberturas ?? {};

  const condutorMesmo = (p.condutor_mesmo as boolean | null) ?? true;
  const alienado = (v.alienado as boolean | null) ?? false;

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
      seguradorasDisponiveis: mapSeguradoras(sg.seguradoras_sel as string[]) || undefined,
    },
    veiculo: {
      placa: v.placa ?? "",
      // TODO Fase 2: chassiRemarcado/antifurto/tipoUso/usoTrabalho/usoEstudo/
      // usoComercialDoisOuMaisDias/cepCirculacao ainda não têm coluna própria
      // — usando os defaults do "Exemplo A" do guia (fluxo Particular simples).
      chassiRemarcado: "Não",
      financiado: simNao(alienado),
      ...(alienado && v.banco ? { alienacaoFiduciaria: v.banco as string } : {}),
      antifurto: "Não",
      cepPernoite: onlyDigits(p.cep_pernoite as string),
      cepCirculacao: onlyDigits(p.cep_pernoite as string),
      kmMes: onlyDigits(v.km_mensal as string),
      tipoUso: "Particular",
      usoTrabalho: "Não trabalha",
      usoEstudo: "Não estuda",
      usoComercialDoisOuMaisDias: "Não",
    },
    complementares: {
      // TODO Fase 3: tipoGaragem/relacaoSeguradoProprietario/tipoResidencia/
      // seguroCorretorProximo ainda não têm coluna própria.
      tipoGaragem: p.garagem_resid ? "Sim, com portão manual" : "Não",
      relacaoSeguradoProprietario: "Sim",
      principalCondutor: simNao(condutorMesmo),
      ...(!condutorMesmo
        ? {
            principalCondutorCpf: onlyDigits(p.cond_cpf as string),
            principalCondutorNome: p.cond_nome ?? "",
            principalCondutorSexo: p.cond_sexo ?? "",
            principalCondutorNascimento: p.cond_nasc ?? "",
            principalCondutorEstadoCivil: p.cond_estado_civil ?? "",
          }
        : {}),
      tipoResidencia: "Casa/sobrado",
      seguroCorretorProximo: "Não",
      pessoas17a25: simNao(p.jovens_18_25 as boolean),
    },
    cobertura: {
      danosMateriaisTerceiros: c.rcf_dm ?? undefined,
      danosCorporaisTerceiros: c.rcf_dc ?? undefined,
      appMortePorPassageiro: c.app_morte ?? undefined,
      appInvalidezPorPassageiro: c.app_invalidez ?? undefined,
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
        const body = (await res.json()) as { details?: string[]; error?: string };
        details = body.details ?? (body.error ? [body.error] : []);
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
