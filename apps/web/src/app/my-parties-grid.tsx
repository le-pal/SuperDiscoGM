"use client";

import { Avatar } from "@/components/Avatar";
import { useDashboardPresence } from "@/hooks/useDashboardPresence";

interface PartyCardData {
  partyId: string;
  status: string;
  campaign: { id: string; name: string };
  scenario: { id: string; title: string };
  currentPhase: { id: string; title: string; order: number } | null;
  participants: { id: string; name: string; avatarColor: string; role: string }[];
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "En direct", PAUSED: "En pause", ENDED: "Terminée" };

// "Il y a déjà quelqu'un dessus" [Q49] — indicateur de présence câblé côté UI (étape 39) via
// useDashboardPresence (poll léger, pas de flux poussé dédié, mécanique précise TBD [Q49b]).
export function MyPartiesGrid({ parties }: { parties: PartyCardData[] }) {
  const presence = useDashboardPresence(parties.map((p) => p.partyId));

  if (parties.length === 0) {
    return <p className="muted">Vous ne participez à aucune partie pour l&apos;instant.</p>;
  }

  return (
    <div className="card-grid">
      {parties.map((p) => {
        const online = presence[p.partyId] ?? [];
        return (
          <div key={p.partyId} className="card">
            <div className="flex between">
              <h3>{p.campaign.name}</h3>
              <span className={`badge ${p.status === "ACTIVE" ? "status-ok" : "tag"}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{p.scenario.title}</p>
            <div className="flex gap-8" style={{ margin: "10px 0" }}>
              {p.participants.map((participant) => (
                <Avatar key={participant.id} name={participant.name} color={participant.avatarColor} size="sm" />
              ))}
            </div>
            {p.currentPhase && (
              <p className="faint" style={{ fontSize: ".78rem" }}>Chapitre actif : « {p.currentPhase.title} »</p>
            )}
            {online.length > 0 && (
              <p className="faint" style={{ fontSize: ".78rem" }}>🟢 {online.length} connecté(s) en ce moment</p>
            )}
            <div className="flex gap-8" style={{ marginTop: 12 }}>
              <a className="btn primary small" href={`/party/${p.partyId}`}>Reprendre</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
