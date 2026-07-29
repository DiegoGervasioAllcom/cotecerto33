/**
 * V11 — perfil 'interno' (time de apoio da Matriz: Assistente Comercial, Marketing).
 *
 * O motivo de existir não é visibilidade — nenhuma policy usa 'supervisor', então o
 * perfil não decide escopo de dado (quem decide é empresas_visiveis). O motivo é
 * DINHEIRO: `fechar_comissao_competencia` paga royalties a todo profile com role
 * 'supervisor' e `profiles.royalties > 0`. Enquanto Assistente e Marketing eram
 * marcados como supervisor, a única coisa que os separava de receber royalties de
 * supervisor no fechamento era a coluna estar nula.
 *
 * Este teste trava exatamente isso: com royalties preenchido, 'supervisor' recebe e
 * 'interno' não.
 */
import { describe, it, expect } from "vitest";
import { admin, loginMatriz, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

/** Competência única por run, para não colidir com outros fechamentos. */
function competenciaUnica(): string {
  const n = Math.floor(Math.random() * 12) + 1;
  const ano = 2030 + Math.floor(Math.random() * 60);
  return `${ano}-${String(n).padStart(2, "0")}`;
}

describe("V11 — perfil 'interno'", () => {
  it("existe no enum perfil", async () => {
    const p = await criarPersonaComEmpresa("interno", { emailPrefix: "int-enum" });
    expect(p.userId).toBeTruthy();
  });

  it("recebe as áreas do cargo, igual aos outros perfis internos", async () => {
    const p = await criarPersonaComEmpresa("interno", { emailPrefix: "int-areas" });
    await admin.from("profiles").update({ cargo_id: "marketing" }).eq("id", p.userId);

    const { data, error } = await p.client.rpc("fn_areas_do_usuario", { _user_id: p.userId });
    if (error) throw error;
    const areas = (data ?? []).map((r) => r.area_chave).sort();
    // Preset 'marketing' do protótipo: mdash, mleads, mdist, mrel, mkt.
    expect(areas).toEqual(["mdash", "mdist", "mkt", "mleads", "mrel"]);
  });

  it("NÃO entra no laço de royalties do fechamento; 'supervisor' entra", async () => {
    const comp = competenciaUnica();

    const interno = await criarPersonaComEmpresa("interno", { emailPrefix: "int-roy" });
    const supervisor = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-roy" });

    // Mesmo valor de royalties nos dois: só o papel difere.
    for (const id of [interno.userId, supervisor.userId]) {
      const { error } = await admin.from("profiles").update({ royalties: 123.45 }).eq("id", id);
      if (error) throw error;
    }

    // A RPC é concedida só a `authenticated` e valida matriz por dentro — o
    // client de service_role não a executa (mesmo padrão de golden-fechamento).
    const matriz = await loginMatriz();
    const { error: eFech } = await matriz.rpc("fechar_comissao_competencia", {
      p_competencia: comp,
    });
    if (eFech) throw eFech;

    const { data: lancs, error } = await admin
      .from("comissao_lancamentos")
      .select("beneficiario_id, papel, origem, valor")
      .eq("competencia", comp)
      .eq("origem", "fechamento_royalties");
    if (error) throw error;

    const beneficiarios = (lancs ?? []).map((l) => l.beneficiario_id);
    expect(beneficiarios, "supervisor deixou de receber royalties").toContain(supervisor.userId);
    expect(beneficiarios, "interno foi pago como se fosse supervisor").not.toContain(
      interno.userId,
    );
  });

  it("não é aceito como solicitante em solicitar_vendedor", async () => {
    const interno = await criarPersonaComEmpresa("interno", { emailPrefix: "int-solic" });
    const { error } = await interno.client.rpc("solicitar_vendedor", {
      p_nome: uniq("Vendedor pedido"),
      p_email: `${uniq("vend")}@teste.local`,
    });
    // A função aceita matriz/master/supervisor — 'interno' não é solicitante.
    expect(error, "interno conseguiu solicitar vendedor").not.toBeNull();
  });
});
