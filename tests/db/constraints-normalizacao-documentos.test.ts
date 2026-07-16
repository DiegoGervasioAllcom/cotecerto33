import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, uniq, uniqDoc } from "../helpers/supabase";

/**
 * D3.1 — normalização (só dígitos) + formato + uniques em documentos/contatos.
 *
 * 20260716130000_d3_normalizar_documentos.sql adiciona:
 *   - trigger BEFORE INSERT/UPDATE que remove tudo que não é dígito
 *     (`regexp_replace(col, '\D', '', 'g')`) em documento/CPF/CNPJ/CEP/telefone
 *     de empresas, clientes, cotacao_segurado e cotacao_perfil;
 *   - CHECK de formato no valor já normalizado (documento/CPF/CNPJ: 11 ou 14
 *     dígitos; CEP: 8; telefone: 10 ou 11) — tolerante a null/'';
 *   - CHECK de e-mail (regex simples) em empresas/clientes/cotacao_segurado/profiles;
 *   - unique em empresas.documento (global, parcial where <> '');
 *   - unique composto em clientes (empresa_id, documento) (parcial where <> '');
 *   - unique em profiles.email (defesa em profundidade, parcial where <> '').
 *
 * As colunas aqui cobertas saíram dos testes de char_length (D1) porque o
 * D3.1 passou a governar seu formato (ver comentários nos arquivos D1).
 */
