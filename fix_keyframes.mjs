import fs from 'fs';

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
