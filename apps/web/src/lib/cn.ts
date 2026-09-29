/** Une clases CSS ignorando valores vacíos (`false`, `null`, `undefined`, `""`). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
