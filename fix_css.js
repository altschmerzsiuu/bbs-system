const fs = require('fs');

// 1. Read original html
const html = fs.readFileSync('../bbs-admin.html', 'utf-8');

// 2. Extract CSS block
const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) {
  console.error("No style tag found");
  process.exit(1);
}
let css = cssMatch[1];

// 3. Remove variables that are already in globals.css if needed, OR just wrap in .role-admin
// Wait, the original css had body, html, * {} resets which we removed earlier.
// Let's strip them manually.
css = css.replace(/body\s*\{[\s\S]*?\n\s{8}\}/, '');
css = css.replace(/html,\s*body\s*\{[\s\S]*?\n\s{8}\}/, '');
css = css.replace(/\*\s*\{[\s\S]*?\n\s{8}\}/, '');

// Also strip out media queries for prefers-color-scheme because it breaks
css = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\s{8}\}/, '');

// Extract keyframes to put them at the end
let keyframes = [];
css = css.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\n\s{8}\}/g, (match) => {
    keyframes.push(match);
    return '';
});
// There might be some nested 4-space keyframes from media queries that were flattened
css = css.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\n\s{4}\}/g, (match) => {
    keyframes.push(match);
    return '';
});

// Remove any remaining @keyframes that might have a different indent
css = css.replace(/@keyframes[\s\S]*?\n\s*\}/g, (match) => {
    keyframes.push(match);
    return '';
});

// Let's just use postcss for safety!
