// jspdf/jspdf-autotable são pesados (~124KB gzip) — importados sob demanda
// (dynamic import dentro de exportPdf) pra não inflar o chunk da tela de quem
// só usa CSV.
export type ColunaRelatorio = { header: string; key: string };
export type LinhaRelatorio = Record<string, string | number>;

function slug(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta um CSV (separador ';', aspas, BOM) — mesmo padrão usado em
 * comissoes.tsx / estornos.tsx / renovacoes.tsx. */
export function exportCsv(nome: string, colunas: ColunaRelatorio[], linhas: LinhaRelatorio[]) {
  const headers = colunas.map((c) => c.header);
  const lines = [headers.join(";")];
  for (const linha of linhas) {
    lines.push(
      colunas
        .map((c) => String(linha[c.key] ?? "").replace(/"/g, '""'))
        .map((v) => `"${v}"`)
        .join(";"),
    );
  }
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  download(blob, `${slug(nome)}.csv`);
}

export type ExportPdfOpts = {
  /** Rótulo do período/recorte aplicado, exibido no cabeçalho. */
  periodo?: string;
  /** Linhas extras de resumo (ex.: totais/KPIs) exibidas acima da tabela. */
  resumo?: string[];
};

/** Exporta um PDF (jsPDF + autoTable) com cabeçalho (título + período),
 * tabela e rodapé com a data de geração. Gera arquivo mesmo com 0 linhas. */
export async function exportPdf(
  titulo: string,
  colunas: ColunaRelatorio[],
  linhas: LinhaRelatorio[],
  opts: ExportPdfOpts = {},
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(titulo, 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("CoteCerto", 14, 22);
  if (opts.periodo) {
    doc.text(`Recorte: ${opts.periodo}`, 14, 27);
  }

  let startY = opts.periodo ? 33 : 28;
  if (opts.resumo?.length) {
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    for (const linha of opts.resumo) {
      doc.text(linha, 14, startY);
      startY += 5;
    }
    startY += 2;
  }

  autoTable(doc, {
    startY,
    head: [colunas.map((c) => c.header)],
    body: linhas.length
      ? linhas.map((linha) => colunas.map((c) => String(linha[c.key] ?? "—")))
      : [colunas.map(() => "—")],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Gerado em ${geradoEm} — página ${doc.getCurrentPageInfo().pageNumber}/${pageCount}`,
        14,
        doc.internal.pageSize.getHeight() - 8,
      );
    },
  });

  if (linhas.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("Nenhum registro no recorte selecionado.", 14, startY + 12);
  }

  doc.save(`${slug(titulo)}.pdf`);
}
