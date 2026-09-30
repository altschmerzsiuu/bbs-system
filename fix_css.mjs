import fs from 'fs';
import postcss from 'postcss';

const html = fs.readFileSync('../bbs-admin.html', 'utf-8');
const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
let css = cssMatch[1];

const root = postcss.parse(css);

const newRoot = postcss.root();
const scopedRule = postcss.rule({ selector: '.role-admin' });
scopedRule.append(postcss.decl({ prop: 'overflow-x', value: 'hidden' }));

root.each(node => {
    if (node.type === 'atrule' && node.name === 'keyframes') {
        newRoot.append(node.clone());
    } else if (node.type === 'atrule' && node.name === 'media' && node.params.includes('prefers-color-scheme')) {
        // Ignore
    } else if (node.type === 'rule' && (node.selector === 'body' || node.selector === 'html, body' || node.selector === '*')) {
        // Ignore global resets
    } else {
        scopedRule.append(node.clone());
    }
});

newRoot.append(scopedRule);

fs.writeFileSync('src/app/(admin)/admin.css', newRoot.toString());
console.log('Successfully fixed admin.css using PostCSS!');
