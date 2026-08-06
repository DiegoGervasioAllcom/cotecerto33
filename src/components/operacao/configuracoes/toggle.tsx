// Linha de configuração com switch on/off (Auditoria, Notificações).
export function Toggle({
  title,
  desc,
  on,
  onChange,
  disabled = false,
}: {
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="crit-row">
      <div className="cr-body">
        <div className="cr-t">{title}</div>
        <div className="cr-d">{desc}</div>
      </div>
      <div
        className={`switch ${on ? "on" : ""}`}
        onClick={disabled ? undefined : () => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
      >
        <span className="track" />
      </div>
    </div>
  );
}
