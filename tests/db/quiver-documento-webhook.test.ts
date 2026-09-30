import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa } from "../helpers/supabase";
import {
  QUIVER_DOCUMENTO_WEBHOOK_PATH,
  handleQuiverDocumentoWebhook,
} from "@/lib/quiver-documento-webhook";

/** V12.4.7 fatia 2 — handler chamado direto (sem servidor HTTP), como o webhook de transmissão. */
const KEY = "teste-doc-key";
const SECRET = "teste-doc-secret";

function req(body: unknown, headers?: Record<string, string>) {
  return new Request(`http://localhost${QUIVER_DOCUMENTO_WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-key": KEY,
      "x-client-secret": SECRET,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("webhook de documento da proposta Quiver", () => {
  let empresa: string;
  let cotacao: string;
  let proposta: string;
  const bytes = Buffer.alloc(2048, 0x62);
  bytes.write("%PDF-1.7\n", 0, "latin1");
  const pdfBody = () => ({
    cotacaoId: cotacao,
    tipo: "proposta_pdf",
    nome: "proposta.pdf",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    tamanho: bytes.length,
    pdfBase64: bytes.toString("base64"),
  });

  beforeAll(async () => {
    process.env.SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_KEY = KEY;
    process.env.SELF_QUIVER_DOCUMENTO_WEBHOOK_CLIENT_SECRET = SECRET;
    empresa = (await criarEmpresa({ nome: "DocWebhook" })).id;
    const d = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresa,
      emailPrefix: "dw-dono",
    });
    const c = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa, responsavel_id: d.userId })
      .select("id")
      .single();
    if (c.error) throw c.error;
    cotacao = c.data.id;
    const p = await admin
      .from("propostas")
      .insert({
        empresa_id: empresa,
        cotacao_id: cotacao,
        responsavel_id: d.userId,
        numero: `PRP-${Date.now() % 100000}`,
        status: "transmitida",
        transmissao_status: "transmitida",
      } as never)
      .select("id")
      .single();
    if (p.error) throw p.error;
    proposta = p.data.id;
    const t = await admin.from("cotacao_transmissoes").insert({
      cotacao_id: cotacao,
      proposta_id: proposta,
      status: "transmitida",
    });
    if (t.error) throw t.error;
  });

  it("401 sem/ com credenciais erradas; 400 para JSON e payload inválidos", async () => {
    expect(
      (await handleQuiverDocumentoWebhook(req(pdfBody(), { "x-client-key": "x" }))).status,
    ).toBe(401);
    expect((await handleQuiverDocumentoWebhook(req("{oi"))).status).toBe(400);
    expect(
      (await handleQuiverDocumentoWebhook(req({ cotacaoId: cotacao, erro: "texto livre" }))).status,
    ).toBe(400);
  });

  it("422 para PDF adulterado (sha) e nada é gravado", async () => {
    const r = await handleQuiverDocumentoWebhook(req({ ...pdfBody(), sha256: "0".repeat(64) }));
    expect(r.status).toBe(422);
    const { data } = await admin
      .from("proposta_documentos")
      .select("id")
      .eq("proposta_id", proposta);
    expect(data).toHaveLength(0);
  });

  it("404 para cotação sem transmissão concluída", async () => {
    const c = await admin.from("cotacoes").insert({ empresa_id: empresa }).select("id").single();
    const r = await handleQuiverDocumentoWebhook(req({ ...pdfBody(), cotacaoId: c.data!.id }));
    expect(r.status).toBe(404);
  });

  it("erro vira falhou; PDF promove para ok, sobe no Storage e repetir é 200 sem duplicar", async () => {
    const e = await handleQuiverDocumentoWebhook(req({ cotacaoId: cotacao, erro: "timeout" }));
    expect(e.status).toBe(200);
    let { data } = await admin.from("proposta_documentos").select("*").eq("proposta_id", proposta);
    expect(data?.[0].status).toBe("falhou");
    expect(data?.[0].erro_codigo).toBe("timeout");

    const r1 = await handleQuiverDocumentoWebhook(req(pdfBody()));
    expect(r1.status).toBe(200);
    const r2 = await handleQuiverDocumentoWebhook(req(pdfBody()));
    expect(r2.status).toBe(200);
    expect((await r2.json()).duplicado).toBe(true);

    ({ data } = await admin.from("proposta_documentos").select("*").eq("proposta_id", proposta));
    expect(data).toHaveLength(1);
    expect(data?.[0].status).toBe("ok");
    expect(data?.[0].storage_path).toBe(`${empresa}/${proposta}/proposta.pdf`);
    expect(data?.[0].tentativas).toBe(2);

    const dl = await admin.storage.from("propostas-docs").download(data![0].storage_path!);
    expect(dl.error).toBeNull();
    expect(Buffer.from(await dl.data!.arrayBuffer()).equals(bytes)).toBe(true);
  });
});
