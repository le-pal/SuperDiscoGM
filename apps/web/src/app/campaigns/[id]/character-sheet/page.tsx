import { prisma } from "@superdiscogm/db";
import { requireUser } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { toCharacterSheetView, formatLogEntry } from "@/lib/characterSheet";
import { NewSheetForm } from "./new-sheet-form";
import { LevelUpButton } from "./level-up-button";

// Portage de maquette/fiche-personnage.html (étape 28). Version simplifiée V1 [Q30], une fiche
// par campagne [Q47], éditée en jeu uniquement par tool-call déterministe du MJ-IA [Q31][Q31b] —
// jamais par texte libre, d'où le journal des modifications qui fait référence.
export const dynamic = "force-dynamic";

const STAT_LABELS = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"];

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export default async function CharacterSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    return (
      <AppShell user={user}>
        <p className="muted">Campagne introuvable.</p>
      </AppShell>
    );
  }

  const record = await prisma.characterSheet.findUnique({
    where: { userId_campaignId: { userId: user.id, campaignId } },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  if (!record) {
    return (
      <AppShell user={user}>
        <h1>Fiche de personnage</h1>
        <p className="muted" style={{ marginBottom: 16 }}>Campagne « {campaign.name} »</p>
        <NewSheetForm campaignId={campaignId} />
      </AppShell>
    );
  }

  const sheet = toCharacterSheetView(record);
  const pct = sheet.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((sheet.hp / sheet.hpMax) * 100))) : 0;

  return (
    <AppShell user={user}>
      <div className="flex center gap-16" style={{ marginBottom: 24 }}>
        <Avatar name={sheet.name} color={user.avatarColor} size="lg" />
        <div>
          <h1 style={{ marginBottom: 2 }}>{sheet.name}</h1>
          <p className="muted">
            {sheet.race} {sheet.className} · Niveau {sheet.level} · Campagne « {campaign.name} »
          </p>
        </div>
        <LevelUpButton sheetId={sheet.id} />
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>Points de vie</h3>
          <div className="pv-bar" style={{ height: 16, marginBottom: 6 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="muted" style={{ fontSize: ".85rem" }}>{sheet.hp} / {sheet.hpMax} PV</div>
          {sheet.conditions.length > 0 && (
            <div className="flex gap-8 wrap" style={{ marginTop: 10 }}>
              {sheet.conditions.map((c) => (
                <span key={c} className="badge tag">{c}</span>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Caractéristiques</h3>
          <div className="stat-grid">
            {STAT_LABELS.map((label) => (
              <div key={label} className="stat-box">
                <div className="val">{formatModifier(sheet.stats[label] ?? 0)}</div>
                <div className="lab">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Classe d&apos;armure</h3>
          <div className="stat-box">
            <div className="val">{sheet.ac}</div>
            <div className="lab">CA</div>
          </div>
        </div>

        <div className="card">
          <h3>Inventaire</h3>
          {sheet.inventory.length === 0 ? (
            <p className="muted" style={{ fontSize: ".87rem" }}>(vide)</p>
          ) : (
            <p className="muted" style={{ fontSize: ".87rem" }}>
              {sheet.inventory.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(", ")}
            </p>
          )}
        </div>

        <div className="card">
          <h3>Emplacements de sorts</h3>
          {Object.keys(sheet.spellSlots).length === 0 ? (
            <p className="muted" style={{ fontSize: ".87rem" }}>(aucun)</p>
          ) : (
            <div className="flex gap-16">
              {Object.entries(sheet.spellSlots).map(([level, remaining]) => (
                <div key={level} className="stat-box" style={{ flex: 1 }}>
                  <div className="val">{remaining}</div>
                  <div className="lab">Niv. {level}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Journal des modifications</h3>
          {record.logs.length === 0 ? (
            <p className="muted" style={{ fontSize: ".82rem" }}>(aucune modification pour l&apos;instant)</p>
          ) : (
            <p className="muted" style={{ fontSize: ".82rem" }}>
              {record.logs.map((log) => (
                <span key={log.id}>
                  {formatLogEntry(log)}
                  <br />
                </span>
              ))}
            </p>
          )}
          <p className="faint" style={{ fontSize: ".72rem", marginTop: 8 }}>
            Chaque ligne correspond à un outil déterministe appelé par le MJ-IA, jamais à une improvisation en texte libre.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
