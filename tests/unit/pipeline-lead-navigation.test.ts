import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
          })),
        })),
      })),
    })),
    rpc: mocks.rpc,
  },
}));

import { pipelineColumnKey, resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";

describe("pipeline de leads recebidos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agrupa lead qualificado na coluna Qualificando e preserva os demais estágios", () => {
    expect(pipelineColumnKey("qualificado")).toBe("contato");
    expect(pipelineColumnKey("novo")).toBe("novo");
    expect(pipelineColumnKey("cotacao")).toBe("cotacao");
  });

  it("abre a cotação existente no passo persistido sem chamar assumir_lead", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "cotacao-existente", step_atual: 3 },
      error: null,
    });

    await expect(
      resolveExistingLeadDestination({
        leadId: "lead-externo",
        status: "qualificado",
        canAssume: true,
      }),
    ).resolves.toEqual({ kind: "wizard", id: "cotacao-existente", step: 3 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("vendedor assume lead externo sem cotação e recebe wizard com id", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.rpc.mockResolvedValue({ data: "cotacao-criada", error: null });

    const destination = await resolveExistingLeadDestination({
      leadId: "lead-externo",
      status: "qualificado",
      canAssume: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("assumir_lead", { p_lead_id: "lead-externo" });
    expect(destination).toEqual({ kind: "wizard", id: "cotacao-criada", step: 0 });
    expect(destination).not.toEqual({ kind: "wizard", id: "", step: 0 });
  });

  it("gestor não assume nem envia ao cadastro manual quando o lead ainda não tem cotação", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      resolveExistingLeadDestination({
        leadId: "lead-sem-cotacao",
        status: "novo",
        canAssume: false,
      }),
    ).resolves.toEqual({
      kind: "unavailable",
      message: "Este lead ainda não possui cotação. Abra-o pelo perfil do vendedor responsável.",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("direciona proposta e ganho para suas telas, nunca para o wizard manual", async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({ data: { id: "proposta-1" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(
      resolveExistingLeadDestination({ leadId: "lead-1", status: "proposta", canAssume: false }),
    ).resolves.toEqual({ kind: "proposals", selected: "proposta-1" });
    await expect(
      resolveExistingLeadDestination({ leadId: "lead-2", status: "ganho", canAssume: false }),
    ).resolves.toEqual({ kind: "acceptance", selected: undefined });
  });

  it("recusa estágio sem tela e propaga falhas do banco", async () => {
    await expect(
      resolveExistingLeadDestination({ leadId: "lead-1", status: "perdido", canAssume: true }),
    ).resolves.toMatchObject({ kind: "unavailable" });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();

    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("consulta falhou") });
    await expect(
      resolveExistingLeadDestination({ leadId: "lead-2", status: "novo", canAssume: true }),
    ).rejects.toThrow("consulta falhou");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("liga vendedor/Individual à assunção e mantém telas gerenciais somente leitura", () => {
    const vendedor = readFileSync("src/routes/_authenticated/venda/pipeline.tsx", "utf8");
    const geral = readFileSync("src/routes/_authenticated/operacao/pipeline-geral.tsx", "utf8");
    const central = readFileSync("src/routes/_authenticated/comando/leads.tsx", "utf8");

    expect(vendedor).toContain("canAssume: true");
    expect(geral).toContain("canAssume: false");
    expect(central).toContain("canAssume: false");
    for (const source of [vendedor, geral, central]) {
      expect(source).toContain("resolveExistingLeadDestination");
      expect(source).not.toMatch(/to:\s*["']\/venda\/novo-lead["'],\s*search:\s*\{\s*\}/);
    }
  });
});
