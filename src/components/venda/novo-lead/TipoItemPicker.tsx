// Picker "Item segurado" — troca de produto dentro da cotação (padrão
// Quiver). Espelha `tipoItemPicker`/`trocarTipoItem` do protótipo V12
// (cotecerto_prototipo_v12.html:3605-3640): círculo por produto, os sem
// jornada pronta ficam num bloco "em breve" esmaecido e abrem um modal
// informativo em vez de trocar o produto.
import { useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { ModalShell } from "@/components/operacao/configuracoes/modal-shell";
import { PRODUTOS, produtoTemJornada, type Produto } from "./produtos";

type Variant = "wizard" | "linha";

export function TipoItemPicker({
  ramo,
  onChange,
  variant = "wizard",
  dataTour,
}: {
  ramo: string;
  onChange: (ramo: Produto["ramo"]) => void;
  variant?: Variant;
  dataTour?: string;
}) {
  const [emConstrucao, setEmConstrucao] = useState<Produto | null>(null);

  function clicar(p: Produto) {
    if (p.ramo === ramo) return;
    if (!produtoTemJornada(p.id)) {
      setEmConstrucao(p);
      return;
    }
    onChange(p.ramo);
  }

  const prontos = PRODUTOS.filter((p) => produtoTemJornada(p.id));
  const futuros = PRODUTOS.filter((p) => !produtoTemJornada(p.id));

  const botao = (p: Produto) => {
    const on = p.ramo === ramo;
    const pronto = produtoTemJornada(p.id);
    return (
      <button
        key={p.id}
        type="button"
        className={"ti-btn" + (on ? " on" : "") + (pronto ? "" : " soon")}
        title={p.nome + (pronto ? "" : " · em breve")}
        onClick={() => clicar(p)}
      >
        <Icon id={p.icone} size={variant === "linha" ? 24 : 20} />
      </button>
    );
  };

  if (variant === "linha") {
    return (
      <>
        <div className="nl-tipos" data-tour={dataTour}>
          {prontos.map(botao)}
          {futuros.map(botao)}
        </div>
        {futuros.length > 0 && <div className="nl-tipos-nota">os demais itens entram em breve</div>}
        {emConstrucao && (
          <ModalInformativo produto={emConstrucao} onClose={() => setEmConstrucao(null)} />
        )}
      </>
    );
  }

  return (
    <div className="tipo-item" data-tour={dataTour}>
      <span className="ti-lbl">Item segurado</span>
      <div className="ti-set">
        {prontos.map(botao)}
        {futuros.length > 0 && (
          <div className="ti-soon">
            <div className="ti-soon-row">{futuros.map(botao)}</div>
            <span className="ti-nota">os demais itens entram em breve</span>
          </div>
        )}
      </div>
      {emConstrucao && (
        <ModalInformativo produto={emConstrucao} onClose={() => setEmConstrucao(null)} />
      )}
    </div>
  );
}

function ModalInformativo({ produto, onClose }: { produto: Produto; onClose: () => void }) {
  return (
    <ModalShell
      title={`Jornada de ${produto.nome} em construção`}
      onClose={onClose}
      footer={
        <button className="btn btn-yellow" onClick={onClose}>
          Entendi
        </button>
      }
    >
      <p style={{ margin: "0 0 12px" }}>
        Trocar o item segurado <strong>no meio da cotação</strong> já está previsto — é o caminho
        para quando o lead vem classificado errado pela campanha ou o cliente muda de ideia.
      </p>
      <div className="clt-note">
        <Icon id="info" size={15} />
        <div>
          Hoje só a jornada de <strong>Auto</strong> está pronta. As perguntas de{" "}
          <strong>{produto.nome}</strong> (item, perfil e coberturas próprias) entram nas próximas
          entregas — a cotação atual segue como Auto.
        </div>
      </div>
    </ModalShell>
  );
}
