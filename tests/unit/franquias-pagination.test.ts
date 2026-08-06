import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FRANQUIAS_PAGE_SIZE,
  normalizarPaginaFranquias,
  paginaAnteriorSeVazia,
} from "@/routes/_authenticated/operacao/franquias.index";

describe("listagem paginada de franquias", () => {
  it("usa somente a RPC paginada e elimina a consulta profiles com in gigante", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/routes/_authenticated/operacao/franquias.index.tsx"),
      "utf8",
    );

    expect(source).toContain('supabase.rpc("listar_franquias_paginada"');
    expect(source).toContain("p_limite: FRANQUIAS_PAGE_SIZE");
    expect(source).toContain("p_offset: (page - 1) * FRANQUIAS_PAGE_SIZE");
    expect(source).not.toContain('.from("v_franquia_kpis")');
    expect(source).not.toContain('.from("profiles")');
    expect(source).not.toContain('.in("empresa_id"');
    expect(source).toContain("p_limite: EXPORT_PAGE_SIZE");
    expect(source).toContain("allRows.push(...lote.rows)");
  });

  it("separa o total da página e preserva o responsável retornado pelo servidor", () => {
    const pagina = normalizarPaginaFranquias([
      {
        empresa_id: "franquia-1",
        nome: "Supper Centro",
        cidade: "São Paulo",
        uf: "SP",
        status: "aprovada",
        perc_comissao_efetiva: 12,
        leads_mes: 20,
        em_aberto: 5,
        perdidos_mes: 2,
        vendas_mes: 8,
        faturamento_mes: 9000,
        comissao_mes: 1080,
        meta_vendas: 10,
        meta_faturamento: 12000,
        responsavel_nome: "Maria Souza",
        total_count: 61,
      },
    ]);

    expect(FRANQUIAS_PAGE_SIZE).toBe(25);
    expect(pagina.total).toBe(61);
    expect(pagina.rows).toHaveLength(1);
    expect(pagina.rows[0]).toMatchObject({
      empresa_id: "franquia-1",
      responsavel_nome: "Maria Souza",
      vendas_mes: 8,
    });
    expect(pagina.rows[0]).not.toHaveProperty("total_count");
  });

  it("recua e recarrega quando a página atual deixa de existir", () => {
    expect(paginaAnteriorSeVazia(4, 0)).toBe(3);
    expect(paginaAnteriorSeVazia(1, 0)).toBeNull();
    expect(paginaAnteriorSeVazia(4, 1)).toBeNull();
  });
});
