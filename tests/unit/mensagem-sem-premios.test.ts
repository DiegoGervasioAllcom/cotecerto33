import { describe, expect, it } from "vitest";
import { explicarSemPremios } from "@/lib/mensagem-sem-premios";

describe("explicarSemPremios", () => {
  it("sem mensagem: frase padrão com o que fazer", () => {
    expect(explicarSemPremios(null).resumo).toMatch(/não retornou preço/);
    expect(explicarSemPremios("  ").detalhe).toBeUndefined();
  });

  it("texto técnico de 'nenhum card' vira frase de vendedor, sem jargão", () => {
    const r = explicarSemPremios(
      "Nenhum card de prêmio foi renderizado pelo portal. Pode ocorrer quando a combinação de tipoUso + seguradorasDisponiveis não tem produto disponível no portal Suppercerto.",
    );
    expect(r.resumo).not.toMatch(/tipoUso|Suppercerto|seguradorasDisponiveis/);
    expect(r.detalhe).toBeUndefined();
  });

  it("alerta de comissão: resume o problema e guarda o texto do portal em detalhe", () => {
    const r = explicarSemPremios("Alerta do portal: Comissão máx. deve ser: 30%.");
    expect(r.resumo).toMatch(/comissão pendente/);
    expect(r.detalhe).toBe("Comissão máx. deve ser: 30%.");
  });

  it("outro alerta do portal: frase genérica e o texto em detalhe", () => {
    const r = explicarSemPremios("Alerta do portal: Algo inesperado.");
    expect(r.resumo).toMatch(/bloqueou o cálculo/);
    expect(r.detalhe).toBe("Algo inesperado.");
  });

  it("placa não encontrada tem frase própria", () => {
    expect(
      explicarSemPremios("Placa não encontrada no portal: ABC1D23. A busca...").resumo,
    ).toMatch(/placa/i);
  });

  it("mensagem desconhecida passa como veio", () => {
    expect(explicarSemPremios("Erro inesperado na Página 6").resumo).toBe(
      "Erro inesperado na Página 6",
    );
  });
});

import { textoSemPremios } from "@/lib/mensagem-sem-premios";

describe("textoSemPremios", () => {
  it("junta resumo e detalhe quando há alerta do portal", () => {
    expect(textoSemPremios("Alerta do portal: Comissão máx. deve ser: 30%.")).toMatch(
      /\(Detalhe: Comissão máx\. deve ser: 30%\.\)$/,
    );
  });
  it("sem detalhe devolve só o resumo", () => {
    expect(textoSemPremios(null)).not.toMatch(/Detalhe/);
  });
});

describe("limite de tamanho", () => {
  it("corta mensagens muito longas", () => {
    expect(explicarSemPremios("x".repeat(1000)).resumo.length).toBe(300);
  });
});
