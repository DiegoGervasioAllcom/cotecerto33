import { describe, expect, test } from "vitest";
import { buildCotacaoDoc, type DocConfigImpressao, type DocDados } from "@/lib/print";

const DADOS: DocDados = {
  cotacaoNumero: "#00123",
  segurado: {
    nome: "Maria Silva",
    cpfCnpj: "111.111.111-11",
    nascimento: "1990-05-10",
    sexo: "Feminino",
    estadoCivil: "Solteira",
    telefone: "11999990000",
    email: "maria@exemplo.com",
  },
  seguro: { tipo: "Seguro novo", vigIni: "2026-10-01", vigFim: "2027-10-01" },
  veiculo: {
    descricao: "Fiat Idea 1.4",
    anoFab: "2013",
    anoModelo: "2013",
    combustivel: "Flex",
    zeroKm: false,
    placa: "ABC1D23",
    chassi: "9BD135019D2244082",
    cepPernoite: "01000-000",
    tipoUso: "Particular",
  },
  perfil: { condutorMesmo: true, jovens1825: false },
  seguradoras: [
    {
      id: "card-porto",
      seguradora: "Porto",
      planoNome: "Compreensiva",
      precoLabel: "R$ 1.896,08",
      coberturasBasicas: { "Danos materiais a terceiros": "R$ 100.000,00" },
      coberturasAdicionais: { Vidros: "Contratada" },
      opcoes: [
        {
          tipo: "Compreensiva - Franquia reduzida",
          franquia: "R$ 1.500,00",
          avista: "R$ 1.896,08",
          parcelasOpcoes: ["6x sem juros de R$ 316,01", "12x sem juros de R$ 158,00"],
        },
      ],
    },
    {
      id: "card-azul",
      seguradora: "Azul",
      planoNome: "Compreensiva",
      precoLabel: "R$ 2.010,00",
      coberturasBasicas: { "Danos materiais a terceiros": "R$ 100.000,00" },
      opcoes: [
        {
          tipo: "Compreensiva - Franquia normal",
          franquia: "R$ 2.000,00",
          avista: "R$ 2.010,00",
          parcelasOpcoes: ["12x sem juros de R$ 167,50"],
        },
      ],
    },
  ],
};

function config(overrides: Partial<DocConfigImpressao> = {}): DocConfigImpressao {
  return {
    modelo: "supper",
    tipo: "resumida",
    seguradorasSelecionadas: ["card-porto", "card-azul"],
    parcelas: [1, 12],
    economia: false,
    colunado: false,
    ...overrides,
  };
}

