import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const MATRIZ_EMAIL = "desenvolvimento@suppercerto.com.br";
const MATRIZ_SENHA = "Supper@123!";

test("admin da matriz (seed) faz login e chega na Visão geral", async ({ page }) => {
  await loginAs(page, MATRIZ_EMAIL, MATRIZ_SENHA);

  // O perfil matriz é redirecionado de /inicio para /comando/visao-geral.
  await expect(page).toHaveURL(/\/comando\/visao-geral/, { timeout: 15_000 });
  await expect(page).toHaveTitle(/Visão geral · CoteCerto/);
});
