import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  type CustomDashboardPeriodForm,
  type DashboardCurrentPeriodPreset,
  type DashboardPeriodSelection,
  customDashboardPeriodSchema,
  defaultCustomPeriod,
  selectCurrentDashboardPeriod,
  selectCustomDashboardPeriod,
} from "@/lib/dashboard-period";

type DashboardPeriodPickerProps = {
  value: DashboardPeriodSelection;
  onChange: (selection: DashboardPeriodSelection) => void;
};

const presets: { value: DashboardCurrentPeriodPreset; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "quinzena", label: "Quinzena" },
  { value: "mes", label: "Mês" },
];

export function DashboardPeriodPicker({ value, onChange }: DashboardPeriodPickerProps) {
  const defaults = value.preset === "personalizado" ? value : defaultCustomPeriod();
  const {
    register,
    handleSubmit,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<CustomDashboardPeriodForm>({
    resolver: zodResolver(customDashboardPeriodSchema),
    defaultValues: { startDate: defaults.startDate, endDate: defaults.endDate },
  });
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  function selectPreset(preset: DashboardCurrentPeriodPreset) {
    clearErrors();
    onChange(selectCurrentDashboardPeriod(preset));
  }

  const applyCustomPeriod = handleSubmit((values) => onChange(selectCustomDashboardPeriod(values)));

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-b">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="small muted" style={{ fontWeight: 800, letterSpacing: ".06em" }}>
            PERÍODO
          </span>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`acc-pill ${value.preset === preset.value ? "on" : ""}`}
              aria-pressed={value.preset === preset.value}
              onClick={() => selectPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
          <span className="small muted" style={{ marginLeft: 8 }}>
            de
          </span>
          <input
            className="input"
            type="date"
            aria-label="Data inicial"
            max={endDate}
            {...register("startDate")}
            style={{ width: "auto", padding: "6px 10px", fontSize: 12.5 }}
          />
          <span className="small muted">a</span>
          <input
            className="input"
            type="date"
            aria-label="Data final"
            min={startDate}
            {...register("endDate")}
            style={{ width: "auto", padding: "6px 10px", fontSize: 12.5 }}
          />
          <button type="button" className="btn btn-slate btn-sm" onClick={applyCustomPeriod}>
            Aplicar
          </button>
          <span className="chip chip-outline" style={{ marginLeft: "auto" }}>
            {value.label}
          </span>
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          O período vale para <strong>toda a visão</strong> — indicadores, gráficos e tabelas
          abaixo.
        </div>
        {(errors.startDate || errors.endDate) && (
          <div className="small" role="alert" style={{ color: "var(--alert)", marginTop: 8 }}>
            {errors.startDate?.message ?? errors.endDate?.message}
          </div>
        )}
      </div>
    </div>
  );
}
