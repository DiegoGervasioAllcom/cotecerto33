// V11 · C13 — "Quero falar com a Cote Certo" (tela de login, rota pública).
//
// Decisão do plano: dispara e esquece — sem outbox, sem tabela. O e-mail vai
// direto pro Resend, no mesmo estilo de chamada de `email.functions.ts`, mas
// sem o Idempotency-Key (que é conceito de lease do outbox, não se aplica
// aqui: se falhar, a pessoa tenta de novo, não tem retry automático).
//
// Rate-limit em memória, primeira rota pública do sistema a precisar disso.
// Não persiste em banco de propósito — o app roda numa instância única
// (docs/RUNBOOK_DEPLOY.md), então o contador em memória já deter o
// espontâneo; reinício zera o contador, o que é aceitável pro que se pede
// aqui ("básico"), não uma blindagem contra ataque coordenado.
import { createServerFn } from "@tanstack/react-start";
import { contatoMatrizSchema } from "@/lib/schemas/contato.schema";
import { escapeHtml } from "@/lib/email-templates";

const FROM = "CoteCerto <acesso@cote-certo.sandboxallcom.com>";
const MATRIZ_EMAIL = "diego.gervasio@allcomtelecom.com";

const JANELA_MS = 60 * 60 * 1000;
const LIMITE_POR_JANELA = 3;
const enviosPorEmail = new Map<string, number[]>();

function podeEnviar(chave: string): boolean {
  const agora = Date.now();
  const historico = (enviosPorEmail.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  if (historico.length >= LIMITE_POR_JANELA) {
    enviosPorEmail.set(chave, historico);
    return false;
  }
  historico.push(agora);
  enviosPorEmail.set(chave, historico);
  return true;
}

export const enviarContatoMatriz = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const parsed = contatoMatrizSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    const chave = data.email.trim().toLowerCase();
    if (!podeEnviar(chave)) {
      throw new Error("Muitas mensagens enviadas com este e-mail. Tente novamente mais tarde.");
    }

    const resendKey = process.env.SELF_RESEND_API_KEY;
    if (!resendKey) throw new Error("Configuração do servidor ausente.");

    const nome = escapeHtml(data.nome);
    const email = escapeHtml(data.email);
    const tema = escapeHtml(data.tema);
    const mensagemHtml = escapeHtml(data.mensagem).replace(/\n/g, "<br>");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        reply_to: data.email.trim(),
        to: [MATRIZ_EMAIL],
        subject: `Quero falar com a Cote Certo · ${data.tema}`,
        html: `<p><strong>Nome:</strong> ${nome}</p><p><strong>E-mail:</strong> ${email}</p><p><strong>Tema:</strong> ${tema}</p><p><strong>Mensagem:</strong></p><p>${mensagemHtml}</p>`,
        text: `Nome: ${data.nome}\nE-mail: ${data.email}\nTema: ${data.tema}\n\n${data.mensagem}`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Falha ao enviar (${response.status}): ${body}`);
    }

    return { ok: true as const };
  });
