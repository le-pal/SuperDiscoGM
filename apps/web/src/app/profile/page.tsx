import { requireUser } from "@/server/authz";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "./avatar-picker";

// Portage de maquette/profil.html (étape 45 du PLAN.md) — gestion de l'avatar (couleur +
// initiales déduites du nom [Q50]). Cette couleur est aussi celle du contour des messages dans
// le chat (identification en un coup d'œil, cf doc/partie/spec.md) — d'où le rappel "où cet
// avatar apparaît" en bas de page.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <h1>Mon profil</h1>
      <p className="muted">L&apos;avatar identifie un utilisateur partout dans l&apos;app : chat, tableau de bord, gestion des utilisateurs.</p>

      <div className="card-grid" style={{ alignItems: "start" }}>
        <div className="card">
          <h3>Avatar actuel</h3>
          <div className="flex center gap-16" style={{ margin: "14px 0" }}>
            <Avatar name={user.name} color={user.avatarColor} size="lg" />
            <div>
              <div style={{ fontWeight: 700 }}>{user.name}</div>
              <div className="muted" style={{ fontSize: ".82rem" }}>{user.email}</div>
            </div>
          </div>
          <p className="faint" style={{ fontSize: ".75rem" }}>
            Cette couleur est aussi celle du contour de vos messages dans le chat — elle doit rester unique sur chaque table.
          </p>
        </div>

        <div className="card" style={{ gridColumn: "span 2" }}>
          <h3>Choisir un avatar (V1 — bibliothèque prédéfinie)</h3>
          <p className="muted" style={{ fontSize: ".82rem", marginBottom: 14 }}>
            Couleur + initiales, générées automatiquement à partir de votre nom. Cliquez une couleur pour la changer.
          </p>
          <AvatarPicker name={user.name} currentColor={user.avatarColor} />

          <div className="hr" />

          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Image personnalisée <span className="badge tag">Disponible à partir de la V2</span>
          </h3>
          <div className="upload-zone" style={{ opacity: 0.5, marginTop: 10 }}>
            <p style={{ marginBottom: 0 }}>
              📷 Importer une photo ou une illustration — désactivé en V1, cohérent avec l&apos;absence d&apos;images de contenu en V1.
            </p>
          </div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 28 }}>
        <div className="section-head">
          <h2>Où cet avatar apparaît</h2>
        </div>
        <div className="card flex gap-16 wrap">
          <div className="flex center gap-8">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <span className="muted" style={{ fontSize: ".85rem" }}>Chat de partie (contour des messages)</span>
          </div>
          <div className="flex center gap-8">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <span className="muted" style={{ fontSize: ".85rem" }}>Tableau de bord (participants)</span>
          </div>
          <div className="flex center gap-8">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <span className="muted" style={{ fontSize: ".85rem" }}>Gestion des utilisateurs (Admin)</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
