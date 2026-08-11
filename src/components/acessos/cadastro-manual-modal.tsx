import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "@/components/operacao/acessos/icon";
import { criarPendenteManual } from "@/lib/cadastro.functions";
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";
import { cadastroManualSchema } from "@/lib/schemas/cadastro.schema";

/**
 * "Cadastro manual · exceção" (V11 · C2/C3) — `openManualCad(scope)` do protótipo.
 *
 * Substitui o autocadastro espontâneo de `/auth/cadastro` como única porta que
 * nasce sem convite. Só existe em `acessos.tsx` (Matriz/Coordenador): todo
 * pendente sem convite roteia para a fila da Matriz (`fn_destino_pedido`, F1 da
 * Frente 2) — o mesmo botão em `xacessos.tsx` criaria, pro Master/Full, um
 * pendente que eles mesmos não teriam como aprovar.
 */

export type EscopoCadastroManual = "interno" | "externo";

export function CadastroManualModal({
  escopo,
  onClose,
  onCriado,
}: {
  escopo: EscopoCadastroManual;
  onClose: () => void;
  onCriado: (empresaId: string) => void;
}) {
  const isExterno = escopo === "externo";
  const [tipo, setTipo] = useState<"pj" | "pf">("pj");
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    const parsed = cadastroManualSchema.safeParse({
      nome: nome.trim(),
      tipo: isExterno ? tipo : "pf",
      documento: documento.trim(),
      email: email.trim(),
      celular: celular.trim() || undefined,
    });
    if (!parsed.success) {
      setErro(parsed.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }

    setEnviando(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setEnviando(false);
      setErro("Sessão expirada. Entre novamente.");
      return;
    }

    try {
      const resultado = await criarPendenteManual({
        data: {
          caller_token: token,
          nome: parsed.data.nome,
          tipo: parsed.data.tipo,
          documento: parsed.data.documento,
          email: parsed.data.email,
          celular: parsed.data.celular,
        },
      });
      onCriado(resultado.empresaId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar o cadastro.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <Icon id="edit" size={18} />
          <h3>Cadastro manual — exceção da Matriz</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <div className="acc-grid">
            {isExterno && (
              <div className="field-group full">
                <label htmlFor="mc-tipo">Documento</label>
                <select
                  id="mc-tipo"
                  className="input"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "pj" | "pf")}
                >
                  <option value="pj">Pessoa Jurídica (CNPJ) — franquia ou Master</option>
                  <option value="pf">Pessoa Física (CPF) — vendedor</option>
                </select>
              </div>
            )}
            <div className="field-group full">
              <label htmlFor="mc-nome">Nome{isExterno ? " / Razão social" : " completo"}</label>
              <input
                id="mc-nome"
                className="input"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={isExterno ? "Nome ou razão social" : "Nome do colaborador"}
              />
            </div>
            <div className="field-group">
              <label htmlFor="mc-doc">{isExterno && tipo === "pj" ? "CNPJ" : "CPF"}</label>
              <input
                id="mc-doc"
                className="input"
                value={documento}
                onChange={(e) => setDocumento(maskCpfCnpj(e.target.value))}
                placeholder={isExterno && tipo === "pj" ? "00.000.000/0001-00" : "000.000.000-00"}
                maxLength={isExterno && tipo === "pj" ? 18 : 14}
              />
            </div>
            <div className="field-group">
              <label htmlFor="mc-cel">Celular</label>
              <input
                id="mc-cel"
                className="input"
                value={celular}
                onChange={(e) => setCelular(maskTelefone(e.target.value))}
                placeholder="(11) 90000-0000"
                maxLength={15}
              />
            </div>
            <div className="field-group full">
              <label htmlFor="mc-email">E-mail</label>
              <input
                id="mc-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@email.com"
              />
            </div>
          </div>

          <div className="clt-note" style={{ marginTop: 10 }}>
            <Icon id="info" size={15} />
            <div>
              Uso para <strong>casos pontuais</strong> (carga inicial, urgência) — o caminho padrão
              é o <strong>Convite Supper</strong>. Toda criação por aqui fica{" "}
              <strong>registrada em log</strong> como exceção da Matriz.
            </div>
          </div>

          {erro && (
            <div className="banner alert" style={{ marginTop: 12 }}>
              {erro}
            </div>
          )}
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-yellow" type="button" onClick={enviar} disabled={enviando}>
            <Icon id="shield" size={14} /> {enviando ? "Enviando…" : "Continuar para classificação"}
          </button>
        </div>
      </div>
    </div>
  );
}
