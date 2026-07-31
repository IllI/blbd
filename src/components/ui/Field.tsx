'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

type InputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;

export function Input({ label, hint, error, id, ...rest }: InputProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const describedBy = hint ? `${fieldId}-hint` : error ? `${fieldId}-error` : undefined;

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...rest}
        id={fieldId}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && !error && (
        <span className="field__hint" id={`${fieldId}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${fieldId}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

type TextareaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export function Textarea({ label, hint, error, id, ...rest }: TextareaProps) {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <textarea
        {...rest}
        id={fieldId}
        className="textarea"
        aria-invalid={error ? true : undefined}
      />
      {hint && !error && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label: string;
  description?: string;
}

export function Checkbox({ label, description, ...rest }: CheckboxProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      <span>
        <strong>{label}</strong>
        {description}
      </span>
    </label>
  );
}
