import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, required, hint, error, children }: FormFieldProps) {
  return (
    <label className="form-field">
      <span className="form-field-label">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {error ? (
        <span className="form-field-error">{error}</span>
      ) : hint ? (
        <span className="form-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
