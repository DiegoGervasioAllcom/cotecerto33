import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ARQUIVOS_DAS_17_AREAS = [
  "src/routes/_authenticated/comando/visao-geral.tsx",
  "src/routes/_authenticated/comando/leads.tsx",
  "src/routes/_authenticated/comando/distribuicao.tsx",
  "src/routes/_authenticated/operacao/aprovacoes.tsx",
  "src/routes/_authenticated/operacao/franquias.index.tsx",
  "src/routes/_authenticated/operacao/franquias.$id.tsx",
  "src/routes/_authenticated/operacao/vendedores.index.tsx",
  "src/routes/_authenticated/operacao/vendedores.$id.tsx",
  "src/routes/_authenticated/operacao/supervisao.tsx",
  "src/routes/_authenticated/operacao/pipeline-geral.tsx",
  "src/routes/_authenticated/operacao/vendas.tsx",
  "src/routes/_authenticated/operacao/comissoes.tsx",
  "src/routes/_authenticated/operacao/premiacoes.tsx",
  "src/routes/_authenticated/operacao/estornos.tsx",
  "src/routes/_authenticated/operacao/renovacoes.tsx",
  "src/routes/_authenticated/operacao/relatorios.tsx",
  "src/routes/_authenticated/operacao/mensagens.tsx",
  "src/routes/_authenticated/operacao/acessos.tsx",
  "src/routes/_authenticated/operacao/configuracoes.tsx",
] as const;

describe("contrato dos guards das 17 áreas", () => {
  it.each(ARQUIVOS_DAS_17_AREAS)("%s não mantém allowlist local incompatível", (arquivo) => {
    const source = readFileSync(resolve(process.cwd(), arquivo), "utf8");
    expect(source).not.toContain("useRequireRole(");

    const podeCompartilharComFull =
      arquivo.endsWith("comando/leads.tsx") || arquivo.endsWith("comando/distribuicao.tsx");
    if (!podeCompartilharComFull) {
      expect(source).not.toContain("useRequireMatrizOuFranquiaFull(");
    }
  });
});
