import { describe, expect, test } from "vitest";
import { contarSeguradorasConsultadas } from "@/lib/seguradora-canonica";

describe("contarSeguradorasConsultadas", () => {
  test("conta só as que o robô suporta", () => {
    expect(contarSeguradorasConsultadas(["Porto", "Allianz"], "Automóvel")).toBe(2);
    expect(contarSeguradorasConsultadas(["Porto", "Itaú", "Zurich"], "Automóvel")).toBe(1);
  });
  test("moto filtra pelas seguradoras do portal de moto", () => {
    expect(contarSeguradorasConsultadas(["Porto", "Suhai", "Bradesco"], "Moto")).toBe(2);
  });
  test("sem seleção ou nula → 0 (robô consulta todas)", () => {
    expect(contarSeguradorasConsultadas([], "Automóvel")).toBe(0);
    expect(contarSeguradorasConsultadas(null, null)).toBe(0);
  });
});
