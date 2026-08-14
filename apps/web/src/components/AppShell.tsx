import type { ReactNode } from "react";
import type { User } from "@superdiscogm/db";
import { TopNav } from "./TopNav";
import { RoleBadge } from "./RoleBadge";
import { Avatar } from "./Avatar";
import { SocketProvider } from "./SocketProvider";

interface AppShellProps {
  user: User;
  wide?: boolean;
  children: ReactNode;
}

// Layout partagé par toutes les pages hors /login et /invite/[token] (étape 9 du PLAN.md).
export function AppShell({ user, wide = false, children }: AppShellProps) {
  return (
    <SocketProvider>
      <div className="app-shell">
        <div className="topbar">
          <div className="brand">
            <span className="dot" /> SuperDiscoGM
          </div>
          <TopNav role={user.role} />
          <div className="flex center gap-8">
            <RoleBadge role={user.role} />
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
          </div>
        </div>
        <div className={wide ? "page wide" : "page"}>{children}</div>
      </div>
    </SocketProvider>
  );
}
