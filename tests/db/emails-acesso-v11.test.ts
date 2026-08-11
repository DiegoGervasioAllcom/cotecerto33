import { beforeAll, describe, expect, test } from "vitest";
import {
  admin,
  criarEmpresa,
  criarPersonaComEmpresa,
  criarUsuario,
  loginMatriz,
  uniq,
  type Db,
} from "../helpers/supabase";

type Pedido = { empresaId: string; userId: string; email: string; nome: string; client: Db };

async function criarPedidoPendente(prefix: string): Promise<Pedido> {
  const email = `${uniq(prefix)}@teste.local`;
  const nome = uniq("Solicitante");
  const empresa = await criarEmpresa({ nome: uniq(prefix), status: "pendente" });
  const pessoa = await criarUsuario(email);
  const { error } = await admin
    .from("profiles")
    .update({ empresa_id: empresa.id, nome, status: "pendente" })
    .eq("id", pessoa.userId);
  if (error) throw error;
  return { empresaId: empresa.id, userId: pessoa.userId, email, nome, client: pessoa.client };
}

const CAMPOS_SECRETOS = /(^|_)(link|token|senha|password)($|_)/i;

function esperarPayloadSeguro(payload: unknown, esperado: Record<string, unknown>) {
  expect(payload).toEqual(esperado);
  expect(Object.keys(payload as Record<string, unknown>)).not.toEqual(
    expect.arrayContaining([expect.stringMatching(CAMPOS_SECRETOS)]),
  );
  expect(JSON.stringify(payload)).not.toMatch(/"(?:link|token|senha|password)"\s*:/i);
}

async function criarFullDona(prefix: string) {
  const { data: modelo, error: modeloError } = await admin
    .from("modelos_franquia")
    .select("id")
    .eq("modalidade", "full")
    .limit(1)
    .single();
  if (modeloError) throw modeloError;
  const empresa = await criarEmpresa();
  await admin.from("empresas").update({ modelo_id: modelo.id }).eq("id", empresa.id);
  const master = await criarPersonaComEmpresa("master", { emailPrefix: `${prefix}-master` });
  return criarPersonaComEmpresa("franqueado", {
    empresaId: empresa.id,
    emailPrefix: prefix,
    superiorId: master.userId,
  });
}

async function criarPedidoDaFull(fullId: string, criadoPor: string): Promise<Pedido> {
  const pedido = await criarPedidoPendente("email-full-pedido");
  const { data: codigo } = await admin.rpc("fn_convite_codigo");
  const { data: convite, error } = await admin
    .from("convites")
    .insert({
      codigo: codigo as string,
      token: crypto.randomUUID().replace(/-/g, "").padEnd(44, "x"),
      nome: uniq("Vendedor Full"),
      escopo: "externo",
      trilha: "externo",
      perfil: "vendedor",
      vinc_tipo: "full",
      vinc_empresa_id: fullId,
      expira_em: new Date(Date.now() + 86_400_000).toISOString(),
      criado_por: criadoPor,
    })
    .select("id")
    .single();
  if (error) throw error;
  await admin.from("empresas").update({ convite_id: convite.id }).eq("id", pedido.empresaId);
  return pedido;
}

