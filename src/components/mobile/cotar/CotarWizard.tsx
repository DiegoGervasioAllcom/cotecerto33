import { PASSOS } from "./passos";
import { PassoCoberturas } from "./PassoCoberturas";
import { PassoRevisar } from "./PassoRevisar";
import { PassoSegurado } from "./PassoSegurado";
import { PassoUso } from "./PassoUso";
import { PassoVeiculo } from "./PassoVeiculo";
import { useCotarMobile } from "./useCotarMobile";

export function CotarWizard() {
  const w = useCotarMobile();
  const { f, passo } = w;
  const ultimo = passo === PASSOS.length - 1;
  const marcaModelo = [
    w.marcas.find((m) => m.codigo === f.marca)?.nome,
    w.modelos.find((m) => String(m.codigo) === f.modelo)?.nome,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div className="m-steps">
        Passo {passo + 1} de {PASSOS.length} · <strong>{PASSOS[passo]}</strong>
        <div className="m-progress">
          <div
            className="m-progress-bar"
            style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }}
          />
        </div>
      </div>
      {passo === 0 && (
        <PassoSegurado
          f={f}
          up={w.up}
          erros={w.erros}
          cpfConsultando={w.cpf.consultando}
          cpfStatus={w.cpf.status}
          consultarCpf={(c) => void w.cpf.consultar(c)}
          cepLoading={w.cepLoading}
          lookupCep={(c) => void w.lookupCep(c)}
        />
      )}
      {passo === 1 && (
        <PassoVeiculo
          f={f}
          up={w.up}
          onRamo={w.onRamo}
          erros={w.erros}
          marcas={w.marcas}
          modelos={w.modelos}
          fipeValor={w.fipeValor}
          placaConsultando={w.placa.consultando}
          placaStatus={w.placa.status}
          placaVersoes={w.placa.versoes}
          consultarPlaca={(p) => void w.placa.consultar(p)}
          escolherVersao={(v) => void w.placa.escolherVersao(v)}
        />
      )}
      {passo === 2 && <PassoUso f={f} up={w.up} erros={w.erros} />}
      {passo === 3 && <PassoCoberturas f={f} />}
      {passo === 4 && (
        <PassoRevisar
          f={f}
          marcaModelo={marcaModelo}
          faltantes={w.calculo.camposFaltantes}
          erro={w.calculo.erro}
          calculando={w.calculo.calculando}
        />
      )}
      {w.erroPasso && <div className="m-state err">{w.erroPasso}</div>}
      <div className="m-actions">
        {passo > 0 && (
          <button
            type="button"
            className="m-btn"
            onClick={w.voltar}
            disabled={w.calculo.calculando}
          >
            Voltar
          </button>
        )}
        {ultimo ? (
          <button
            type="button"
            className="m-btn primary"
            onClick={() => void w.calcular()}
            disabled={w.calculo.calculando || !w.calculo.podeCalcular}
          >
            {w.calculo.calculando ? "Calculando…" : "Calcular"}
          </button>
        ) : (
          <button
            type="button"
            className="m-btn primary"
            onClick={() => void w.avancar()}
            disabled={w.salvando}
          >
            {w.salvando ? "Salvando…" : "Continuar"}
          </button>
        )}
      </div>
    </>
  );
}
