import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, type Db } from "../helpers/supabase";

/**
 * Filhas de cotação: DELETE negado a todo `authenticated` (não há policy de DELETE);
 * só SECURITY DEFINER (salvar_cotacao_rascunho, registrar_premios_quiver) e o
 * ON DELETE CASCADE de cotacoes apagam. Leitura/escrita seguem como antes.
 * Sem policy de DELETE o PostgREST devolve error nulo e 0 linhas.
 */
type Filha =
  | "cotacao_coberturas"
  | "cotacao_perfil"
  | "cotacao_premios"
  | "cotacao_segurado"
  | "cotacao_seguro"
  | "cotacao_veiculo";

// tabela, coluna de texto usada para provar UPDATE, e se aceita 2ª linha por cotação
const TABELAS: [Filha, string, boolean][] = [
  ["cotacao_coberturas", "casco_valor", false],
  ["cotacao_perfil", "cond_nome", false],
  ["cotacao_premios", "cobertura", true],
  ["cotacao_segurado", "nome", false],
  ["cotacao_seguro", "campanha", false],
  ["cotacao_veiculo", "marca_nome", false],
];

async function montarCotacao(empresaId: string, responsavelId: string) {
  const { data, error } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: responsavelId })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id;
  const ins = [
    admin.from("cotacao_segurado").insert({ cotacao_id: id, nome: "Segurado Original" }),
    admin
      .from("cotacao_veiculo")
      .insert({ cotacao_id: id, marca_nome: "FIAT", modelo_nome: "UNO" }),
    admin.from("cotacao_coberturas").insert({ cotacao_id: id }),
    admin.from("cotacao_perfil").insert({ cotacao_id: id }),
    admin.from("cotacao_premios").insert({ cotacao_id: id, seguradora: "Seguradora Teste" }),
    admin.from("cotacao_seguro").insert({ cotacao_id: id }),
  ];
  for (const r of await Promise.all(ins)) if (r.error) throw r.error;
  return id;
}

const contar = async (t: Filha, cotId: string) => {
  const r = await admin.from(t).select("cotacao_id").eq("cotacao_id", cotId);
  if (r.error) throw r.error;
  return r.data.length;
};