describe("V11.2.1 — e-mails de acesso e outbox", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  test("Matriz solicita pendência e vê somente o e-mail que criou", async () => {
    const pedido = await criarPedidoPendente("email-pendencia");
    const { data: outboxId, error } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "  Enviar contrato social  ",
    });
    expect(error).toBeNull();
    expect(outboxId).toEqual(expect.any(String));

    const { data: empresa } = await admin
      .from("empresas")
      .select("pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();
    expect(empresa?.pendencia_motivo).toBe("Enviar contrato social");
    expect(empresa?.pendencia_em).not.toBeNull();

    const { data: visivel } = await matriz
      .from("email_outbox")
      .select("tipo, destinatario, payload, status, tentativas")
      .eq("id", outboxId as string)
      .single();
    expect(visivel).toMatchObject({
      tipo: "pendencia",
      destinatario: pedido.email.toLowerCase(),
      status: "pendente",
      tentativas: 0,
    });
    expect(visivel?.payload).toMatchObject({ pendencia: "Enviar contrato social" });
    expect(JSON.stringify(visivel?.payload)).not.toMatch(/senha|password/i);

    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "email-outbox-negativo",
    });
    const { data: oculto, error: selectError } = await vendedor.client
      .from("email_outbox")
      .select("id")
      .eq("id", outboxId as string);
    expect(selectError).toBeNull();
    expect(oculto).toEqual([]);
  });

  test("vendedor NÃO solicita pendência nem recusa pedido fora da sua alçada", async () => {
    const pedido = await criarPedidoPendente("email-sem-alcada");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "email-sem-alcada-vendedor",
    });

    const { error: pendenciaError } = await vendedor.client.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Documento ilegível",
    });
    expect(pendenciaError?.message).toContain("não permite analisar");

    const { error: recusaError } = await vendedor.client.rpc("recusar_empresa", {
      p_empresa_id: pedido.empresaId,
      motivo: "Cadastro incompatível",
    });
    expect(recusaError?.message).toContain("não permite recusar");
  });

  test("motivos curtos são rejeitados e não alteram o pedido", async () => {
    const pedido = await criarPedidoPendente("email-motivo-curto");
    const { error } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: " x ",
    });
    expect(error?.message).toContain("3 a 1000 caracteres");

    const { data: empresa } = await admin
      .from("empresas")
      .select("pendencia_motivo")
      .eq("id", pedido.empresaId)
      .single();
    expect(empresa?.pendencia_motivo).toBeNull();
  });

  test("recusa atualiza empresa e profile e cria outbox sem manter pendência", async () => {
    const pedido = await criarPedidoPendente("email-recusa");
    await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar comprovante",
    });

    const { data: outboxId, error } = await matriz.rpc("recusar_empresa", {
      p_empresa_id: pedido.empresaId,
      motivo: "  Documento incompatível  ",
    });
    expect(error).toBeNull();
    expect(outboxId).toEqual(expect.any(String));

    const { data: empresa } = await admin
      .from("empresas")
      .select("status, recusa_motivo, recusada_em, pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();
    expect(empresa).toMatchObject({
      status: "recusada",
      recusa_motivo: "Documento incompatível",
      pendencia_motivo: null,
      pendencia_em: null,
    });
    expect(empresa?.recusada_em).not.toBeNull();

    const { data: profiles } = await admin
      .from("profiles")
      .select("status")
      .eq("empresa_id", pedido.empresaId);
    expect(profiles?.every((profile) => profile.status === "recusada")).toBe(true);

    const { data: outbox, error: outboxError } = await matriz
      .from("email_outbox")
      .select("tipo, payload")
      .eq("id", outboxId as string)
      .single();
    expect(outboxError).toBeNull();
    expect(outbox?.tipo).toBe("recusa");
    expect(outbox?.payload).toMatchObject({ motivo: "Documento incompatível" });
  });

  test("somente o criador reivindica o envio e somente o serviço finaliza", async () => {
    const pedido = await criarPedidoPendente("email-dispatch");
    const { data: outboxId } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar documento",
    });
    const outro = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "email-dispatch-outro",
    });

    const { error: claimAlheio } = await outro.client.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(claimAlheio?.message).toContain("indisponível");

    const { data: claimed, error: claimError } = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(claimError).toBeNull();
    expect(claimed).toMatchObject({ id: outboxId, tipo: "pendencia" });
    const leaseToken = (claimed as { lease_token: string }).lease_token;

    const { error: finishUsuario } = await matriz.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: leaseToken,
      p_resultado: "enviado",
    });
    expect(finishUsuario).not.toBeNull();

    const { error: finishServico } = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: leaseToken,
      p_resultado: "enviado",
      p_provider_id: "resend-123",
    });
    expect(finishServico).toBeNull();

    const { data: final, error: finalError } = await matriz
      .from("email_outbox")
      .select("status, tentativas, provider_id, enviado_em")
      .eq("id", outboxId as string)
      .single();
    expect(finalError).toBeNull();
    expect(final).toMatchObject({ status: "enviado", tentativas: 1, provider_id: "resend-123" });
    expect(final?.enviado_em).not.toBeNull();
  });

  test("lease expirado NÃO é reclaimado e fencing token inválido não finaliza", async () => {
    const pedido = await criarPedidoPendente("email-lease");
    const { data: outboxId } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar documento",
    });
    const claimA = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(claimA.error).toBeNull();
    const tokenA = (claimA.data as { lease_token: string }).lease_token;

    const antesDoLease = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(antesDoLease.error?.message).toContain("indisponível");

    const { error: envelhecerError } = await admin
      .from("email_outbox")
      .update({ processando_em: new Date(Date.now() - 6 * 60_000).toISOString() })
      .eq("id", outboxId as string);
    expect(envelhecerError).toBeNull();

    const claimB = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(claimB.error?.message).toContain("indisponível");

    const finalizacaoA = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: "00000000-0000-0000-0000-000000000001",
      p_resultado: "enviado",
      p_provider_id: "provider-worker-a",
    });
    expect(finalizacaoA.error?.message).toContain("lease de e-mail expirado ou substituído");

    const { data: aposA } = await matriz
      .from("email_outbox")
      .select("status, tentativas, provider_id, enviado_em")
      .eq("id", outboxId as string)
      .single();
    expect(aposA).toMatchObject({
      status: "enviando",
      tentativas: 1,
      provider_id: null,
      enviado_em: null,
    });

    const finalizacaoB = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: tokenA,
      p_resultado: "enviado",
      p_provider_id: "provider-worker-b",
    });
    expect(finalizacaoB.error).toBeNull();

    const { data: aposB } = await matriz
      .from("email_outbox")
      .select("status, tentativas, provider_id, enviado_em")
      .eq("id", outboxId as string)
      .single();
    expect(aposB).toMatchObject({
      status: "enviado",
      tentativas: 1,
      provider_id: "provider-worker-b",
    });
    expect(aposB?.enviado_em).not.toBeNull();
  });

  test("retry reutiliza o mesmo outbox sem repetir decisão ou criar novo evento", async () => {
    const pedido = await criarPedidoPendente("email-retry");
    const { data: outboxId } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar comprovante",
    });
    const { data: decisaoAntes } = await admin
      .from("empresas")
      .select("pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();

    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    const leaseToken = (claim.data as { lease_token: string }).lease_token;
    const { error: falhaError } = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: leaseToken,
      p_resultado: "falha_explicita",
      p_erro: "Resend HTTP 422",
    });
    expect(falhaError).toBeNull();

    const retry = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ id: outboxId });

    const { data: outboxes } = await matriz
      .from("email_outbox")
      .select("id, tentativas")
      .eq("empresa_id", pedido.empresaId);
    expect(outboxes).toEqual([{ id: outboxId, tentativas: 2 }]);

    const { data: decisaoDepois } = await admin
      .from("empresas")
      .select("pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();
    expect(decisaoDepois).toEqual(decisaoAntes);
  });

  test("resultado ambíguo fica incerto, não é claimável e não repete a decisão", async () => {
    const pedido = await criarPedidoPendente("email-incerto");
    const { data: outboxId } = await matriz.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar comprovante legível",
    });
    const { data: decisaoAntes } = await admin
      .from("empresas")
      .select("pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();

    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    const leaseToken = (claim.data as { lease_token: string }).lease_token;
    const finalizacao = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: leaseToken,
      p_resultado: "incerto",
      p_erro: "timeout aguardando resposta do provedor",
    });
    expect(finalizacao.error).toBeNull();

    const retry = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(retry.error?.message).toContain("indisponível");

    const { data: outboxes } = await matriz
      .from("email_outbox")
      .select("id, status, tentativas")
      .eq("empresa_id", pedido.empresaId);
    expect(outboxes).toEqual([{ id: outboxId, status: "incerto", tentativas: 1 }]);

    const { data: decisaoDepois } = await admin
      .from("empresas")
      .select("pendencia_motivo, pendencia_em")
      .eq("id", pedido.empresaId)
      .single();
    expect(decisaoDepois).toEqual(decisaoAntes);
  });

  test("Franquia Full dona solicita pendência para seu vendedor", async () => {
    const full = await criarFullDona("email-full-dona");
    const pedido = await criarPedidoDaFull(full.empresaId, full.userId);
    const { data: outboxId, error } = await full.client.rpc("solicitar_pendencia_acesso", {
      p_empresa_id: pedido.empresaId,
      p_pendencia: "Enviar documento com foto",
    });
    expect(error).toBeNull();
    expect(outboxId).toEqual(expect.any(String));

    const { data: outbox } = await full.client
      .from("email_outbox")
      .select("criado_por, payload")
      .eq("id", outboxId as string)
      .single();
    expect(outbox?.criado_por).toBe(full.userId);
    expect(outbox?.payload).toMatchObject({ pendencia: "Enviar documento com foto" });
  });

  test("aprovação pública enfileira boas-vindas na mesma transação", async () => {
    const pedido = await criarPedidoPendente("email-aprovacao");
    const { data: outboxId, error } = await matriz.rpc("aprovar_acesso_com_boas_vindas", {
      p_empresa_id: pedido.empresaId,
      p_perfil: "master",
    });
    expect(error).toBeNull();
    expect(outboxId).toEqual(expect.any(String));

    const { count } = await admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", pedido.empresaId)
      .eq("tipo", "boas_vindas");
    expect(count).toBe(1);
  });

  test("outbox rejeita e-mail, payload e faixa de tentativas inválidos", async () => {
    const pedido = await criarPedidoPendente("email-constraints");
    const { data: matrizProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", "desenvolvimento@suppercerto.com.br")
      .single();
    const base = {
      empresa_id: pedido.empresaId,
      tipo: "pendencia" as const,
      criado_por: matrizProfile!.id,
    };

    const { error: validoError } = await admin
      .from("email_outbox")
      .insert({ ...base, destinatario: pedido.email, payload: {} });
    expect(validoError).toBeNull();

    const { error: emailError } = await admin
      .from("email_outbox")
      .insert({ ...base, destinatario: "email-invalido", payload: {} });
    expect(emailError).not.toBeNull();

    const { error: payloadError } = await admin.from("email_outbox").insert({
      ...base,
      destinatario: pedido.email,
      payload: [] as unknown as Record<string, never>,
    });
    expect(payloadError).not.toBeNull();

    const { error: tentativasError } = await admin
      .from("email_outbox")
      .insert({ ...base, destinatario: pedido.email, payload: {}, tentativas: 11 });
    expect(tentativasError).not.toBeNull();
  });
});

