/**
 * Synthetic, stable, sortable ids for the mock fixtures (change maqueta-ui-navegable).
 *
 * They follow the same shape used in the OpenAPI examples (docs/api/openapi.json) so that a
 * fixture id "looks like" a real one, without pretending to be a valid UUIDv7. Nothing here
 * is derived from, or resembles, real museum data (RNF-014).
 */
function id(group: string, n: number): string {
  const g = group.padStart(4, "0").slice(0, 4);
  const suffix = n.toString().padStart(12, "0").slice(0, 12);
  return `0f1c0000-0000-7000-${g}-${suffix}`;
}

export const ids = {
  role: (n: number) => id("1", n),
  user: (n: number) => id("2", n),
  vocabulary: (n: number) => id("3", n),
  term: (n: number) => id("4", n),
  identifierType: (n: number) => id("5", n),
  location: (n: number) => id("6", n),
  collection: (n: number) => id("7", n),
  piece: (n: number) => id("8", n),
  identifier: (n: number) => id("9", n),
  media: (n: number) => id("a", n),
  movement: (n: number) => id("b", n),
  sourceRecord: (n: number) => id("c", n),
  audit: (n: number) => id("d", n),
  changeSet: (n: number) => id("e", n),
  aiSuggestion: (n: number) => id("f", n),
  importBatch: (n: number) => id("11", n),
  importRow: (n: number) => id("12", n),
  duplicate: (n: number) => id("13", n),
};
