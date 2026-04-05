import type { ReactNode } from "react";
import { EmptyState } from "./page-states";

type DataListProps<T> = {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataList<T>({
  items,
  renderItem,
  keyExtractor,
  emptyTitle = "Nenhum item encontrado",
  emptyDescription,
}: DataListProps<T>) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="data-list">
      {items.map((item) => (
        <div className="data-list-item" key={keyExtractor(item)}>
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
