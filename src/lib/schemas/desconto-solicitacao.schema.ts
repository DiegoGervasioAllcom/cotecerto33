// Schema do pedido de desconto adicional (G3.3 — Solicitar desconto).
// Espelha a constraint da RPC solicitar_desconto: percentual entre 0 e 100.

import { z } from "zod";

export const pctPedidoSchema = z
  .number({ message: "Informe um número." })
  .min(0.01, "Informe um percentual maior que 0%.")
  .max(100, "Máximo 100%.");
