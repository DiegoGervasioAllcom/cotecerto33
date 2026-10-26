import { describe, expect, it, vi } from "vitest";
import { criarPersistenciaSerial, salvarEAvancar } from "@/lib/persistencia-serial";

describe("persistencia serial", () => {
  it("duas chamadas concorrentes resultam em UMA criação", async () => {
    let id: string | null = null;
    const rpc = vi.fn(async (pid: string | null) => {
      await new Promise((r) => setTimeout(r, 10));
      return pid ?? "novo-id";
    });
    const executar = criarPersistenciaSerial();
    const persistir = (reusar = true) =>
      executar(async () => {
        const data = await rpc(id);
        if (!id) id = data;
        return true;
      }, reusar);
    await Promise.all([persistir(), persistir()]);
    expect(rpc.mock.calls.filter((c) => c[0] === null)).toHaveLength(1);
    await Promise.all([persistir(false), persistir(false)]);
    expect(rpc.mock.calls.filter((c) => c[0] === null)).toHaveLength(1);
  });

  it("avancar não avança se o save falhar", async () => {
    const avancar = vi.fn();
    expect(await salvarEAvancar(async () => false, avancar)).toBe(false);
    expect(await salvarEAvancar(async () => Promise.reject(new Error("x")), avancar)).toBe(false);
    expect(avancar).not.toHaveBeenCalled();
    expect(await salvarEAvancar(async () => true, avancar)).toBe(true);
    expect(avancar).toHaveBeenCalledOnce();
  });
});
