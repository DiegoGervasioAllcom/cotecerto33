import { beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  criarEmpresa,
  criarPersonaComEmpresa,
  loginMatriz,
  uniq,
  type Db,
} from "../helpers/supabase";

describe("RPC listar_franquias_paginada — paginação e escopo de rede", () => {
  let matriz: Db;
  let supervisor: Db;
  let supervisorEmpresaId: string;
  let filhaAEmpresaId: string;
  let foraDaRedeId: string;
  let vendedorDaFilha: Db;
  let proprietarioFull: Db;
  let internoSemArea: Db;
  const empresasVolume: string[] = [];

  beforeAll(async () => {
    matriz = await loginMatriz();

    const gestor = await criarPersonaComEmpresa("supervisor", {
      emailPrefix: "rpc-franq-supervisor",
    });
    supervisor = gestor.client;
    supervisorEmpresaId = gestor.empresaId;
    await admin.from("profile_areas").insert({ profile_id: gestor.userId, area_chave: "mfranq" });

    const empresaFilha = await criarEmpresa({ nome: uniq("Franquia com equipe") });
    filhaAEmpresaId = empresaFilha.id;

    // Ordem adversa intencional: o vendedor é criado antes do proprietário.
    // A RPC deve resolver o responsável pelo papel canônico `franqueado`, não
    // pelo primeiro profile aprovado da empresa.
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      empresaId: filhaAEmpresaId,
      emailPrefix: "rpc-franq-vendedor-primeiro",
      superiorId: gestor.userId,
    });
    vendedorDaFilha = vendedor.client;
    await admin
      .from("profiles")
      .update({ nome: "Vendedor criado primeiro" })
      .eq("id", vendedor.userId);

    const proprietario = await criarPersonaComEmpresa("franqueado", {
      empresaId: filhaAEmpresaId,
      emailPrefix: "rpc-franq-proprietario-depois",
      superiorId: gestor.userId,
    });
    proprietarioFull = proprietario.client;
    await admin
      .from("profiles")
      .update({ nome: "Proprietário Franqueado" })
      .eq("id", proprietario.userId);

    const fora = await criarPersonaComEmpresa("master", { emailPrefix: "rpc-franq-master-b" });
    foraDaRedeId = fora.empresaId;

    const semArea = await criarPersonaComEmpresa("supervisor", {
      emailPrefix: "rpc-franq-supervisor-sem-area",
    });
    internoSemArea = semArea.client;

    for (let i = 0; i < 23; i += 1) {
      const empresa = await criarEmpresa({
        nome: uniq(`RPC volume ${String(i).padStart(2, "0")}`),
      });
      empresasVolume.push(empresa.id);
    }
  }, 120_000);

  it("POSITIVO: matriz pagina volume sem enviar lista de IDs e recebe total estável", async () => {
    const { data: primeira, error: erroPrimeira } = await matriz.rpc("listar_franquias_paginada", {
      p_limite: 10,
      p_offset: 0,
    });
    expect(erroPrimeira).toBeNull();
    expect(primeira).toHaveLength(10);

    const total = Number(primeira?.[0]?.total_count ?? 0);
    expect(total).toBeGreaterThanOrEqual(empresasVolume.length + 3);

    const ids = new Set<string>();
    for (let offset = 0; offset < total; offset += 10) {
      const { data, error } = await matriz.rpc("listar_franquias_paginada", {
        p_limite: 10,
        p_offset: offset,
      });
      expect(error).toBeNull();
      for (const row of data ?? []) {
        ids.add(row.empresa_id);
        expect(Number(row.total_count)).toBe(total);
      }
    }

    expect(empresasVolume.every((id) => ids.has(id))).toBe(true);
  });

  it("POSITIVO: interno com mfranq recebe sua rede e o proprietário no mesmo resultado", async () => {
    const { data, error } = await supervisor.rpc("listar_franquias_paginada", {
      p_limite: 20,
      p_offset: 0,
    });
    expect(error).toBeNull();

    const ids = new Set((data ?? []).map((row) => row.empresa_id));
    expect(ids.has(supervisorEmpresaId)).toBe(true);
    expect(ids.has(filhaAEmpresaId)).toBe(true);
    expect(data?.find((row) => row.empresa_id === filhaAEmpresaId)?.responsavel_nome).toBe(
      "Proprietário Franqueado",
    );
  });

  it("NEGATIVO: interno autorizado NÃO recebe empresa de outra rede", async () => {
    const { data, error } = await supervisor.rpc("listar_franquias_paginada", {
      p_limite: 20,
      p_offset: 0,
    });
    expect(error).toBeNull();
    expect((data ?? []).some((row) => row.empresa_id === foraDaRedeId)).toBe(false);
  });

  it("NEGATIVO: vendedor não amplia seu acesso pela RPC security definer", async () => {
    const { error } = await vendedorDaFilha.rpc("listar_franquias_paginada", {
      p_limite: 20,
      p_offset: 0,
    });
    expect(error?.code).toBe("42501");
  });

  it("NEGATIVO: proprietário Full sem área mfranq não acessa listagem interna", async () => {
    const { error } = await proprietarioFull.rpc("listar_franquias_paginada", {
      p_limite: 20,
      p_offset: 0,
    });
    expect(error?.code).toBe("42501");
  });

  it("NEGATIVO: perfil interno sem área efetiva mfranq é bloqueado", async () => {
    const { error } = await internoSemArea.rpc("listar_franquias_paginada", {
      p_limite: 20,
      p_offset: 0,
    });
    expect(error?.code).toBe("42501");
    expect(error?.message).toContain("área Franquias");
  });

  it("NEGATIVO: chamada anônima não executa a RPC", async () => {
    const { error } = await anonClient().rpc("listar_franquias_paginada", {
      p_limite: 10,
      p_offset: 0,
    });
    expect(error).not.toBeNull();
  });

  it("NEGATIVO: limites inválidos são rejeitados no servidor", async () => {
    const { error } = await matriz.rpc("listar_franquias_paginada", {
      p_limite: 201,
      p_offset: 0,
    });
    expect(error?.code).toBe("22023");
  });
});
