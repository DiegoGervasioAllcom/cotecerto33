/**
 * PDF do Convite Supper (V11 · C6) — "arte oficial com logo, link clicável".
 *
 * Reproduz o card de `cvArteHTML` do protótipo r40 com primitivas do jsPDF, em
 * vez de rasterizar o HTML. O motivo é o critério de aceite: html2canvas viraria
 * uma imagem e **mataria o link clicável**, que é justamente o que o convite
 * precisa entregar. Aqui o link sai como `textWithLink`, navegável no leitor.
 *
 * O protótipo abre uma janela e chama `print()`, deixando o "salvar como PDF" na
 * mão do usuário. Aqui o download é direto — o Handoff pede "Baixar em PDF", e
 * pop-up bloqueado quebraria o fluxo.
 *
 * jsPDF é pesado (~124 KB gzip), então entra por import dinâmico, no mesmo padrão
 * de `export-relatorio.ts`.
 */

export type ConvitePdfDados = {
  /** Nome de quem está sendo convidado. */
  nome: string;
  /** Tipo declarado, no formato "TÍTULO | qualificador". */
  perfil: string;
  /** Quem convidou. */
  quem: string;
  /** Cargo de quem convidou. */
  cargo: string;
  /** URL do convite. */
  link: string;
  /** Código humano SC-XXXXXX. */
  codigo: string;
};

/** Paleta do protótipo (as mesmas variáveis do proto.css). */
const SLATE: [number, number, number] = [66, 85, 99];
const SLATE_DARK: [number, number, number] = [47, 61, 72];
const YELLOW: [number, number, number] = [255, 182, 0];
const CREAM: [number, number, number] = [255, 246, 224];
const INK: [number, number, number] = [38, 49, 58];
const MUTED: [number, number, number] = [124, 138, 149];
const LINHA_SUAVE: [number, number, number] = [226, 230, 233];
const CINZA_PASSOS: [number, number, number] = [247, 248, 248];

/** Carrega o logo como data URL, para embutir no PDF. */
async function logoDataUrl(): Promise<string | null> {
  try {
    const { default: url } = await import("@/assets/cotecerto-logo.png");
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    // Sem logo o convite continua válido — melhor gerar sem a arte completa do
    // que não gerar.
    return null;
  }
}

export async function baixarConvitePdf(d: ConvitePdfDados): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), logoDataUrl()]);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const larguraPagina = doc.internal.pageSize.getWidth();

  // Card centralizado, espelhando o `.card` de 640px do protótipo.
  const cardW = 460;
  const x = (larguraPagina - cardW) / 2;
  let y = 56;

  // ---- Cabeçalho slate com logo e "CONVITE SUPPER" ----
  const cabecalhoH = 62;
  doc.setFillColor(...SLATE);
  doc.rect(x, y, cardW, cabecalhoH, "F");

  if (logo) {
    try {
      // Proporção do logo do app; altura fixa e largura derivada.
      doc.addImage(logo, "PNG", x + 22, y + 16, 96, 30);
    } catch {
      /* logo inválido não impede o convite */
    }
  }

  // "CONVITE SUPPER" numa linha só, com SUPPER em amarelo — como no protótipo.
  // Desenha da direita para a esquerda: primeiro SUPPER encostado na margem,
  // depois CONVITE recuado pela largura dele.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const baseline = y + cabecalhoH / 2 + 4;
  const direita = x + cardW - 22;
  const larguraSupper = doc.getTextWidth("SUPPER");
  doc.setTextColor(...YELLOW);
  doc.text("SUPPER", direita, baseline, { align: "right" });
  doc.setTextColor(255, 255, 255);
  doc.text("CONVITE", direita - larguraSupper - 5, baseline, { align: "right" });

  y += cabecalhoH;

  // ---- Corpo branco ----
  const corpoTop = y;
  const padding = 26;
  let cursor = y + 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);

  const saudacao = `Olá, ${d.nome}! Aqui é ${d.quem}, ${d.cargo} da Supper Certo.`;
  const linhasSaudacao = doc.splitTextToSize(saudacao, cardW - padding * 2);
  doc.text(linhasSaudacao, x + padding, cursor);
  cursor += linhasSaudacao.length * 14 + 8;

  doc.text("Quero te convidar para se cadastrar na nossa plataforma como", x + padding, cursor);
  cursor += 22;

  // Pílula amarela com o tipo declarado.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const perfilW = doc.getTextWidth(d.perfil) + 28;
  doc.setFillColor(...YELLOW);
  doc.roundedRect(x + padding, cursor - 12, perfilW, 22, 11, 11, "F");
  doc.setTextColor(...SLATE_DARK);
  doc.text(d.perfil, x + padding + 14, cursor + 3);
  cursor += 34;

  // ---- Bloco "Como funciona" ----
  const passos = [
    "1. Toque no link — o cadastro abre já identificado com o seu convite.",
    "2. Confira seus dados e confirme o vínculo (ele já vem preenchido).",
    "3. Envie — seu pedido entra na fila de aprovação e a confirmação chega no seu e-mail.",
  ];
  const passosLinhas = passos.flatMap((p) => doc.splitTextToSize(p, cardW - padding * 2 - 22));
  const passosH = 26 + passosLinhas.length * 13;
  doc.setFillColor(...CINZA_PASSOS);
  doc.rect(x + padding, cursor - 6, cardW - padding * 2, passosH, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(x + padding, cursor - 6, 3, passosH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text("COMO FUNCIONA", x + padding + 14, cursor + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(passosLinhas, x + padding + 14, cursor + 24);
  cursor += passosH + 14;

  // ---- Link, em caixa creme e CLICÁVEL ----
  const linkLinhas = doc.splitTextToSize(d.link, cardW - padding * 2 - 24);
  const linkH = 16 + linkLinhas.length * 12;
  doc.setFillColor(...CREAM);
  doc.roundedRect(x + padding, cursor - 6, cardW - padding * 2, linkH, 6, 6, "F");

  doc.setFont("courier", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(138, 100, 0);
  linkLinhas.forEach((linha: string, i: number) => {
    // textWithLink é o que mantém o link navegável no PDF — o critério de aceite.
    doc.textWithLink(linha, x + padding + 12, cursor + 8 + i * 12, { url: d.link });
  });
  cursor += linkH + 16;

  // ---- Aviso de nominal / uso único ----
  doc.setDrawColor(...LINHA_SUAVE);
  doc.line(x + padding, cursor - 6, x + cardW - padding, cursor - 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const aviso = doc.splitTextToSize(
    `Este convite é nominal e de uso único (${d.codigo}) — vale só para você, por 7 dias. ` +
      "Se expirar, é só pedir um novo a quem te enviou.",
    cardW - padding * 2,
  );
  doc.text(aviso, x + padding, cursor + 8);
  cursor += aviso.length * 11 + 20;

  // ---- Moldura do corpo e rodapé ----
  doc.setDrawColor(...LINHA_SUAVE);
  doc.rect(x, corpoTop, cardW, cursor - corpoTop, "S");

  const rodapeH = 24;
  doc.setFillColor(...SLATE_DARK);
  doc.rect(x, cursor, cardW, rodapeH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(199, 208, 214);
  doc.text("SUPPER CERTO · PLATAFORMA COTE CERTO", x + cardW / 2, cursor + 15, {
    align: "center",
  });

  // Nome do arquivo com o código, para quem gera vários não se perder.
  const slug = d.nome
    .normalize("NFD")
    // Marcas combinantes por escape explícito — o range literal é invisível no
    // editor e fácil de corromper numa edição futura.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`convite-supper-${slug || "convidado"}-${d.codigo}.pdf`);
}
