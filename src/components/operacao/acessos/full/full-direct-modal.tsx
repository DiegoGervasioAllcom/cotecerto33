import { useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import { cadastrarVendedorFullDireto } from "@/lib/full-vendedor.functions";
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";
import { cadastroDiretoFullSchema as schema, EQUIPES_FULL } from "./full-direct-schema";

/**
 * Cadastro direto — 1 tela só, igual ao protótipo (`openCadDireto`): nome,
 * documento, contato e equipe. Leads, comissão, produtos e canais ficam pra
 * "próxima tela" — aqui, o modal Configurar que `xacessos.tsx` abre em
 * seguida, assim que o vendedor aparece na lista recarregada.
 */
export function FullDirectModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (resultado: { userId: string; aviso: string | null }) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [celular, setCelular] = useState("");
  const [equipe, setEquipe] = useState<(typeof EQUIPES_FULL)[number]>(EQUIPES_FULL[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cadastrar() {
    const parsed = schema.safeParse({ nome, email, cpf, celular, equipe });
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
          equipe: parsed.data.equipe,
          produtos: [],
          canais: [],
        },
      });
      onSaved({
        userId: result.user_id,
        aviso: result.email_enviado
          ? null
          : `Cadastro concluído, mas o e-mail não foi enviado: ${result.email_erro ?? "erro desconhecido"}`,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao cadastrar vendedor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-host" onMouseDown={onClose}>
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
              Cadastro <strong>direto</strong> — autonomia da Full. Na próxima tela você configura
              equipe, leads, produtos e canais; só ao concluir ele recebe o e-mail{" "}
              <strong>Boas-vindas Supper</strong> para criar a senha. Prefira o{" "}
              <strong>Convite Supper</strong>: quem preenche os dados é ele.
            </div>
          </div>
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
            <div className="field-group">
              <label>Equipe</label>
              <select
                className="input"
                value={equipe}
                onChange={(e) => setEquipe(e.target.value as (typeof EQUIPES_FULL)[number])}
              >
                {EQUIPES_FULL.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-yellow" disabled={busy} onClick={cadastrar}>
            {busy ? "Cadastrando…" : "Continuar para configuração"}
          </button>
        </div>
      </div>
    </div>
  );
}
