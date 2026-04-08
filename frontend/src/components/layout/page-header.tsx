import Link from "next/link";
import type { ReactNode } from "react";

type BreadcrumbSegment = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  breadcrumb?: BreadcrumbSegment[];
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ breadcrumb, title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      {breadcrumb?.length ? (
        <nav className="breadcrumb" aria-label="Caminho">
          {breadcrumb.map((seg, i) => (
            <span className="breadcrumb-segment" key={`${seg.label}-${i}`}>
              {i > 0 ? (
                <svg className="breadcrumb-separator" aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              ) : null}
              {seg.href ? (
                <Link href={seg.href} className="breadcrumb-link">{seg.label}</Link>
              ) : (
                <span className="breadcrumb-current">{seg.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="page-header-row">
        <div className="page-header-text">
          <h1 className="page-header-title">{title}</h1>
          {description ? <p className="page-header-description">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
