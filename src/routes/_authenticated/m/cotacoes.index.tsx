import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileEstado, MobileShell } from "@/components/mobile/MobileShell";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import { useCotacoesRecentes } from "@/hooks/useCotacoesRecentes";
import {
  rotuloStatusCotacao,
  STATUS_COTACAO,
  type CotacaoStatus as Status,
} from "@/components/mobile/status";

export const Route = createFileRoute("/_authenticated/m/cotacoes/")({
  component: ListaMobile,
});

function ListaMobile() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"" | Status>("");
  const { rows, isLoading, isError, refetch } = useCotacoesRecentes(
    busca,
    status ? [status] : [],
    50,
  );

  return (
    <MobileShell titulo="Cotações">
      <input
        className="m-input"
        type="search"
        placeholder="Buscar por nome, modelo, placa ou nº"
        maxLength={60}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <select
        className="m-select"
        value={status}
        onChange={(e) => setStatus(e.target.value as "" | Status)}
        aria-label="Filtrar por status"
      >
        <option value="">Todos os status</option>
        {STATUS_COTACAO.map((s) => (
          <option key={s.valor} value={s.valor}>
            {s.rotulo}
          </option>
        ))}
      </select>

      {isLoading && <MobileEstado>Carregando…</MobileEstado>}
      {isError && (
        <MobileEstado erro>
          Não foi possível carregar.{" "}
          <button type="button" className="m-btn" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </MobileEstado>
      )}
      {!isLoading && !isError && rows.length === 0 && (
        <MobileEstado>Nenhuma cotação encontrada.</MobileEstado>
      )}
      {rows.map((r) => {
        const v = r.veiculo;
        const modelo = [v?.marca_nome, v?.modelo_nome, v?.ano_modelo].filter(Boolean).join(" ");
        return (
          <Link key={r.id} to="/m/cotacoes/$id" params={{ id: r.id }} className="m-card">
            <div className="m-card-top">
              <span>{cotNum(r.numero, r.criado_em)}</span>
              <span className="m-badge">{rotuloStatusCotacao(r.status)}</span>
            </div>
            <div className="m-card-title">{r.segurado?.nome ?? "Sem segurado"}</div>
            <div className="m-card-sub">{modelo || r.ramo}</div>
          </Link>
        );
      })}
    </MobileShell>
  );
}
