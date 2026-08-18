import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * "Cargo (preset) + áreas ajustáveis" da Etapa 2 — o time interno da Matriz.
 *
 * O sentinela `""` é o "Vendedor Matriz (Modelo CLT)" do protótipo: fica FORA
 * dos presets de propósito (não é cargo de escopo, é a pessoa vendedora do
 * time interno — por isso o pai deste componente trata cargo="" chamando
 * `ProdutosCanaisFields` em vez de áreas).
 */

export type CargoOpcao = { id: string; nome: string };

export function useCargos() {
  const [cargos, setCargos] = useState<CargoOpcao[]>([]);
  useEffect(() => {
    supabase
      .from("cargos")
      .select("id,nome")
      .order("nome")
      .then(({ data }) => setCargos((data as CargoOpcao[]) ?? []));
  }, []);
  return cargos;
}

export function CargoAreasFields({
  cargos,
  cargoId,
  setCargoId,
  areas,
  setAreas,
  locked,
  initialAreas,
}: {
  cargos: CargoOpcao[];
  cargoId: string;
  setCargoId: (v: string) => void;
  areas: string[];
  setAreas: (v: string[]) => void;
  locked: boolean;
  /**
   * Áreas já conhecidas pelo chamador (ex.: override existente de um cadastro
   * já aprovado, na edição — C4). Usadas só na primeira montagem, no lugar de
   * buscar o preset do cargo; trocas de cargo feitas pelo usuário depois disso
   * continuam buscando o preset normalmente. Sem isto, abrir o editor de
   * alguém com áreas customizadas as substituiria pelo preset do cargo.
   */
  initialAreas?: string[];
}) {
  const [catalogoAreas, setCatalogoAreas] = useState<{ chave: string; label: string }[]>([]);
  const jaInicializou = useRef(false);
  // Guarda contra o efeito abaixo rodar mais de uma vez para o MESMO cargoId
  // (hidratação do TanStack Start invoca o efeito duas vezes mesmo sem
  // StrictMode explícito — confirmado via log: mesmo cargoId, mesma
  // initialAreas, duas execuções). Sem isto, a 2ª execução sempre cai no
  // branch de buscar o preset do cargo (porque `jaInicializou` já é true),
  // sobrescrevendo silenciosamente o override real da pessoa (`initialAreas`)
  // aplicado pela 1ª execução — o bug do supervisor que perdia a área
  // "Distribuição" ao reabrir o cadastro.
  const ultimoCargoProcessado = useRef<string | null>(null);

  useEffect(() => {
    supabase
      .from("areas")
      .select("chave,label")
      .eq("disponivel", true)
      .order("ordem")
      .then(({ data }) => setCatalogoAreas((data as { chave: string; label: string }[]) ?? []));
  }, []);

  // Carrega o preset do cargo sempre que ele muda — inclusive na primeira
  // renderização, quando o cargo já vem travado do convite (locked=true) e o
  // <select> nunca dispara onChange: sem isto, o pedido chegaria à aprovação
  // com o cargo certo mas nenhuma área marcada.
  useEffect(() => {
    if (ultimoCargoProcessado.current === cargoId) return;
    ultimoCargoProcessado.current = cargoId;

    if (!jaInicializou.current && initialAreas !== undefined) {
      jaInicializou.current = true;
      setAreas(initialAreas);
      return;
    }
    jaInicializou.current = true;
    if (!cargoId) {
      setAreas([]);
      return;
    }
    let ativo = true;
    supabase
      .from("cargo_areas")
      .select("area_chave")
      .eq("cargo_id", cargoId)
      .then(({ data }) => {
        if (ativo) setAreas(((data ?? []) as { area_chave: string }[]).map((r) => r.area_chave));
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só recarrega ao trocar de cargo
  }, [cargoId]);

  function toggleArea(chave: string) {
    setAreas(areas.includes(chave) ? areas.filter((a) => a !== chave) : [...areas, chave]);
  }

  function todasAreas() {
    const todas = catalogoAreas.map((a) => a.chave);
    setAreas(areas.length === todas.length ? [] : todas);
  }

  return (
    <>
      <div className="acc-sec-t">Cargo</div>
      <div className="acc-grid">
        <div className="field-group full">
          <label>Cargo (preset de escopo)</label>
          <select
            className="input"
            value={cargoId}
            disabled={locked}
            onChange={(e) => setCargoId(e.target.value)}
          >
            <option value="">Vendedor Matriz (Modelo CLT)</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {cargoId && (
        <>
          <div className="acc-sec-t" style={{ display: "flex", alignItems: "center" }}>
            Áreas liberadas{" "}
            <span className="muted small" style={{ fontWeight: 500 }}>
              &nbsp;— preenchidas pelo preset, ajuste se necessário
            </span>
            <button
              type="button"
              className="btn btn-yellow btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={todasAreas}
            >
              Todos
            </button>
          </div>
          <div className="acc-pills">
            {catalogoAreas.map((a) => (
              <button
                key={a.chave}
                type="button"
                className={`acc-pill ${areas.includes(a.chave) ? "on" : ""}`}
                onClick={() => toggleArea(a.chave)}
              >
                {areas.includes(a.chave) ? "✓ " : ""}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
