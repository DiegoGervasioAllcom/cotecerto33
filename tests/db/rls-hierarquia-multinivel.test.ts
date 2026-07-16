import { describe, it, expect, beforeAll } from "vitest";
import { criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * empresas_visiveis() multinível (G1.2, 20260716210100) — cadeia de ≥2 níveis por
 * `profiles.superior_id`: master › franqueado › vendedor, cada um com empresa própria.
 *
 * master (topo, sem superior) — empresaMaster
 *   └─ franqueado (superior_id = master) — empresaFranqueado
 *        └─ vendedor (superior_id = franqueado) — empresaVendedor
 *
 * Terceira rede independente (fora da cadeia) usada no caso negativo.
 */
describe("RLS empresas — visibilidade multinível (master › franqueado › vendedor)", () => {
  let master: Db;
  let franqueado: Db;
  let vendedor: Db;
  let foraDaCadeia: Db;

  let empresaMaster: string;
  let empresaFranqueado: string;
  let empresaVendedor: string;

  beforeAll(async () => {
    const m = await criarPersonaComEmpresa("master", { emailPrefix: "multi-master" });
    master = m.client;
    empresaMaster = m.empresaId;

    const empFranqueado = await criarEmpresa({
      nome: "Multi Franqueado",
      parent_id: empresaMaster,
    });
    empresaFranqueado = empFranqueado.id;

    const f = await criarPersonaComEmpresa("franqueado", {
      empresaId: empresaFranqueado,
      emailPrefix: "multi-franqueado",
      superiorId: m.userId,
    });
    franqueado = f.client;

    const empVendedor = await criarEmpresa({
      nome: "Multi Vendedor",
      parent_id: empresaFranqueado,
    });
    empresaVendedor = empVendedor.id;

    const v = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaVendedor,
      emailPrefix: "multi-vendedor",
      superiorId: f.userId,
    });
    vendedor = v.client;

    const fora = await criarPersonaComEmpresa("vendedor", { emailPrefix: "multi-fora" });
    foraDaCadeia = fora.client;
  });

  it("POSITIVO: master vê as 3 empresas da cadeia (própria + franqueado + vendedor)", async () => {
    const { data, error } = await master
      .from("empresas")
      .select("id")
      .in("id", [empresaMaster, empresaFranqueado, empresaVendedor]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaMaster, empresaFranqueado, empresaVendedor]));
  });

  it("POSITIVO: franqueado vê a própria empresa + a do vendedor (mas não a do master)", async () => {
    const { data, error } = await franqueado
      .from("empresas")
      .select("id")
      .in("id", [empresaMaster, empresaFranqueado, empresaVendedor]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaFranqueado, empresaVendedor]));
  });

  it("POSITIVO: vendedor vê só a própria empresa", async () => {
    const { data, error } = await vendedor
      .from("empresas")
      .select("id")
      .in("id", [empresaMaster, empresaFranqueado, empresaVendedor]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((e) => e.id));
    expect(ids).toEqual(new Set([empresaVendedor]));
  });

  it("NEGATIVO: usuário fora da cadeia não vê nenhuma das 3 empresas", async () => {
    const { data, error } = await foraDaCadeia
      .from("empresas")
      .select("id")
      .in("id", [empresaMaster, empresaFranqueado, empresaVendedor]);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
