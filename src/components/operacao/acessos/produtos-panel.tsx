// Aba "Personalização geral" — Produtos (catálogo + produtos padrão por
// bloco). Espelha accModeloProdutos()/prodPadraoIntTab()/prodPadraoCard() do
// protótipo v11: o catálogo completo (nome, jornada, ativo, remover) só
// aparece no bloco EXTERNOS — o bloco MATRIZ só ajusta o padrão do próprio
// escopo (interno).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SenhaDiretorModal } from "@/components/acessos/senha-diretor-modal";
import { Icon } from "./icon";
import type { ProdutoCatalogo } from "./types";

/** `bloco` da tela ("interno"/"rede") -> `bloco` da tabela `produtos_padrao` ("interno"/"externo"). */
function blocoTabela(bloco: "interno" | "rede"): "interno" | "externo" {
  return bloco === "interno" ? "interno" : "externo";
}

export function ProdutosPanel({
  bloco,
  onToast,
}: {
  bloco: "interno" | "rede";
  onToast: (msg: string, kind: "ok" | "alert") => void;
}) {
  const scope = blocoTabela(bloco);
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [padrao, setPadrao] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [prodRes, padRes] = await Promise.all([
      supabase.from("produtos").select("id,nome,fixo,ativo,tem_jornada,ordem").order("ordem"),
      supabase.from("produtos_padrao").select("produto_id").eq("bloco", scope),
    ]);
    if (prodRes.data) setProdutos(prodRes.data);
    if (padRes.data) setPadrao(padRes.data.map((p) => p.produto_id));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  function patchNome(id: string, nome: string) {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, nome } : p)));
  }
  function toggleAtivo(p: ProdutoCatalogo) {
    if (p.fixo) {
      onToast("Auto não pode ser desativado", "alert");
      return;
    }
    setProdutos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: !x.ativo } : x)));
  }
  function removerLocal(id: string) {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    setPadrao((prev) => prev.filter((x) => x !== id));
  }
  function togglePadrao(id: string) {
    if (id === "auto") return;
    setPadrao((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function salvarComSenha(senha: string): Promise<{ error: string | null }> {
    setBusy(true);
    if (bloco === "rede") {
      const { error } = await supabase.rpc("fn_salvar_produtos_catalogo", {
        p_senha: senha,
        p_produtos: produtos.map((p) => ({ id: p.id, nome: p.nome, ativo: p.ativo })),
        p_novo_nome: novoNome.trim() || undefined,
      });
      if (error) {
        setBusy(false);
        return { error: error.message };
      }
    }
    const idsPadrao = padrao.includes("auto") ? padrao : ["auto", ...padrao];
    const { error: errPad } = await supabase.rpc("fn_salvar_produtos_padrao", {
      p_senha: senha,
      p_bloco: scope,
      p_produto_ids: idsPadrao,
    });
    setBusy(false);
    if (errPad) return { error: errPad.message };
    setNovoNome("");
    setAddOpen(false);
    onToast(
      bloco === "rede"
        ? "Catálogo de produtos e padrão externo alterados"
        : "Produtos padrão dos perfis internos salvos",
      "ok",
    );
    await load();
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando produtos…</div>
      </div>
    );
  }

  const produtosAtivos = produtos.filter((p) => p.ativo);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn btn-slate btn-sm"
          disabled={busy}
          onClick={() => setConfirmando(true)}
        >
          <Icon id="check" size={13} /> Salvar política
        </button>
      </div>
      {confirmando && (
        <SenhaDiretorModal
          label={bloco === "rede" ? "o catálogo de produtos" : "os produtos padrão"}
          onConfirm={salvarComSenha}
          onClose={() => setConfirmando(false)}
        />
      )}

      {bloco === "rede" && (
        <div className="card">
          <div className="card-h" style={{ gap: 12 }}>
            <h3>
              <Icon id="layers" size={16} /> Produtos / tipos de seguro
            </h3>
            <div style={{ marginLeft: "auto" }}>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => setAddOpen((v) => !v)}
              >
                <Icon id="plus" size={13} /> Novo produto
              </button>
            </div>
          </div>
          <div className="muted small" style={{ padding: "0 16px 12px" }}>
            <Icon id="info" size={13} /> Catálogo de produtos/tipos de seguro. Alimenta a
            habilitação de vendedores, a Central de Leads e o tipo de cotação. <strong>Auto</strong>{" "}
            é fixo e sempre ativo.
          </div>
          {addOpen && (
            <div className="card-b" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                placeholder="ex.: Empresarial"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                style={{ maxWidth: 320 }}
                maxLength={150}
              />
              <span className="muted small">Entra ao salvar a política.</span>
            </div>
          )}
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Jornada</th>
                  <th style={{ textAlign: "center" }}>Ativo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        className="input input-mini"
                        value={p.nome}
                        readOnly={p.fixo}
                        maxLength={150}
                        onChange={(e) => patchNome(p.id, e.target.value)}
                      />
                    </td>
                    <td>
                      {p.tem_jornada ? (
                        <span className="chip chip-ok">Jornada pronta</span>
                      ) : (
                        <span className="chip chip-yellow">Jornada em construção</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        className={`switch ${p.ativo ? "on" : ""}`}
                        onClick={() => toggleAtivo(p)}
                        role="button"
                      >
                        <span className="track"></span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.fixo ? (
                        <span className="muted small">fixo</span>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => removerLocal(p.id)}>
                          <Icon id="x" size={12} /> Remover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="shield" size={16} /> Produtos padrão —{" "}
            {bloco === "interno" ? "perfis internos" : "perfis externos"}
          </h3>
        </div>
        <div className="card-b">
          <div className="acc-pills">
            {produtosAtivos.map((p) => {
              const on = p.fixo || padrao.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`acc-pill ${on ? "on" : ""}`}
                  onClick={() => togglePadrao(p.id)}
                >
                  {on ? "✓ " : ""}
                  {p.nome}
                  {p.fixo ? " · base" : ""}
                </button>
              );
            })}
          </div>
          <div className="clt-note" style={{ marginTop: 12 }}>
            <Icon id="info" size={15} />
            <div>
              <strong>Regra geral do bloco:</strong> todo perfil{" "}
              {bloco === "interno"
                ? "interno entra na aprovação com estes produtos (padrão: todos)"
                : "externo entra na aprovação com estes produtos (padrão: só Auto)"}
              . A <strong>regra específica</strong> é o ajuste por pessoa, na análise do cadastro.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
