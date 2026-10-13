import { describe, expect, it } from "vitest";
import { perfilSchema } from "@/lib/schemas/cotacaoPerfil.schema";
import { resolveProfissao } from "@/components/venda/novo-lead/hooks/useCotacaoRascunho";
import { filtraOpcoes } from "@/lib/normalizaTexto";
import { PROFISSOES_CONDUTOR } from "@/components/venda/novo-lead/enumsProfissao";

const parse = (v?: string) => perfilSchema.safeParse({ profissaoPrincipalCondutor: v }).success;

describe("profissão do condutor", () => {
  it("zod rejeita texto livre e aceita item da lista", () => {
    expect(parse("Motorista de aplicativo")).toBe(false);
    expect(parse("Motorista Profissional")).toBe(true);
    expect(parse("")).toBe(true);
    expect(parse(undefined)).toBe(true);
  });
  it("rascunho: match normalizado ou limpa com aviso", () => {
    expect(resolveProfissao("motorista profissional").profissaoPrincipalCondutor).toBe(
      "Motorista Profissional",
    );
    expect(resolveProfissao("acougueiro").profissaoPrincipalCondutor).toBe("Açougueiro");
    const r = resolveProfissao("Motorista de aplicativo");
    expect(r.profissaoPrincipalCondutor).toBe("");
    expect(r.profissaoAviso).toContain("Motorista de aplicativo");
  });
  it("filtro sem acento/caixa", () => {
    expect(filtraOpcoes(PROFISSOES_CONDUTOR, "ACOUGUEIRO")).toContain("Açougueiro");
    expect(filtraOpcoes(["A", "B"], "")).toEqual(["A", "B"]);
  });
});
