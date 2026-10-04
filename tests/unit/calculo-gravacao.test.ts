import { describe, it, expect, vi } from "vitest";
import {
  gravouAntesDeCalcular,
  MSG_FALHA_GRAVAR,
} from "@/components/venda/novo-lead/calculoGravacao";

describe("gravouAntesDeCalcular", () => {
  it("save ok -> true (pode enviar) e repassa overrides", async () => {
    const p = vi.fn().mockResolvedValue(true);
    expect(await gravouAntesDeCalcular(p, { seguradorasSel: ["x"] })).toBe(true);
    expect(p).toHaveBeenCalledWith({ seguradorasSel: ["x"] });
  });
  it("save false -> false (não envia)", async () => {
    expect(await gravouAntesDeCalcular(vi.fn().mockResolvedValue(false))).toBe(false);
  });
  it("save lança exceção -> false (não envia)", async () => {
    expect(await gravouAntesDeCalcular(vi.fn().mockRejectedValue(new Error("rede")))).toBe(false);
  });
  it("mensagem em PT-BR sem detalhe técnico", () => {
    expect(MSG_FALHA_GRAVAR).toMatch(/salvar a cotação/);
  });
});
