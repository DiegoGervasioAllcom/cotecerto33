// Linha de configuração com switch on/off (Auditoria, Notificações).
export function Toggle({
  title,
  desc,
  on,
  onChange,
}: {
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="crit-row">
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <div
        className={`switch ${on ? "on" : ""}`}
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
      >
        <span className="track" />
      </div>
    </div>
  );
}
