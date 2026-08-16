import { describe, it, expect } from "vitest";
import { parseDecodificadorXml, normalizarCombustivel } from "../../src/lib/placa-decodificador";

// Resposta real da API para a placa FTP4J82 (capturada em 15/08/2026),
// incluindo o padding à direita em DsModelo e as duas versões FIPE.
const XML_SUCESSO = `<Root>
  <placa>FTP4982</placa>
  <chassi>9BGJC69Z0FB105973</chassi>
  <Decodificador>
    <DsCategoria>AUTOMOVEL</DsCategoria>
    <DsPlaca>FTP4J82</DsPlaca>
    <DsChassi>9BGJC69Z0FB105973</DsChassi>
    <DsChassiTratado>9BGJC69Z0FB105973</DsChassiTratado>
    <DsLocalFabricacao>SAO CAETANO DO SUL / SP</DsLocalFabricacao>
    <DsMarca>CHEVROLET</DsMarca>
    <DsModelo>COBALT 1.8 LTZ      </DsModelo>
    <DsMotor>1.8</DsMotor>
    <DsOrigem>NACIONAL</DsOrigem>
    <DsPais>BRASIL</DsPais>
    <DsRegiao>BRASIL / PARAGUAI / COLOMBIA / URUGUAI</DsRegiao>
    <DsRetorno>Marca/Modelo/Ano Identificados</DsRetorno>
    <DsTipoCarroceria>SEDAN</DsTipoCarroceria>
    <DsVersao>1.8 LTZ</DsVersao>
    <NuAnoModelo>2015</NuAnoModelo>
    <NuAnoFabricacao>2014</NuAnoFabricacao>
    <NuCdCategoria>2</NuCdCategoria>
    <NuCdRetorno>0</NuCdRetorno>
    <NuCdTipoCarroceria>3</NuCdTipoCarroceria>
    <PrecificadorI>
      <DsCodigo>004420-2</DsCodigo>
      <DsCombustivel>Gasolina</DsCombustivel>
      <DsMarca>GM - Chevrolet</DsMarca>
      <DsModelo>COBALT LTZ 1.8 8V Econo.Flex 4p Mec.</DsModelo>
      <NuValor>43399</NuValor>
    </PrecificadorI>
    <PrecificadorI>
      <DsCodigo>004421-0</DsCodigo>
      <DsCombustivel>Gasolina</DsCombustivel>
      <DsMarca>GM - Chevrolet</DsMarca>
      <DsModelo>COBALT LTZ 1.8 8V Econo.Flex 4p Aut.</DsModelo>
      <NuValor>45917</NuValor>
    </PrecificadorI>
  </Decodificador>
</Root>`;

// Resposta real para placa inexistente.
const XML_ERRO = `<NewDataSet>
  <Retorno>
    <Existe_erro>1</Existe_erro>
    <Codigo>3</Codigo>
    <Mensagem>Consulta Indisponivel (C)</Mensagem>
    <Parametro />
  </Retorno>
</NewDataSet>`;

describe("parseDecodificadorXml", () => {
  it("decodifica a resposta de sucesso", () => {
    const r = parseDecodificadorXml(XML_SUCESSO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // DsPlaca preserva o Mercosul; a <placa> da raiz vem convertida.
    expect(r.dados.placa).toBe("FTP4J82");
    expect(r.dados.chassi).toBe("9BGJC69Z0FB105973");
    expect(r.dados.marca).toBe("CHEVROLET");
    // Padding à direita do XML precisa sair.
    expect(r.dados.modelo).toBe("COBALT 1.8 LTZ");
    expect(r.dados.versao).toBe("1.8 LTZ");
    expect(r.dados.anoModelo).toBe("2015");
    expect(r.dados.anoFabricacao).toBe("2014");
    expect(r.dados.categoria).toBe("AUTOMOVEL");
    expect(r.dados.tipoCarroceria).toBe("SEDAN");
    expect(r.dados.codigoRetorno).toBe("0");
  });

  it("lê todas as versões FIPE, com código e valor numérico", () => {
    const r = parseDecodificadorXml(XML_SUCESSO);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.dados.fipe).toHaveLength(2);
    expect(r.dados.fipe[0]).toEqual({
      codigo: "004420-2",
      combustivel: "Gasolina",
      marca: "GM - Chevrolet",
      modelo: "COBALT LTZ 1.8 8V Econo.Flex 4p Mec.",
      valor: 43399,
    });
    expect(r.dados.fipe[1].codigo).toBe("004421-0");
    expect(r.dados.fipe[1].valor).toBe(45917);
  });

  it("devolve a mensagem do fornecedor no formato de erro", () => {
    const r = parseDecodificadorXml(XML_ERRO);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("3");
    expect(r.mensagem).toBe("Consulta Indisponivel (C)");
  });

  it("trata NuCdRetorno diferente de 0 como veículo não identificado", () => {
    const xml = XML_SUCESSO.replace(
      "<NuCdRetorno>0</NuCdRetorno>",
      "<NuCdRetorno>9</NuCdRetorno>",
    ).replace("Marca/Modelo/Ano Identificados", "Veiculo nao localizado");
    const r = parseDecodificadorXml(xml);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("9");
    expect(r.mensagem).toBe("Veiculo nao localizado");
  });

  it("não lança com entrada vazia ou lixo", () => {
    for (const entrada of ["", "   ", "<html>502 Bad Gateway</html>", "{}"]) {
      const r = parseDecodificadorXml(entrada);
      expect(r.ok).toBe(false);
    }
  });

  it("decodifica entidades XML no texto", () => {
    const xml = XML_SUCESSO.replace("GM - Chevrolet", "GM &amp; Chevrolet");
    const r = parseDecodificadorXml(xml);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.dados.fipe[0].marca).toBe("GM & Chevrolet");
  });

  it("aceita valor FIPE no formato pt-BR com centavos", () => {
    const xml = XML_SUCESSO.replace("<NuValor>43399</NuValor>", "<NuValor>45.917,50</NuValor>");
    const r = parseDecodificadorXml(xml);
    if (!r.ok) throw new Error("esperava sucesso");
    expect(r.dados.fipe[0].valor).toBe(45917.5);
  });

  it("sobrevive a uma resposta sem bloco PrecificadorI", () => {
    const xml = XML_SUCESSO.replace(/<PrecificadorI>[\s\S]*?<\/PrecificadorI>/g, "");
    const r = parseDecodificadorXml(xml);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.fipe).toEqual([]);
    expect(r.dados.marca).toBe("CHEVROLET");
  });
});

describe("normalizarCombustivel", () => {
  it("mapeia para as opções do formulário", () => {
    expect(normalizarCombustivel("COBALT LTZ 1.8 8V Econo.Flex 4p Mec.")).toBe("Flex");
    expect(normalizarCombustivel("Gasolina")).toBe("Gasolina");
    expect(normalizarCombustivel("S10 2.8 Diesel 4x4")).toBe("Diesel");
    expect(normalizarCombustivel("Álcool")).toBe("Álcool");
    expect(normalizarCombustivel("Elétrico")).toBe("Elétrico");
    expect(normalizarCombustivel("Híbrido")).toBe("Elétrico");
  });

  it("devolve vazio quando não reconhece", () => {
    expect(normalizarCombustivel("")).toBe("");
    expect(normalizarCombustivel(null)).toBe("");
    expect(normalizarCombustivel("GOL 1.0")).toBe("");
  });
});
