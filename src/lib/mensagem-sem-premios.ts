// Módulo compartilhado: traduz o motivo que o robô devolve quando a cotação volta sem cards (`cotacoes.quiver_mensagem`)
// numa frase que o vendedor entende e sabe o que fazer. O texto original do robô fica em `detalhe` (para o suporte).
export type MensagemSemPremios = { resumo: string; detalhe?: string };

const LIMITE = 300;
const PADRAO = "A seguradora não retornou preço para esta cotação.";
const PREFIXO_ALERTA = /^alerta do portal:\s*/i;

export function explicarSemPremios(bruta: string | null | undefined): MensagemSemPremios {
  const texto = (bruta ?? "").trim().slice(0, LIMITE);
  if (!texto) return { resumo: `${PADRAO} Tente outra seguradora ou revise os dados do veículo.` };

  if (PREFIXO_ALERTA.test(texto)) {
    const alerta = texto.replace(PREFIXO_ALERTA, "").trim();
    if (/comiss/i.test(alerta)) {
      return {
        resumo:
          "O cálculo foi bloqueado por um ajuste de comissão pendente no cadastro da seguradora. Acione o suporte para liberar.",
        detalhe: alerta,
      };
    }
    return {
      resumo:
        "O portal bloqueou o cálculo com um aviso. Acione o suporte informando o detalhe abaixo.",
      detalhe: alerta,
    };
  }

  if (/^nenhum card de prêmio foi renderizado/i.test(texto)) {
    return {
      resumo: `${PADRAO} Isso costuma acontecer quando o perfil ou o veículo não é aceito por ela. Tente outra seguradora ou revise os dados do veículo.`,
    };
  }

  if (/^placa não encontrada/i.test(texto)) {
    return {
      resumo: "Placa não encontrada no portal. Confira a placa ou preencha o veículo manualmente.",
    };
  }

  return { resumo: texto };
}

/** Versão em uma linha para telas que mostram só texto: resumo + detalhe técnico entre parênteses, se houver. */
export function textoSemPremios(bruta: string | null | undefined): string {
  const { resumo, detalhe } = explicarSemPremios(bruta);
  return detalhe ? `${resumo} (Detalhe: ${detalhe})` : resumo;
}
