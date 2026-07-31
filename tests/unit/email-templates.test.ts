import { describe, expect, test } from "vitest";
import { renderEmailTemplate } from "@/lib/email-templates";

describe("templates dos e-mails de acesso", () => {
  test("pendência renderiza os dados oficiais em HTML e texto", () => {
    const rendered = renderEmailTemplate({
      tipo: "pendencia",
      nome: "Ana",
      tipo_declarado: "Franquia Full",
      pendencia: "Enviar contrato social",
      data_pedido: "30/07/2026",
    });

    expect(rendered.subject).toBe("Falta um dado para liberar seu acesso ao Supper Certo");
    expect(rendered.html).toContain("Enviar contrato social");
    expect(rendered.html).toContain("30/07/2026");
    expect(rendered.text).toContain("O que falta: Enviar contrato social");
  });

  test("recusa escapa conteúdo controlado pelo usuário no HTML", () => {
    const rendered = renderEmailTemplate({
      tipo: "recusa",
      nome: '<img src=x onerror="alert(1)">',
      tipo_declarado: "Master & Parceiro",
      motivo: "<script>alert('x')</script>",
    });

    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("Master &amp; Parceiro");
    expect(rendered.text).toContain("<script>alert('x')</script>");
  });

  test.each([
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "matriz" as const,
        nome: "Ana",
        aprovador: "Diretora Lis",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Seu acesso à Matriz está liberado",
      excerpts: ["17 áreas", "responde pelas configurações", "Diretora Lis"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "cargo" as const,
        nome: "Bia",
        cargo: "Marketing",
        areas: ["Visão geral", "Relatórios"],
        janela: "segunda a sexta, das 8h às 18h",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Seu acesso como Marketing",
      excerpts: ["Visão geral · Relatórios", "Janela de acesso", "nada além disso"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "supervisor" as const,
        nome: "Caio",
        tipo_supervisor: "Vendas" as const,
        areas: ["Aprovações", "Vendas"],
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Seu acesso de Supervisor (Vendas)",
      excerpts: ["sem comissionamento", "alçada de desconto", "Aprovações · Vendas"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "master" as const,
        nome: "Dani",
        grupo: "Grupo Sul",
        regiao: "Paraná",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Seu acesso de Master está liberado",
      excerpts: ["Grupo Sul", "Paraná", "20% sobre a comissão da equipe"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "franquia_full" as const,
        nome: "Eva",
        franquia: "Supper Curitiba",
        cidade_uf: "Curitiba/PR",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Sua franquia Full está ativa",
      excerpts: ["Supper Curitiba", "Curitiba/PR", "customizados para a sua operação"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "franquia_individual" as const,
        nome: "Fábio",
        modelo: "Smart" as const,
        responsavel: "Master Sul",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Sua franquia Smart está ativa",
      excerpts: ["opera como vendedor", "Master Sul", "definido em contrato"],
    },
    {
      template: {
        tipo: "boas_vindas" as const,
        variante: "vendedor" as const,
        nome: "Gabi",
        origem: "Full" as const,
        responsavel: "Franquia Curitiba",
        link: "https://app.teste/senha",
      },
      subject: "Boas-vindas Supper! Seu acesso de vendedor",
      excerpts: ["até 3 minutos", "Franquia Curitiba", "nunca dados de outros vendedores"],
    },
  ])(
    "renderiza a variante $template.variante conforme o modelo oficial",
    ({ template, subject, excerpts }) => {
      const rendered = renderEmailTemplate(template);

      expect(rendered.subject).toBe(subject);
      for (const excerpt of excerpts) {
        expect(`${rendered.html} ${rendered.text}`).toContain(excerpt);
      }
      expect(`${rendered.html} ${rendered.text}`).toContain("48 horas");
    },
  );

  test("supervisor Operacional não recebe texto de alçada de Vendas", () => {
    const rendered = renderEmailTemplate({
      tipo: "boas_vindas",
      variante: "supervisor",
      nome: "Bia",
      tipo_supervisor: "Operacional",
      areas: ["Leads", "Distribuição"],
      link: "https://app.teste/senha",
    });

    expect(rendered.html).toContain("sem alçada");
    expect(rendered.html).not.toContain("alçada de desconto");
  });

  test("boas-vindas informa 48 horas, uso único e escapa nome, tipo e link", () => {
    const rendered = renderEmailTemplate({
      tipo: "boas_vindas",
      variante: "matriz",
      nome: "<img src=x>",
      aprovador: "Matriz & <script>alert(1)</script>",
      link: 'https://app.teste/auth/criar-senha?x="<script>',
    });

    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;img src=x&gt;");
    expect(rendered.html).toContain("Matriz &amp; &lt;script&gt;");
    expect(rendered.html).toContain("48 horas");
    expect(`${rendered.html} ${rendered.text}`).toMatch(/só pode ser usado uma vez/i);
    expect(`${rendered.html} ${rendered.text}`).not.toMatch(
      /senha\s*(temporária|provisória)|password/i,
    );
  });

  test("nenhum template inclui senha ou campo secreto no conteúdo", () => {
    const templates = [
      renderEmailTemplate({
        tipo: "pendencia",
        nome: "Ana",
        tipo_declarado: "Franquia",
        pendencia: "Enviar documento",
        data_pedido: "30/07/2026",
      }),
      renderEmailTemplate({
        tipo: "recusa",
        nome: "Bia",
        tipo_declarado: "Master",
        motivo: "Documento incompatível",
      }),
      renderEmailTemplate({
        tipo: "boas_vindas",
        variante: "vendedor",
        nome: "Caio",
        origem: "Matriz",
        responsavel: "Supervisora Ana",
        link: "https://app.teste/criar-acesso",
      }),
    ];

    for (const rendered of templates) {
      expect(`${rendered.subject} ${rendered.html} ${rendered.text}`).not.toMatch(
        /senha\s*(temporária|provisória)|password/i,
      );
    }
  });
});
