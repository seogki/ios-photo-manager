import { createFileRoute } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/")({
  component: ManagerPage,
});

function ManagerPage() {
  return <App activeTab="manager" />;
}
