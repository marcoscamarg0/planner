const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(app)', 'qa', 'QaClient.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the first occurrence of the closing brace of the component
// We know the component ends around line 3726 (1-indexed)
// Find the second closing of the function (second "}\n" after the AnimatePresence)

// Strategy: find where the first complete `}\n` occurs after line 3700
let firstClose = -1;
for (let i = 3700; i < Math.min(3730, lines.length); i++) {
  if (lines[i].trim() === '}') {
    firstClose = i;
    break;
  }
}

if (firstClose === -1) {
  console.error('Could not find the closing brace');
  process.exit(1);
}

console.log(`Found closing brace at line ${firstClose + 1} (0-indexed: ${firstClose})`);
console.log(`Line content: "${lines[firstClose]}"`);
console.log(`Lines before: "${lines[firstClose-1]}"`);
console.log(`Total lines: ${lines.length}`);

// Keep only lines 0..firstClose
const cleaned = lines.slice(0, firstClose + 1).join('\n') + '\n';
fs.writeFileSync(filePath, cleaned, 'utf8');

const newLines = fs.readFileSync(filePath, 'utf8').split('\n');
console.log(`Done! File now has ${newLines.length} lines`);
