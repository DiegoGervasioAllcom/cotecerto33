import { beforeEach, describe, expect, it, vi } from "vitest";

type RoleRow = { user_id: string; role: string };
type ProfileRow = {
  id: string;
  nome: string;
  status: "aprovada";
  desligado_em: string | null;
};
type QueryResult<Row> = { data: Row[]; error: Error | null };

const mock = vi.hoisted(() => ({
  profileCalls: [] as { from: number; to: number }[],
  calls: [] as { ids: string[]; from: number; to: number }[],
  rolesByUserId: new Map<string, RoleRow[]>(),
  profilePages: new Map<number, QueryResult<ProfileRow>>(),
  rolesError: null as Error | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        const builder = {
          select: vi.fn(() => builder),
          order: vi.fn(() => builder),
          range: vi.fn(async (from: number, to: number) => {
            mock.profileCalls.push({ from, to });
            return mock.profilePages.get(from) ?? { data: [], error: null };
          }),
        };
        return builder;
      }
      if (table !== "user_roles") throw new Error(`Tabela inesperada: ${table}`);

      let ids: string[] = [];
      const builder = {
        select: vi.fn(() => builder),
        in: vi.fn((_column: string, values: string[]) => {
          ids = values;
          return builder;
        }),
        range: vi.fn(async (from: number, to: number) => {
          mock.calls.push({ ids, from, to });
          return {
            data: ids.flatMap((id) => mock.rolesByUserId.get(id) ?? []).slice(from, to + 1),
            error: mock.rolesError,
          };
        }),
      };
      return builder;
    }),
  },
}));

import {
  carregarPerfisVisiveis,
  carregarRolesDosPerfis,
  vendedoresAtivosDaRede,
} from "@/lib/vendedores-ativos";

describe("filtro de vendedores ativos", () => {
  beforeEach(() => {
    mock.calls.length = 0;
    mock.profileCalls.length = 0;
    mock.rolesByUserId.clear();
    mock.profilePages.clear();
    mock.rolesError = null;
  });

  it("mantém no filtro do Master o vendedor após os primeiros mil perfis visíveis", async () => {
    const profiles = Array.from({ length: 1_001 }, (_, index) => ({
      id: `perfil-${index + 1}`,
      nome: `Perfil ${index + 1}`,
      status: "aprovada" as const,
      desligado_em: null,
    }));
    const vendedorDaUltimaPagina = profiles.at(-1)!;
    mock.profilePages.set(0, { data: profiles.slice(0, 1_000), error: null });
    mock.profilePages.set(1_000, { data: [vendedorDaUltimaPagina], error: null });
    mock.rolesByUserId.set(vendedorDaUltimaPagina.id, [
      { user_id: vendedorDaUltimaPagina.id, role: "vendedor" },
    ]);

    const profilesVisiveis = await carregarPerfisVisiveis();
    const roles = await carregarRolesDosPerfis(profilesVisiveis.map((profile) => profile.id));
    const vendedores = vendedoresAtivosDaRede(profilesVisiveis, roles);

    expect(vendedores).toEqual([vendedorDaUltimaPagina]);
    expect(mock.profileCalls).toEqual([
      { from: 0, to: 999 },
      { from: 1_000, to: 1_999 },
    ]);
    expect(mock.calls).toHaveLength(11);
    expect(mock.calls.at(-1)).toMatchObject({
      ids: [vendedorDaUltimaPagina.id],
      from: 0,
      to: 999,
    });
  });

  it("não inclui gestor ou vendedor desligado mesmo quando ambos estão na rede do Master", () => {
    const profiles = [
      {
        id: "vendedor-ativo",
        nome: "Vendedor ativo",
        status: "aprovada" as const,
        desligado_em: null,
      },
      { id: "master", nome: "Master", status: "aprovada" as const, desligado_em: null },
      {
        id: "vendedor-desligado",
        nome: "Vendedor desligado",
        status: "aprovada" as const,
        desligado_em: "2026-08-09T12:00:00Z",
      },
    ];

    const vendedores = vendedoresAtivosDaRede(profiles, [
      { user_id: "vendedor-ativo", role: "vendedor" },
      { user_id: "master", role: "master" },
      { user_id: "master", role: "vendedor" },
      { user_id: "vendedor-desligado", role: "vendedor" },
    ] as never);

    expect(vendedores.map((profile) => profile.id)).toEqual(["vendedor-ativo"]);
  });

  it("propaga a falha ao ler os cargos, sem tratar vendedor como perfil sem papel", async () => {
    mock.rolesError = new Error("RLS de cargos indisponível");

    await expect(carregarRolesDosPerfis(["vendedor-1"])).rejects.toThrow(
      "Falha ao carregar cargos dos perfis: RLS de cargos indisponível",
    );
  });
});
