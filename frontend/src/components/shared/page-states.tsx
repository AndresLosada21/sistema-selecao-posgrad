type StateProps = {
  title: string;
  description?: string;
};

export function LoadingState({ title, description }: StateProps) {
  return (
    <section className="state-block" aria-live="polite">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <section className="state-block">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}

export function ErrorState({ title, description }: StateProps) {
  return (
    <section className="state-block state-block-error" role="alert">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}
