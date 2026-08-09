import { useState } from "react";
import { ProdutosCanaisFields } from "@/components/acessos/produtos-canais-fields";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import { cadastrarVendedorFullDireto } from "@/lib/full-vendedor.functions";
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";
import {
  cadastroDiretoFullSchema as schema,
  cadastroDiretoIdentidadeSchema,
} from "./full-direct-schema";

export function FullDirectModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (aviso: string | null) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [celular, setCelular] = useState("");
  const [equipe, setEquipe] = useState("");
  const [leadsDia, setLeadsDia] = useState("0");
  const [comissaoVenda, setComissaoVenda] = useState("0");
  const [comissaoRenovacao, setComissaoRenovacao] = useState("0");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [canais, setCanais] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [etapa, setEtapa] = useState<"cadastro" | "configuracao">("cadastro");

  async function cadastrar() {
    const parsed = schema.safeParse({
      nome,
      email,
      cpf,
      celular,
      equipe,
      leadsDia,
      comissaoVenda,
      comissaoRenovacao,
    });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Revise os campos.");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setErro("Sessão expirada. Entre novamente.");
    setBusy(true);
    setErro(null);
    try {
      const result = await cadastrarVendedorFullDireto({
        data: {
          caller_token: token,
          nome: parsed.data.nome,
          email: parsed.data.email,
          cpf: parsed.data.cpf,
          celular: parsed.data.celular,
          equipe: parsed.data.equipe || undefined,
          leads_dia: parsed.data.leadsDia,
          produtos,
          canais,
          comissao_venda_pct: parsed.data.comissaoVenda,
          comissao_renovacao_pct: parsed.data.comissaoRenovacao,
        },
      });
      onSaved(
        result.email_enviado
          ? null
          : `Cadastro concluído, mas o e-mail não foi enviado: ${result.email_erro ?? "erro desconhecido"}`,
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao cadastrar vendedor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-h">
          <Icon id="edit" size={18} />
          <h3>Cadastro direto — vendedor</h3>
          <button className="x" onClick={onClose}>
            <Icon id="x" size={18} />
          </button>
        </div>
        <div className="modal-b">
          {erro && <div className="banner alert">{erro}</div>}
          <div className="clt-note">
            <Icon id="info" size={15} />
            <div>
              O vendedor será criado diretamente na sua franquia e receberá um link para criar a
              própria senha.
            </div>
          </div>
          <div className="toggle toggle-sub" style={{ marginTop: 14, marginBottom: 14 }}>
            <button
              className={etapa === "cadastro" ? "on" : ""}
              type="button"
              onClick={() => setEtapa("cadastro")}
            >
              1 · Cadastro
            </button>
            <button
              className={etapa === "configuracao" ? "on" : ""}
              type="button"
              disabled={etapa === "cadastro"}
            >
              2 · Configuração
            </button>
          </div>
          {etapa === "cadastro" && (
            <div className="acc-grid" style={{ marginTop: 14 }}>
              <div className="field-group full">
                <label>Nome completo</label>
                <input
                  className="input"
                  maxLength={150}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>CPF</label>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(event) => setCpf(maskCpfCnpj(event.target.value))}
                />
              </div>
              <div className="field-group">
                <label>Celular</label>
                <input
                  className="input"
                  inputMode="tel"
                  maxLength={15}
                  placeholder="(11) 90000-0000"
                  value={celular}
                  onChange={(event) => setCelular(maskTelefone(event.target.value))}
                />
              </div>
              <div className="field-group full">
                <label>E-mail</label>
                <input
                  className="input"
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}
          {etapa === "configuracao" && (
            <>
              <div className="acc-grid" style={{ marginTop: 14 }}>
                <div className="field-group">
                  <label>Equipe</label>
                  <input
                    className="input"
                    maxLength={120}
                    value={equipe}
                    onChange={(e) => setEquipe(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>Leads · média/dia útil</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={1000}
                    value={leadsDia}
                    onChange={(e) => setLeadsDia(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>Comissão de venda (%)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={comissaoVenda}
                    onChange={(e) => setComissaoVenda(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>Comissão de renovação (%)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={comissaoRenovacao}
                    onChange={(e) => setComissaoRenovacao(e.target.value)}
                  />
                </div>
              </div>
              <ProdutosCanaisFields
                bloco="externo"
                produtos={produtos}
                setProdutos={setProdutos}
                canais={canais}
                setCanais={setCanais}
              />
            </>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          {etapa === "cadastro" ? (
            <button
              className="btn btn-yellow"
              type="button"
              onClick={() => {
                const identity = cadastroDiretoIdentidadeSchema.safeParse({
                  nome,
                  email,
                  cpf,
                  celular,
                });
                if (!identity.success)
                  return setErro(identity.error.issues[0]?.message ?? "Revise os campos.");
                setErro(null);
                setEtapa("configuracao");
              }}
            >
              Continuar para configuração
            </button>
          ) : (
            <button className="btn btn-yellow" disabled={busy} onClick={cadastrar}>
              {busy ? "Cadastrando…" : "Concluir cadastro"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
