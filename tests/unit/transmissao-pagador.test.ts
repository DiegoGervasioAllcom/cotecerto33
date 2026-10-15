import { describe, expect, it } from "vitest";
import { mascararData, validarPagador } from "@/lib/transmissao-pagador";

const AGORA = new Date(2026, 9, 15);
const fisicaOk = {
  tipoPessoa: "Física",
  nome: "Pagador de Teste",
  documento: "11144477735",
  email: "teste@example.com",
  ddd: "11",
  telefone: "987654321",
  sexo: "Masculino",
  estadoCivil: "Solteiro(a)",
  dataNascimento: "15/03/1985",
} as const;
const juridicaOk = {
  tipoPessoa: "Jurídica",
  nome: "Empresa de Teste Ltda",
  documento: "11222333000181",
  email: "financeiro@example.com",
  ddd: "11",
  telefone: "987654321",
  sexo: "",
  estadoCivil: "",
  dataNascimento: "",
} as const;

describe("pagador — validação", () => {
  it("aceita pessoa Física completa", () => {
    expect(validarPagador(fisicaOk, AGORA)).toEqual({});
  });

  it("pessoa Jurídica não exige sexo, estado civil nem nascimento", () => {
    expect(validarPagador(juridicaOk, AGORA)).toEqual({});
  });

  it("pessoa Física exige sexo, estado civil e nascimento", () => {
    const erros = validarPagador(
      { ...fisicaOk, sexo: "", estadoCivil: "", dataNascimento: "" },
      AGORA,
    );
    expect(Object.keys(erros).sort()).toEqual(["dataNascimento", "estadoCivil", "sexo"]);
  });

  it.each([
    ["sem tipo de pessoa", { ...fisicaOk, tipoPessoa: "" }, "tipoPessoa"],
    ["nome vazio", { ...fisicaOk, nome: "  " }, "nome"],
    ["CPF inválido", { ...fisicaOk, documento: "11144477736" }, "documento"],
    ["CNPJ inválido", { ...juridicaOk, documento: "11222333000182" }, "documento"],
    ["CPF onde se espera CNPJ", { ...juridicaOk, documento: "11144477735" }, "documento"],
    ["e-mail inválido", { ...fisicaOk, email: "sem-arroba" }, "email"],
    ["DDD com 1 dígito", { ...fisicaOk, ddd: "1" }, "ddd"],
    ["celular curto", { ...fisicaOk, telefone: "1234567" }, "telefone"],
    ["nascimento inexistente", { ...fisicaOk, dataNascimento: "31/02/1985" }, "dataNascimento"],
    ["nascimento futuro", { ...fisicaOk, dataNascimento: "01/01/2999" }, "dataNascimento"],
    ["estado civil fora da lista", { ...fisicaOk, estadoCivil: "Complicado" }, "estadoCivil"],
  ])("recusa %s", (_n, pagador, campo) => {
    expect(Object.keys(validarPagador(pagador as never, AGORA))).toContain(campo);
  });

  it("as mensagens de erro NUNCA repetem o valor (dado pessoal)", () => {
    const sensivel = { ...fisicaOk, documento: "11144477736", email: "segredo@x" };
    const msgs = JSON.stringify(validarPagador(sensivel as never, AGORA));
    for (const v of ["11144477736", "segredo@x", "Pagador de Teste"]) expect(msgs).not.toContain(v);
  });

  it("tipos errados dão erro controlado", () => {
    expect(
      Object.keys(validarPagador({ nome: 1, ddd: 11 } as never, AGORA)).length,
    ).toBeGreaterThan(0);
    expect(Object.keys(validarPagador(undefined, AGORA)).length).toBeGreaterThan(0);
  });
});

describe("pagador — máscara de data", () => {
  it("dd/mm/aaaa", () => {
    expect(mascararData("1")).toBe("1");
    expect(mascararData("1503")).toBe("15/03");
    expect(mascararData("15031985")).toBe("15/03/1985");
    expect(mascararData("150319851")).toBe("15/03/1985");
  });
});
