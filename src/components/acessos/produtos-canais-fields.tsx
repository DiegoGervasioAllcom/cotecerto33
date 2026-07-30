import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/operacao/acessos/icon";

/**
 * "Produtos e canais logo abaixo do modelo/supervisão, com botão Todos" (Etapa
 * 2). Só entra em quem VENDE e RECEBE leads — franquia e vendedores. Master
 * franqueado não usa isto (F5 recusa se vier preenchido).
 *
 * Produtos começam no padrão do bloco (F3: interno todos · externo só Auto);
 * canais começam todos marcados — como `canais:CANAIS_LEADS.slice()` no
 * `openClassify` do protótipo.
 */

type Produto = { id: string; nome: string; fixo: boolean };
type Canal = { id: string; nome: string };

export function ProdutosCanaisFields({
  bloco,
  produtos,
  setProdutos,
  canais,
  setCanais,
}: {
  bloco: "interno" | "externo";
  produtos: string[];
  setProdutos: (v: string[]) => void;
  canais: string[];
  setCanais: (v: string[]) => void;
}) {
  const [catalogoProdutos, setCatalogoProdutos] = useState<Produto[]>([]);
  const [catalogoCanais, setCatalogoCanais] = useState<Canal[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let ativo = true;
    Promise.all([
      supabase.from("produtos").select("id,nome,fixo").eq("ativo", true).order("ordem"),
      supabase
        .from("canais")
        .select("id,nome")
        .is("empresa_id", null)
        .neq("tipo", "sistema")
        .order("ordem"),
      supabase.rpc("fn_produtos_padrao", { _bloco: bloco }),
    ]).then(([pRes, cRes, padraoRes]) => {
      if (!ativo) return;
      const cat = (pRes.data ?? []) as Produto[];
      setCatalogoProdutos(cat);
      setCatalogoCanais((cRes.data ?? []) as Canal[]);
      // Só define o estado inicial uma vez — se o pai já tem seleção (ex.:
      // reabrindo depois de trocar de aba), não sobrescreve.
      if (!carregado) {
        const padrao = (padraoRes.data ?? []) as string[];
        setProdutos(padrao.length > 0 ? padrao : cat.filter((p) => p.fixo).map((p) => p.id));
        setCanais(((cRes.data ?? []) as Canal[]).map((c) => c.id));
        setCarregado(true);
      }
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recarrega ao trocar de bloco
  }, [bloco]);

  function toggleProduto(id: string, fixo: boolean) {
    if (fixo) return; // Auto não pode ser desmarcado (protótipo ignora o clique).
    setProdutos(produtos.includes(id) ? produtos.filter((x) => x !== id) : [...produtos, id]);
  }

  function todosProdutos() {
    const todos = catalogoProdutos.map((p) => p.id);
    const jaTodos = todos.every((id) => produtos.includes(id));
    setProdutos(jaTodos ? catalogoProdutos.filter((p) => p.fixo).map((p) => p.id) : todos);
  }

  function toggleCanal(id: string) {
    setCanais(canais.includes(id) ? canais.filter((x) => x !== id) : [...canais, id]);
  }

  function todosCanais() {
    const todos = catalogoCanais.map((c) => c.id);
    setCanais(canais.length === todos.length ? [] : todos);
  }

  return (
    <>
      <div
        className="acc-sec-t"
        style={{ display: "flex", alignItems: "center" }}
        data-testid="produtos-fields"
      >
        Produtos habilitados
        <button
          type="button"
          className="btn btn-yellow btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={todosProdutos}
        >
          Todos
        </button>
      </div>
      <div className="acc-pills">
        {catalogoProdutos.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`acc-pill ${produtos.includes(p.id) ? "on" : ""}`}
            onClick={() => toggleProduto(p.id, p.fixo)}
          >
            {produtos.includes(p.id) ? "✓ " : ""}
            {p.nome}
            {p.fixo ? " · base" : ""}
          </button>
        ))}
      </div>

      <div
        className="acc-sec-t"
        style={{ display: "flex", alignItems: "center" }}
        data-testid="canais-fields"
      >
        Canais de leads{" "}
        <span className="muted small" style={{ fontWeight: 500 }}>
          &nbsp;— de quais canais este acesso recebe (ex.: só Movida)
        </span>
        <button
          type="button"
          className="btn btn-yellow btn-sm"
          style={{ marginLeft: "auto" }}
          onClick={todosCanais}
        >
          Todos
        </button>
      </div>
      <div className="acc-pills">
        {catalogoCanais.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`acc-pill ${canais.includes(c.id) ? "on" : ""}`}
            onClick={() => toggleCanal(c.id)}
          >
            {c.nome}
          </button>
        ))}
      </div>
      {carregado && catalogoProdutos.length === 0 && (
        <div className="muted small">
          <Icon id="info" size={13} /> Nenhum produto ativo cadastrado.
        </div>
      )}
    </>
  );
}
