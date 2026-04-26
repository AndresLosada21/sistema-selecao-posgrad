import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type FormFieldProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, required, hint, error, children }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = `field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id: (child.props as { id?: string }).id ?? fieldId,
        required,
        "aria-required": required || undefined,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy,
      })
    : child;

  return (
    <div className="form-field">
      <label className="form-field-label" htmlFor={(isValidElement(child) && (child.props as { id?: string }).id) || fieldId}>
        {label}
        {required ? " *" : ""}
      </label>
      {control}
      {error ? (
        <span className="form-field-error" id={errorId}>{error}</span>
      ) : hint ? (
        <span className="form-field-hint" id={hintId}>{hint}</span>
      ) : null}
    </div>
  );
}
