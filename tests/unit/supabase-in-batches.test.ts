import { describe, expect, it, vi } from "vitest";
import { selectInBatches } from "@/lib/supabase-in-batches";

describe("selectInBatches", () => {
  it("devolve vazio sem chamar a consulta quando a lista de valores é vazia", async () => {
    const consultarLote = vi.fn();
    const resultado = await selectInBatches([], consultarLote);
    expect(resultado).toEqual({ data: [], error: null });
    expect(consultarLote).not.toHaveBeenCalled();
  });

  it("não corta em lotes quando a lista cabe num só (≤ 100 valores)", async () => {
    const valores = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    const consultarLote = vi.fn().mockResolvedValue({
      data: valores.map((id) => ({ id })),
      error: null,
    });
    const resultado = await selectInBatches(valores, consultarLote);
    expect(consultarLote).toHaveBeenCalledTimes(1);
    expect(consultarLote.mock.calls[0][0]).toEqual(valores);
    expect(resultado.data).toHaveLength(50);
    expect(resultado.error).toBeNull();
  });

  it("corta uma lista grande em lotes de 100 e junta o resultado de todos", async () => {
    const valores = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const consultarLote = vi
      .fn<(lote: string[]) => Promise<{ data: { id: string }[]; error: null }>>()
      .mockImplementation((lote) =>
        Promise.resolve({ data: lote.map((id) => ({ id })), error: null }),
      );
    const resultado = await selectInBatches(valores, consultarLote);
    expect(consultarLote).toHaveBeenCalledTimes(3);
    expect(consultarLote.mock.calls[0][0]).toHaveLength(100);
    expect(consultarLote.mock.calls[1][0]).toHaveLength(100);
    expect(consultarLote.mock.calls[2][0]).toHaveLength(50);
    expect(resultado.data).toHaveLength(250);
    expect(resultado.error).toBeNull();
    // A ordem não importa para quem consome (os resultados viram um Map por
    // id), mas o total tem de bater com a entrada — nenhum registro perdido.
    expect(new Set(resultado.data.map((d) => d.id))).toEqual(new Set(valores));
  });

  it("dispara todos os lotes em paralelo, não em série", async () => {
    const valores = Array.from({ length: 300 }, (_, i) => `id-${i}`);
    let emVoo = 0;
    let maxEmVoo = 0;
    const consultarLote = vi.fn().mockImplementation(async (lote: string[]) => {
      emVoo += 1;
      maxEmVoo = Math.max(maxEmVoo, emVoo);
      await new Promise((r) => setTimeout(r, 10));
      emVoo -= 1;
      return { data: lote.map((id) => ({ id })), error: null };
    });
    await selectInBatches(valores, consultarLote);
    expect(maxEmVoo).toBeGreaterThan(1);
  });

  it("propaga o primeiro erro quando algum lote falha, mas ainda junta os dados dos lotes que funcionaram", async () => {
    const valores = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const erroSimulado = { message: "URL longa demais", code: "PGRST100" };
    const consultarLote = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "id-0" }], error: null })
      .mockResolvedValueOnce({ data: null, error: erroSimulado });
    const resultado = await selectInBatches(valores, consultarLote);
    expect(resultado.error).toEqual(erroSimulado);
    expect(resultado.data).toEqual([{ id: "id-0" }]);
  });
});
