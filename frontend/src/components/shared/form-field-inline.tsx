import type { ReactNode } from "react";

type FormFieldInlineProps = {
  label: string;
  children: ReactNode;
};

export function FormFieldInline({ label, children }: FormFieldInlineProps) {
  return (
    <label className="form-field-inline">
      {children}
      <span>{label}</span>
    </label>
  );
}