describe("V11.2.2 — boas-vindas depois da aprovação", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  test.each([
    {
      variante: "matriz",
      perfil: "matriz" as const,
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "matriz",
        aprovador: "Administrador Matriz",
      }),
    },
    {
      variante: "cargo",
      perfil: "interno" as const,
      cargoId: "marketing",
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "cargo",
        cargo: "Marketing",
        areas: expect.arrayContaining(["Distribuição"]),
        janela: "Todos os dias, sem restrição de horário",
      }),
    },
    {
      variante: "supervisor",
      perfil: "supervisor" as const,
      cargoId: "sup_vendas",
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "supervisor",
        tipo_supervisor: "Vendas",
        areas: expect.arrayContaining(["Aprovações"]),
      }),
    },
    {
      variante: "master",
      perfil: "master" as const,
      empresa: { nome: "Grupo Sul", cidade: "Curitiba", uf: "pr" },
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "master",
        grupo: "Grupo Sul",
        regiao: "Curitiba/PR",
      }),
    },
    {
      variante: "franquia_full",
      perfil: "franqueado" as const,
      modalidade: "full" as const,
      empresa: { nome: "Supper Curitiba", cidade: "Curitiba", uf: "pr" },
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "franquia_full",
        franquia: "Supper Curitiba",
        cidade_uf: "Curitiba/PR",
      }),
    },
    {
      variante: "franquia_individual",
      perfil: "franqueado" as const,
      modeloNome: "Smart",
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "franquia_individual",
        modelo: "Smart",
        responsavel: "Administrador Matriz",
      }),
    },
    {
      variante: "vendedor",
      perfil: "vendedor" as const,
      esperado: (pedido: Pedido) => ({
        nome: pedido.nome,
        variante: "vendedor",
        origem: "Matriz",
        responsavel: "Administrador Matriz",
      }),
    },
  ])(
    "persiste payload completo e sem segredo para $variante",
    async ({ variante, perfil, cargoId, modalidade, modeloNome, empresa, esperado }) => {
      const pedido = await criarPedidoPendente(`payload-${variante}`);
      if (empresa) {
        const { error } = await admin.from("empresas").update(empresa).eq("id", pedido.empresaId);
        expect(error).toBeNull();
      }
      if (modalidade || modeloNome) {
        let query = admin.from("modelos_franquia").select("id").limit(1);
        if (modalidade) query = query.eq("modalidade", modalidade);
        if (modeloNome) query = query.eq("nome", modeloNome);
        const { data: modelo, error: modeloError } = await query.single();
        expect(modeloError).toBeNull();
        const { error } = await admin
          .from("empresas")
          .update({ modelo_id: modelo!.id })
          .eq("id", pedido.empresaId);
        expect(error).toBeNull();
      }

      const master =
        modalidade === "full"
          ? await criarPersonaComEmpresa("master", { emailPrefix: "payload-full-master" })
          : null;
      const aprovacao = await matriz.rpc("aprovar_acesso", {
        p_empresa_id: pedido.empresaId,
        p_perfil: perfil,
        p_cargo_id: cargoId,
        p_superior_id: master?.userId,
      });
      expect(aprovacao.error).toBeNull();
      const enfileiramento = await matriz.rpc("enfileirar_boas_vindas", {
        p_empresa_id: pedido.empresaId,
      });
      expect(enfileiramento.error).toBeNull();

      const { data: outbox, error } = await admin
        .from("email_outbox")
        .select("tipo, destinatario, payload")
        .eq("id", enfileiramento.data as string)
        .single();
      expect(error).toBeNull();
      expect(outbox).toMatchObject({ tipo: "boas_vindas", destinatario: pedido.email });
      esperarPayloadSeguro(outbox!.payload, esperado(pedido));
    },
  );

  test("Matriz enfileira uma única boas-vindas para empresa e profile aprovados", async () => {
    const pedido = await criarPedidoPendente("boas-vindas-matriz");
    const aprovacao = await matriz.rpc("aprovar_acesso", {
      p_empresa_id: pedido.empresaId,
      p_perfil: "master",
    });
    expect(aprovacao.error).toBeNull();

    const primeira = await matriz.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    const segunda = await matriz.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    expect(primeira.error).toBeNull();
    expect(segunda.error).toBeNull();
    expect(segunda.data).toBe(primeira.data);

    const { data: rows, error } = await matriz
      .from("email_outbox")
      .select("id, tipo, destinatario, payload")
      .eq("empresa_id", pedido.empresaId)
      .eq("tipo", "boas_vindas");
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ id: primeira.data, destinatario: pedido.email });
    expect(JSON.stringify(rows?.[0].payload)).not.toMatch(/token|link|senha|password/i);
  });

  test("Franquia Full dona aprova e enfileira boas-vindas para seu vendedor", async () => {
    const full = await criarFullDona("boas-vindas-full");
    const pedido = await criarPedidoDaFull(full.empresaId, full.userId);
    const aprovacao = await full.client.rpc("aprovar_acesso", {
      p_empresa_id: pedido.empresaId,
      p_perfil: "vendedor",
    });
    expect(aprovacao.error).toBeNull();

    const boasVindas = await full.client.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    expect(boasVindas.error).toBeNull();
    expect(boasVindas.data).toEqual(expect.any(String));
  });

  test("NÃO enfileira antes de empresa e profile estarem aprovados", async () => {
    const pedido = await criarPedidoPendente("boas-vindas-pendente");
    const result = await matriz.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    expect(result.error?.message).toContain("precisam estar aprovados");

    const { count } = await admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", pedido.empresaId)
      .eq("tipo", "boas_vindas");
    expect(count).toBe(0);
  });

  test("vendedor alheio NÃO enfileira boas-vindas de empresa aprovada", async () => {
    const pedido = await criarPedidoPendente("boas-vindas-sem-alcada");
    expect(
      (
        await matriz.rpc("aprovar_acesso", {
          p_empresa_id: pedido.empresaId,
          p_perfil: "master",
        })
      ).error,
    ).toBeNull();
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "boas-vindas-vendedor-alheio",
    });

    const result = await vendedor.client.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    expect(result.error?.message).toContain("não permite concluir");
  });

  test("Matriz NÃO enfileira boas-vindas do vendedor pertencente à Full", async () => {
    const full = await criarFullDona("boas-vindas-full-negativo");
    const pedido = await criarPedidoDaFull(full.empresaId, full.userId);
    expect(
      (
        await full.client.rpc("aprovar_acesso", {
          p_empresa_id: pedido.empresaId,
          p_perfil: "vendedor",
        })
      ).error,
    ).toBeNull();

    const result = await matriz.rpc("enfileirar_boas_vindas", {
      p_empresa_id: pedido.empresaId,
    });
    expect(result.error?.message).toContain("não permite concluir");
  });

  test("emissão vira pendente só após envio confirmado e o titular a ativa sem senha/token na RPC", async () => {
    const pedido = await criarPedidoPendente("ativacao-acesso");
    expect(
      (
        await matriz.rpc("aprovar_acesso", {
          p_empresa_id: pedido.empresaId,
          p_perfil: "master",
        })
      ).error,
    ).toBeNull();

    const { data: outboxId, error: emitirError } = await matriz.rpc("reenviar_link_acesso", {
      p_empresa_id: pedido.empresaId,
    });
    expect(emitirError).toBeNull();

    const { data: nova } = await matriz
      .from("acesso_emissoes")
      .select("id, status, numero, outbox_id, envio_confirmado_em, ativado_em")
      .eq("outbox_id", outboxId as string)
      .single();
    expect(nova).toMatchObject({ status: "novo", numero: 1, outbox_id: outboxId });
    expect(nova?.envio_confirmado_em).toBeNull();
    expect(nova?.ativado_em).toBeNull();

    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: outboxId as string,
    });
    expect(claim.error).toBeNull();
    const { error: envioError } = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: outboxId as string,
      p_lease_token: (claim.data as { lease_token: string }).lease_token,
      p_resultado: "enviado",
      p_provider_id: "resend-ativacao-confirmada",
    });
    expect(envioError).toBeNull();

    const { data: pendente } = await pedido.client
      .from("acesso_emissoes")
      .select("status, envio_confirmado_em, ativado_em")
      .eq("id", nova!.id)
      .single();
    expect(pendente?.status).toBe("pendente");
    expect(pendente?.envio_confirmado_em).not.toBeNull();
    expect(pendente?.ativado_em).toBeNull();

    const ativacao = await pedido.client.rpc("ativar_acesso_apos_criar_senha", {
      p_emissao_id: nova!.id,
      p_versao: nova!.numero,
    });
    expect(ativacao.error).toBeNull();
    expect(ativacao.data).toBe(nova!.id);
    const { data: ativa } = await pedido.client
      .from("acesso_emissoes")
      .select("status, ativado_em")
      .eq("id", nova!.id)
      .single();
    expect(ativa?.status).toBe("ativo");
    expect(ativa?.ativado_em).not.toBeNull();
    expect(JSON.stringify(ativa)).not.toMatch(/senha|password|token|link/i);
  });

  test("Full reemite para vendedor próprio e Matriz não lê nem reenfileira a emissão dela", async () => {
    const full = await criarFullDona("emissao-full");
    const pedido = await criarPedidoDaFull(full.empresaId, full.userId);
    expect(
      (
        await full.client.rpc("aprovar_acesso", {
          p_empresa_id: pedido.empresaId,
          p_perfil: "vendedor",
        })
      ).error,
    ).toBeNull();
    const primeira = await full.client.rpc("reenviar_link_acesso", {
      p_empresa_id: pedido.empresaId,
    });
    expect(primeira.error).toBeNull();
    const segunda = await full.client.rpc("reenviar_link_acesso", {
      p_empresa_id: pedido.empresaId,
    });
    expect(segunda.error).toBeNull();
    expect(segunda.data).not.toBe(primeira.data);

    const { data: fullEmissoes } = await full.client
      .from("acesso_emissoes")
      .select("outbox_id, status, numero")
      .eq("empresa_id", pedido.empresaId)
      .order("numero");
    expect(fullEmissoes).toEqual([
      { outbox_id: primeira.data, status: "invalidada", numero: 1 },
      { outbox_id: segunda.data, status: "novo", numero: 2 },
    ]);

    const { data: matrizOculta, error: matrizSelectError } = await matriz
      .from("acesso_emissoes")
      .select("id")
      .eq("empresa_id", pedido.empresaId);
    expect(matrizSelectError).toBeNull();
    expect(matrizOculta).toEqual([]);
    const matrizReenvio = await matriz.rpc("reenviar_link_acesso", {
      p_empresa_id: pedido.empresaId,
    });
    expect(matrizReenvio.error?.message).toContain("não permite reenviar");
  });

  test("versão da emissão anterior não ativa o acesso depois do reenvio", async () => {
    const pedido = await criarPedidoPendente("emissao-fencing");
    await matriz.rpc("aprovar_acesso", { p_empresa_id: pedido.empresaId, p_perfil: "master" });
    const primeira = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(primeira.error).toBeNull();
    const { data: emissaoAntiga } = await admin
      .from("acesso_emissoes")
      .select("id,numero")
      .eq("outbox_id", primeira.data as string)
      .single();
    await admin
      .from("acesso_emissoes")
      .update({ status: "pendente", envio_confirmado_em: new Date().toISOString() })
      .eq("id", emissaoAntiga!.id);

    const segunda = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(segunda.error).toBeNull();
    const { data: emissaoAtual } = await admin
      .from("acesso_emissoes")
      .select("id,numero")
      .eq("outbox_id", segunda.data as string)
      .single();
    await admin
      .from("acesso_emissoes")
      .update({ status: "pendente", envio_confirmado_em: new Date().toISOString() })
      .eq("id", emissaoAtual!.id);

    const antiga = await pedido.client.rpc("ativar_acesso_apos_criar_senha", {
      p_emissao_id: emissaoAntiga!.id,
      p_versao: emissaoAntiga!.numero,
    });
    expect(antiga.error?.message).toContain("link de acesso inválido, substituído");
    const atual = await pedido.client.rpc("ativar_acesso_apos_criar_senha", {
      p_emissao_id: emissaoAtual!.id,
      p_versao: emissaoAtual!.numero,
    });
    expect(atual.error).toBeNull();
    expect(atual.data).toBe(emissaoAtual!.id);
  });

  test("interleaving claim -> reenvio é serializado e o dispatcher antigo não alcança GoTrue", async () => {
    const pedido = await criarPedidoPendente("emissao-toctou-reenvio");
    await matriz.rpc("aprovar_acesso", { p_empresa_id: pedido.empresaId, p_perfil: "master" });
    const primeira = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(primeira.error).toBeNull();

    // Simula exatamente o estado persistente entre o claim do dispatcher e o
    // generateLink: a emissão ainda é nova, mas a outbox já possui um lease.
    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: primeira.data as string,
    });
    expect(claim.error).toBeNull();
    const leaseToken = (claim.data as { lease_token: string }).lease_token;

    const duranteGeracao = await matriz.rpc("reenviar_link_acesso", {
      p_empresa_id: pedido.empresaId,
    });
    expect(duranteGeracao.error?.message).toContain("geração do link de acesso está em andamento");

    // O contrato antigo continua válido somente porque nenhuma nova emissão
    // conseguiu cruzar o lease. Ao encerrar a tentativa, a reemissão volta a
    // ser possível e a emissão anterior é fenced para a ativação.
    const contrato = await admin.rpc("obter_contrato_link_acesso", {
      p_outbox_id: primeira.data as string,
      p_lease_token: leaseToken,
    });
    expect(contrato.error).toBeNull();

    const finalizacao = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: primeira.data as string,
      p_lease_token: leaseToken,
      p_resultado: "enviado",
      p_provider_id: "resend-toctou-serializado",
    });
    expect(finalizacao.error).toBeNull();

    const segunda = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(segunda.error).toBeNull();
    expect(segunda.data).not.toBe(primeira.data);

    // A segunda metade determinística da interleaving: um dispatcher antigo
    // atrasado não consegue renovar o claim nem obter contrato para generateLink
    // depois que a reemissão venceu e invalidou a emissão anterior.
    const claimAntigo = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: primeira.data as string,
    });
    expect(claimAntigo.error?.message).toContain("e-mail indisponível");
    const contratoAntigo = await admin.rpc("obter_contrato_link_acesso", {
      p_outbox_id: primeira.data as string,
      p_lease_token: leaseToken,
    });
    expect(contratoAntigo.error?.message).toContain(
      "emissão de acesso substituída ou indisponível",
    );

    const { data: emissaoAntiga } = await admin
      .from("acesso_emissoes")
      .select("id, numero, status")
      .eq("outbox_id", primeira.data as string)
      .single();
    expect(emissaoAntiga?.status).toBe("invalidada");
    const antiga = await pedido.client.rpc("ativar_acesso_apos_criar_senha", {
      p_emissao_id: emissaoAntiga!.id,
      p_versao: emissaoAntiga!.numero,
    });
    expect(antiga.error?.message).toContain("link de acesso inválido, substituído");
  });

  test("perfil legado já ativo não recebe reemissão", async () => {
    const pedido = await criarPedidoPendente("emissao-legado-ativo");
    await matriz.rpc("aprovar_acesso", { p_empresa_id: pedido.empresaId, p_perfil: "master" });
    const { data: historico, error: historicoError } = await admin
      .from("email_outbox")
      .insert({
        empresa_id: pedido.empresaId,
        tipo: "boas_vindas_herdada",
        destinatario: pedido.email,
        payload: { origem: "teste_legado" },
        status: "enviado",
        criado_por: pedido.userId,
        enviado_em: new Date().toISOString(),
        provider_id: "historico-teste",
      })
      .select("id")
      .single();
    expect(historicoError).toBeNull();
    const { error: emissaoError } = await admin.from("acesso_emissoes").insert({
      empresa_id: pedido.empresaId,
      profile_id: pedido.userId,
      outbox_id: historico!.id,
      numero: 1,
      status: "ativo",
      criado_por: pedido.userId,
      envio_confirmado_em: new Date().toISOString(),
      ativado_em: new Date().toISOString(),
    });
    expect(emissaoError).toBeNull();

    const reenvio = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(reenvio.error?.message).toContain("acesso já está ativo");
  });

  test("falha explícita não libera acesso e reenvio invalida a emissão que falhou", async () => {
    const pedido = await criarPedidoPendente("emissao-falha");
    await matriz.rpc("aprovar_acesso", { p_empresa_id: pedido.empresaId, p_perfil: "master" });
    const primeira = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(primeira.error).toBeNull();

    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: primeira.data as string,
    });
    const falha = await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: primeira.data as string,
      p_lease_token: (claim.data as { lease_token: string }).lease_token,
      p_resultado: "falha_explicita",
      p_erro: "destinatário recusado",
    });
    expect(falha.error).toBeNull();

    const { data: aindaNovo } = await pedido.client
      .from("acesso_emissoes")
      .select("status, envio_confirmado_em")
      .eq("outbox_id", primeira.data as string)
      .single();
    expect(aindaNovo).toEqual({ status: "novo", envio_confirmado_em: null });
    expect(
      (
        await pedido.client.rpc("ativar_acesso_apos_criar_senha", {
          p_emissao_id: crypto.randomUUID(),
          p_versao: 1,
        })
      ).error?.message,
    ).toContain("link de acesso inválido, substituído ou já utilizado");

    const segunda = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(segunda.error).toBeNull();
    const { data: emissoes } = await matriz
      .from("acesso_emissoes")
      .select("outbox_id, status, numero")
      .eq("empresa_id", pedido.empresaId)
      .order("numero");
    expect(emissoes).toEqual([
      { outbox_id: primeira.data, status: "invalidada", numero: 1 },
      { outbox_id: segunda.data, status: "novo", numero: 2 },
    ]);
  });

  test("link confirmado há mais de 48 horas continua pendente, mas pode ser reemitido", async () => {
    const pedido = await criarPedidoPendente("emissao-expirada");
    await matriz.rpc("aprovar_acesso", { p_empresa_id: pedido.empresaId, p_perfil: "master" });
    const primeira = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    const claim = await matriz.rpc("marcar_email_outbox_enviando", {
      p_outbox_id: primeira.data as string,
    });
    await admin.rpc("finalizar_email_outbox", {
      p_outbox_id: primeira.data as string,
      p_lease_token: (claim.data as { lease_token: string }).lease_token,
      p_resultado: "enviado",
      p_provider_id: "resend-expirado",
    });
    const expiradoEm = new Date(Date.now() - 48 * 60 * 60 * 1000 - 1_000).toISOString();
    const { error: ajustarExpiracao } = await admin
      .from("acesso_emissoes")
      .update({ envio_confirmado_em: expiradoEm })
      .eq("outbox_id", primeira.data as string);
    expect(ajustarExpiracao).toBeNull();

    const { data: pendenteExpirada } = await pedido.client
      .from("acesso_emissoes")
      .select("status, envio_confirmado_em")
      .eq("outbox_id", primeira.data as string)
      .single();
    expect(pendenteExpirada?.status).toBe("pendente");
    expect(new Date(pendenteExpirada?.envio_confirmado_em ?? 0).getTime()).toBe(
      new Date(expiradoEm).getTime(),
    );
    const segunda = await matriz.rpc("reenviar_link_acesso", { p_empresa_id: pedido.empresaId });
    expect(segunda.error).toBeNull();
  });
});
