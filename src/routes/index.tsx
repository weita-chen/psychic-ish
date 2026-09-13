import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/components/game/landing";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Landing />;
}
