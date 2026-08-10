import { useEffect, useState } from "react";
import { z } from "zod";
import { ProdutosCanaisFields } from "@/components/acessos/produtos-canais-fields";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import type { FullTeamMember } from "./full-team";

const configSchema = z.object({
  equipe: z.string().trim().max(80, "Equipe deve ter no máximo 80 caracteres."),
  leadsDia: z.coerce.number().int().min(0).max(1000),
  comissaoVenda: z.coerce.number().min(0).max(100),
  comissaoRenovacao: z.coerce.number().min(0).max(100),
});
const motivoSchema = z.string().trim().min(3, "Informe o motivo (mín. 3 caracteres).").max(500);

export function FullMemberModal({
  membro,
  modo,
  onClose,
  onSaved,
}: {
  membro: FullTeamMember;
  modo: "ver" | "configurar" | "excluir";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [equipe, setEquipe] = useState(membro.equipe ?? "");
  const [leadsDia, setLeadsDia] = useState(String(membro.leadsDia ?? 0));
  const [comissaoVenda, setComissaoVenda] = useState(String(membro.comissao ?? 0));
  const [comissaoRenovacao, setComissaoRenovacao] = useState("0");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [canais, setCanais] = useState<string[]>([]);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      supabase.from("profile_produtos").select("produto_id").eq("profile_id", membro.id),
      supabase.from("profile_canais").select("canal_id").eq("profile_id", membro.id),
      supabase
        .from("full_vendedor_config")
        .select("comissao_venda_pct,comissao_renovacao_pct")
        .eq("profile_id", membro.id)
        .maybeSingle(),
    ]).then(([produtosResult, canaisResult, configResult]) => {
      if (!ativo) return;
      setProdutos((produtosResult.data ?? []).map((item) => item.produto_id));
      setCanais((canaisResult.data ?? []).map((item) => item.canal_id));
      if (configResult.data) {
        setComissaoVenda(String(configResult.data.comissao_venda_pct ?? 0));
        setComissaoRenovacao(String(configResult.data.comissao_renovacao_pct ?? 0));
      }
    });
    return () => {
      ativo = false;
    };
  }, [membro.id]);

  async function salvar() {
    const parsed = configSchema.safeParse({ equipe, leadsDia, comissaoVenda, comissaoRenovacao });
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Revise os campos.");
    setBusy(true);
    setErro(null);
    const { error } = await supabase.rpc("fn_configurar_vendedor_full", {
      p_vendedor_id: membro.id,
      p_equipe: parsed.data.equipe || undefined,
      p_leads_dia: parsed.data.leadsDia,
      p_produtos: produtos,
      p_canais: canais,
      p_comissao_venda_pct: parsed.data.comissaoVenda,
      p_comissao_renovacao_pct: parsed.data.comissaoRenovacao,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    onSaved();
  }

  async function excluir() {
    const parsed = motivoSchema.safeParse(motivo);
    if (!parsed.success) return setErro(parsed.error.issues[0]?.message ?? "Informe o motivo.");
    setBusy(true);
    setErro(null);
    const { error } = await supabase.rpc("fn_desligar_vendedor_full", {
      p_vendedor_id: membro.id,
      p_motivo: parsed.data,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    onSaved();
  }

  return (
    <div className="modal-host" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-h">
          <Icon id={modo === "excluir" ? "alert-triangle" : "user"} size={18} />
          <h3>
            {modo === "configurar" ? "Configurar" : modo === "excluir" ? "Desligar" : "Cadastro"} —{" "}
            {membro.nome}
          </h3>
          <button className="x" onClick={onClose}>
            <Icon id="x" size={18} />
          </button>
        </div>
        <div className="modal-b">
          {erro && <div className="banner alert">{erro}</div>}
          {modo === "ver" && (
            <table className="table-pipe">
              <tbody>
                <tr>
                  <td>Nome</td>
                  <td>{membro.nome}</td>
                </tr>
                <tr>
                  <td>CPF</td>
                  <td>{membro.cpf || "—"}</td>
                </tr>
                <tr>
                  <td>E-mail</td>
                  <td>{membro.email}</td>
                </tr>
                <tr>
                  <td>Equipe</td>
                  <td>{membro.equipe || "—"}</td>
                </tr>
                <tr>
                  <td>Produtos</td>
                  <td>{membro.produtos}</td>
                </tr>
                <tr>
                  <td>Comissão</td>
                  <td>{membro.comissao == null ? "Modelo do time" : `${membro.comissao}%`}</td>
                </tr>
              </tbody>
            </table>
          )}
          {modo === "configurar" && (
            <>
              <div className="acc-grid">
                <div className="field-group">
                  <label>Equipe</label>
                  <input
                    className="input"
                    maxLength={80}
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
          {modo === "excluir" && (
            <div className="field-group full">
              <label>Motivo — fica no registro para a Matriz</label>
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          {modo === "configurar" && (
            <button className="btn btn-slate" disabled={busy} onClick={salvar}>
              Salvar configuração
            </button>
          )}
          {modo === "excluir" && (
            <button className="btn btn-yellow" disabled={busy} onClick={excluir}>
              Confirmar desligamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
