import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 : "middleware" est renommé "proxy" (voir doc/technique/architecture.md).
// Garde léger — présence du cookie seulement, pas d'appel DB ici. La vérification
// authoritative (session valide, non expirée) se fait dans chaque page/route via
// getCurrentUser() (src/server/auth.ts), jamais uniquement ici.
const SESSION_COOKIE = "session";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!login|invite|api/auth|api/invite|_next/static|_next/image|favicon.ico).*)",
  ],
};
