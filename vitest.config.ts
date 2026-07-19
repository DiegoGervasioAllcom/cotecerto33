import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Config ISOLADA do vite.config.ts — o plugin do TanStack Start quebra o runner.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "node",
    // Carrega o .env inteiro (inclusive vars sem prefixo VITE_) para process.env dos testes.
    env: loadEnv("", process.cwd(), ""),
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      // O gate de cobertura (T9) protege a LÓGICA DE NEGÓCIO PURA do lado
      // cliente — máscaras/parse de moeda e os schemas Zod de cotação/cadastro,
      // que um dev poderia quebrar silenciosamente. As regras de negócio do
      // servidor (RPCs/triggers/RLS no Postgres) são cobertas pelos jobs
      // `db-tests` e `e2e` no CI, não por cobertura de TS. Por isso o
      // denominador é só o conjunto testável abaixo — medir `src/**` inteiro
      // (telas, wrappers de Supabase) só produziria uma métrica enganosa.
      include: [
        "src/lib/masks.ts",
        "src/lib/veiculo.ts",
        "src/lib/schemas/cadastro.schema.ts",
        "src/lib/schemas/catalogos.schema.ts",
        "src/lib/schemas/cotacaoSegurado.schema.ts",
        "src/lib/schemas/cotacaoSeguro.schema.ts",
        "src/lib/schemas/cotacaoVeiculo.schema.ts",
        "src/lib/schemas/cotacaoPerfil.schema.ts",
        "src/lib/schemas/cotacaoCoberturas.schema.ts",
      ],
      // Piso que trava a cobertura atual e barra regressões. Ver comentário
      // acima: escopo intencionalmente restrito à lógica pura testável.
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          fileParallelism: false, // banco compartilhado — sem corrida
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
