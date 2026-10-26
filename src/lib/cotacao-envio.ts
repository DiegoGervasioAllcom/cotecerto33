// Envio/geração do documento da cotação — compartilhado entre o modal de
// impressão do desktop e o mini-app mobile. Funções sem JSX; as únicas com
// efeito colateral são `gerarPdfCotacao` (registra a trilha + abre o print).
import { registrarImpressao } from "@/components/venda/cotacoes/comissao-impressao";
import {
  buildCotacaoDoc,
  printCotacaoDoc,
  type DocConfigImpressao,
  type DocDados,
  type DocOpcoesInterno,
} from "@/lib/print";
import type { ImprimirCotacaoConfig } from "@/lib/schemas/imprimirCotacao.schema";

export type MensagemEnvio = { tipo: "erro" | "aviso"; texto: string };

/** Subconjunto de `ImprimirCotacaoConfig` que o gerador de HTML consome. */
export function configParaDoc(config: ImprimirCotacaoConfig): DocConfigImpressao {
  return {
    modelo: config.modelo,
    tipo: config.tipo,
    seguradorasSelecionadas: config.seguradorasSelecionadas,
    parcelas: config.parcelas,
    economia: config.economia,
    colunado: config.colunado,
  };
}

/** HTML do documento comparativo (mesmo que o preview do modal). */
export function montarDocHtml(
  dados: DocDados,
  config: ImprimirCotacaoConfig,
  opcoes?: DocOpcoesInterno,
): string {
  return buildCotacaoDoc(dados, configParaDoc(config), opcoes);
}

/** Título da janela de impressão / nome sugerido do PDF. */
export function tituloDocCotacao(dados: DocDados): string {
  return `Cotação · ${dados.cotacaoNumero}`;
}

/** Texto padrão da mensagem de WhatsApp (sem dados internos/comissão). */
export function montarMensagemWhatsapp(dados: DocDados, linkDoc?: string): string {
  const nome = dados.segurado.nome?.trim();
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const partes = [
    `${saudacao} Segue sua cotação de seguro ${dados.cotacaoNumero}.`,
    linkDoc ? `Acesse: ${linkDoc}` : null,
  ];
  return partes.filter(Boolean).join("\n");
}

/** Só dígitos; assume Brasil (55) quando vier sem DDI. Null se inválido. */
export function normalizarTelefoneWhatsapp(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/** Link `wa.me`; sem telefone válido abre o seletor de contato do WhatsApp. */
export function linkWhatsapp(tel: string | null | undefined, mensagem: string): string {
  const num = normalizarTelefoneWhatsapp(tel);
  const texto = encodeURIComponent(mensagem);
  return num ? `https://wa.me/${num}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

/**
 * "Baixar PDF": registra a impressão e abre o documento. Com comissão é
 * fail-closed — sem trilha gravada o documento não sai (retorna erro).
 */
export async function gerarPdfCotacao(params: {
  dados: DocDados;
  config: ImprimirCotacaoConfig;
  doc: string;
  comComissao: boolean;
}): Promise<MensagemEnvio | null> {
  const { dados, config, doc, comComissao } = params;
  let aviso: MensagemEnvio | null = null;
  try {
    await registrarImpressao(dados, { ...config, comComissao }, "baixar");
  } catch (e) {
    if (comComissao) {
      return {
        tipo: "erro",
        texto: `Não foi possível registrar a impressão (${
          e instanceof Error ? e.message : "erro"
        }). O documento com comissão não foi gerado.`,
      };
    }
    aviso = { tipo: "aviso", texto: "Aviso: não foi possível registrar esta impressão." };
  }
  printCotacaoDoc(tituloDocCotacao(dados), doc);
  return aviso;
}

/**
 * Mensagem de WhatsApp com o resumo dos prêmios (sem link de documento — o PDF
 * hoje é só impressão HTML). Nunca inclui comissão: usa só `precoLabel` das ofertas.
 */
export function montarMensagemWhatsappComResumo(dados: DocDados): string {
  const base = montarMensagemWhatsapp(dados);
  const linhas = dados.seguradoras
    .filter((s) => s.precoLabel)
    .map((s) => `• ${s.seguradora}: ${s.precoLabel}`);
  if (linhas.length === 0) return base;
  return `${base}\n\nPrêmios (à vista):\n${linhas.join("\n")}`;
}
