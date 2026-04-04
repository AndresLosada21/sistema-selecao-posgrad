type SectionCardProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-card-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
