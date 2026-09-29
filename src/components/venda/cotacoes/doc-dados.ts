// Adaptadores que convertem os formatos de dados de cotação que o app tem
// hoje (o `Form` do wizard novo-lead, o retorno bruto do Quiver, as linhas de
// "Em negociação" e as de "Em finalização") no `DocDados`/`DocSeguradoraOferta`
// normalizados que `buildCotacaoDoc` (src/lib/print.ts) consome — usado pelos
// pontos de entrada do modal "Imprimir cotação" (Frente 3 V12 · 7a).
import { fmtBRL, type DocDados, type DocSeguradoraOferta } from "@/lib/print";
import type { ResultadoCalculo } from "./quiver-resultado";
import type { Form } from "@/components/venda/novo-lead/types";

/** Um `ResultadoCalculo` do Quiver (card por seguradora) → oferta do doc. */
export function ofertaDoResultado(r: ResultadoCalculo): DocSeguradoraOferta {
  return {
    id: r.cardId,
    seguradora: r.seguradora,
    planoNome: r.produto ? `${r.produto} · ${r.nome || ""}`.trim() : r.nome || null,
    precoLabel: r.opcoes[0]?.avista ?? null,
    coberturasBasicas: r.coberturasBasicas,
    coberturasAdicionais: r.coberturasAdicionais,
    opcoes: r.opcoes.map((o) => ({
      tipo: o.tipo,
      franquia: o.franquia,
      avista: o.avista,
      parcelasOpcoes: o.parcelasOpcoes,
    })),
  };
}

/** `Form` do wizard novo-lead (StepCalculo) — é o mais completo dos 3, tem
 * segurado/veículo/perfil inteiros porque é o próprio formulário. */
export function docDadosDoForm(
  f: Form,
  resultadosOrdenados: ResultadoCalculo[],
  cotacaoNumero: string,
  cotacaoId?: string | null,
): DocDados {
  return {
    cotacaoNumero,
    cotacaoId: cotacaoId ?? undefined,
    segurado: {
      nome: f.nome,
      cpfCnpj: f.cpf,
      nascimento: f.nasc,
      sexo: f.sexo,
      estadoCivil: f.estadoCivil,
      telefone: f.celular,
      email: f.email,
    },
    seguro: { tipo: f.tipoSeguro, vigIni: f.vigIni, vigFim: f.vigFim },
    veiculo: {
      descricao: `${f.marca || ""} ${f.modelo || ""}`.trim() || null,
      anoFab: f.anoFab,
      anoModelo: f.anoModelo,
      combustivel: f.combustivel,
      zeroKm: f.zeroKm,
      placa: f.placa,
      chassi: f.chassi,
      cepPernoite: f.cepPernoite,
      tipoUso: f.tipoUso,
    },
    perfil: {
      condutorMesmo: f.condutorMesmo ? f.condutorMesmo === "sim" : null,
      jovens1825: f.jovens1825 ? f.jovens1825 === "sim" : null,
    },
    seguradoras: resultadosOrdenados.map(ofertaDoResultado),
  };
}

/** Dados de segurado/veículo já vindos do banco (`cotacao_segurado` /
 * `cotacao_veiculo` / `cotacao_seguro` / `cotacao_perfil`) — usado pelo
 * comparativo (`/venda/cotacoes/$id`) e por "Em negociação". Todos os campos
 * são opcionais porque cada tela hoje seleciona um subconjunto diferente. */
export type DocDadosCabecalho = {
  cotacaoNumero: string;
  /** `cotacoes.id` — habilita "Imprimir comissão" e o registro da impressão. */
  cotacaoId?: string;
  segurado?: {
    nome?: string | null;
    cpf_cnpj?: string | null;
    nascimento?: string | null;
    sexo?: string | null;
    estado_civil?: string | null;
  } | null;
  veiculo?: {
    marca_nome?: string | null;
    modelo_nome?: string | null;
    ano_modelo?: string | null;
    ano_fab?: string | null;
    placa?: string | null;
    chassi?: string | null;
    combustivel?: string | null;
  } | null;
  seguro?: {
    tipo_seguro?: string | null;
    vig_ini?: string | null;
    vig_fim?: string | null;
    grupo_producao?: string | null;
  } | null;
  perfil?: {
    condutor_mesmo?: boolean | null;
    jovens_18_25?: boolean | null;
    cep_pernoite?: string | null;
  } | null;
};

