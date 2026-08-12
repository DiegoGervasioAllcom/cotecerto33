import { describe, it, expect, beforeAll } from "vitest";
import { admin, uniq, uniqDoc } from "../helpers/supabase";

function uniqTelefone(): string {
  return `11${Math.floor(900000000 + Math.random() * 99999999)}`.slice(0, 11);
}
function uniqPlaca(prefix: string): string {
  return `${prefix}${Math.floor(Math.random() * 1e4)}`.padEnd(7, "0").toUpperCase();
}

/**
 * Ingestão de leads externos (app captacao-movida) — Etapa 1.
 *
 * 20260812000000_ingerir_lead_externo_captacao_movida.sql entrega a RPC
 * `ingerir_lead_externo`, só executável por `service_role` (RPC de borda,
 * mesmo padrão de `registrar_premios_quiver`).
 *
 * Dedup: cliente por telefone, lead por placa (origem=captacao_movida).
 *
 * Distribuição: o lead NÃO passa por `trg_distribuir_lead_auto` — nasce
 * direto com empresa_id = Matriz e responsavel_id nulo, na fila de
 * distribuição manual (mesmo lugar onde caem hoje leads sem vendedor de
 * qualquer empresa).
 */
describe("ingerir_lead_externo — captacao-movida", () => {
  let cidadeUnica: string;
  let matrizId: string;

  beforeAll(async () => {
    cidadeUnica = uniq("cidade-captacao").toLowerCase();

    const { data: matriz, error: eMatriz } = await admin
      .from("empresas")
      .select("id")
      .eq("tipo", "matriz")
      .limit(1)
      .single();
    if (eMatriz || !matriz) throw eMatriz ?? new Error("empresa matriz não encontrada no seed");
    matrizId = matriz.id;
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

  it("cliente novo + lead novo criado direto na fila da Matriz (sem vendedor)", async () => {
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
    // cai direto na fila da Matriz, sem vendedor — não passa pelo trigger
    // de distribuição automática (empresa_id já vem preenchido).
    expect(lead?.empresa_id).toBe(matrizId);
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
    // cliente já nasce ligado à Matriz — nunca órfão (empresa_id null)
    expect(cliente?.empresa_id).toBe(matrizId);
  });

  it("mesma placa: segunda chamada NÃO duplica lead, só atualiza (continua na fila da Matriz)", async () => {
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
    expect(leadAntes?.empresa_id).toBe(matrizId);
    expect(leadAntes?.responsavel_id).toBeNull();

    const r2 = await admin.rpc("ingerir_lead_externo", {
      type: "UPDATE",
      record: { nome_cliente: "Nome Atualizado", telefone, placa, cidade: cidadeUnica, canal: "ViaNuvem" },
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
    // continua na fila da Matriz, sem vendedor
    expect(leadDepois?.empresa_id).toBe(matrizId);
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

    const { data: leadA } = await admin.from("leads").select("cliente_id").eq("id", lead1.lead_id).single();
    const { data: leadB } = await admin.from("leads").select("cliente_id").eq("id", lead2.lead_id).single();
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
    const { data: leadA } = await admin.from("leads").select("cliente_id").eq("id", lead1.lead_id).single();

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

    const { data: clientes } = await admin.from("clientes").select("id,documento").eq("telefone", telefone);
    expect(clientes ?? []).toHaveLength(1);
    expect(clientes?.[0].documento).toBe(cpf);
    expect(clientes?.[0].id).toBe(clienteAntes?.id);
  });
});
