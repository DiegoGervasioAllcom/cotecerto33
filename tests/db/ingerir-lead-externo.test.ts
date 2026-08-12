import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, uniq, uniqDoc, criarUsuario } from "../helpers/supabase";

function uniqTelefone(): string {
  return `11${Math.floor(900000000 + Math.random() * 99999999)}`.slice(0, 11);
}
function uniqPlaca(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e4)}`.padEnd(7, "0").toUpperCase();
}

/**
 * Ingestão de leads externos (app captacao-movida) — Etapa 1 + correção.
 *
 * 20260812000000_ingerir_lead_externo_captacao_movida.sql entrega a RPC
 * `ingerir_lead_externo`, só executável por `service_role` (RPC de borda,
 * mesmo padrão de `registrar_premios_quiver`).
 *
 * 20260813000000_corrigir_fila_lead_externo_captacao_movida.sql corrige a
 * distribuição: o lead nasce com empresa_id/responsavel_id nulos, na MESMA
 * fila global de qualquer lead sem vendedor — sujeito a
 * `trg_distribuir_lead_auto`. Se o trigger resolver uma regra automática,
 * distribui; senão fica pendente (visível/distribuível manualmente pela
 * Matriz pra qualquer empresa da rede). O cliente é religado à empresa
 * resolvida quando isso acontece; senão fica órfão (empresa_id null), estado
 * equivalente ao do próprio lead pendente.
 *
 * Dedup: cliente por telefone, lead por placa (origem=captacao_movida).
 */
describe("ingerir_lead_externo — captacao-movida", () => {
  let cidadeUnica: string;
  let cfgOriginal: Record<string, unknown> | null = null;

  beforeAll(async () => {
    cidadeUnica = uniq("cidade-captacao").toLowerCase();

    // garante que o automático fique desligado por padrão nestes testes —
    // singleton global, outros arquivos de teste podem deixar ligado.
    const { data: cfg } = await admin
      .from("distribuicao_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    cfgOriginal = cfg;
    await admin.from("distribuicao_config").update({ automatico_on: false }).eq("id", "default");
  });

  afterAll(async () => {
    if (cfgOriginal) await admin.from("distribuicao_config").upsert(cfgOriginal as never);
  });

  it("NEGATIVO: authenticated não pode chamar a RPC (só service_role)", async () => {
    const { data: user } = await admin.auth.admin.createUser({
      email: `${uniq("intruso")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
      process.env.VITE_SUPABASE_ANON_KEY || "",
    );
    await anon.auth.signInWithPassword({ email: user.user!.email!, password: "Teste@123!" });
    const { error } = await anon.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Forjado", telefone: "11999990000", placa: "ABC1234" },
    } as never);
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission denied/i);
  });

  it("cliente novo + lead novo caem na fila global sem vendedor (automático desligado)", async () => {
    const telefone = uniqTelefone();
    const placa = uniqPlaca("CAP");

    const { data, error } = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: {
        nome_cliente: "Cliente Um",
        telefone,
        placa,
        cidade: cidadeUnica,
        canal: "Indicação",
        loja: "Loja X",
      },
    } as never);
    expect(error).toBeNull();
    const row = (data as { lead_id: string; criado: boolean }[])[0];
    expect(row.criado).toBe(true);
    expect(row.lead_id).toBeTruthy();

    const { data: lead } = await admin
      .from("leads")
      .select("origem,nome,contato,empresa_id,responsavel_id,cliente_id,dados")
      .eq("id", row.lead_id)
      .single();
    expect(lead?.origem).toBe("captacao_movida");
    // automático desligado neste teste: fica pendente, mesma fila global de
    // qualquer lead sem vendedor (empresa_id/responsavel_id nulos).
    expect(lead?.empresa_id).toBeNull();
    expect(lead?.responsavel_id).toBeNull();
    expect((lead?.dados as Record<string, unknown>)?.placa).toBe(placa);
    expect(lead?.cliente_id).toBeTruthy();

    const { data: cliente } = await admin
      .from("clientes")
      .select("telefone,nome,documento,empresa_id")
      .eq("id", lead!.cliente_id!)
      .single();
    expect(cliente?.telefone).toBe(telefone);
    expect(cliente?.nome).toBe("Cliente Um");
    expect(cliente?.documento).toBeNull();
    // cliente órfão enquanto a distribuição não resolve empresa — estado
    // equivalente ao do próprio lead pendente.
    expect(cliente?.empresa_id).toBeNull();

    // aparece na fila pendente da Matriz, como qualquer outro lead sem
    // vendedor (distribuir_fila_pendente / tela de Leads da Matriz).
    const { data: pendente } = await admin
      .from("leads")
      .select("id")
      .eq("id", row.lead_id)
      .is("empresa_id", null)
      .is("responsavel_id", null)
      .maybeSingle();
    expect(pendente?.id).toBe(row.lead_id);
  });

  it("mesma placa: segunda chamada NÃO duplica lead, só atualiza (continua pendente)", async () => {
    const telefone = uniqTelefone();
    const placa = uniqPlaca("DUP");

    const r1 = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Nome Original", telefone, placa, cidade: cidadeUnica },
    } as never);
    expect(r1.error).toBeNull();
    const row1 = (r1.data as { lead_id: string; criado: boolean }[])[0];
    expect(row1.criado).toBe(true);

    const { data: leadAntes } = await admin
      .from("leads")
      .select("empresa_id,responsavel_id")
      .eq("id", row1.lead_id)
      .single();
    expect(leadAntes?.empresa_id).toBeNull();
    expect(leadAntes?.responsavel_id).toBeNull();

    const r2 = await admin.rpc("ingerir_lead_externo", {
      type: "UPDATE",
      record: {
        nome_cliente: "Nome Atualizado",
        telefone,
        placa,
        cidade: cidadeUnica,
        canal: "ViaNuvem",
      },
    } as never);
    expect(r2.error).toBeNull();
    const row2 = (r2.data as { lead_id: string; criado: boolean }[])[0];
    expect(row2.criado).toBe(false);
    expect(row2.lead_id).toBe(row1.lead_id);

    const { data: leadsComPlaca } = await admin
      .from("leads")
      .select("id")
      .eq("origem", "captacao_movida")
      .filter("dados->>placa", "eq", placa);
    expect(leadsComPlaca ?? []).toHaveLength(1);

    const { data: leadDepois } = await admin
      .from("leads")
      .select("nome,empresa_id,responsavel_id,dados")
      .eq("id", row1.lead_id)
      .single();
    expect(leadDepois?.nome).toBe("Nome Atualizado");
    // continua pendente, sem vendedor
    expect(leadDepois?.empresa_id).toBeNull();
    expect(leadDepois?.responsavel_id).toBeNull();
    expect((leadDepois?.dados as Record<string, unknown>)?.canal).toBe("ViaNuvem");
  });

  it("mesmo telefone: segunda chamada NÃO duplica cliente (placas diferentes)", async () => {
    const telefone = uniqTelefone();
    const placa1 = `T${Math.floor(Math.random() * 1e6)}`.padEnd(7, "0").toUpperCase();
    const placa2 = `U${Math.floor(Math.random() * 1e6)}`.padEnd(7, "0").toUpperCase();

    const r1 = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Mesmo Cliente", telefone, placa: placa1 },
    } as never);
    expect(r1.error).toBeNull();
    const lead1 = (r1.data as { lead_id: string; criado: boolean }[])[0];

    const r2 = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Mesmo Cliente", telefone, placa: placa2 },
    } as never);
    expect(r2.error).toBeNull();
    const lead2 = (r2.data as { lead_id: string; criado: boolean }[])[0];
    expect(lead2.criado).toBe(true);
    expect(lead2.lead_id).not.toBe(lead1.lead_id);

    const { data: leadA } = await admin
      .from("leads")
      .select("cliente_id")
      .eq("id", lead1.lead_id)
      .single();
    const { data: leadB } = await admin
      .from("leads")
      .select("cliente_id")
      .eq("id", lead2.lead_id)
      .single();
    expect(leadA?.cliente_id).toBe(leadB?.cliente_id);

    const { data: clientes } = await admin.from("clientes").select("id").eq("telefone", telefone);
    expect(clientes ?? []).toHaveLength(1);
  });

  it("CPF chegando null na 1ª chamada e preenchido na 2ª: atualiza sem duplicar cliente", async () => {
    const telefone = uniqTelefone();
    const placa1 = `C${Math.floor(Math.random() * 1e6)}`.padEnd(7, "0").toUpperCase();
    const placa2 = `D${Math.floor(Math.random() * 1e6)}`.padEnd(7, "0").toUpperCase();
    const cpf = uniqDoc();

    const r1 = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Sem CPF Ainda", telefone, placa: placa1 },
    } as never);
    expect(r1.error).toBeNull();
    const lead1 = (r1.data as { lead_id: string; criado: boolean }[])[0];
    const { data: leadA } = await admin
      .from("leads")
      .select("cliente_id")
      .eq("id", lead1.lead_id)
      .single();

    const { data: clienteAntes } = await admin
      .from("clientes")
      .select("id,documento")
      .eq("id", leadA!.cliente_id!)
      .single();
    expect(clienteAntes?.documento).toBeNull();

    const r2 = await admin.rpc("ingerir_lead_externo", {
      type: "INSERT",
      record: { nome_cliente: "Com CPF Agora", telefone, placa: placa2, cpf },
    } as never);
    expect(r2.error).toBeNull();

    const { data: clientes } = await admin
      .from("clientes")
      .select("id,documento")
      .eq("telefone", telefone);
    expect(clientes ?? []).toHaveLength(1);
    expect(clientes?.[0].documento).toBe(cpf);
    expect(clientes?.[0].id).toBe(clienteAntes?.id);
  });

  it("automático ligado + regra casa por cidade: lead distribuído e cliente religado à mesma empresa", async () => {
    const UF = "AC";
    const cidadeAuto = uniq("cidade-captacao-auto").toLowerCase();

    await admin
      .from("distribuicao_config")
      .update({
        automatico_on: true,
        modo: "regiao",
        criterios: { regiao: true },
      })
      .eq("id", "default");

    const { data: emp, error: eEmp } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Franquia Captacao Auto"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        uf: UF,
        cidade: cidadeAuto,
      })
      .select("id")
      .single();
    if (eEmp) throw eEmp;
    const empresaId = emp.id;

    const { userId: vendedorId } = await criarUsuario(`${uniq("vend-captacao")}@teste.local`);
    await admin
      .from("profiles")
      .update({ empresa_id: empresaId, status: "aprovada" })
      .eq("id", vendedorId);
    await admin.from("user_roles").insert({ user_id: vendedorId, role: "vendedor" });

    try {
      const telefone = uniqTelefone();
      const placa = uniqPlaca("AUT");

      const { data, error } = await admin.rpc("ingerir_lead_externo", {
        type: "INSERT",
        record: { nome_cliente: "Cliente Auto", telefone, placa, cidade: cidadeAuto },
      } as never);
      expect(error).toBeNull();
      const row = (data as { lead_id: string; criado: boolean }[])[0];

      const { data: lead } = await admin
        .from("leads")
        .select("empresa_id,responsavel_id,cliente_id")
        .eq("id", row.lead_id)
        .single();
      expect(lead?.empresa_id).toBe(empresaId);
      expect(lead?.responsavel_id).toBe(vendedorId);

      // cliente religado à mesma empresa que o trigger resolveu pro lead.
      const { data: cliente } = await admin
        .from("clientes")
        .select("empresa_id")
        .eq("id", lead!.cliente_id!)
        .single();
      expect(cliente?.empresa_id).toBe(empresaId);
    } finally {
      await admin.from("distribuicao_config").update({ automatico_on: false }).eq("id", "default");
    }
  });

  it("religação do cliente é pulada se colidir com o índice único (empresa_id, documento), sem quebrar a RPC", async () => {
    const UF = "AC";
    const cidadeConflito = uniq("cidade-captacao-conflito").toLowerCase();
    const cpfCompartilhado = uniqDoc();

    await admin
      .from("distribuicao_config")
      .update({
        automatico_on: true,
        modo: "regiao",
        criterios: { regiao: true },
      })
      .eq("id", "default");

    const { data: emp, error: eEmp } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Franquia Captacao Conflito"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        uf: UF,
        cidade: cidadeConflito,
      })
      .select("id")
      .single();
    if (eEmp) throw eEmp;
    const empresaId = emp.id;

    const { userId: vendedorId } = await criarUsuario(`${uniq("vend-conflito")}@teste.local`);
    await admin
      .from("profiles")
      .update({ empresa_id: empresaId, status: "aprovada" })
      .eq("id", vendedorId);
    await admin.from("user_roles").insert({ user_id: vendedorId, role: "vendedor" });

    // já existe outro cliente com o mesmo documento NESSA empresa — religar
    // o cliente novo pra essa empresa colidiria com clientes_empresa_documento_uidx.
    const { error: eOutroCliente } = await admin.from("clientes").insert({
      empresa_id: empresaId,
      nome: uniq("Outro Cliente"),
      documento: cpfCompartilhado,
      telefone: uniqTelefone(),
    });
    if (eOutroCliente) throw eOutroCliente;

    try {
      const telefone = uniqTelefone();
      const placa = uniqPlaca("CFT");

      const { data, error } = await admin.rpc("ingerir_lead_externo", {
        type: "INSERT",
        record: {
          nome_cliente: "Cliente Conflitante",
          telefone,
          placa,
          cidade: cidadeConflito,
          cpf: cpfCompartilhado,
        },
      } as never);
      // não estoura a transação/perde o lead por causa da colisão.
      expect(error).toBeNull();
      const row = (data as { lead_id: string; criado: boolean }[])[0];
      expect(row.lead_id).toBeTruthy();

      const { data: lead } = await admin
        .from("leads")
        .select("empresa_id,cliente_id")
        .eq("id", row.lead_id)
        .single();
      expect(lead?.empresa_id).toBe(empresaId);

      // cliente permanece órfão (empresa_id null): religação pulada por causa
      // do conflito de documento na empresa resolvida.
      const { data: cliente } = await admin
        .from("clientes")
        .select("empresa_id,documento")
        .eq("id", lead!.cliente_id!)
        .single();
      expect(cliente?.documento).toBe(cpfCompartilhado);
      expect(cliente?.empresa_id).toBeNull();
    } finally {
      await admin.from("distribuicao_config").update({ automatico_on: false }).eq("id", "default");
    }
  });
});
