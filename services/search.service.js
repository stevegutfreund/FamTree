const path = require("path");
const FILE = path.basename(__filename).split(".js")[0].toUpperCase();

module.exports = {
  fuzzySearch,
  hebrewNormalize,
  calculateSimilarity,
  smartSearch,
  swapKeyboardLayout,
};

/**
 * Normalize Hebrew text for better searching
 */
function hebrewNormalize(text) {
  if (!text) return "";

  return (
    text
      // Remove nikud (vowel marks)
      .replace(/[\u0591-\u05C7]/g, "")
      // Normalize Hebrew characters
      .replace(/ך/g, "כ")
      .replace(/ם/g, "מ")
      .replace(/ן/g, "נ")
      .replace(/ף/g, "פ")
      .replace(/ץ/g, "צ")
      // Remove extra whitespace
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
  );
}

/**
 * All the text fields on a member that a search term may match against
 */
function getSearchableFields(member) {
  return [
    member.name,
    member.englishNickname,
    member.englishSurname,
    member.calendarName,
    member.hebrewNickname,
    member.hebrewSurname,
  ].filter(Boolean);
}

/**
 * Best similarity between a search term and any of a member's searchable fields
 */
function memberSimilarity(member, searchTerm) {
  return Math.max(
    0,
    ...getSearchableFields(member).map((field) =>
      calculateSimilarity(field, searchTerm)
    )
  );
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(str1, str2) {
  const normalized1 = hebrewNormalize(str1);
  const normalized2 = hebrewNormalize(str2);

  if (normalized1 === normalized2) return 1.0;

  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return 0.8;
  }

  // Levenshtein distance for fuzzy matching
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) return 1.0;

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Fuzzy search in members array
 */
function fuzzySearch(members, searchTerm, threshold = 0.6) {
  if (!searchTerm || searchTerm.trim() === "") {
    return members;
  }

  const results = members
    .map((member) => ({
      ...member,
      similarity: memberSimilarity(member, searchTerm),
    }))
    .filter((member) => member.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);

  return results;
}

/**
 * Same physical keys, other keyboard layout (standard Israeli Hebrew layout):
 * "tcrvo" typed with the keyboard left in English is "אברהם", and the other
 * way round "שרט" is "ary".
 */
const EN_KEYS = "qwertyuiopasdfghjkl;'zxcvbnm,./";
const HE_KEYS = "/'קראטוןםפשדגכעיחלךף,זסבהנמצתץ.";
const EN_TO_HE = {};
const HE_TO_EN = {};
for (let i = 0; i < EN_KEYS.length; i++) {
  EN_TO_HE[EN_KEYS[i]] = HE_KEYS[i];
  // Hebrew letters only, so "," "." "/" "'" keep their usual meaning.
  if (/[א-ת]/.test(HE_KEYS[i])) HE_TO_EN[HE_KEYS[i]] = EN_KEYS[i];
}

function swapKeyboardLayout(text) {
  const t = text.toLowerCase();
  if (/[א-ת]/.test(t) && !/[a-z]/.test(t)) {
    return [...t].map((c) => HE_TO_EN[c] || c).join("");
  }
  if (/[a-z]/.test(t) && !/[א-ת]/.test(t)) {
    return [...t].map((c) => EN_TO_HE[c] || c).join("");
  }
  return null;
}

/**
 * Smart search with multiple strategies.  The term is also tried as if typed
 * on the other keyboard layout; matches of either are merged tier by tier, so
 * an exact match on the converted term beats a fuzzy match on the raw one.
 */
function smartSearch(members, searchTerm) {
  if (!searchTerm || searchTerm.trim() === "") {
    return { exact: [], fuzzy: [], all: members };
  }

  const swapped = swapKeyboardLayout(searchTerm.trim());
  if (!swapped || swapped === searchTerm.trim()) {
    return smartSearchOne(members, searchTerm);
  }
  const a = smartSearchOne(members, searchTerm);
  const b = smartSearchOne(members, swapped);
  const seen = new Set();
  const merged = {};
  for (const tier of ["exact", "startsWith", "contains", "fuzzy"]) {
    merged[tier] = [...a[tier], ...b[tier]].filter((m) => {
      if (seen.has(m.uuid)) return false;
      seen.add(m.uuid);
      return true;
    });
  }
  merged.all = [...merged.exact, ...merged.startsWith, ...merged.contains, ...merged.fuzzy];
  return merged;
}

function smartSearchOne(members, searchTerm) {
  const normalized = hebrewNormalize(searchTerm);

  // Exact matches
  const exact = members.filter((member) =>
    getSearchableFields(member).some(
      (field) => hebrewNormalize(field) === normalized
    )
  );

  // Starts with matches
  const startsWith = members.filter(
    (member) =>
      !exact.includes(member) &&
      getSearchableFields(member).some((field) =>
        hebrewNormalize(field).startsWith(normalized)
      )
  );

  // Contains matches
  const contains = members.filter(
    (member) =>
      !exact.includes(member) &&
      !startsWith.includes(member) &&
      getSearchableFields(member).some((field) =>
        hebrewNormalize(field).includes(normalized)
      )
  );

  // Fuzzy matches
  const fuzzy = fuzzySearch(members, searchTerm, 0.7).filter(
    (member) =>
      !exact.includes(member) &&
      !startsWith.includes(member) &&
      !contains.includes(member)
  );

  return {
    exact,
    startsWith,
    contains,
    fuzzy,
    all: [...exact, ...startsWith, ...contains, ...fuzzy],
  };
}
