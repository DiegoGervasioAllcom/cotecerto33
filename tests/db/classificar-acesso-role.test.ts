import { describe, it, expect, beforeAll } from "vitest";
import { admin, loginMatriz, criarUsuario, uniq, uniqDoc, type Db } from "../helpers/supabase";

/**
 * Regressão do bug S-crítica: cadastrar_franquia grava `user_roles.role =
 * 'vendedor'` para todo mundo, e a tela "Classificar acesso" precisa
 * SUBSTITUIR essa role (nunca só inserir/upsert em cima) pela role
 * definitiva escolhida pela Matriz — `user_roles` é UNIQUE(user_id, role) e
 * useAuth() espera no máximo 1 linha (`.maybeSingle()`).
 *
 * Este teste simula a sequência client-side que
 * `classificar-acesso-modal.tsx` executa (delete + insert em user_roles),
 * autenticado como Matriz — sem passar por RPC, pois a lógica de negócio é
 * pura escrita de tabela protegida pela policy `user_roles_matriz_admin`.
 */
describe("classificar acesso — substituição de role em user_roles", () => {
  let matriz: Db;
  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  async function cadastrarPendente(prefix: string) {
    const { client: dono, userId } = await criarUsuario(`${uniq(prefix)}@teste.local`);
    const { data: empresaId, error } = await dono.rpc("cadastrar_franquia", {
      p: {
        nome: uniq(prefix),
        tipo: "pj",
        documento: uniqDoc(),
        email: `${uniq(prefix)}@teste.local`,
      },
    });
    expect(error).toBeNull();
    return { userId, empresaId: empresaId as string };
  }

  async function substituirRole(userId: string, role: "franqueado" | "master" | "supervisor") {
    const { error: delErr } = await matriz.from("user_roles").delete().eq("user_id", userId);
    expect(delErr).toBeNull();
    const { error: insErr } = await matriz.from("user_roles").insert({ user_id: userId, role });
    expect(insErr).toBeNull();
  }

  it("cadastro novo já nasce com role 'vendedor' (bug de origem confirmado)", async () => {
    const { userId } = await cadastrarPendente("clf-origem");
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    expect(roles).toHaveLength(1);
    expect(roles?.[0].role).toBe("vendedor");
  });

  it("classificar como Master franqueado deixa EXATAMENTE 1 linha com role='master'", async () => {
    const { userId } = await cadastrarPendente("clf-master");
    await substituirRole(userId, "master");
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    expect(error).toBeNull();
    expect(roles).toHaveLength(1);
    expect(roles?.[0].role).toBe("master");
  });

  it("classificar como Franquia deixa EXATAMENTE 1 linha com role='franqueado'", async () => {
    const { userId } = await cadastrarPendente("clf-franq");
    await substituirRole(userId, "franqueado");
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    expect(error).toBeNull();
    expect(roles).toHaveLength(1);
    expect(roles?.[0].role).toBe("franqueado");
  });

  it("classificar como Supervisor (Matriz) deixa EXATAMENTE 1 linha com role='supervisor'", async () => {
    const { userId } = await cadastrarPendente("clf-sup");
    await substituirRole(userId, "supervisor");
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    expect(error).toBeNull();
    expect(roles).toHaveLength(1);
    expect(roles?.[0].role).toBe("supervisor");
  });

  it("não-matriz NÃO consegue substituir a própria role (policy user_roles_matriz_admin)", async () => {
    const { client: dono, userId } = await criarUsuario(`${uniq("clf-neg")}@teste.local`);
    await dono.rpc("cadastrar_franquia", {
      p: {
        nome: uniq("clf-neg"),
        tipo: "pj",
        documento: uniqDoc(),
        email: `${uniq("clf-neg")}@teste.local`,
      },
    });
    const { error: delErr } = await dono.from("user_roles").delete().eq("user_id", userId);
    // RLS: delete de 0 linhas não é erro, mas o insert de uma role elevada deve falhar.
    expect(delErr).toBeNull();
    const { error: insErr } = await dono
      .from("user_roles")
      .insert({ user_id: userId, role: "master" });
    expect(insErr).not.toBeNull();
    // a role original 'vendedor' segue intacta (delete do próprio dono não afeta linhas de outro user_id nem passa RLS de escrita)
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    expect(roles).toHaveLength(1);
    expect(roles?.[0].role).toBe("vendedor");
  });
});
