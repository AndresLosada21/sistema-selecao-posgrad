type StateProps = {
  title: string;
  description?: string;
};

const iconLoader = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const iconEmpty = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
    <path d="M8 11h6" />
  </svg>
);

const iconError = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

export function LoadingState({ title, description }: StateProps) {
  return (
    <section className="state-block" aria-live="polite">
      <div className="state-block-icon">{iconLoader}</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}

export function EmptyState({ title, description }: StateProps) {
  return (
    <section className="state-block">
      <div className="state-block-icon">{iconEmpty}</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}

export function ErrorState({ title, description }: StateProps) {
  return (
    <section className="state-block state-block-error" role="alert">
      <div className="state-block-icon">{iconError}</div>
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </section>
  );
}
