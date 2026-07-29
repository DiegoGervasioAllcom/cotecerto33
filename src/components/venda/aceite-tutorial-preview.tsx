type AceiteTutorialPreviewMode = "aceite-aceita" | "aceite-pendencia";

const TIMELINES = {
  "aceite-aceita": [
    { label: "Enviada", when: "20/05 · 16:12" },
    { label: "Visualizada", when: "20/05 · 17:38" },
    { label: "Aceita pelo cliente", when: "hoje · 11:04" },
    { label: "Transmitida à seguradora", when: "—" },
    { label: "Apólice emitida", when: "—" },
  ],
  "aceite-pendencia": [
    { label: "Enviada", when: "17/05 · 15:20" },
    { label: "Visualizada", when: "17/05 · 16:01" },
    { label: "Aceita pelo cliente", when: "18/05 · 10:12" },
    { label: "Transmitida à seguradora", when: "19/05 · 09:14" },
    { label: "Apólice emitida", when: "—" },
  ],
} as const;

function TutorialTimeline({ mode }: { mode: AceiteTutorialPreviewMode }) {
  const current = mode === "aceite-pendencia" ? 3 : 2;
  const timeline = TIMELINES[mode];
  return (
    <div className="timeline" data-tour="aceite-timeline">
      <div className="row">
        <h3>Linha do tempo do aceite</h3>
        <span className="chip chip-outline">Exemplo do tutorial</span>
      </div>
      <div className="tl-steps tl-steps-5">
        {timeline.map((step, index) => (
          <div
            className={`tl-step ${index < current ? "done" : index === current ? "current" : "future"}`}
            key={step.label}
          >
            <div className="dot" />
            <div className="lbl">{step.label}</div>
            <div className="when">{index <= current ? step.when : "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AceiteConferenciaPreview() {
  return (
    <div className="confer-card" aria-readonly="true">
      <div className="row">
        <h3 style={{ margin: 0, color: "var(--slate)", fontSize: 16 }}>
          Conferência final dos dados
        </h3>
        <span className="chip chip-ok" style={{ marginLeft: 10 }}>
          Aceita pelo cliente
        </span>
        <span className="spacer" />
        <span className="chip chip-outline">Exemplo do tutorial</span>
      </div>

      <div className="confer-grid" data-tour="aceite-conferencia">
        <div className="confer-item">
          <div className="k">CLIENTE</div>
          <div className="v">Fernanda Souza</div>
        </div>
        <div className="confer-item">
          <div className="k">CPF · NASCIMENTO</div>
          <div className="v">247.193.802-09 · 14/04/1989</div>
        </div>
        <div className="confer-item">
          <div className="k">VEÍCULO</div>
          <div className="v">VW Polo Comfortline 2023</div>
        </div>
        <div className="confer-item">
          <div className="k">PLACA · FIPE</div>
          <div className="v">FRX-2H08 · R$ 142.380</div>
        </div>
        <div className="confer-item">
          <div className="k">SEGURADORA</div>
          <div className="v">Seguradora do exemplo · Apólice nova</div>
        </div>
        <div className="confer-item">
          <div className="k">VIGÊNCIA</div>
          <div className="v">23/05/2026 a 23/05/2027</div>
        </div>
        <div className="confer-item">
          <div className="k">PRÊMIO TOTAL</div>
          <div className="v">R$ 3.510</div>
        </div>
        <div className="confer-item">
          <div className="k">PAGAMENTO</div>
          <div className="v">12x R$ 292,50 · cartão de crédito</div>
        </div>
        <div className="confer-item" style={{ gridColumn: "1/-1" }}>
          <div className="k">COBERTURAS</div>
          <div className="v" style={{ fontSize: 13, fontWeight: 600 }}>
            Compreensiva · franquia R$ 3.000 · RCF 150k/150k · APP 5k · carro reserva 30 dias ·
            assistência padrão · vidros + pequenos reparos
          </div>
        </div>
      </div>

      <div className="confer-check" data-tour="aceite-checkbox">
        <input type="checkbox" id="tutorial-ok-conferi" disabled />
        <label htmlFor="tutorial-ok-conferi">
          <strong>Conferi todos os dados acima.</strong> Estou autorizado a transmitir a apólice à
          seguradora.
        </label>
      </div>

      <div className="confer-action">
        <button className="btn btn-ghost" type="button" disabled>
          Imprimir conferência
        </button>
        <span className="spacer" />
        <button
          className="btn btn-yellow"
          type="button"
          data-tour="aceite-transmitir"
          disabled
          style={{ opacity: 0.5 }}
        >
          Transmitir para a seguradora
        </button>
      </div>
    </div>
  );
}

function AceitePendenciaPreview() {
  return (
    <div className="confer-card" aria-readonly="true">
      <div className="row" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0, color: "var(--slate)", fontSize: 16 }}>Transmissão à seguradora</h3>
        <span className="chip chip-alert" style={{ marginLeft: 10 }}>
          Pendência da seguradora
        </span>
        <span className="spacer" />
        <span className="chip chip-outline">Exemplo do tutorial</span>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        A proposta já foi enviada e está em análise. Se a seguradora devolver uma pendência, ela
        aparece aqui para ser resolvida antes da emissão.
      </p>
      <div
        data-tour="aceite-pendencia"
        style={{
          background: "var(--alert-soft)",
          border: "1px solid #f3d6d2",
          borderRadius: 12,
          padding: "14px 16px",
          marginTop: 10,
        }}
        aria-readonly="true"
      >
        <div className="row" style={{ gap: 8, marginBottom: 6 }}>
          <strong style={{ color: "var(--alert)" }}>Pendência aberta</strong>
          <span className="spacer" />
          <span className="small muted">aberta hoje · 08:40 · prazo amanhã · 18:00</span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ink)" }}>
          Seguradora solicitou: CNH do condutor principal (foto legível) + comprovante de residência
          atualizado (até 90 dias).
        </p>
        <div className="field-group" style={{ marginBottom: 10 }}>
          <label>Resposta / resolução da pendência</label>
          <textarea
            className="input"
            rows={3}
            value=""
            placeholder="Descreva o que foi feito ou anexe a informação solicitada…"
            readOnly
          />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="small muted" style={{ fontWeight: 700 }}>
            Registrar resolução por:
          </span>
          <button className="btn btn-yellow btn-sm" type="button" disabled>
            Resolvi (Vendedor)
          </button>
          <button className="btn btn-slate btn-sm" type="button" disabled>
            Resolvido pela Matriz
          </button>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" type="button" disabled>
            Encaminhar p/ Matriz
          </button>
        </div>
      </div>
    </div>
  );
}

export function AceiteTutorialPreview({ mode }: { mode: AceiteTutorialPreviewMode }) {
  const pending = mode === "aceite-pendencia";
  const heading = pending
    ? {
        title: "Aceite & transmissão · Eduardo Lima",
        subtitle: "Proposta de exemplo · Porto Seguro · Toyota Hilux 2023",
      }
    : {
        title: "Aceite & transmissão · Fernanda Souza",
        subtitle: "Proposta de exemplo · Seguradora do exemplo · VW Polo 2023",
      };
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{heading.title}</h1>
          <div className="sub">{heading.subtitle}</div>
        </div>
      </div>
      <TutorialTimeline mode={mode} />
      {pending ? <AceitePendenciaPreview /> : <AceiteConferenciaPreview />}
    </>
  );
}
