import type { ReactNode } from "react";
import type { StatusVariant } from "./status-variant-map";

type StatusBadgeShape = "pill" | "tag";

type StatusBadgeProps = {
  variant?: StatusVariant;
  shape?: StatusBadgeShape;
  children: ReactNode;
};

export function StatusBadge({ variant = "neutral", shape = "pill", children }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${variant} status-badge--${shape}`}>
      {children}
    </span>
  );
}
