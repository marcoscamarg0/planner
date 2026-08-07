const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/api/ai/qa/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The regex will match: (input.slice(0, XX) + (input.length > XX ? "..." : ""))
// and replace it with: (input.split('\n')[0].slice(0, 150) + (input.split('\n')[0].length > 150 ? "..." : ""))
content = content.replace(/\(input\.slice\(0,\s*\d+\)\s*\+\s*\(input\.length\s*>\s*\d+\s*\?\s*"..."\s*:\s*""\)\)/g, 
  '(input.split(\'\\n\')[0].slice(0, 150) + (input.split(\'\\n\')[0].length > 150 ? "..." : ""))'
);

// We should also replace the sys prompt for summarize_report
const oldSysPrompt = 'const sys = "Você é um engenheiro de QA. Resuma os resultados deste teste de forma EXTREMAMENTE DIRETA, SIMPLIFICADA E RESUMIDA. Vá direto ao ponto, em no máximo 1 ou 2 frases. Diga apenas se passou/falhou e qual foi o objetivo principal ou erro principal. Sem enrolação. Retorne APENAS o texto plano. IDIOMA OBRIGATÓRIO: Português do Brasil (PT-BR).";';
const newSysPrompt = `const sys = "Você é um engenheiro de QA. Analise os resultados deste teste e retorne um resumo ESTRITAMENTE PADRONIZADO E CURTO (no máximo 2 frases).\\n\\n"
        + "Inicie OBRIGATORIAMENTE com 'Status - Passou: ' ou 'Status - Falhou: ', seguido do motivo principal ou objetivo validado.\\n\\n"
        + "Exemplos:\\n"
        + "Status - Passou: A navegação para a categoria de trânsito ocorreu com sucesso.\\n"
        + "Status - Falhou: O elemento não estava visível para clique no tempo limite.\\n\\n"
        + "Retorne APENAS o texto padronizado, sem formatação markdown ou explicações.";`;

content = content.replace(oldSysPrompt, newSysPrompt);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed titles and summary prompt in route.ts');
