// Modal "Ver" do Master em xAcessos — só-leitura, sem os modos
// configurar/excluir do FullMemberModal (o Master não edita nem desliga
// direto: ele só solicita desligamento à Matriz, via SolicitarDesligamentoModal).
import { Icon } from "@/components/operacao/acessos/icon";
import type { MembroEquipe } from "./use-team-data";

export function MasterMemberModal({
  membro,
  onClose,
}: {
  membro: MembroEquipe;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-host"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-h">
          <Icon id="user" size={18} />
          <h3>Cadastro — {membro.nome}</h3>
          <div className="x" onClick={onClose} role="button" aria-label="Fechar">
            <Icon id="x" size={18} />
          </div>
        </div>
        <div className="modal-b">
          <table className="table-pipe">
            <tbody>
              <tr>
                <td>Nome</td>
                <td>{membro.nome}</td>
              </tr>
              <tr>
                <td>Tipo</td>
                <td>{membro.tipoLabel}</td>
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
                <td>Supervisão</td>
                <td>{membro.supervisaoLabel}</td>
              </tr>
              <tr>
                <td>Comissão</td>
                <td>{membro.comissao == null ? "Modelo do time" : `${membro.comissao}%`}</td>
              </tr>
              <tr>
                <td>Status</td>
                <td>{membro.desligado_em ? "Desligado" : "Ativo"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="modal-f">
          <button className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
