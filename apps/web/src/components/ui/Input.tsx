import { useId, type InputHTMLAttributes } from "react";

import { Field, controlClassName, fieldIds, type ControlSize, type FieldProps } from "./Field";

export interface InputProps extends FieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  fieldClassName?: string;
  /** Alto del campo: 44 px (`md`, por defecto) o 52 px (`lg`). */
  controlSize?: ControlSize;
}

/** Campo de texto con etiqueta visible, ayuda y error accesibles (RNF-010). */
export function Input({ label, hint, error, id, className, fieldClassName, controlSize, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const ids = fieldIds(inputId, { hint, error });
  return (
    <Field id={inputId} label={label} hint={hint} error={error} ids={ids} className={fieldClassName}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={controlClassName(Boolean(error), className, controlSize)}
        {...props}
      />
    </Field>
  );
}
