function normalizeCakeSizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/["″]/g, ' inch ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cakeSizeHasNoCustomizations(name?: string) {
  if (!name) return false;

  return /^4 (?:inch|inches|in) 2 layers?(?: cake)?$/.test(normalizeCakeSizeName(name));
}
