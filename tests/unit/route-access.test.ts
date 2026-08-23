import { describe, expect, it } from "vitest";
import {
  areaDaRotaInterna,
  deveCarregarDadosAcessos,
  podeAdministrarAcessos,
  podeAcessarAreaInterna,
  podeAcessarCentral,
  podeEditarConfiguracoes,
  primeiraRotaInternaPermitida,
  resolverAcessoAreaInterna,
  ROTAS_AREAS_INTERNAS,
} from "@/lib/route-access";

describe("podeAcessarCentral", () => {
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "permite o perfil interno %s",
    (role) => expect(podeAcessarCentral(role, false)).toBe(true),
  );

  it("permite Franquia Full e bloqueia Franquia Individual", () => {
    expect(podeAcessarCentral("franqueado", true)).toBe(true);
    expect(podeAcessarCentral("franqueado", false)).toBe(false);
  });

  it.each(["master", "vendedor"] as const)("bloqueia o perfil externo %s", (role) => {
    expect(podeAcessarCentral(role, false)).toBe(false);
  });
});

describe("podeAcessarAreaInterna", () => {
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "permite o perfil interno %s; AreaChave decide a tela",
    (role) => expect(podeAcessarAreaInterna(role)).toBe(true),
  );

  it.each(["master", "franqueado", "vendedor"] as const)(
    "mantém o perfil externo %s fora das rotas internas",
    (role) => expect(podeAcessarAreaInterna(role)).toBe(false),
  );
});

describe("resolverAcessoAreaInterna sem loop", () => {
  it.each([
    ["supervisor", "mfranq", "/operacao/franquias"],
    ["supervisor", "mfranq", "/operacao/franquias/empresa-1"],
    ["interno", "mmsgs", "/operacao/mensagens"],
    ["interno", "mconf", "/operacao/configuracoes"],
    ["interno", "macessos", "/operacao/acessos"],
  ] as const)("permite %s com somente %s em %s", (role, area, pathname) => {
    expect(resolverAcessoAreaInterna({ role, pathname, areas: new Set([area]) })).toEqual({
      tipo: "permitir",
    });
  });

  it("redireciona uma vez e permite imediatamente a rota de destino", () => {
    const areas = new Set(["mmsgs"]);
    const primeira = resolverAcessoAreaInterna({
      role: "supervisor",
      pathname: "/operacao/configuracoes",
      areas,
    });
    expect(primeira).toEqual({ tipo: "redirecionar", to: "/operacao/mensagens" });
    expect(
      resolverAcessoAreaInterna({
        role: "supervisor",
        pathname: primeira.tipo === "redirecionar" ? primeira.to : "",
        areas,
      }),
    ).toEqual({ tipo: "permitir" });
  });

  it("não aplica o recorte a perfis externos", () => {
    expect(
      resolverAcessoAreaInterna({
        role: "master",
        pathname: "/operacao/configuracoes",
        areas: new Set(),
      }),
    ).toEqual({ tipo: "permitir" });
  });
});

describe("podeEditarConfiguracoes", () => {
  // Revisão 22/08/2026: quem abre a tela já passou pelo guard de área
  // (`useRequireAreaAtual`) — a Matriz decide ao conceder `mconf`, não o
  // código. Read-only sem a Matriz ter pedido não fazia sentido.
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "concede escrita a qualquer perfil interno (%s) — a área já filtrou quem entra",
    (role) => expect(podeEditarConfiguracoes(role)).toBe(true),
  );

  it.each(["master", "franqueado", "vendedor"] as const)(
    "nunca concede escrita a perfil externo %s",
    (role) => expect(podeEditarConfiguracoes(role)).toBe(false),
  );
});

describe("podeAdministrarAcessos", () => {
  // Revisão 22/08/2026, substituindo a regra por cargo (H8): a área
  // `macessos` já decidiu quem entra na tela; quem entra administra por
  // completo, independente do cargo.
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "concede ações administrativas a qualquer perfil interno (%s)",
    (role) => expect(podeAdministrarAcessos(role)).toBe(true),
  );

  it.each(["sup_vendas", "sup_operacional", "sup_backoffice", null, undefined] as const)(
    "ignora o cargo — só o perfil interno decide (cargo %s)",
    (cargoId) => expect(podeAdministrarAcessos("supervisor", cargoId)).toBe(true),
  );

  it.each(["master", "franqueado", "vendedor"] as const)(
    "não concede ações administrativas a perfil externo %s",
    (role) => expect(podeAdministrarAcessos(role)).toBe(false),
  );
});

describe("deveCarregarDadosAcessos", () => {
  it.each(["matriz", "coordenador", "supervisor", "interno"] as const)(
    "carrega para %s somente quando o guard permitiu",
    (role) => {
      expect(deveCarregarDadosAcessos(role, null, false)).toBe(true);
      expect(deveCarregarDadosAcessos(role, null, true)).toBe(false);
    },
  );

  it("carrega para o Supervisor de Vendas também — cargo não decide mais", () => {
    expect(deveCarregarDadosAcessos("supervisor", "sup_vendas", false)).toBe(true);
  });

  it.each(["master", "franqueado", "vendedor"] as const)(
    "nunca carrega para perfil externo %s",
    (role) => expect(deveCarregarDadosAcessos(role, null, false)).toBe(false),
  );
});

describe("recorte de URL por AreaChave", () => {
  it("mapeia as 17 rotas internas canônicas sem lacunas", () => {
    expect(ROTAS_AREAS_INTERNAS).toHaveLength(17);
    expect(new Set(ROTAS_AREAS_INTERNAS.map(({ area }) => area)).size).toBe(17);
  });

  it.each([
    ["/comando/visao-geral", "mdash"],
    ["/comando/leads", "mleads"],
    ["/comando/distribuicao", "mdist"],
    ["/operacao/aprovacoes", "maprov"],
    ["/operacao/franquias", "mfranq"],
    ["/operacao/franquias/empresa-1", "mfranq"],
    ["/operacao/vendedores", "mvend"],
    ["/operacao/vendedores/user-1", "mvend"],
    ["/operacao/supervisao", "msuperv"],
    ["/operacao/pipeline-geral", "mpipe"],
    ["/operacao/vendas", "mvendas"],
    ["/operacao/comissoes", "mcomm"],
    ["/operacao/premiacoes", "mprem"],
    ["/operacao/estornos", "mestorno"],
    ["/operacao/renovacoes", "mren"],
    ["/operacao/relatorios", "mrel"],
    ["/operacao/mensagens", "mmsgs"],
    ["/operacao/acessos", "macessos"],
    ["/operacao/configuracoes", "mconf"],
  ] as const)("mapeia %s para %s", (pathname, area) => {
    expect(areaDaRotaInterna(pathname)).toBe(area);
  });

  it("não interfere nas rotas da rede externa", () => {
    expect(areaDaRotaInterna("/inicio")).toBeNull();
    expect(areaDaRotaInterna("/venda/pipeline")).toBeNull();
    expect(areaDaRotaInterna("/operacao/xacessos")).toBeNull();
  });

  it("redireciona para a primeira área permitida na ordem do menu", () => {
    expect(primeiraRotaInternaPermitida(new Set(["mconf", "mpipe"]))).toBe(
      "/operacao/pipeline-geral",
    );
    expect(primeiraRotaInternaPermitida(new Set())).toBeNull();
  });
});
