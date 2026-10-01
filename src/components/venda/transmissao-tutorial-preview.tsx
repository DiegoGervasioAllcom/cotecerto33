// Preview estático da Etapa 7 (Transmissão) para o tutorial do vendedor
// (V12.3.10) — usado quando `useTutorialPreview()` volta
// "lead-transmissao-dados" (sub-passo 0 · Dados complementares) ou
// "lead-transmissao-confirmacao" (sub-passo 1 · Confirmação). Mesmo padrão
// de `aceite-tutorial-preview.tsx`: markup estático com as classes reais
// (`.acc-sol`, `.wizard-grid`, `.ff-table`, `.wizard-foot`), sem nenhum dado
// novo além do exemplo já usado nos outros previews (Fernanda Souza · VW
// Polo 2023 · Seguradora do exemplo).
function ResumoTransmissao() {
  return (
    <div className="acc-sol" data-tour="transmissao-resumo" style={{ marginBottom: 16 }}>
      <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <span className="muted small">Cotação</span>
          <br />
          <strong>Fernanda Souza</strong>
        </div>
        <div>
          <span className="muted small">Seguradora</span>
          <br />
          <strong>Seguradora do exemplo</strong>
        </div>
        <div>
          <span className="muted small">Pagamento</span>
          <br />
          <strong>Boleto Bancário · à vista</strong>
        </div>
        <div>
          <span className="muted small">Vigência</span>
          <br />
          <strong>23/05/2026 a 23/05/2027</strong>
        </div>
        <div>
          <span className="muted small">Modalidade</span>
          <br />
          <strong>Valor de Mercado · 100% FIPE</strong>
        </div>
        <span className="chip chip-outline">Exemplo do tutorial</span>
      </div>
    </div>
  );
}

export function TransmissaoDadosTutorialPreview() {
  return (
    <div className="lead-shell">
      <div className="wizard-card" aria-readonly="true">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0 }}>Dados complementares</h2>
          <div className="sub" style={{ margin: "4px 0 0" }}>
            Confira apenas os dados exigidos para transmitir a proposta à seguradora.
          </div>
        </div>

        <ResumoTransmissao />

        <div className="acc-sec-t">Dados básicos do segurado</div>
        <div className="wizard-grid cols-3" data-tour="transmissao-dados">
          <div className="field-group">
            <label>CPF</label>
            <input className="input" value="247.193.802-09" disabled />
          </div>
          <div className="field-group">
            <label>Nome do segurado</label>
            <input className="input" value="Fernanda Souza" disabled />
          </div>
          <div className="field-group">
            <label>RG</label>
            <input className="input" value="32.481.905-7" disabled />
          </div>
          <div className="field-group">
            <label>Órgão emissor</label>
            <input className="input" value="SSP" disabled />
          </div>
          <div className="field-group">
            <label>Telefone</label>
            <input className="input" value="(11) 98421-3390" disabled />
          </div>
          <div className="field-group">
            <label>E-mail</label>
            <input className="input" value="fernanda.souza@exemplo.com" disabled />
          </div>
        </div>

        <div className="wizard-foot">
          <button className="btn btn-ghost" type="button" disabled>
            Voltar ao cálculo
          </button>
          <span className="spacer" />
          <button className="btn btn-yellow" type="button" disabled>
            Efetivar
          </button>
        </div>
      </div>
    </div>
  );
}

export function TransmissaoConfirmacaoTutorialPreview() {
  return (
    <div className="lead-shell">
      <div className="wizard-card" aria-readonly="true">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0 }}>Confirmação — Auto Completo</h2>
          <div className="sub" style={{ margin: "4px 0 0" }}>
            Confira antes de transmitir — depois disso a seguradora assume o processo.
          </div>
        </div>

        <ResumoTransmissao />

        <div
          className="wizard-grid"
          data-tour="transmissao-confirmacao"
          style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}
        >
          <div>
            <div>
              <div className="acc-sec-t">Dados do veículo</div>
              <table className="table-pipe ff-table">
                <tbody>
                  <tr>
                    <td className="ff-k">Modelo</td>
                    <td className="ff-v">VW Polo Comfortline 2023</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Código Fipe</td>
                    <td className="ff-v">—</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Placa</td>
                    <td className="ff-v">FRX-2H08</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Chassi</td>
                    <td className="ff-v">—</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Valor Fipe</td>
                    <td className="ff-v">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <div className="acc-sec-t">Coberturas</div>
              <table className="table-pipe ff-table">
                <tbody>
                  <tr>
                    <td className="ff-k">Danos Materiais</td>
                    <td className="ff-v">R$ 100.000,00</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Danos Corporais</td>
                    <td className="ff-v">R$ 100.000,00</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Danos Morais</td>
                    <td className="ff-v">R$ 10.000,00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div>
              <div className="acc-sec-t">Perfil</div>
              <table className="table-pipe ff-table">
                <tbody>
                  <tr>
                    <td className="ff-k">Sexo do segurado</td>
                    <td className="ff-v">Masculino</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Estado civil</td>
                    <td className="ff-v">Casado</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Sexo do condutor</td>
                    <td className="ff-v">Masculino</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Garagem na residência</td>
                    <td className="ff-v">Sim, com portão manual</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Garagem ao ir ao trabalho</td>
                    <td className="ff-v">Não trabalha</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Garagem ao ir à faculdade/colégio</td>
                    <td className="ff-v">Não estuda</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Tipo de uso</td>
                    <td className="ff-v">Particular</td>
                  </tr>
                  <tr>
                    <td className="ff-k">Utilização do veículo</td>
                    <td className="ff-v">Particular</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="acc-sec-t">Prêmio</div>
            <table className="table-pipe ff-table">
              <tbody>
                <tr>
                  <td className="muted small">Forma de pagamento</td>
                  <td>Boleto Bancário</td>
                </tr>
                <tr>
                  <td className="muted small">Parcelas</td>
                  <td>À vista</td>
                </tr>
                <tr>
                  <td className="muted small">Prêmio</td>
                  <td>
                    <strong>R$ 3.510,00</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="clt-note" style={{ marginTop: 14 }}>
          <svg width="15" height="15">
            <use href="#i-info" />
          </svg>
          <div>
            Protocolo, orçamento e fator de ajuste do portal só aparecem depois da transmissão.
          </div>
        </div>

        <div className="wizard-foot">
          <button className="btn btn-ghost" type="button" disabled>
            Voltar
          </button>
          <span className="spacer" />
          <button
            className="btn btn-yellow"
            type="button"
            data-tour="transmissao-efetivar"
            disabled
          >
            <svg width="14" height="14">
              <use href="#i-send" />
            </svg>{" "}
            Confirmar e transmitir
          </button>
        </div>
      </div>
    </div>
  );
}
