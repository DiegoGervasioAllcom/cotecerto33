import { beforeAll, describe, expect, it } from "vitest";
import { admin, criarPersonaComEmpresa, criarUsuario, uniq, type Db } from "../helpers/supabase";

/**
 * Segurança: desligar o profile não revoga imediatamente o JWT emitido pelo
 * GoTrue. Os asserts abaixo reutilizam deliberadamente o mesmo client/token
 * obtido antes do desligamento e nunca usam service_role para consultar dados.
 */
describe("usuário desligado — JWT antigo não autoriza PostgREST", () => {
  const erroAcessoDesativado = "Acesso desativado. Entre em contato com a Matriz.";
  let clientComJwtAntigo: Db;
  let userId: string;
  let leadId: string;

  beforeAll(async () => {
    const persona = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "jwt-antigo-desligado",
    });
    clientComJwtAntigo = persona.client;
    userId = persona.userId;

    const { data, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead JWT antigo"),
        origem: "teste",
        empresa_id: persona.empresaId,
        responsavel_id: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadId = data.id;
  });

  it("POSITIVO: pendente consulta o próprio contexto mínimo de onboarding", async () => {
    const pendente = await criarUsuario(`${uniq("onboarding-pendente")}@teste.local`);
    const { data, error } = await pendente.client
      .from("profiles")
      .select("id,status,desligado_em")
      .eq("id", pendente.userId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: pendente.userId,
      status: "pendente",
      desligado_em: null,
    });
  });

  it("POSITIVO: profile ativo acessa dado protegido e sua role", async () => {
    const { data: role, error: roleError } = await clientComJwtAntigo.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    expect(roleError).toBeNull();
    expect(role).toBe(true);

    const { data, error } = await clientComJwtAntigo.from("leads").select("id").eq("id", leadId);
    expect(error).toBeNull();
    expect(data?.map((row) => row.id)).toEqual([leadId]);
  });

  it("NEGATIVO: o mesmo JWT deixa de ler e executar RPC após o desligamento", async () => {
    const { error: desligarError } = await admin
      .from("profiles")
      .update({
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "Teste de bloqueio imediato do JWT antigo",
      })
      .eq("id", userId);
    if (desligarError) throw desligarError;

    const { data, error } = await clientComJwtAntigo.from("leads").select("id").eq("id", leadId);
    expect(data).toBeNull();
    expect(error?.message).toBe(erroAcessoDesativado);

    const { data: escrita, error: escritaError } = await clientComJwtAntigo
      .from("leads")
      .update({ nome: "Tentativa após desligamento" })
      .eq("id", leadId)
      .select("id");
    expect(escrita).toBeNull();
    expect(escritaError?.message).toBe(erroAcessoDesativado);

    const { data: role, error: roleError } = await clientComJwtAntigo.rpc("has_role", {
      _user_id: userId,
      _role: "vendedor",
    });
    expect(role).toBeNull();
    expect(roleError?.message).toBe(erroAcessoDesativado);
  });
});
