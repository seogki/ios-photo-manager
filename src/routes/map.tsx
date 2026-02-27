import { createFileRoute } from "@tanstack/react-router";
import App from "../App";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return <App activeTab="map" />;
}
