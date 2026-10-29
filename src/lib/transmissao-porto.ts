// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Campos da transmissão que só a Porto (ou duas tabelas de franquia no modal
// de pagamento do portal) exigem. Espelha o contrato do robô em
// `POST /transmissao` (`franquia`, `rendaMensal`, `ramoAtividade`,
// `pessoaPoliticamenteExposta`).
import { PEP_PORTO, RENDAS_MENSAIS_PORTO } from "@/components/venda/novo-lead/enumsPorto";
import { RAMOS_ATIVIDADE_PORTO } from "@/components/venda/novo-lead/enumsRamoAtividade";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { erroTelefoneFixo, telefoneFixoPayload, type TelefoneFixo } from "@/lib/telefone-fixo";

export type DeclaracoesPorto = {
  rendaMensal?: string;
  ramoAtividade?: string;
  pessoaPoliticamenteExposta?: string;
  // Telefones FIXOS (opcionais): a Porto recusa o celular que o portal copia para estes campos.
  dddTelefoneResidencial?: string;
  telefoneResidencial?: string;
  dddTelefoneComercial?: string;
  telefoneComercial?: string;
};

export type CamposPortoPayload = Pick<
  DeclaracoesPorto,
  "rendaMensal" | "ramoAtividade" | "pessoaPoliticamenteExposta"
> & {
  franquia?: string;
  telefoneResidencial?: TelefoneFixo;
  telefoneComercial?: TelefoneFixo;
};

/**
 * Grupo Porto: a Azul Seguros usa a MESMA Efetivação da Porto no Quiver — mesmas formas de pagamento, mesmos campos e
 * ids (renda, PEP, ramo, logradouro, débito, cartão, pagador), conferido ao vivo em 29/10/2026 na cotação 160556.
 * Os produtos do Itaú já chegam como seguradora "Porto". Por isso estas regras valem para as duas.
 */
const GRUPO_PORTO = new Set(["porto", "azul"]);

/**
 * Seguradoras cujo passo "Pagamento" (débito em conta e cartão de crédito) usa as MESMAS formas e campos da Porto:
 * o grupo Porto e a Allianz (formas "Débito em Conta" / "Cartão de Crédito", mesmos ids de agência, conta, número e
 * validade — conferido ao vivo em 29/10/2026). A lista de bancos e as bandeiras mudam por seguradora.
 */
export function ehSeguradoraComPagamentoPorto(seguradora: string): boolean {
  return ehSeguradoraPorto(seguradora) || nomeCanonicoSeguradora(seguradora) === "allianz";
}

export function ehSeguradoraPorto(seguradora: string): boolean {
  return GRUPO_PORTO.has(nomeCanonicoSeguradora(seguradora));
}

/**
 * Regra de bloqueio (servidor): na Porto, renda, ramo e PEP são declarações
 * do cliente — o robô NUNCA as assume — e precisam ser exatamente uma opção
 * do portal. Devolve a mensagem de erro, ou `null` se estiver tudo certo (ou
 * se a seguradora não for a Porto).
 */
export function erroDeclaracoesPorto(
  seguradora: string,
  declaracoes: DeclaracoesPorto | undefined,
): string | null {
  if (!ehSeguradoraPorto(seguradora)) return null;
  const d = declaracoes ?? {};
  if (!d.rendaMensal || !(RENDAS_MENSAIS_PORTO as readonly string[]).includes(d.rendaMensal)) {
    return "Informe a renda mensal do segurado (exigida pela Porto).";
  }
  if (
    !d.pessoaPoliticamenteExposta ||
    !(PEP_PORTO as readonly string[]).includes(d.pessoaPoliticamenteExposta)
  ) {
    return "Informe se o segurado é pessoa politicamente exposta (exigido pela Porto).";
  }
  if (!d.ramoAtividade || !RAMOS_ATIVIDADE_PORTO.includes(d.ramoAtividade)) {
    return "Escolha o ramo de atividade na lista (exigido pela Porto).";
  }
  return (
    erroTelefoneFixo(d.dddTelefoneResidencial, d.telefoneResidencial, "residencial") ??
    erroTelefoneFixo(d.dddTelefoneComercial, d.telefoneComercial, "comercial")
  );
}

/**
 * Campos extras do payload de transmissão.
 *
 * - `franquia`: vem da opção que o vendedor escolheu (`opcao.tipo`, ex.:
 *   "normal 100%"). O robô só a consulta quando o modal de pagamento do
 *   portal traz uma tabela por franquia (Porto); nas demais seguradoras é
 *   ignorada. Sem ela, nesse caso, a transmissão falha pedindo a escolha.
 * - declarações (renda/ramo/PEP): só para a Porto — dado pessoal que não
 *   precisa sair para as outras seguradoras.
 */
export function camposPortoPayload(
  seguradora: string,
  opcao: { tipo?: string } | undefined,
  declaracoes: DeclaracoesPorto | undefined,
): CamposPortoPayload {
  const campos: CamposPortoPayload = {};
  const franquia = opcao?.tipo?.trim();
  if (franquia) campos.franquia = franquia;
  if (ehSeguradoraPorto(seguradora) && declaracoes) {
    if (declaracoes.rendaMensal) campos.rendaMensal = declaracoes.rendaMensal;
    if (declaracoes.ramoAtividade) campos.ramoAtividade = declaracoes.ramoAtividade;
    if (declaracoes.pessoaPoliticamenteExposta) {
      campos.pessoaPoliticamenteExposta = declaracoes.pessoaPoliticamenteExposta;
    }
    const residencial = telefoneFixoPayload(
      declaracoes.dddTelefoneResidencial,
      declaracoes.telefoneResidencial,
    );
    if (residencial) campos.telefoneResidencial = residencial;
    const comercial = telefoneFixoPayload(
      declaracoes.dddTelefoneComercial,
      declaracoes.telefoneComercial,
    );
    if (comercial) campos.telefoneComercial = comercial;
  }
  return campos;
}
