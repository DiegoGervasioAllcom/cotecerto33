import { createFileRoute, Outlet } from "@tanstack/react-router";
import "@/styles/mobile.css";

// Layout do mini-app mobile: fica FORA do app-shell desktop (o shell é
// renderizado por cada página, não pelo layout _authenticated).
export const Route = createFileRoute("/_authenticated/m")({
  component: Outlet,
});
