/** Une clases condicionales: cx("a", cond && "b", undefined) → "a b". */
export function cx(
  ...values: Array<string | false | null | undefined | 0>
): string {
  return values.filter(Boolean).join(" ");
}
