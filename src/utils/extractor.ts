/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Scrape Engine - Ingestion & Clean Extraction Pipeline.
 * Zero DOM dependencies; runs seamlessly on desktop runtimes & web browsers alike.
 */

// List of standard english language stopwords to run linear density checks again
const STOPWORDS = new Set([
  "the", "and", "to", "of", "a", "in", "is", "that", "it", "on", 
  "for", "as", "with", "was", "at", "by", "an", "be", "this", "are",
  "or", "from", "but", "not", "he", "she", "they", "we", "you", "your"
]);

/**
 * Decodes standard HTML entities back into clean characters.
 */
function decodeHtmlEntities(rawText: string): string {
  return rawText
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "-");
}

/**
 * Stage 2 Extraction Engine:
 * Evaluates blocks of text using character metrics and word structure matrices
 * to separate high-quality readables from programming code, XML nodes, or CSS junk.
 */
export function extractEnglishProse(rawHtml: string): string {
  if (!rawHtml) return "";

  // 1. Initial Purification: Eliminate tags blockout sections (Scripts, Styles, Comments)
  let purged = rawHtml;
  
  // Strip CSS style zones
  purged = purged.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "\n");
  // Strip JS execution zones
  purged = purged.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "\n");
  // Strip code elements entirely to prevent script leak
  purged = purged.replace(/<pre[\s\S]*?>[\s\S]*?<\/pre>/gi, "\n");
  purged = purged.replace(/<code[\s\S]*?>[\s\S]*?<\/code>/gi, "\n");
  // Strip HTML instructions / comments
  purged = purged.replace(/<!--[\s\S]*?-->/g, "\n");
  
  // Replace spacing & structural blocks with strict boundary markers
  purged = purged.replace(/<(p|div|h1|h2|h3|h4|h5|h6|li|tr|option|section|article|header|footer|aside|nav)[\s\S]*?>/gi, "\n\n");
  purged = purged.replace(/<br\s*\/?>/gi, "\n");

  // Strip all remaining inline HTML tags
  purged = purged.replace(/<[^>]+>/g, " ");

  // Normalize character typography
  purged = decodeHtmlEntities(purged);

  // 2. Fragment Separation: Chunk into paragraphs/block units
  const candidates = purged.split(/\n+/);
  const validatedBlocks: string[] = [];

  for (const block of candidates) {
    const trimmed = block.trim();
    if (trimmed.length < 15) {
      // Ignore extremely short fragments which are typically navigation, single symbols, or dates.
      continue;
    }

    // --- METRIC STAGE 0: Title-Cased Header Detection & Removal ---
    const MINOR_WORDS = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "by", "of", "with", "in", "is"]);
    const cleanedWordsForCap = trimmed.split(/\s+/).map(w => w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "")).filter(w => w.length > 0);
    if (cleanedWordsForCap.length >= 2) {
      const majorWords = cleanedWordsForCap.filter(w => !MINOR_WORDS.has(w.toLowerCase()));
      if (majorWords.length >= 2) {
        const majorUpperCount = majorWords.filter(w => /^[A-Z]/.test(w)).length;
        if (majorUpperCount / majorWords.length >= 0.9) {
          // This matches style guidelines of a title-cased header block
          continue;
        }
      } else {
        const overallUpperCount = cleanedWordsForCap.filter(w => /^[A-Z]/.test(w)).length;
        if (overallUpperCount === cleanedWordsForCap.length) {
          continue;
        }
      }
    }

    // --- METRIC STAGE A: Character Distribution Map ---
    // Count alphabet characters, standard blanks, and prose punctuation (commas, periods, quotes, apostrophes).
    const alphabeticAndSpaceCount = (trimmed.match(/[a-zA-Z\s]/g) || []).length;
    const prosePunctuationCount = (trimmed.match(/[,.?!'";:\-()—]/g) || []).length;
    
    // Total valid english-sentence character ratio
    const proseIndex = (alphabeticAndSpaceCount + prosePunctuationCount) / trimmed.length;

    // Check code/structure symbols. Large ratio of symbols like '{', '[', '=', '+', ';', '/', '_' indicates code/markup syntax.
    const codeSymbolCount = (trimmed.match(/[{}[\];=+\/*_<>\\|&#]/g) || []).length;
    const codeSymbolDensity = codeSymbolCount / trimmed.length;

    // --- METRIC STAGE B: Word & Stopword Density Validator ---
    const words = trimmed.toLowerCase().split(/[^a-zA-Z']+/).filter(w => w.length > 0);
    if (words.length === 0) continue;

    // Calculate Average Word Length
    const totalWordCharLength = words.reduce((acc, word) => acc + word.length, 0);
    const averageWordLength = totalWordCharLength / words.length;

    // Count English stopwords matched
    let matchedStopwords = 0;
    for (const word of words) {
      if (STOPWORDS.has(word)) {
        matchedStopwords++;
      }
    }
    const stopwordDensity = matchedStopwords / words.length;

    // Determine if block qualifies as fluid readable prose
    // Constraints:
    // 1. Must be predominantly made of standard text characters (>= 82%)
    // 2. Must NOT be infested with programming syntax identifiers (<= 6% code indicators)
    // 3. Average word size must be human readable (between 2.8 and 11.0 chars)
    // 4. Must show active natural articles/conjunctions (stopword density >= 7.5% for paragraphs > 6 words)
    const displaysEnglishShorthandText = words.length <= 6 && proseIndex >= 0.88; // e.g. titles or headlines
    const isNaturalEnglishProse = 
      proseIndex >= 0.82 &&
      codeSymbolDensity <= 0.06 &&
      averageWordLength >= 2.8 &&
      averageWordLength <= 11.0 &&
      (words.length <= 6 || stopwordDensity >= 0.075);

    if (isNaturalEnglishProse || displaysEnglishShorthandText) {
      // Keep block, standardizing multiple whitespace
      const cleanBlock = trimmed.replace(/\s+/g, " ");
      validatedBlocks.push(cleanBlock);
    }
  }

  // Combine validated textual blocks with double spacing to mimic paragraphs
  // Filter out very short sections with three words or less and no period
  const finalBlocks = validatedBlocks.filter(block => {
    const words = block.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 3 && !block.includes(".")) {
      return false;
    }
    return true;
  });

  return finalBlocks.join("\n\n");
}