export function docDadosDoBanco(
  cabecalho: DocDadosCabecalho,
  resultadosOrdenados: ResultadoCalculo[],
): DocDados {
  const veic = cabecalho.veiculo;
  return {
    cotacaoNumero: cabecalho.cotacaoNumero,
    cotacaoId: cabecalho.cotacaoId,
    grupoProducao: cabecalho.seguro?.grupo_producao ?? null,
    segurado: {
      nome: cabecalho.segurado?.nome ?? null,
      cpfCnpj: cabecalho.segurado?.cpf_cnpj ?? null,
      nascimento: cabecalho.segurado?.nascimento ?? null,
      sexo: cabecalho.segurado?.sexo ?? null,
      estadoCivil: cabecalho.segurado?.estado_civil ?? null,
    },
    seguro: cabecalho.seguro
      ? {
          tipo: cabecalho.seguro.tipo_seguro,
          vigIni: cabecalho.seguro.vig_ini,
          vigFim: cabecalho.seguro.vig_fim,
        }
      : undefined,
    veiculo: veic
      ? {
          descricao: `${veic.marca_nome || ""} ${veic.modelo_nome || ""}`.trim() || null,
          anoFab: veic.ano_fab,
          anoModelo: veic.ano_modelo,
          combustivel: veic.combustivel,
          placa: veic.placa,
          chassi: veic.chassi,
          cepPernoite: cabecalho.perfil?.cep_pernoite,
        }
      : undefined,
    perfil: cabecalho.perfil
      ? {
          condutorMesmo: cabecalho.perfil.condutor_mesmo,
          jovens1825: cabecalho.perfil.jovens_18_25,
        }
      : undefined,
    seguradoras: resultadosOrdenados.map(ofertaDoResultado),
  };
}

/** "Em negociação" só tem `premios` (seguradora + prêmio, sem card/opções do
 * Quiver) — sem `quiver_resultado_raw` não há coberturas/parcelas por
 * seguradora, então o documento sai só com a lista de prêmios. `parcelasNum`/
 * `valorParcela` (opcionais — ajustes pós-deploy V12, item 2) refletem, só
 * quando a oferta é parcelada, o mesmo detalhamento mostrado em Em
 * finalização/Emissão; sem eles, mostra só o total (à vista). */
export function docDadosDosPremios(
  cabecalho: DocDadosCabecalho,
  premios: {
    seguradora: string;
    premio: number;
    parcelasNum?: number | null;
    valorParcela?: number | null;
  }[],
): DocDados {
  const base = docDadosDoBanco(cabecalho, []);
  return {
    ...base,
    seguradoras: premios.map((p, index) => {
      const parcelado = p.parcelasNum && p.valorParcela != null;
      return {
        id: `premio-${index}-${p.seguradora}`,
        seguradora: p.seguradora,
        precoLabel: fmtBRL(p.premio),
        opcoes: [
          {
            tipo: "Prêmio calculado",
            avista: parcelado ? undefined : fmtBRL(p.premio),
            parcelasOpcoes: parcelado
              ? [`${p.parcelasNum}x sem juros de ${fmtBRL(p.valorParcela as number)}`]
              : undefined,
          },
        ],
      };
    }),
  };
}

/** Linha de "Em finalização" (`/venda/em-finalizacao`) — só tem a seguradora
 * e o prêmio da tentativa de transmissão em si (sem `quiver_resultado_raw`,
 * essa lista não guarda o comparativo inteiro). Mesmo adaptador de "Em
 * negociação" (`docDadosDosPremios`): sem seguradora/prêmio, o documento sai
 * só com o cabeçalho, sem inventar oferta nenhuma. */
export function docDadosDaTransmissao(
  cabecalho: DocDadosCabecalho,
  oferta: {
    seguradora: string | null;
    premio: number | null;
    parcelasNum?: number | null;
    valorParcela?: number | null;
  },
): DocDados {
  if (!oferta.seguradora || oferta.premio == null) return docDadosDoBanco(cabecalho, []);
  return docDadosDosPremios(cabecalho, [
    {
      seguradora: oferta.seguradora,
      premio: oferta.premio,
      parcelasNum: oferta.parcelasNum,
      valorParcela: oferta.valorParcela,
    },
  ]);
}
