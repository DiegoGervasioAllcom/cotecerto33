/**
 * V11 · D4 (Frente 4) — job recalcular_regua_performance.
 *
 * Roda D3 pra todo perfil elegível (CLT interno, vendedor de rede, franqueado
 * Individual-como-vendedor) e grava o sinal comparando contra os limites do
 * bloco. Franqueado Full em si não é avaliado — só o time dele (role
 * vendedor dentro de uma empresa com modalidade='full').
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq } from "../helpers/supabase";

const DIA_MS = 24 * 60 * 60 * 1000;
function ha(dias: number): string {
  return new Date(Date.now() - dias * DIA_MS).toISOString();
}

async function criarModelo(tipo: "clt" | "franqueada", modalidade?: "individual" | "full") {
  const { data, error } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-${tipo}-${modalidade ?? "na"}`), tipo, modalidade })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function inserirLeads(
  empresaId: string,
  responsavelId: string,
  qtd: number,
  diasAtras: number,
) {
  await admin.from("leads").insert(
    Array.from({ length: qtd }, (_, i) => ({
      empresa_id: empresaId,
      responsavel_id: responsavelId,
      nome: uniq(`lead-${i}`),
      criado_em: ha(diasAtras),
    })),
  );
}

async function inserirVendas(
  empresaId: string,
  responsavelId: string,
  qtd: number,
  diasAtras: number,
) {
  await admin.from("propostas").insert(
    Array.from({ length: qtd }, () => ({
      empresa_id: empresaId,
      responsavel_id: responsavelId,
      status: "transmitida",
      criado_em: ha(diasAtras),
      emitida_em: ha(diasAtras),
    })),
  );
}

async function inserirCancelamentos(
  empresaId: string,
  responsavelId: string,
  qtd: number,
  diasAtras: number,
) {
  await admin.from("propostas").insert(
    Array.from({ length: qtd }, () => ({
      empresa_id: empresaId,
      responsavel_id: responsavelId,
      status: "cancelada",
      criado_em: ha(diasAtras),
      emitida_em: ha(diasAtras),
      cancelada_em: ha(diasAtras),
    })),
  );
}

async function rodarJob() {
  const matriz = await loginMatriz();
  const { error } = await matriz.rpc("recalcular_regua_performance");
  expect(error).toBeNull();
}

async function lerSinal(profileId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("performance_status,performance_motivo,performance_calculado_em")
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return data;
}

describe("V11 · D4 — recalcular_regua_performance (gate)", () => {
  it("não-matriz autenticado não consegue disparar o job", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d4-gate") });
    const { error } = await pessoa.client.rpc("recalcular_regua_performance");
    expect(error?.message).toContain("só a Matriz");
  });

  it("matriz consegue disparar o job", async () => {
    const matriz = await loginMatriz();
    const { error } = await matriz.rpc("recalcular_regua_performance");
    expect(error).toBeNull();
  });
});

describe("V11 · D4 — classificação do sinal", () => {
  it("CLT interno com boa conversão fica ativo", async () => {
    const modeloId = await criarModelo("clt");
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d4-ativo") });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await inserirLeads(vendedor.empresaId, vendedor.userId, 4, 5);
    await inserirVendas(vendedor.empresaId, vendedor.userId, 2, 3); // conv 50%

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).toBe("ativo");
    expect(sinal.performance_motivo).toMatchObject({ bloco: "interno", leads: 4, vendas: 2 });
    expect(sinal.performance_calculado_em).not.toBeNull();
  });

  it("vendedor sem modelo de franquia (a maioria em produção) é avaliado como interno", async () => {
    // criarPersonaComEmpresa não seta modelo_id — é exatamente o caso real:
    // "Vendedor Matriz (CLT)" nunca tem modelo de franquia (mesmo sinal usado
    // em cadastros-matriz-tab.tsx pra montar a aba Cadastros Matriz).
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d4-sem-modelo"),
    });
    await inserirLeads(vendedor.empresaId, vendedor.userId, 4, 5);
    await inserirVendas(vendedor.empresaId, vendedor.userId, 2, 3);

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).not.toBeNull();
    expect((sinal.performance_motivo as { bloco: string }).bloco).toBe("interno");
  });

  it("vendedor de rede com conversão abaixo da meta (mas acima do travado) fica em atenção", async () => {
    const modeloId = await criarModelo("franqueada", "individual");
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d4-atencao") });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await inserirLeads(vendedor.empresaId, vendedor.userId, 6, 5);
    await inserirVendas(vendedor.empresaId, vendedor.userId, 1, 3); // conv 16,7% (rede: atencao<20, travado<12)

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).toBe("atencao");
    expect((sinal.performance_motivo as { bloco: string }).bloco).toBe("rede");
  });

  it("conversão muito baixa fica travado", async () => {
    const modeloId = await criarModelo("clt");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d4-travado-conv"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await inserirLeads(vendedor.empresaId, vendedor.userId, 10, 5);
    // sem vendas -> conv 0%, bem abaixo do travado (15% no interno)

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).toBe("travado");
  });

  it("cancelamentos no limite travam mesmo com conversão boa", async () => {
    const modeloId = await criarModelo("clt");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d4-travado-canc"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await inserirLeads(vendedor.empresaId, vendedor.userId, 5, 5);
    await inserirVendas(vendedor.empresaId, vendedor.userId, 3, 3); // conv 60%, bem acima da meta

    // O limite de cancelamentos do interno é uma linha global compartilhada
    // entre execuções da suíte (o teste de D2 a incrementa a cada rodada) —
    // lê o valor atual em vez de assumir o default de D1 (3).
    const { data: regua } = await admin
      .from("regua_performance_config")
      .select("cancelamentos_limite")
      .eq("bloco", "interno")
      .single();
    await inserirCancelamentos(vendedor.empresaId, vendedor.userId, regua!.cancelamentos_limite, 2);

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).toBe("travado");
  });

  it("franqueado Individual-como-vendedor entra no bloco rede", async () => {
    const modeloId = await criarModelo("franqueada", "individual");
    const franqueado = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: uniq("d4-franq-ind"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", franqueado.empresaId);
    await inserirLeads(franqueado.empresaId, franqueado.userId, 5, 5);
    await inserirVendas(franqueado.empresaId, franqueado.userId, 3, 3);

    await rodarJob();
    const sinal = await lerSinal(franqueado.userId);
    expect(sinal.performance_status).not.toBeNull();
    expect((sinal.performance_motivo as { bloco: string }).bloco).toBe("rede");
  });

  it("time (vendedor) de uma franquia Full entra no bloco full", async () => {
    const modeloId = await criarModelo("franqueada", "full");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d4-full-time"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await inserirLeads(vendedor.empresaId, vendedor.userId, 5, 5);
    await inserirVendas(vendedor.empresaId, vendedor.userId, 3, 3);

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect((sinal.performance_motivo as { bloco: string }).bloco).toBe("full");
  });
});

describe("V11 · D4 — quem não é avaliado", () => {
  it("franqueado Full em si não é avaliado (só o time dele)", async () => {
    const modeloId = await criarModelo("franqueada", "full");
    const franqueadoFull = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: uniq("d4-full-owner"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", franqueadoFull.empresaId);

    await rodarJob();
    const sinal = await lerSinal(franqueadoFull.userId);
    expect(sinal.performance_status).toBeNull();
  });

  it("franqueado sem modalidade definida (empresa sem modelo) não é avaliado", async () => {
    const franqueado = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: uniq("d4-franq-sem-modelo"),
    });

    await rodarJob();
    const sinal = await lerSinal(franqueado.userId);
    expect(sinal.performance_status).toBeNull();
  });

  it("vendedor desligado não é avaliado", async () => {
    const modeloId = await criarModelo("clt");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d4-desligado"),
    });
    await admin.from("empresas").update({ modelo_id: modeloId }).eq("id", vendedor.empresaId);
    await admin
      .from("profiles")
      .update({ desligado_em: ha(1) })
      .eq("id", vendedor.userId);

    await rodarJob();
    const sinal = await lerSinal(vendedor.userId);
    expect(sinal.performance_status).toBeNull();
  });
});
