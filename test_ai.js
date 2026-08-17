const fs = require('fs');

async function testPrompt() {
  const code = `
test('Deve realizar login com sucesso e redirecionar para o dashboard', async ({ page }) => {
    await page.goto('/');
    const campoEmail = page.locator('input[type="email"], #email, .email-input');
    await campoEmail.fill('marcos.camargo@transportes.gov.br');
});`;

  const prompt = `== CONTEXTO ==
Você está automatizando um caso de teste de QA para a URL: https://ia.transportes.gov.br/

== ROTEIRO / SCRIPT FORNECIDO ==
${code}

== SUA TAREFA ==
Leia o roteiro ou script fornecido acima e converta as interações em um array JSON.
Gere EXATAMENTE o JSON com o array "steps" cobrindo TODAS as interações do script ou roteiro.`;

  console.log("Chamando Groq...");
  require('dotenv').config({ path: '.env.local' });
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return console.log("Sem chave groq");

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + groqKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      model: "llama-3.3-70b-versatile", 
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, 
      max_tokens: 4000,
    }),
  });

  const groqData = await groqRes.json();
  console.log("Res:", JSON.stringify(groqData, null, 2));
}

testPrompt();
