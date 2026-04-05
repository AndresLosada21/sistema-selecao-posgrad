type SummaryItem = {
  label: string;
  value: string | number;
  color?: string;
};

type SummaryGridProps = {
  items: SummaryItem[];
};

export function SummaryGrid({ items }: SummaryGridProps) {
  return (
    <div className="summary-grid">
      {items.map((item) => (
        <article className="summary-card" key={item.label}>
          <span className="summary-card-label">{item.label}</span>
          <strong className="summary-card-value" style={item.color ? { color: item.color } : undefined}>
            {item.value}
          </strong>
        </article>
      ))}
    </div>
  );
}
