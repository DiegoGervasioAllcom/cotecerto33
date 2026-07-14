// Open a popup window with printable HTML and trigger print.
// Used to produce real printable layouts instead of capturing the on-screen UI.

const BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:24px;font-size:12px;line-height:1.45}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:18px 0 8px;color:#334155;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .sub{color:#64748b;font-size:11px;margin-bottom:14px}
  .brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #facc15;padding-bottom:10px;margin-bottom:14px}
  .brand .logo{font-weight:800;color:#0f172a;font-size:16px;letter-spacing:.5px}
  .brand .meta{font-size:11px;color:#64748b;text-align:right}
  table{width:100%;border-collapse:collapse;margin:6px 0 12px}
  th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#475569}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:6px 0 12px}
  .kv{font-size:12px}
  .kv b{color:#475569;font-weight:600;margin-right:4px}
  .card{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:10px}
  .price{font-size:16px;font-weight:700;color:#0f172a}
  .badge{display:inline-block;background:#facc15;color:#0f172a;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px}
  .foot{margin-top:20px;color:#94a3b8;font-size:10px;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}
  @page{size:A4;margin:14mm}
  @media print{body{margin:0}}
`;

export function printHtml(title: string, bodyHtml: string) {
  const when = new Date().toLocaleString("pt-BR");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    title,
  )}</title><style>${BASE_CSS}</style></head><body>
    <div class="brand">
      <div class="logo">CoteCerto</div>
      <div class="meta">${escapeHtml(title)}<br/>${when}</div>
    </div>
    ${bodyHtml}
    <div class="foot">CoteCerto · Documento gerado em ${when}</div>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    alert("Permita pop-ups para imprimir.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Wait for layout before printing.
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* noop */
    }
  }, 300);
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const fmtBRL = (n: number) =>
  "R$ " +
  Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
