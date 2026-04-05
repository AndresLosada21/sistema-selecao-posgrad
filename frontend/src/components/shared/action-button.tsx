import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonVariant = "primary" | "secondary" | "danger" | "danger-outline" | "ghost" | "link";

type ActionButtonProps = {
  variant?: ActionButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function getActionButtonClassName(
  variant: ActionButtonVariant = "primary",
  size: "sm" | "md" | "lg" = "md",
  loading = false,
) {
  const classes = ["action-btn", `action-btn--${variant}`, `action-btn--${size}`];
  if (loading) classes.push("action-btn--loading");
  return classes.join(" ");
}

export function ActionButton({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  icon,
  children,
  disabled,
  ...rest
}: ActionButtonProps) {
  return (
    <button
      className={getActionButtonClassName(variant, size, loading)}
      disabled={loading || disabled}
      {...rest}
    >
      {icon && !loading ? <span className="action-btn-icon">{icon}</span> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
