import { useId, type InputHTMLAttributes } from "react";

import { Field, controlClassName, fieldIds, type FieldProps } from "./Field";

export interface InputProps extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  fieldClassName?: string;
}

/** Campo de texto con etiqueta visible, ayuda y error accesibles (RNF-010). */
export function Input({ label, hint, error, id, className, fieldClassName, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const ids = fieldIds(inputId, { hint, error });
  return (
    <Field id={inputId} label={label} hint={hint} error={error} ids={ids} className={fieldClassName}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={controlClassName(Boolean(error), className)}
        {...props}
      />
    </Field>
  );
}
