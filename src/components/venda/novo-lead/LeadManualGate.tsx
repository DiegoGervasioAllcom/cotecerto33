// V11 · Lead Manual — origem (espelha o protótipo): captura Nome/Telefone/
// Placa/Canal e o tipo de seguro ANTES do wizard, pra registrar de onde veio
// um lead que não nasceu da Central (indicação, ligação, contato direto —
// sem SLA). Sem isto, todo lead criado por aqui ficava com canal "Cotação
// direta" fixo, mesmo vindo de indicação/Google/etc.
//
// No protótipo (cotecerto_prototipo_v11.html:1324-1380) isto é um MODAL
// (openNovoLeadModal), não uma página — por isso usa o mesmo ModalShell dos
// modais de Configurações/Acessos, sobreposto à tela anterior.
import { useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { ModalShell } from "@/components/operacao/configuracoes/modal-shell";
import { maskCel, maskPlaca } from "./masks";

const CANAIS = ["Movida", "Google", "Facebook", "Indicação", "Manual", "Outro"];
const PRODUTOS = [
  { id: "Automóvel", nome: "Auto", disponivel: true },
  { id: "Moto", nome: "Moto", disponivel: false },
  { id: "Vida", nome: "Vida", disponivel: false },
  { id: "Residencial", nome: "Residencial", disponivel: false },
  { id: "Celular", nome: "Celular", disponivel: false },
];

export function LeadManualGate({
  onIniciar,
  onCancelar,
}: {
  onIniciar: (dados: { nome: string; celular: string; placa: string; canal: string }) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [placa, setPlaca] = useState("");
  const [canal, setCanal] = useState("");
  const [descricaoOutro, setDescricaoOutro] = useState("");
  const [lojaMovida, setLojaMovida] = useState("");
  const [vendedorMovida, setVendedorMovida] = useState("");
  const [produto, setProduto] = useState("Automóvel");
  const [erro, setErro] = useState<string | null>(null);

  const produtoAtual = PRODUTOS.find((p) => p.id === produto);

  function confirmar() {
    if (!nome.trim() || !celular.trim() || !placa.trim() || !canal) {
      setErro("Preencha Nome, Telefone, Placa e Canal");
      return;
    }
    if (canal === "Outro" && !descricaoOutro.trim()) {
      setErro("Descreva o canal (Outro)");
      return;
    }
    if (canal === "Movida" && (!lojaMovida.trim() || !vendedorMovida.trim())) {
      setErro("Informe Loja e Vendedor (Movida)");
      return;
    }
    if (!produtoAtual?.disponivel) {
      setErro(`Jornada de ${produtoAtual?.nome} em construção — selecione Auto para iniciar`);
      return;
    }
    setErro(null);
    const canalLabel =
      canal === "Outro"
        ? `Outro · ${descricaoOutro.trim()}`
        : canal === "Movida"
          ? `Movida · ${lojaMovida.trim()} · ${vendedorMovida.trim()}`
          : canal;
    onIniciar({ nome: nome.trim(), celular, placa, canal: canalLabel });
  }

  return (
    <ModalShell
      title="Lead Manual — origem"
      onClose={onCancelar}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="btn btn-yellow" onClick={confirmar}>
            Iniciar cotação
          </button>
        </>
      }
    >
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <Icon id="info" size={15} />
        <div>
          <strong>Lead Manual</strong> — não veio da Central: indicação, ligação ou outro contato
          direto, imputado por você e <strong>sem SLA</strong>. Informe a origem e o{" "}
          <strong>tipo de seguro</strong> para iniciar a cotação.
        </div>
      </div>
      <div className="acc-grid">
        <div className="field-group">
          <label>
            Nome<span className="req">*</span>
          </label>
          <input
            className="input"
            value={nome}
            maxLength={150}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>
        <div className="field-group">
          <label>
            Telefone<span className="req">*</span>
          </label>
          <input
            className="input"
            value={celular}
            maxLength={15}
            onChange={(e) => setCelular(maskCel(e.target.value))}
            placeholder="(00) 00000-0000"
          />
        </div>
        <div className="field-group">
          <label>
            Placa<span className="req">*</span>
          </label>
          <input
            className="input"
            value={placa}
            maxLength={8}
            onChange={(e) => setPlaca(maskPlaca(e.target.value))}
            placeholder="AAA0A00"
          />
        </div>
        <div className="field-group">
          <label>
            Canal<span className="req">*</span>
          </label>
          <select className="input" value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="">Selecione</option>
            {CANAIS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canal === "Outro" && (
        <div className="field-group full">
          <label>
            Descreva o canal<span className="req">*</span>
          </label>
          <input
            className="input"
            value={descricaoOutro}
            maxLength={100}
            onChange={(e) => setDescricaoOutro(e.target.value)}
            placeholder="Qual canal?"
          />
        </div>
      )}

      {canal === "Movida" && (
        <div className="acc-grid">
          <div className="field-group">
            <label>
              Loja (Movida)<span className="req">*</span>
            </label>
            <input
              className="input"
              value={lojaMovida}
              maxLength={100}
              onChange={(e) => setLojaMovida(e.target.value)}
              placeholder="Loja Movida"
            />
          </div>
          <div className="field-group">
            <label>
              Vendedor (Movida)<span className="req">*</span>
            </label>
            <input
              className="input"
              value={vendedorMovida}
              maxLength={100}
              onChange={(e) => setVendedorMovida(e.target.value)}
              placeholder="Vendedor Movida"
            />
          </div>
        </div>
      )}

      <div className="sub" style={{ marginTop: 16, marginBottom: 6 }}>
        Tipo de seguro — define a jornada da cotação
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {PRODUTOS.map((p) => (
          <span
            key={p.id}
            className={"chip " + (produto === p.id ? "chip-yellow" : "chip-outline")}
            style={{ cursor: "pointer" }}
            onClick={() => setProduto(p.id)}
          >
            {p.nome}
            {!p.disponivel && <span style={{ opacity: 0.6 }}> · em breve</span>}
          </span>
        ))}
      </div>
      {!produtoAtual?.disponivel && (
        <div className="clt-note" style={{ marginTop: 10, borderColor: "var(--yellow)" }}>
          <Icon id="info" size={15} />
          <div>
            Jornada de <strong>{produtoAtual?.nome}</strong> <strong>em construção</strong>. Por
            ora, só <strong>Auto</strong> está disponível — selecione Auto para iniciar.
          </div>
        </div>
      )}

      {erro && (
        <div className="banner alert" style={{ marginTop: 14 }}>
          {erro}
        </div>
      )}
    </ModalShell>
  );
}
