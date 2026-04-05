import type { ReactNode } from "react";

type DescriptionItem = {
  label: string;
  value: ReactNode;
};

type DescriptionListProps = {
  items: DescriptionItem[];
};

export function DescriptionList({ items }: DescriptionListProps) {
  return (
    <div className="description-list">
      {items.map((item, index) => (
        <div
          className={`description-list-row ${index % 2 === 1 ? "description-list-row--striped" : ""}`}
          key={item.label}
        >
          <span className="description-list-label">{item.label}</span>
          <span className="description-list-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
