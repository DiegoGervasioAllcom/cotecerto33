import { z } from "zod";

export type DashboardPeriodPreset = "dia" | "semana" | "quinzena" | "mes" | "personalizado";
export type DashboardCurrentPeriodPreset = Exclude<DashboardPeriodPreset, "personalizado">;

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateKey(value: string): Date | null {
  if (!dateKeyPattern.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function formatDate(value: string): string {
  return parseDateKey(value)?.toLocaleDateString("pt-BR") ?? value;
}

export const customDashboardPeriodSchema = z
  .object({
    startDate: z
      .string()
      .regex(dateKeyPattern, "Informe uma data inicial válida.")
      .refine((value) => parseDateKey(value) !== null, "Informe uma data inicial válida."),
    endDate: z
      .string()
      .regex(dateKeyPattern, "Informe uma data final válida.")
      .refine((value) => parseDateKey(value) !== null, "Informe uma data final válida."),
  })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: "A data inicial deve ser anterior ou igual à data final.",
    path: ["endDate"],
  });

export type CustomDashboardPeriodForm = z.infer<typeof customDashboardPeriodSchema>;

export type DashboardPeriodSelection =
  | {
      preset: DashboardCurrentPeriodPreset;
      label: string;
    }
  | {
      preset: "personalizado";
      startDate: string;
      endDate: string;
      label: string;
    };

const presetLabels: Record<DashboardCurrentPeriodPreset, string> = {
  dia: "Hoje",
  semana: "Últimos 7 dias",
  quinzena: "Últimos 15 dias",
  mes: "Mês atual",
};

export function defaultCustomPeriod(reference = new Date()): CustomDashboardPeriodForm {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, "0");
  const day = String(reference.getDate()).padStart(2, "0");
  const currentDate = `${year}-${month}-${day}`;
  return { startDate: currentDate, endDate: currentDate };
}

export function selectCurrentDashboardPeriod(
  preset: DashboardCurrentPeriodPreset,
): DashboardPeriodSelection {
  return { preset, label: presetLabels[preset] };
}

export function selectCustomDashboardPeriod(
  values: CustomDashboardPeriodForm,
): DashboardPeriodSelection {
  const parsed = customDashboardPeriodSchema.parse(values);
  return {
    preset: "personalizado",
    ...parsed,
    label: `${formatDate(parsed.startDate)} a ${formatDate(parsed.endDate)}`,
  };
}
