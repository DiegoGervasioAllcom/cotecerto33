import { useState } from "react";
import { maskAno, maskPlaca } from "@/components/venda/novo-lead/masks";
import type { StatusPlaca } from "@/components/venda/novo-lead/hooks/useConsultaPlaca";
import type { Form } from "@/components/venda/novo-lead/types";
import type { PrecificadorFipe } from "@/lib/placa-decodificador";
import { Campo, Escolha } from "./Campo";
import type { RamoMobile } from "./defaults";
import type { Up } from "./passos";

type Props = {
  f: Form;
  up: Up;
  onRamo: (r: RamoMobile) => void;
  erros: Record<string, string>;
  marcas: { codigo: string; nome: string }[];
  modelos: { codigo: number; nome: string }[];
  fipeValor: string;
  placaConsultando: boolean;
  placaStatus: StatusPlaca | null;
  placaVersoes: PrecificadorFipe[];
  consultarPlaca: (placa: string) => void;
  escolherVersao: (v: PrecificadorFipe) => void;
};

export function PassoVeiculo(p: Props) {
  const { f, up, erros } = p;
  const [manual, setManual] = useState(false);
  const identificado = !!f.marca && !!f.modelo && !!f.anoFab;
  const mostrarFipe = manual || (!identificado && !p.placaConsultando && f.placa.length >= 7);
  return (
    <>
      <Campo label="Tipo de veículo">
        <Escolha
          valor={f.ramo}
          onChange={(v) => p.onRamo(v === "Moto" ? "Moto" : "Automóvel")}
          opcoes={[
            { valor: "Automóvel", rotulo: "Auto" },
            { valor: "Moto", rotulo: "Moto" },
          ]}
        />
      </Campo>
      <Campo
        label="Placa"
        erro={erros.placa}
        dica={p.placaConsultando ? "Consultando placa…" : (p.placaStatus?.texto ?? null)}
      >
        <input
          className="m-input"
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          value={f.placa}
          onChange={(e) => {
            const v = maskPlaca(e.target.value);
            up("placa", v);
            if (v.length === 7) p.consultarPlaca(v);
          }}
          onBlur={() => p.consultarPlaca(f.placa)}
          placeholder="ABC1D23"
        />
      </Campo>
      {p.placaVersoes.length > 0 && (
        <div className="m-field">
          <span className="m-label">Escolha a versão do veículo</span>
          {p.placaVersoes.map((v) => (
            <button
              key={`${v.codigo}-${v.modelo}`}
              type="button"
              className="m-btn"
              onClick={() => p.escolherVersao(v)}
            >
              {v.modelo}
            </button>
          ))}
        </div>
      )}
      {identificado && !manual && (
        <div className="m-card">
          <div className="m-card-title">
            {p.marcas.find((m) => m.codigo === f.marca)?.nome ?? ""}{" "}
            {p.modelos.find((m) => String(m.codigo) === f.modelo)?.nome ?? ""}
          </div>
          <div className="m-card-sub">
            {f.anoModelo}
            {p.fipeValor ? ` · FIPE ${p.fipeValor}` : ""}
          </div>
          <button type="button" className="m-link" onClick={() => setManual(true)}>
            Corrigir pela tabela FIPE
          </button>
        </div>
      )}
      {mostrarFipe && (
        <>
          <Campo label="Marca (tabela FIPE)">
            <select
              className="m-select"
              value={f.marca}
              onChange={(e) => {
                up("marca", e.target.value);
                up("modelo", "");
              }}
            >
              <option value="">Selecione</option>
              {p.marcas.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Modelo">
            <select
              className="m-select"
              value={f.modelo}
              disabled={!f.marca}
              onChange={(e) => up("modelo", e.target.value)}
            >
              <option value="">Selecione</option>
              {p.modelos.map((m) => (
                <option key={m.codigo} value={String(m.codigo)}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Ano do modelo">
            <input
              className="m-input"
              inputMode="numeric"
              maxLength={4}
              value={f.anoModelo}
              onChange={(e) => up("anoModelo", maskAno(e.target.value))}
            />
          </Campo>
          <Campo label="Ano de fabricação" erro={erros.anoFab}>
            <input
              className="m-input"
              inputMode="numeric"
              maxLength={4}
              value={f.anoFab}
              onChange={(e) => up("anoFab", maskAno(e.target.value))}
            />
          </Campo>
        </>
      )}
    </>
  );
}
