// Fold "Blindagem, kit gás, acessórios e equipamentos" do Passo 3 — ver
// doc/EXTERNAL_API_GUIDE.md, seção veiculo (campos blindagem/kitGas/
// acessorios/kitacessorios/opcionais/equipamentos e seus valores por item).
import { useState } from "react";
import { maskBRL } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
};

const SimNaoSelect = ({
  value,
  onChange,
}: {
  value: "sim" | "nao";
  onChange: (v: "sim" | "nao") => void;
}) => (
  <select
    className="input"
    value={value}
    onChange={(e) => onChange(e.target.value as "sim" | "nao")}
  >
    <option value="nao">Não</option>
    <option value="sim">Sim</option>
  </select>
);

export function AcessoriosFold({ f, up }: Props) {
  const [open, setOpen] = useState(false);

  function updDetalhe(key: string, value: string) {
    up("acessoriosDetalhes", { ...f.acessoriosDetalhes, [key]: value });
  }
  const det = (key: string) => f.acessoriosDetalhes[key] ?? "";

  // Chaves de acessoriosDetalhes ligadas a cada sub-toggle — a Quiver
  // rejeita esses campos quando o toggle correspondente está em "Não", mas
  // o objeto acessoriosDetalhes é genérico e mantinha os valores mesmo
  // depois de o vendedor desligar o toggle. Ao desligar, removemos (não só
  // ocultamos) as chaves do grupo.
  const KIT_ACESSORIOS_KEYS = [
    "radioAmFm",
    "cdPlayer",
    "dvdPlayer",
    "rodasLigaLeve",
    "kitMultimidia",
  ];
  const OPCIONAIS_KEYS = ["opcionais2"];
  const EQUIPAMENTOS_KEYS = [
    "capotaFibra",
    "equipamentoEspecial",
    "telefoneCelularVeicular",
    "rebaixado",
    "tunado",
  ];

  function removerDetalhes(keys: string[]) {
    if (!keys.some((k) => k in f.acessoriosDetalhes)) return;
    const next = { ...f.acessoriosDetalhes };
    keys.forEach((k) => delete next[k]);
    up("acessoriosDetalhes", next);
  }

  function toggleKitAcessorios(v: "sim" | "nao") {
    if (v === "nao") removerDetalhes(KIT_ACESSORIOS_KEYS);
    up("kitAcessoriosAtivo", v);
  }
  function toggleOpcionais(v: "sim" | "nao") {
    if (v === "nao") removerDetalhes(OPCIONAIS_KEYS);
    up("opcionaisAtivo", v);
  }
  function toggleEquipamentos(v: "sim" | "nao") {
    if (v === "nao") removerDetalhes(EQUIPAMENTOS_KEYS);
    up("equipamentosAtivo", v);
  }
  function toggleAcessorios(v: "sim" | "nao") {
    if (v === "nao") {
      removerDetalhes([...KIT_ACESSORIOS_KEYS, ...OPCIONAIS_KEYS, ...EQUIPAMENTOS_KEYS]);
    }
    up("acessoriosAtivo", v);
  }

  return (
    <div className={`fold${open ? " open" : ""}`}>
      <div className="fold-h" onClick={() => setOpen((v) => !v)}>
        Blindagem, kit gás, acessórios e equipamentos
        <svg className="chev" width="14" height="14">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      <div className="fold-b">
        <div className="wizard-grid">
          <div className="field-group">
            <label>Blindagem</label>
            <SimNaoSelect value={f.blindagemAtiva} onChange={(v) => up("blindagemAtiva", v)} />
          </div>
          {f.blindagemAtiva === "sim" && (
            <>
              <div className="field-group">
                <label>
                  Cobertura de blindagem<span className="req">*</span>
                </label>
                <input
                  className="input"
                  value={f.coberturaBlindagem}
                  onChange={(e) => up("coberturaBlindagem", e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>
                  Valor da blindagem<span className="req">*</span>
                </label>
                <input
                  className="input"
                  value={f.valorBlindagem}
                  onChange={(e) => up("valorBlindagem", maskBRL(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="field-group">
                <label>Com franquia</label>
                <SimNaoSelect
                  value={f.comFranquiaBlindagem}
                  onChange={(v) => up("comFranquiaBlindagem", v)}
                />
              </div>
            </>
          )}

          <div className="field-group">
            <label>Kit gás</label>
            <SimNaoSelect value={f.kitGasAtivo} onChange={(v) => up("kitGasAtivo", v)} />
          </div>
          {f.kitGasAtivo === "sim" && (
            <>
              <div className="field-group">
                <label>
                  Cobertura de kit gás<span className="req">*</span>
                </label>
                <SimNaoSelect
                  value={f.coberturaKitGas}
                  onChange={(v) => up("coberturaKitGas", v)}
                />
              </div>
              {f.coberturaKitGas === "sim" && (
                <div className="field-group">
                  <label>
                    Valor do kit gás<span className="req">*</span>
                  </label>
                  <input
                    className="input"
                    value={f.valorKitGas}
                    onChange={(e) => up("valorKitGas", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
              )}
              <div className="field-group">
                <label>Com franquia</label>
                <SimNaoSelect
                  value={f.comFranquiaKitGas}
                  onChange={(v) => up("comFranquiaKitGas", v)}
                />
              </div>
            </>
          )}

          <div className="field-group">
            <label>Blindagem/kit gás/acessórios (expandir seção)</label>
            <SimNaoSelect value={f.acessoriosAtivo} onChange={toggleAcessorios} />
          </div>
        </div>

        {f.acessoriosAtivo === "sim" && (
          <>
            <div className="wizard-grid" style={{ marginTop: 10 }}>
              <div className="field-group">
                <label>Kit de acessórios</label>
                <SimNaoSelect value={f.kitAcessoriosAtivo} onChange={toggleKitAcessorios} />
              </div>
              <div className="field-group">
                <label>Opcionais</label>
                <SimNaoSelect value={f.opcionaisAtivo} onChange={toggleOpcionais} />
              </div>
              <div className="field-group">
                <label>Equipamentos especiais</label>
                <SimNaoSelect value={f.equipamentosAtivo} onChange={toggleEquipamentos} />
              </div>
            </div>

            {f.kitAcessoriosAtivo === "sim" && (
              <div className="wizard-grid" style={{ marginTop: 6 }}>
                <div className="field-group">
                  <label>Rádio AM/FM</label>
                  <input
                    className="input"
                    value={det("radioAmFm")}
                    onChange={(e) => updDetalhe("radioAmFm", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>CD Player</label>
                  <input
                    className="input"
                    value={det("cdPlayer")}
                    onChange={(e) => updDetalhe("cdPlayer", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>DVD Player</label>
                  <input
                    className="input"
                    value={det("dvdPlayer")}
                    onChange={(e) => updDetalhe("dvdPlayer", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>Rodas de liga leve</label>
                  <input
                    className="input"
                    value={det("rodasLigaLeve")}
                    onChange={(e) => updDetalhe("rodasLigaLeve", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>Kit multimídia</label>
                  <input
                    className="input"
                    value={det("kitMultimidia")}
                    onChange={(e) => updDetalhe("kitMultimidia", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
            )}

            {f.opcionaisAtivo === "sim" && (
              <div className="wizard-grid" style={{ marginTop: 6 }}>
                <div className="field-group full">
                  <label>Opcionais (separados por vírgula)</label>
                  <input
                    className="input"
                    value={det("opcionais2")}
                    onChange={(e) => updDetalhe("opcionais2", e.target.value)}
                    placeholder="ex.: Air bag motorista, Air bag passageiro"
                  />
                </div>
              </div>
            )}

            {f.equipamentosAtivo === "sim" && (
              <div className="wizard-grid" style={{ marginTop: 6 }}>
                <div className="field-group">
                  <label>Capota de fibra</label>
                  <input
                    className="input"
                    value={det("capotaFibra")}
                    onChange={(e) => updDetalhe("capotaFibra", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>Equipamento especial</label>
                  <input
                    className="input"
                    value={det("equipamentoEspecial")}
                    onChange={(e) => updDetalhe("equipamentoEspecial", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>Telefone celular veicular</label>
                  <input
                    className="input"
                    value={det("telefoneCelularVeicular")}
                    onChange={(e) => updDetalhe("telefoneCelularVeicular", maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="field-group">
                  <label>Rebaixado</label>
                  <select
                    className="input"
                    value={det("rebaixado") || "Não"}
                    onChange={(e) => updDetalhe("rebaixado", e.target.value)}
                  >
                    <option>Não</option>
                    <option>Sim</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Tunado</label>
                  <select
                    className="input"
                    value={det("tunado") || "Não"}
                    onChange={(e) => updDetalhe("tunado", e.target.value)}
                  >
                    <option>Não</option>
                    <option>Sim</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