describe("buildCotacaoDoc", () => {
  test("nunca inclui comissão ou a linha de controle interno", () => {
    const html = buildCotacaoDoc(DADOS, config());
    expect(html).not.toContain("Comissão");
    expect(html).not.toContain("Controle interno");
  });

  test("modelo Marca Supper usa o bloco genérico da corretora", () => {
    const html = buildCotacaoDoc(DADOS, config({ modelo: "supper" }));
    expect(html).toContain("Supper Certo Seguros");
  });

  test("modelo Marca da seguradora usa o nome da 1ª seguradora selecionada e avisa sobre as demais", () => {
    const html = buildCotacaoDoc(DADOS, config({ modelo: "cia" }));
    expect(html).toContain('<div class="doc-logo-cia">');
    expect(html).toContain("<span>Porto</span><small>Orçamento de Seguro Auto</small>");
    expect(html).toContain("um documento por cia");
    expect(html).toContain("os outros 1 seguem no mesmo PDF");
  });

  test("resumida mostra as 3 colunas do topo e não abre as seções da detalhada", () => {
    const html = buildCotacaoDoc(DADOS, config({ tipo: "resumida" }));
    expect(html).toContain("doc-cols3");
    expect(html).not.toContain("Perfil do condutor");
    expect(html).not.toContain("Condutores e/ou residentes jovens");
  });

  test("detalhada abre perfil do condutor e condutores/residentes jovens", () => {
    const html = buildCotacaoDoc(DADOS, config({ tipo: "detalhada" }));
    expect(html).toContain("Perfil do condutor");
    expect(html).toContain("Próprio segurado");
    expect(html).toContain("Condutores e/ou residentes jovens");
    expect(html).toContain("Jovens de 17 a 25 anos?");
  });

  test("só inclui as seguradoras selecionadas e respeita a ordem escolhida", () => {
    const html = buildCotacaoDoc(DADOS, config({ seguradorasSelecionadas: ["card-azul"] }));
    expect(html).toContain("Azul");
    expect(html).not.toContain(">Porto<");
  });

  test("parcelas filtram o que aparece na tabela de opções", () => {
    const soAvista = buildCotacaoDoc(DADOS, config({ parcelas: [1] }));
    expect(soAvista).toContain("R$ 1.896,08");
    expect(soAvista).not.toContain("316,01");

    const com12x = buildCotacaoDoc(DADOS, config({ parcelas: [1, 12] }));
    expect(com12x).toContain("158,00");
  });

  test("modelo Marca da seguradora com só 1 seguradora selecionada não mostra o aviso de 'documento por cia'", () => {
    const html = buildCotacaoDoc(
      DADOS,
      config({ modelo: "cia", seguradorasSelecionadas: ["card-porto"] }),
    );
    expect(html).not.toContain("um documento por cia");
  });

  test("seguradora sem opções não gera as seções de franquias e parcelas", () => {
    const semOpcoes: DocDados = {
      ...DADOS,
      seguradoras: [{ ...DADOS.seguradoras[0], opcoes: [] }],
    };
    const html = buildCotacaoDoc(semOpcoes, config({ seguradorasSelecionadas: ["card-porto"] }));
    expect(html).not.toContain("Parcelas (* sem juros)");
    expect(html).not.toContain("Franquias do veículo");
  });

  test("seguradora sem coberturas nem opções mostra o aviso em vez de tabela vazia", () => {
    const semCoberturas: DocDados = {
      ...DADOS,
      seguradoras: [
        {
          ...DADOS.seguradoras[0],
          coberturasBasicas: undefined,
          coberturasAdicionais: undefined,
          opcoes: [],
        },
      ],
    };
    const html = buildCotacaoDoc(
      semCoberturas,
      config({ seguradorasSelecionadas: ["card-porto"] }),
    );
    expect(html).toContain("Nenhuma cobertura ou opção de pagamento retornada pela seguradora.");
  });

  test("economia e colunado aplicam as classes correspondentes no bloco raiz do documento", () => {
    const nenhuma = buildCotacaoDoc(DADOS, config());
    expect(nenhuma).toMatch(/<div class="doc">/);

    const ambas = buildCotacaoDoc(DADOS, config({ economia: true, colunado: true }));
    expect(ambas).toMatch(/<div class="doc economia colunado">/);
  });

  test("escapa dados do cliente controlados pelo usuário", () => {
    const malicioso: DocDados = {
      ...DADOS,
      segurado: { ...DADOS.segurado, nome: '<img src=x onerror="alert(1)">' },
    };
    const html = buildCotacaoDoc(malicioso, config());
    expect(html).not.toMatch(/<img src=x/i);
    expect(html).toContain("&lt;IMG");
  });

  describe("documento interno (fatia B)", () => {
    const interno = { ...DADOS, grupoProducao: "Equipe Alfa", padraoCalculo: "PADRÃO AUTOMÓVEL" };

    for (const modelo of ["supper", "cia"] as const) {
      test(`PDF do cliente (modelo ${modelo}) não traz comissão nem controle interno`, () => {
        const html = buildCotacaoDoc(interno, config({ modelo }));
        expect(html).not.toContain("Comissão");
        expect(html).not.toContain("Controle interno");
        expect(html).not.toContain("USO INTERNO");
      });

      test(`interno com pct (modelo ${modelo}) traz comissão, controle interno e faixa`, () => {
        const html = buildCotacaoDoc(interno, config({ modelo }), {
          interno: true,
          pctComissao: 12.5,
        });
        expect(html).toContain("Comissão da corretora");
        expect(html).toContain("12,50%");
        expect(html).toContain("Controle interno · Grupo de produção: Equipe Alfa");
        expect(html).toContain("Padrão de cálculo: PADRÃO AUTOMÓVEL");
        expect(html).toContain("USO INTERNO — NÃO ENVIAR AO CLIENTE");
      });
    }

    test("interno sem pct não ativa; pct sem interno também não", () => {
      for (const opcoes of [
        { interno: true },
        { interno: true, pctComissao: null },
        { interno: false, pctComissao: 12 },
        { pctComissao: 12 },
      ]) {
        const html = buildCotacaoDoc(interno, config(), opcoes);
        expect(html).not.toContain("Comissão");
        expect(html).not.toContain("Controle interno");
        expect(html).not.toContain("USO INTERNO");
      }
    });

    test("controle interno omite o que o app não tem e escapa o que tem", () => {
      const html = buildCotacaoDoc({ ...DADOS, grupoProducao: "<b>x</b>" }, config(), {
        interno: true,
        pctComissao: 10,
      });
      expect(html).toContain("Grupo de produção: &lt;b&gt;x&lt;/b&gt;");
      expect(html).not.toContain("Padrão de cálculo");
      const sem = buildCotacaoDoc(DADOS, config(), { interno: true, pctComissao: 10 });
      expect(sem).not.toContain("Controle interno");
      expect(sem).toContain("Comissão da corretora");
    });
  });

  test("mostra o nº do orçamento na cia por faixa só quando alguma seguradora informa", () => {
    const semNumero = buildCotacaoDoc(DADOS, config());
    expect(semNumero).not.toContain("Nº do orçamento na cia");

    const comNumero: DocDados = {
      ...DADOS,
      seguradoras: DADOS.seguradoras.map((s) =>
        s.id === "card-porto"
          ? { ...s, opcoes: s.opcoes.map((o) => ({ ...o, numeroOrcamentoCia: "1234567890" })) }
          : s,
      ),
    };
    const html = buildCotacaoDoc(comNumero, config());
    expect(html).toContain("Nº do orçamento na cia");
    expect(html).toContain("<td>1234567890</td>");
    expect(html).toContain("<td>—</td>");
  });
});
