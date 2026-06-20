import { test } from "node:test";
import assert from "node:assert";
import { extractEnglishProse } from "../src/utils/extractor.js";

test("Stage 2 Heuristic Extractor - HTML Tag Purging", () => {
  const html = `
    <div>
      <h1>quarterly market report data is here</h1>
      <p>This is a standard flowing sentence explaining the revenue metrics and quarterly sales growth of nvidia.</p>
    </div>
  `;
  const result = extractEnglishProse(html);
  
  assert.ok(result.includes("quarterly market report data is here"));
  assert.ok(result.includes("This is a standard flowing sentence"));
  // Assert HTML tags themselves were entirely stripped
  assert.ok(!result.includes("<div>"));
  assert.ok(!result.includes("<h1>"));
});

test("Stage 2 Heuristic Extractor - Title-Cased Header Exclusion", () => {
  const html = `
    <div>
      <h2>Market Capitalization Growth Report</h2>
      <p>Nvidia showed substantial growth over the fiscal quarters of 2026.</p>
      <h3>The Great Financial Assessment of Future Revenue</h3>
    </div>
  `;
  const result = extractEnglishProse(html);

  // Headers should be excluded
  assert.ok(!result.includes("Market Capitalization Growth Report"));
  assert.ok(!result.includes("The Great Financial Assessment of Future Revenue"));
  // Flowing sentence should exist
  assert.ok(result.includes("Nvidia showed substantial growth"));
});

test("Stage 2 Heuristic Extractor - script and style block exclusion", () => {
  const html = `
    <html>
      <head>
        <style>
          body { color: #f00; font-size: 14px; }
          p { margin: 10px; }
        </style>
        <script>
          const x = 12;
          console.log("doing secret stuff", x);
        </script>
      </head>
      <body>
        <p>Investors remain warm on the growth trends displayed by the enterprise platform.</p>
      </body>
    </html>
  `;
  const result = extractEnglishProse(html);

  // Valid paragraph should remain
  assert.ok(result.includes("Investors remain warm"));
  // Style and script interiors MUST be excluded
  assert.ok(!result.includes("body { color"));
  assert.ok(!result.includes("const x = 12"));
});

test("Stage 2 Heuristic Extractor - Code Syntax Filtering", () => {
  const html = `
    <p>This is a healthy paragraph discussing financial progress of technology companies.</p>
    <pre>
      function checkAllocation(pool: number) {
        const x = pool + 5;
        return x / 2;
      }
    </pre>
  `;
  const result = extractEnglishProse(html);

  // Natural prose should pass
  assert.ok(result.includes("This is a healthy paragraph"));
  // Deep code blocks with high symbol/syntax counts should be excluded by character density rules
  assert.ok(!result.includes("function checkAllocation"));
  assert.ok(!result.includes("return x / 2"));
});

test("Stage 2 Heuristic Extractor - HTML Entity Decoding", () => {
  const html = "<p>Nvidia &amp; Alphabet &quot;growth&quot; figures &nbsp; showed &mdash; improvement.</p>";
  const result = extractEnglishProse(html);

  assert.ok(result.includes("Nvidia & Alphabet \"growth\" figures showed — improvement."));
});

test("Stage 2 Heuristic Extractor - Filter Very Short Sections (<=3 words & no period)", () => {
  const html = `
    <p>This is a standard healthy paragraph containing important information.</p>
    <p>Investigate internal guidelines</p> <!-- 3 words, 31 chars, no period -> remove -->
    <p>Investigate internal guidelines.</p> <!-- 3 words, 32 chars, has period -> keep -->
    <p>Please continue reading</p> <!-- 3 words, 23 chars, no period -> remove -->
    <p>This is a test block of raw sentence words</p> <!-- 9 words, 41 chars, no period -> keep -->
  `;
  const result = extractEnglishProse(html);

  assert.ok(result.includes("This is a standard healthy paragraph containing important information."));
  assert.ok(!result.includes("Investigate internal guidelines\n"));
  assert.ok(!result.includes("\nInvestigate internal guidelines\n"));
  assert.ok(result.includes("Investigate internal guidelines."));
  assert.ok(!result.includes("Please continue reading"));
  assert.ok(result.includes("This is a test block of raw sentence words"));
});
