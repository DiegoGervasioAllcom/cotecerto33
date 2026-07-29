export function PropostaAjusteTutorialPreview() {
  return (
    <div className="prop-section" data-tour="proposta-versao" aria-readonly="true">
      <h4>
        <span className="num">1</span> Ajuste fino de cobertura
      </h4>
      <div className="wizard-grid">
        <div className="field-group">
          <label>Franquia · casco</label>
          <select className="input" value="R$ 3.000" disabled>
            <option>R$ 3.000</option>
          </select>
        </div>
        <div className="field-group">
          <label>RCF · danos materiais</label>
          <select className="input" value="R$ 150.000" disabled>
            <option>R$ 150.000</option>
          </select>
        </div>
        <div className="field-group">
          <label>Carro reserva</label>
          <select className="input" value="30 dias" disabled>
            <option>30 dias</option>
          </select>
        </div>
        <div className="field-group">
          <label>Assistência</label>
          <select className="input" value="Padrão (guincho 100km)" disabled>
            <option>Padrão (guincho 100km)</option>
          </select>
        </div>
      </div>
      <span className="switch on" style={{ marginTop: 4 }}>
        <span className="track" />
        <span className="label">Pequenos reparos (incluído na V3)</span>
      </span>
    </div>
  );
}

export function PropostaEnvioTutorialPreview() {
  return (
    <button type="button" className="btn btn-yellow" data-tour="proposta-enviar" disabled>
      Enviar nova versão (V3) ao cliente
    </button>
  );
}
