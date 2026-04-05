type AvatarVariant = "navy" | "success" | "error" | "warning" | "info" | "muted";

type AvatarProps = {
  initials: string;
  variant?: AvatarVariant;
  size?: "sm" | "md" | "lg";
};

export function Avatar({ initials, variant = "navy", size = "md" }: AvatarProps) {
  return (
    <div className={`avatar avatar--${variant} avatar--${size}`}>
      <span>{initials.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}
