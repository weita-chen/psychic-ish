import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoomView } from "@/components/game/room-view";
import { COPY } from "@/lib/game/copy";
import { loadSession, type Session } from "@/lib/session";

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

function RoomPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession(code));
    setReady(true);
  }, [code]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">{COPY.connecting}</div>
    );
  }

  return <RoomView code={code} initialSession={session} onNeedJoin={!session} />;
}
