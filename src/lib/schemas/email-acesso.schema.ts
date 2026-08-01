import { z } from "zod";

const motivoBase = z.string().trim().min(3, "Informe ao menos 3 caracteres.");

export const pendenciaAcessoSchema = motivoBase.max(
  1000,
  "A pendência deve ter no máximo 1000 caracteres.",
);

export const recusaAcessoSchema = motivoBase.max(
  2000,
  "O motivo da recusa deve ter no máximo 2000 caracteres.",
);
