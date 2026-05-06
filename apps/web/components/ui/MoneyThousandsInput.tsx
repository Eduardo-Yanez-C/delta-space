"use client";

import { onMoneyIntegerInputChange } from "../../lib/chile-inputs";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (v: string) => void;
};

/** Miles con punto mientras se escribe (enteros). Enviar con `parseLocaleMoneyNumber` desde `chile-inputs`. */
export function MoneyThousandsInput({ value, onValueChange, className, ...rest }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className ?? "input-field"}
      value={value}
      onChange={(e) => onValueChange(onMoneyIntegerInputChange(e.target.value))}
      {...rest}
    />
  );
}
