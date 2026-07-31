import { describe, expect, test } from "vitest";
import { admin, anonClient, criarUsuario, uniq } from "../helpers/supabase";

describe("GoTrue local — link de criação de senha", () => {
  test("recovery cria sessão, permite trocar senha e o token é de uso único", async () => {
    const senhaInicial = "Inicial123";
    const senhaNova = "NovaSenha456";
    const pessoa = await criarUsuario(`${uniq("recovery")}@teste.local`, senhaInicial);
    await pessoa.client.auth.signOut();

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: pessoa.email,
      options: { redirectTo: "http://localhost:8080/auth/criar-senha" },
    });
    expect(linkError).toBeNull();
    if (!link.properties) throw new Error("GoTrue não retornou as propriedades do link recovery");
    const properties = link.properties;
    expect(properties.action_link).toContain("type=recovery");
    const actionUrl = new URL(properties.action_link);
    expect(actionUrl.searchParams.get("redirect_to")).toBe(
      "http://localhost:8080/auth/criar-senha",
    );

    const recovery = anonClient();
    const primeira = await recovery.auth.verifyOtp({
      type: "recovery",
      token_hash: properties.hashed_token,
    });
    expect(primeira.error).toBeNull();
    expect(primeira.data.session).not.toBeNull();
    expect((await recovery.auth.updateUser({ password: senhaNova })).error).toBeNull();
    await recovery.auth.signOut();

    const segunda = await anonClient().auth.verifyOtp({
      type: "recovery",
      token_hash: properties.hashed_token,
    });
    expect(segunda.error).not.toBeNull();

    const login = await anonClient().auth.signInWithPassword({
      email: pessoa.email,
      password: senhaNova,
    });
    expect(login.error).toBeNull();
  });
});
