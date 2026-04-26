import Link from "next/link";

type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

type AdminBreadcrumbProps = {
  items: AdminBreadcrumbItem[];
};

export function AdminBreadcrumb({ items }: AdminBreadcrumbProps) {
  return (
    <nav aria-label="Caminho administrativo" className="admin-inline-breadcrumb">
      {items.map((item, index) => (
        <span className="admin-inline-breadcrumb-segment" key={`${item.label}-${index}`}>
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
