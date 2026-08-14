import { initialsFromName } from "@/lib/avatar";

interface AvatarProps {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  /** MJ-IA : style dédié (--mj), jamais une des couleurs joueur — cf doc/partie/spec.md. */
  isMj?: boolean;
}

export function Avatar({ name, color, size = "md", isMj = false }: AvatarProps) {
  const sizeClass = size === "sm" ? "avatar sm" : size === "lg" ? "avatar lg" : "avatar";
  const className = isMj ? `${sizeClass} mj` : sizeClass;

  return (
    <div className={className} style={isMj ? undefined : { background: color }} title={name}>
      {isMj ? "MJ" : initialsFromName(name)}
    </div>
  );
}
