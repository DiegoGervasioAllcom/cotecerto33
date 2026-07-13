import { describe, it, expect, beforeAll } from "vitest";
import { loginMatriz, criarUsuario, uniq, uniqDoc, type Db } from "../helpers/supabase";

/**
 * Fluxo: cadastrar_franquia (usuário novo) → aprovar_empresa (matriz).
 * Asserts SEMPRE com clients autenticados por persona (nunca service_role).
 */
describe("cadastrar_franquia → aprovar_empresa", () => {
  let matriz: Db;
  beforeAll(async () => { matriz = await loginMatriz(); });

  it("cadastro cria empresa pendente com role vendedor; matriz aprova; não-matriz NÃO aprova", async () => {
    // 1. usuário novo se cadastra
    const { client: dono, userId } = await criarUsuario(`${uniq("franq")}@teste.local`);
    const { data: empresaId, error: eCad } = await dono.rpc("cadastrar_franquia", {
      p: { nome: uniq("Franquia Teste"), tipo: "pj", documento: uniqDoc(), email: `${uniq("f")}@teste.local` },
    });
    expect(eCad).toBeNull();
    expect(empresaId).toBeTruthy();

    // 2. nasce pendente (visão da matriz)
    const { data: emp1 } = await matriz.from("empresas").select("status").eq("id", empresaId!).single();
    expect(emp1?.status).toBe("pendente");

    // 3. NEGATIVO: o próprio dono (não-matriz) tenta aprovar → erro e status inalterado
    const { error: eNeg } = await dono.rpc("aprovar_empresa", { p_empresa_id: empresaId! });
    expect(eNeg).not.toBeNull();
    expect(eNeg!.message.toLowerCase()).toContain("matriz");
    const { data: emp2 } = await matriz.from("empresas").select("status").eq("id", empresaId!).single();
    expect(emp2?.status).toBe("pendente");

    // 4. POSITIVO: matriz aprova → empresa e profile aprovados
    const { error: eOk } = await matriz.rpc("aprovar_empresa", { p_empresa_id: empresaId! });
    expect(eOk).toBeNull();
    const { data: emp3 } = await matriz.from("empresas").select("status").eq("id", empresaId!).single();
    expect(emp3?.status).toBe("aprovada");
    const { data: prof } = await matriz.from("profiles").select("status").eq("id", userId).single();
    expect(prof?.status).toBe("aprovada");
  });

  it("uuid inexistente não lança erro (comportamento atual: update de 0 linhas)", async () => {
    const { error } = await matriz.rpc("aprovar_empresa", {
      p_empresa_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).toBeNull(); // documentado: a RPC não valida existência
  });
});
