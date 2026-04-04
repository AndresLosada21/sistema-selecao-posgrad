type StatusBadgeProps = {
  children: React.ReactNode;
};

export function StatusBadge({ children }: StatusBadgeProps) {
  return <span className="status-badge">{children}</span>;
}
