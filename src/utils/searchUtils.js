// Shared search helpers for every search box in the app.
//
// Two rules every search has to follow:
//
// 1. Case and accents never matter. "kamal", "Kamal" and "KAMAL" are the same
//    query, and "José" is found by typing "jose".
// 2. Typing is forgiving. Extra or missing spaces, tokens typed out of order
//    ("perera kamal" for "Kamal Perera") and formatting inside phone numbers
//    ("077-123 4567" vs "0771234567") still match.

/**
 * Lowercase, strip accents, collapse whitespace. The single normalisation
 * every comparison in the app goes through, so a query and the stored value
 * are always reduced the same way.
 */
export function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits only — lets "077 123 4567" match a stored "+94771234567". */
export function digitsOnly(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

/**
 * True when every whitespace-separated token of `query` appears somewhere in
 * `fields`. Every token must match (so more typing narrows the list), but the
 * order of the tokens doesn't, and an empty query matches everything.
 *
 * Numeric tokens are also tested against the digits-only form of the fields,
 * so a phone number matches however it was punctuated on either side.
 *
 *   matchesSearch("kamal 077", member.name, member.mobile, member.email)
 */
export function matchesSearch(query, ...fields) {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const flat = fields.flat(Infinity);
  const haystack = flat.map(normalizeText).filter(Boolean).join(" ");
  if (!haystack) return false;

  const digits = digitsOnly(haystack);

  return tokens.every((token) => {
    if (haystack.includes(token)) return true;
    if (!digits || !/^\d+$/.test(token)) return false;
    // A phone typed in local form ("0771234567") still matches a stored
    // international one ("+94771234567"), and vice versa.
    return digits.includes(token) || digits.includes(token.replace(/^0+/, ""));
  });
}

/**
 * Reusable predicate for `.filter()` when the same query is tested against
 * many rows:  members.filter(searchFilter(searchTerm, (m) => [m.name, m.email]))
 */
export function searchFilter(query, pick) {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return () => true;
  return (item) => matchesSearch(query, pick(item));
}