describe("RLS filhas de cotação — DELETE negado a todo client autenticado", () => {
  let dono: Db;
  let colega: Db;
  let matriz: Db;
  let masterRede: Db;
  let masterOutra: Db;
  let sup: Db;
  let coord: Db;
  let vendOutra: Db;
  let cotId: string;

  beforeAll(async () => {
    const s = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-filhas" });
    sup = s.client;
    const m = await criarPersonaComEmpresa("master", {
      emailPrefix: "mst-filhas",
      superiorId: s.userId,
    });
    masterRede = m.client;
    const v = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-filhas",
      superiorId: m.userId,
    });
    dono = v.client;
    colega = (
      await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "vend-filhas-col",
        empresaId: v.empresaId,
        superiorId: m.userId,
      })
    ).client;
    cotId = await montarCotacao(v.empresaId, v.userId);

    const m2 = await criarPersonaComEmpresa("master", { emailPrefix: "mst-filhas-o" });
    masterOutra = m2.client;
    vendOutra = (
      await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "vend-filhas-o",
        superiorId: m2.userId,
      })
    ).client;
    coord = (await criarPersonaComEmpresa("coordenador", { emailPrefix: "coord-filhas" })).client;
    matriz = await loginMatriz();
  });

  const nomeados = (): [string, () => Db][] => [
    ["colega da mesma empresa", () => colega],
    ["dono (responsável)", () => dono],
    ["matriz", () => matriz],
    ["master da rede", () => masterRede],
    ["supervisor da cadeia", () => sup],
    ["coordenador", () => coord],
  ];

  describe.each(TABELAS)("%s", (tabela, coluna, aceitaSegunda) => {
    it.each(nomeados())("NEGATIVO: %s não apaga (0 linhas, linha intacta)", async (_n, get) => {
      const antes = await contar(tabela, cotId);
      expect(antes).toBe(1);
      const r = await get().from(tabela).delete().eq("cotacao_id", cotId).select("cotacao_id");
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
      expect(await contar(tabela, cotId)).toBe(1);
    });

    it.each(nomeados())("leitura inalterada: %s lê a linha", async (_n, get) => {
      const r = await get().from(tabela).select("cotacao_id").eq("cotacao_id", cotId);
      expect(r.error).toBeNull();
      expect(r.data).toEqual([{ cotacao_id: cotId }]);
    });

    it("NEGATIVO: vendedor de outra empresa e master de outra rede não leem", async () => {
      for (const c of [vendOutra, masterOutra]) {
        const r = await c.from(tabela).select("cotacao_id").eq("cotacao_id", cotId);
        expect(r.error).toBeNull();
        expect(r.data).toEqual([]);
      }
    });

    it("dono atualiza; colega da mesma empresa não insere nem atualiza", async () => {
      const upd = await dono
        .from(tabela)
        .update({ [coluna]: "DONO-OK" } as never)
        .eq("cotacao_id", cotId)
        .select("cotacao_id");
      expect(upd.error).toBeNull();
      expect(upd.data).toHaveLength(1);

      const col = await colega
        .from(tabela)
        .update({ [coluna]: "COLEGA-X" } as never)
        .eq("cotacao_id", cotId)
        .select("cotacao_id");
      // colega enxerga a linha (USING) mas o WITH CHECK (responsável) recusa: erro 42501
      expect(col.error?.code).toBe("42501");
      expect(col.data).toBeNull();
      const real = await admin
        .from(tabela)
        .select(coluna)
        .eq("cotacao_id", cotId)
        .single<Record<string, string>>();
      expect(real.data?.[coluna]).toBe("DONO-OK");

      // INSERT do colega: RLS (WITH CHECK responsável) recusa antes de qualquer unique
      const insCol = await colega.from(tabela).insert({
        cotacao_id: cotId,
        ...(tabela === "cotacao_premios" ? { seguradora: "X" } : {}),
      } as never);
      expect(insCol.error?.code).toBe("42501");

      // INSERT do dono: em tabelas 1:1 passa a RLS e colide na PK (23505, não 42501);
      // em cotacao_premios (1:N) insere de fato.
      const insDono = await dono.from(tabela).insert({
        cotacao_id: cotId,
        ...(tabela === "cotacao_premios" ? { seguradora: "Y" } : {}),
      } as never);
      if (aceitaSegunda) {
        expect(insDono.error).toBeNull();
        expect(await contar(tabela, cotId)).toBe(2);
        await admin.from("cotacao_premios").delete().eq("cotacao_id", cotId).eq("seguradora", "Y");
      } else {
        expect(insDono.error?.code).toBe("23505");
      }
      expect(await contar(tabela, cotId)).toBe(1);
    });
  });

  it("caminho legítimo: salvar_cotacao_rascunho (definer) ainda apaga e reescreve os prêmios", async () => {
    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-filhas-rasc" });
    const id = await montarCotacao(v.empresaId, v.userId);
    const { error } = await v.client.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: id,
      p_payload: {
        step_atual: 1,
        segurado: { nome: "Reescrito" },
        seguro: {},
        veiculo: {},
        perfil: {},
        coberturas: {},
        premios: [{ seguradora: "Nova", cobertura: "Compreensiva", premio: 123.45 }],
      } as never,
    });
    expect(error).toBeNull();
    const p = await admin.from("cotacao_premios").select("seguradora").eq("cotacao_id", id);
    expect(p.data).toEqual([{ seguradora: "Nova" }]); // a linha antiga foi apagada
    const s = await admin.from("cotacao_segurado").select("nome").eq("cotacao_id", id);
    expect(s.data).toEqual([{ nome: "Reescrito" }]);
  });

  it("ON DELETE CASCADE de cotacoes continua limpando as filhas", async () => {
    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-filhas-casc" });
    const id = await montarCotacao(v.empresaId, v.userId);
    const del = await admin.from("cotacoes").delete().eq("id", id);
    expect(del.error).toBeNull();
    for (const [t] of TABELAS) expect(await contar(t, id), t).toBe(0);
  });
});
