import Link from "next/link";

type NavigationItem = {
  href: string;
  label: string;
};

type AppFrameProps = {
  title: string;
  description?: string;
  navigation: NavigationItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function AppFrame({ title, description, navigation, actions, children }: AppFrameProps) {
  return (
    <main className="app-frame">
      <header className="app-frame-header">
        <div className="app-frame-heading">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="app-frame-actions">{actions}</div> : null}
      </header>

      <nav className="app-frame-nav" aria-label="Navegacao principal">
        {navigation.map((item) => (
          <Link className="nav-link" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="app-frame-content">{children}</section>
    </main>
  );
}