describe("D3.1 — normalização, formato e uniques de documentos/contatos", () => {
  let empresaId: string;
  let empresaId2: string;

  beforeAll(async () => {
    empresaId = (await criarEmpresa({ nome: uniq("Empresa D3 A") })).id;
    empresaId2 = (await criarEmpresa({ nome: uniq("Empresa D3 B") })).id;
  });

  /** CNPJ (14 dígitos) único por execução, mascarado no formato XX.XXX.XXX/XXXX-XX. */
  function uniqCnpjMascarado(): string {
    const d = String(Date.now()).slice(-8).padStart(8, "1") + "000190";
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  }

  it("normalização: máscara vira só dígitos após insert (empresas)", async () => {
    const cnpjMascarado = uniqCnpjMascarado();
    const cnpjDigitos = cnpjMascarado.replace(/\D/g, "");

    const { data, error } = await admin
      .from("empresas")
      .insert({
        nome: uniq("d3-emp-norm"),
        tipo: "pj",
        documento: cnpjMascarado,
        celular: "(11) 99999-8888",
      } as never)
      .select("documento, celular")
      .single();

    expect(error).toBeNull();
    expect((data as never as { documento: string }).documento).toBe(cnpjDigitos);
    expect((data as never as { celular: string }).celular).toBe("11999998888");
  });

  it("normalização: máscara vira só dígitos após insert (cotacao_segurado)", async () => {
    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    expect(eCot).toBeNull();
    const cotacaoId = (cot as never as { id: string }).id;

    const { data, error } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cotacaoId, cpf_cnpj: "123.456.789-09", cep: "01310-100" } as never)
      .select("cpf_cnpj, cep")
      .single();

    expect(error).toBeNull();
    expect((data as never as { cpf_cnpj: string }).cpf_cnpj).toBe("12345678909");
    expect((data as never as { cep: string }).cep).toBe("01310100");
  });

  it("empresas: check de formato (documento, celular, email)", async () => {
    const { error: eDocInvalido } = await admin.from("empresas").insert({
      nome: uniq("d3-emp-doc-invalido"),
      tipo: "pj",
      documento: "1234567890", // 10 dígitos
    } as never);
    expect(eDocInvalido?.code, "documento com 10 dígitos").toBe("23514");

    const { error: eCelInvalido } = await admin.from("empresas").insert({
      nome: uniq("d3-emp-cel-invalido"),
      tipo: "pj",
      documento: uniqDoc(),
      celular: "123456789", // 9 dígitos
    } as never);
    expect(eCelInvalido?.code, "celular com 9 dígitos").toBe("23514");

    const { error: eEmailInvalido } = await admin.from("empresas").insert({
      nome: uniq("d3-emp-email-invalido"),
      tipo: "pj",
      documento: uniqDoc(),
      email: "nao-e-email",
    } as never);
    expect(eEmailInvalido?.code, "email inválido").toBe("23514");

    const { error: eValidoCpf } = await admin.from("empresas").insert({
      nome: uniq("d3-emp-doc-valido-11"),
      tipo: "pf",
      documento: uniqDoc(), // 11 dígitos
      celular: "11999998888", // 11 dígitos
      telefone: "1133334444", // 10 dígitos
      email: "valido@teste.local",
    } as never);
    expect(eValidoCpf, "documento CPF (11), celular (11), telefone (10), email válidos").toBeNull();

    const { error: eValidoCnpj } = await admin.from("empresas").insert({
      nome: uniq("d3-emp-doc-valido-14"),
      tipo: "pj",
      documento: uniqCnpjMascarado().replace(/\D/g, ""), // 14 dígitos
    } as never);
    expect(eValidoCnpj, "documento CNPJ (14) válido").toBeNull();
  });

  it("clientes: check de formato (documento, telefone)", async () => {
    const { error: eDocInvalido } = await admin.from("clientes").insert({
      empresa_id: empresaId,
      nome: uniq("d3-cli-doc-invalido"),
      documento: "1234567890", // 10 dígitos
    } as never);
    expect(eDocInvalido?.code, "clientes.documento com 10 dígitos").toBe("23514");

    const { error: eTelInvalido } = await admin.from("clientes").insert({
      empresa_id: empresaId,
      nome: uniq("d3-cli-tel-invalido"),
      telefone: "123456789", // 9 dígitos
    } as never);
    expect(eTelInvalido?.code, "clientes.telefone com 9 dígitos").toBe("23514");

    const { error: eEmailInvalido } = await admin.from("clientes").insert({
      empresa_id: empresaId,
      nome: uniq("d3-cli-email-invalido"),
      email: "nao-e-email",
    } as never);
    expect(eEmailInvalido?.code, "clientes.email inválido").toBe("23514");

    const { error: eValido } = await admin.from("clientes").insert({
      empresa_id: empresaId,
      nome: uniq("d3-cli-valido"),
      documento: uniqDoc(),
      telefone: "11999998888",
      email: "valido@teste.local",
    } as never);
    expect(eValido, "clientes documento/telefone/email válidos").toBeNull();
  });

  it("profiles.email: check de formato", async () => {
    const { userId } = await (async () => {
      const email = `${uniq("d3-profile")}@teste.local`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: "Teste@123!",
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("falha ao criar usuário de fixture");
      return { userId: data.user.id };
    })();

    const { error: eInvalido } = await admin
      .from("profiles")
      .update({ email: "nao-e-email" } as never)
      .eq("id", userId);
    expect(eInvalido?.code, "profiles.email inválido").toBe("23514");
  });

  it("cotacao_segurado/cotacao_perfil: check de formato (cep, cpf_cnpj)", async () => {
    const { data: cot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    const cotacaoId = (cot as never as { id: string }).id;

    const { error: eCepInvalido } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cotacaoId, cep: "1234567" } as never); // 7 dígitos
    expect(eCepInvalido?.code, "cep com 7 dígitos").toBe("23514");

    const { data: cot2 } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    const cotacaoId2 = (cot2 as never as { id: string }).id;

    const { error: eCepValido } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cotacaoId2, cep: "01310100" } as never); // 8 dígitos
    expect(eCepValido, "cep com 8 dígitos").toBeNull();

    const { error: eCondCpfInvalido } = await admin
      .from("cotacao_perfil")
      .insert({ cotacao_id: cotacaoId2, cond_cpf: "1234567890" } as never); // 10 dígitos
    expect(eCondCpfInvalido?.code, "cond_cpf com 10 dígitos").toBe("23514");

    const { data: cot3 } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId })
      .select("id")
      .single();
    const cotacaoId3 = (cot3 as never as { id: string }).id;

    const { error: eEmailInvalido } = await admin
      .from("cotacao_segurado")
      .insert({ cotacao_id: cotacaoId3, email: "nao-e-email" } as never);
    expect(eEmailInvalido?.code, "cotacao_segurado.email inválido").toBe("23514");
  });

  it("empresas.documento: unique global", async () => {
    const doc = uniqDoc();
    const { error: e1 } = await admin
      .from("empresas")
      .insert({ nome: uniq("d3-emp-uniq-1"), tipo: "pj", documento: doc } as never);
    expect(e1).toBeNull();

    const { error: e2 } = await admin
      .from("empresas")
      .insert({ nome: uniq("d3-emp-uniq-2"), tipo: "pj", documento: doc } as never);
    expect(e2?.code, "documento duplicado em empresas diferentes").toBe("23505");
  });

  it("clientes: unique composto (empresa_id, documento) — mesmo doc em empresas diferentes é ok", async () => {
    const doc = uniqDoc();

    const { error: e1 } = await admin
      .from("clientes")
      .insert({ empresa_id: empresaId, nome: uniq("d3-cli-comp-1"), documento: doc } as never);
    expect(e1).toBeNull();

    const { error: eOutraEmpresa } = await admin
      .from("clientes")
      .insert({ empresa_id: empresaId2, nome: uniq("d3-cli-comp-2"), documento: doc } as never);
    expect(eOutraEmpresa, "mesmo documento em empresa diferente").toBeNull();

    const { error: eMesmaEmpresa } = await admin
      .from("clientes")
      .insert({ empresa_id: empresaId, nome: uniq("d3-cli-comp-3"), documento: doc } as never);
    expect(eMesmaEmpresa?.code, "mesmo documento na mesma empresa").toBe("23505");
  });
});
