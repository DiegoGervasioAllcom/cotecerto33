// Aba "Desligamentos" — histórico de usuários desligados.
import type { Deslig } from "./types";

export function DesligamentosTab({ deslig }: { deslig: Deslig[] }) {
  return (
    <div className="card">
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Email</th>
              <th>Motivo</th>
              <th>Desligado em</th>
            </tr>
          </thead>
          <tbody>
            {deslig.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  Nenhum desligamento registrado.
                </td>
              </tr>
            )}
            {deslig.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.nome}</strong>
                </td>
                <td>{d.email}</td>
                <td>{d.desligado_motivo ?? "—"}</td>
                <td>{new Date(d.desligado_em).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
