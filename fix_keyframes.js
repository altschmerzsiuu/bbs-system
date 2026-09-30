const fs = require('fs');
let css = fs.readFileSync('src/app/(admin)/admin.css', 'utf-8');

// The file looks like: .role-admin { ... @keyframes xxx { ... } ... }
// Let's use regex to extract all @keyframes blocks and remove them from inside .role-admin
const keyframesRegex = /@keyframes\s+[\w-]+\s*\{[\s\S]*?\n\s{8}\}/g;
let extracted = [];
css = css.replace(keyframesRegex, (match) => {
    extracted.push(match);
    return '';
});

// also fix the specific slideup one that might end with 12 spaces if it was deeper
const keyframesRegex2 = /@keyframes\s+[\w-]+\s*\{[\s\S]*?\n\s{4}\}/g;
css = css.replace(keyframesRegex2, (match) => {
    extracted.push(match);
    return '';
});

// If there are any other keyframes, let's just do a simple block extractor
function extractKeyframes(text) {
    let result = '';
    let blocks = [];
    let i = 0;
    while(i < text.length) {
        let idx = text.indexOf('@keyframes', i);
        if (idx === -1) {
            result += text.slice(i);
            break;
        }
        result += text.slice(i, idx);
        
        let braceCount = 0;
        let j = text.indexOf('{', idx);
        braceCount = 1;
        j++;
        while (j < text.length && braceCount > 0) {
            if (text[j] === '{') braceCount++;
            if (text[j] === '}') braceCount--;
            j++;
        }
        
        blocks.push(text.slice(idx, j));
        i = j;
    }
    return { cleanCss: result, blocks };
}

let newCss = fs.readFileSync('src/app/(admin)/admin.css', 'utf-8');
const { cleanCss, blocks } = extractKeyframes(newCss);

fs.writeFileSync('src/app/(admin)/admin.css', cleanCss + '\n\n' + blocks.join('\n\n'));
console.log('Extracted', blocks.length, 'keyframes');
