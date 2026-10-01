import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

// Recapitulação local do que a tela "Confirmação" do portal Quiver mostra em
// "Informações enviadas" (blocos Dados do veículo, Perfil e Coberturas), só com
// dados nossos. O bloco "Retorno" (protocolo, orçamento, fator de ajuste do
// portal) não existe aqui: só nasce depois do "Efetivar" no portal.

export type LinhaConfirmacao = { rotulo: string; valor: string };
export type BlocoConfirmacao = { titulo: string; linhas: LinhaConfirmacao[] };
export type ConfirmacaoQuiver = {
  titulo: string;
  blocos: BlocoConfirmacao[];
  avisos: string[];
};

export const VAZIO = "—";

export type ExtrasConfirmacao = { fipeValor?: string };

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-10-01` → `01/10/2026`. Qualquer outro formato volta como veio. */
export function formatarDataBr(valor: string | undefined | null): string {
  const v = (valor ?? "").trim();
  if (!v) return VAZIO;
  const m = ISO.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** `Solteiro(a)` → `Solteiro` (o portal confirma sem o "(a)"). */
export function normalizarEstadoCivil(valor: string | undefined | null): string {
  const v = (valor ?? "").trim();
  if (!v) return VAZIO;
  return v.replace(/\(a\)/gi, "").trim();
}

function texto(valor: string | undefined | null): string {
  const v = (valor ?? "").trim();
  return v || VAZIO;
}

function moeda(valor: string | undefined | null): string {
  const v = (valor ?? "").trim();
  if (!v) return VAZIO;
  if (/^\d+(\.\d+)?$/.test(v)) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return v;
}

function utilizacao(f: Form): string {
  const uso = (f.tipoUso ?? "").trim();
  const taxi = (f.categoriaTaxi ?? "").trim();
  const locadora = (f.utilizacaoLocadora ?? "").trim();
  if (uso === "Táxi" && taxi) return taxi;
  if (uso.startsWith("Locadora") && locadora) return locadora;
  return texto(uso);
}

export function montarConfirmacaoQuiver(
  f: Form,
  resultado: Pick<ResultadoCalculo, "seguradora"> & { produto?: string | null },
  dados: DadosComplementaresTransmissao | null,
  extras: ExtrasConfirmacao = {},
): ConfirmacaoQuiver {
  const produto = (resultado.produto ?? "").trim();
  const condutorMesmo = f.condutorMesmo !== "nao";
  const modelo = [f.marca, f.modelo, f.anoModelo].filter(Boolean).join(" ");

  const veiculo: BlocoConfirmacao = {
    titulo: "Dados do veículo",
    linhas: [
      { rotulo: "Modelo", valor: texto(modelo) },
      // O formulário não guarda o código FIPE; fica "—" até capturarmos.
      { rotulo: "Código Fipe", valor: VAZIO },
      { rotulo: "Placa", valor: texto(f.placa) },
      { rotulo: "Chassi", valor: texto(f.chassi) },
      { rotulo: "Valor Fipe", valor: texto(extras.fipeValor) },
    ],
  };

  const perfilLinhas: LinhaConfirmacao[] = [
    { rotulo: "Sexo do segurado", valor: texto(f.sexo) },
    { rotulo: "Estado civil", valor: normalizarEstadoCivil(f.estadoCivil) },
    { rotulo: "Sexo do condutor", valor: texto(condutorMesmo ? f.sexo : f.condSexo) },
    { rotulo: "Garagem na residência", valor: texto(f.tipoGaragem) },
    { rotulo: "Garagem ao ir ao trabalho", valor: texto(f.usoTrabalho) },
    { rotulo: "Garagem ao ir à faculdade/colégio", valor: texto(f.usoEstudo) },
    { rotulo: "Tipo de uso", valor: texto(f.tipoUso) },
    { rotulo: "Utilização do veículo", valor: utilizacao(f) },
  ];
  if ((f.tipoUso ?? "").trim() === "Particular") {
    perfilLinhas.push({
      rotulo: "Uso comercial 2+ dias/semana",
      valor: f.usoComercialDoisDias === "sim" ? "Sim" : "Não",
    });
  }

  const coberturas: BlocoConfirmacao = {
    titulo: "Coberturas",
    linhas: [
      { rotulo: "Danos Materiais", valor: moeda(f.rcfDm) },
      { rotulo: "Danos Corporais", valor: moeda(f.rcfDc) },
      { rotulo: "Danos Morais", valor: moeda(f.danosMorais) },
    ],
  };

  const avisos: string[] = [];
  if (dados && !dados.mesmoEnderecoCorrespondencia) {
    avisos.push(
      "O endereço de correspondência informado não é enviado: o robô usa sempre o endereço residencial.",
    );
  }

  return {
    titulo: produto ? `Confirmação — ${produto}` : "Confirmação",
    blocos: [veiculo, { titulo: "Perfil", linhas: perfilLinhas }, coberturas],
    avisos,
  };
}
