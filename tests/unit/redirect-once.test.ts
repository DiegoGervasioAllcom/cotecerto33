import { describe, expect, it } from "vitest";
import {
  limparChaveRedirecionamentoFalho,
  proximaChaveRedirecionamento,
} from "@/lib/redirect-once";

describe("proximaChaveRedirecionamento", () => {
  it("bloqueia o redisparo da mesma transição enquanto a origem segue montada", () => {
    const primeira = proximaChaveRedirecionamento(
      ["usuario-interno", "/comando/visao-geral"],
      null,
    );

    expect(primeira).toBe("usuario-interno->/comando/visao-geral");
    expect(
      proximaChaveRedirecionamento(["usuario-interno", "/comando/visao-geral"], primeira),
    ).toBeNull();
  });

  it("libera uma nova transição quando usuário ou destino muda", () => {
    const anterior = "supervisor->/comando/visao-geral";

    expect(proximaChaveRedirecionamento(["interno", "/comando/visao-geral"], anterior)).toBe(
      "interno->/comando/visao-geral",
    );
    expect(proximaChaveRedirecionamento(["interno", "/operacao/acessos"], anterior)).toBe(
      "interno->/operacao/acessos",
    );
  });

  it("libera retry quando a tentativa atual falha", () => {
    const tentativa = "interno->/operacao/acessos";

    expect(limparChaveRedirecionamentoFalho(tentativa, tentativa)).toBeNull();
    expect(proximaChaveRedirecionamento(["interno", "/operacao/acessos"], null)).toBe(tentativa);
  });

  it("não apaga uma transição nova quando uma Promise antiga rejeita depois", () => {
    expect(
      limparChaveRedirecionamentoFalho(
        "interno->/operacao/configuracoes",
        "interno->/operacao/acessos",
      ),
    ).toBe("interno->/operacao/configuracoes");
  });
});
