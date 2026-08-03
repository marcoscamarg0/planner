const fs = require('fs');
const file = 'components/qa/SmartRunnerTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// Container bg
content = content.replace(/bg-black\/40/g, 'bg-card dark:bg-black/40');
content = content.replace(/bg-black\/60/g, 'bg-card/90 dark:bg-black/60');
content = content.replace(/bg-black\/90/g, 'bg-card dark:bg-black/90');

// White borders
content = content.replace(/border-white\/5(?!0)/g, 'border-border dark:border-white/5');
content = content.replace(/border-white\/10/g, 'border-border dark:border-white/10');
content = content.replace(/border-white\/20/g, 'border-border\/60 dark:border-white/20');
content = content.replace(/border-white\/30/g, 'border-border dark:border-white/30');

// White backgrounds
content = content.replace(/bg-white\/5(?!0)/g, 'bg-muted\/50 dark:bg-white/5');
content = content.replace(/bg-white\/10/g, 'bg-muted dark:bg-white/10');
content = content.replace(/bg-white\/20/g, 'bg-muted\/80 dark:bg-white/20');

// text-white
content = content.replace(/text-white\/5/g, 'text-foreground\/5 dark:text-white/5');
content = content.replace(/text-white(?![\w])/g, 'text-primary-foreground dark:text-white');

fs.writeFileSync(file, content);
console.log('Fixed SmartRunnerTab.tsx');
