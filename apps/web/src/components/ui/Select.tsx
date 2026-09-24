import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

import { Field, controlClassName, fieldIds, type FieldProps } from "./Field";

export interface SelectProps extends FieldProps, SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  fieldClassName?: string;
}

/** Lista desplegable con etiqueta visible, ayuda y error accesibles (RNF-010). */
export function Select({ label, hint, error, id, className, fieldClassName, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const ids = fieldIds(selectId, { hint, error });
  return (
    <Field id={selectId} label={label} hint={hint} error={error} ids={ids} className={fieldClassName}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={controlClassName(Boolean(error), className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
