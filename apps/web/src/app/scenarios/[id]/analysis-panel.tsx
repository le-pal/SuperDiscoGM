"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/SocketProvider";

type Status = "DRAFT" | "ANALYZING" | "READY";

interface Phase {
  id: string;
  order: number;
  title: string;
  summary: string;
  locationTag: string | null;
  npcTags: string[];
  exitConditions: string | null;
  secrets: string | null;
}

interface NotificationEvent {
  userId: string;
  type: string;
  data?: { scenarioId?: string };
}

// Étapes 2-3 · Analyse asynchrone [Q14] + scénario digéré, jouable immédiatement sans relecture
// obligatoire [Q15]. ANALYZING -> READY arrive par notification Socket.IO (apps/worker publie
// "scenario:ready" via Redis pub/sub, relayé par apps/web/src/server/notifications.ts vers la
// room user:<id>) plutôt que par un polling HTTP.
export function AnalysisPanel({ scenarioId, status, phases }: { scenarioId: string; status: Status; phases: Phase[] }) {
  const router = useRouter();
  const socket = useSocket();
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    if (!socket || status !== "ANALYZING") return;

    const onNotification = (event: NotificationEvent) => {
      if (event.type === "scenario:ready" && event.data?.scenarioId === scenarioId) {
        router.refresh();
      }
    };
    socket.on("notification", onNotification);
    return () => {
      socket.off("notification", onNotification);
    };
  }, [socket, status, scenarioId, router]);

  async function trigger(endpoint: "analyze" | "reanalyze") {
    if (triggering) return;
    setTriggering(true);
    await fetch(`/api/scenarios/${scenarioId}/${endpoint}`, { method: "POST" });
    setTriggering(false);
    router.refresh();
  }

  return (
    <>
      <div className="section">
        <div className="section-head"><h2>2 · Analyse</h2></div>
        {status === "DRAFT" && (
          <div className="card flex between center">
            <p className="muted" style={{ margin: 0 }}>Contenu prêt — lancez l&apos;analyse pour découper le scénario en scènes.</p>
            <button type="button" className="btn primary small" onClick={() => trigger("analyze")} disabled={triggering}>
              Lancer l&apos;analyse
            </button>
          </div>
        )}
        {status === "ANALYZING" && (
          <div className="card flex between center">
            <div className="flex center gap-12">
              <span className="spinner" />
              <div>
                <div style={{ fontWeight: 700 }}>Analyse en cours…</div>
                <div className="muted" style={{ fontSize: ".8rem" }}>Annotation et découpage en scènes — vous serez notifié à la fin.</div>
              </div>
            </div>
            <span className="badge status-pending">En cours</span>
          </div>
        )}
        {status === "READY" && (
          <div className="card flex between center">
            <p className="muted" style={{ margin: 0 }}>Scénario digéré et prêt. Contenu modifié depuis ? Relancez l&apos;analyse.</p>
            <button type="button" className="btn ghost small" onClick={() => trigger("reanalyze")} disabled={triggering}>
              Ré-analyser
            </button>
          </div>
        )}
      </div>

      {status === "READY" && (
        <div className="section">
          <div className="section-head">
            <h2>3 · Scénario digéré</h2>
            <span className="badge status-ok">Prêt — jouable immédiatement</span>
          </div>
          <p className="faint" style={{ fontSize: ".78rem", marginTop: -6 }}>
            Pas de relecture obligatoire en V1 : le découpage automatique ci-dessous est utilisé tel quel dès qu&apos;il est prêt.
          </p>

          <div className="card-grid" style={{ marginTop: 14 }}>
            {phases.map((phase) => (
              <div key={phase.id} className="card scene-card">
                <div className="flex between">
                  <h3 style={{ margin: 0 }}>{phase.title}</h3>
                  <span className="badge tag">#{phase.order + 1}</span>
                </div>
                <p className="muted" style={{ fontSize: ".85rem" }}>{phase.summary}</p>
                <div className="tags">
                  {phase.locationTag && <span className="badge tag">📍 {phase.locationTag}</span>}
                  {phase.npcTags.map((npc) => (
                    <span key={npc} className="badge tag">🧑 {npc}</span>
                  ))}
                  {phase.exitConditions && <span className="badge tag">→ {phase.exitConditions}</span>}
                  {phase.secrets && <span className="badge tag">🔒 {phase.secrets}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
