import { expect, test } from "@playwright/test";
import { loginAs, preencherDadosComplementaresAteConfirmacao } from "./helpers";
import {
  criarCotacaoTransmissaoFixture,
  limparCotacaoTransmissaoFixture,
  QUIVER_WEBHOOK_HEADERS,
} from "./provision";

/**
 * V12.4.13 — Confirmação fiel ao Quiver (passo 7, sub-passo Confirmação).
 * Vai só até a Confirmação: nunca clica em "Confirmar e transmitir", então o
 * robô (real ou mock) não é acionado.
 */
const CARD = {
  index: 10,
  seguradora: "Seguradora Confirmação E2E",
  produto: "Auto Completo",
  nome: "Plano Padrão",
  opcoes: [
    {
      tipo: "Compreensiva",
      franquia: "Reduzida · R$ 2.000,00",
      avista: "R$ 1.999,90",
      parcelas: "10x de R$ 210,00",
    },
  ],
  formaPagamento: "Boleto",
  coberturasBasicas: { Casco: "100% FIPE" },
};

test("Confirmação mostra os blocos e rótulos do Quiver e não mostra o Retorno do portal", async ({
  page,
}) => {
  const fixture = await criarCotacaoTransmissaoFixture();
  try {
    const res = await page.request.post("/api/webhooks/quiver", {
      headers: QUIVER_WEBHOOK_HEADERS,
      data: { cotacaoId: fixture.cotacaoId, temPremios: true, cards: [CARD] },
    });
    expect(res.ok()).toBeTruthy();

    await loginAs(page, fixture.email, fixture.senha);
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
    await page.goto(`/venda/novo-lead?id=${fixture.cotacaoId}&step=5`);
    await page.getByTitle(`Gerar proposta (${CARD.seguradora})`).click();
    await expect(page.getByRole("heading", { name: "Dados complementares" })).toBeVisible();

    // Avisos do passo 1: contatos vêm do Quiver; correspondência diferente não é enviada.
    await expect(page.getByText(/vêm do cadastro do próprio\s+Quiver/)).toBeVisible();
    await page.getByRole("button", { name: "Endereço de correspondência é o mesmo" }).click();
    await expect(page.getByTestId("aviso-correspondencia")).toContainText(
      "o robô envia sempre o endereço residencial",
    );
    await page.getByRole("button", { name: "Endereço de correspondência é o mesmo" }).click();

    await preencherDadosComplementaresAteConfirmacao(page);

    await expect(
      page.getByRole("heading", { name: `Confirmação — ${CARD.produto}` }),
    ).toBeVisible();

    const tela = page.locator('[data-tour="transmissao-confirmacao"]');
    for (const titulo of ["Dados do veículo", "Perfil", "Coberturas", "Prêmio"]) {
      await expect(tela.locator(".acc-sec-t", { hasText: titulo })).toBeVisible();
    }
    for (const rotulo of [
      "Modelo",
      "Código Fipe",
      "Placa",
      "Chassi",
      "Valor Fipe",
      "Sexo do segurado",
      "Estado civil",
      "Sexo do condutor",
      "Garagem na residência",
      "Garagem ao ir ao trabalho",
      "Garagem ao ir à faculdade/colégio",
      "Tipo de uso",
      "Utilização do veículo",
      "Danos Materiais",
      "Danos Corporais",
      "Danos Morais",
      "Forma de pagamento",
    ]) {
      await expect(tela.locator("td.ff-k", { hasText: new RegExp(`^${rotulo}$`) })).toBeVisible();
    }

    await expect(page.getByText("Fator de ajuste solicitado")).toBeVisible();
    // O formato dd/mm/aaaa é coberto no unit; a fixture pode vir sem vigência ("—").
    await expect(
      page.getByText(/(\d{2}\/\d{2}\/\d{4}|—) até (\d{2}\/\d{2}\/\d{4}|—)/),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Protocolo, orçamento e fator de ajuste do portal só aparecem depois da transmissão.",
      ),
    ).toBeVisible();
    // Sem "Retorno" simulado: nenhuma linha/rótulo de protocolo fora da nota acima.
    await expect(tela.getByText("Protocolo")).toHaveCount(0);
    await expect(page.locator("td.ff-k", { hasText: /Protocolo|Orçamento/ })).toHaveCount(0);
  } finally {
    await limparCotacaoTransmissaoFixture(fixture);
  }
});
