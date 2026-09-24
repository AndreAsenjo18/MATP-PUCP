import { useId, type TextareaHTMLAttributes } from "react";

import { Field, controlClassName, fieldIds, type FieldProps } from "./Field";

export interface TextareaProps extends FieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "children"> {
  fieldClassName?: string;
}

/** Texto de varias líneas con etiqueta visible, ayuda y error accesibles (RNF-010). */
export function Textarea({ label, hint, error, id, className, fieldClassName, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const ids = fieldIds(textareaId, { hint, error });
  return (
    <Field id={textareaId} label={label} hint={hint} error={error} ids={ids} className={fieldClassName}>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids.describedBy}
        className={controlClassName(Boolean(error), className)}
        {...props}
      />
    </Field>
  );
}
