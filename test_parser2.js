const fs = require('fs');

const code = `
test.describe('TC001 - Validar login bem-sucedido com credenciais válidas', () => {
  test('Deve realizar login com sucesso e redirecionar para o dashboard', async ({ page }) => {
    // Passo 1: Acessar a página de login
    await test.step('Acessar a página inicial do sistema', async () => {
      await page.goto('/');
      // Aguardar o carregamento inicial e verificar se o título está visível
      await expect(page).toHaveTitle(/.*IA SOBERANA.*/i);
    });

    // Passo 2: Preencher o campo de e-mail
    await test.step('Preencher o campo de e-mail', async () => {
      // Usando uma estratégia robusta com fallback
      const emailInput = page.locator('input[type="email"], #email, .email-input');
      await emailInput.fill('marcos.camargo@transportes.gov.br');
    });
    
    // Passo 3: Preencher a senha
    await test.step('Preencher a senha', async () => {
      const passwordInput = page.locator('input[type="password"], #senha, .password-input');
      await passwordInput.fill('123Night!');
    });

    // Passo 4: Clicar no botão de login
    await test.step('Clicar no botão de login', async () => {
      const loginBtn = page.locator('button[type="submit"], #btnLogin, .btn-login');
      await loginBtn.click();
    });
    
    await page.waitForURL('**/dashboard');
  });
});
`;

    const pwSteps = [];
    let stepCount = 0;
    
    // Track locator variables: const varName = page.locator('selector')
    const locators = {};
    const lines = code.split('\n').map(l => l.trim());
    
    for (const line of lines) {
      if (!line) continue;
      
      let m = line.match(/await\s+page\.goto\(['"]([^'"]+)['"]\)/);
      if (m) {
        pwSteps.push({ action: 'goto', value: m[1], label: \`Acessar \${m[1]}\` });
        stepCount++;
        continue;
      }
      
      m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.locator\(['"\`](.*?)['"\`]/);
      if (m) {
        locators[m[1]] = m[2];
        continue;
      }
      
      m = line.match(/await\s+page\.locator\(['"\`](.*?)['"\`].*?\)\.fill\((.*?)\)/);
      if (m) {
        let val = m[2].replace(/^['"\`]|['"\`]$/g, '');
        pwSteps.push({ action: 'type', selectorType: 'css', selector: m[1], value: val, label: 'Preencher campo' });
        stepCount++;
        continue;
      }
      
      m = line.match(/await\s+([a-zA-Z0-9_]+)\.fill\((.*?)\)/);
      if (m && locators[m[1]]) {
        let val = m[2].replace(/^['"\`]|['"\`]$/g, '');
        pwSteps.push({ action: 'type', selectorType: 'css', selector: locators[m[1]], value: val, label: 'Preencher campo' });
        stepCount++;
        continue;
      }
      
      m = line.match(/await\s+page\.locator\(['"\`](.*?)['"\`].*?\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: m[1], value: m[1], label: 'Clicar no elemento' });
        stepCount++;
        continue;
      }
      
      m = line.match(/await\s+([a-zA-Z0-9_]+)\.click\(/);
      if (m && locators[m[1]]) {
        pwSteps.push({ action: 'click', selectorType: 'css', selector: locators[m[1]], value: locators[m[1]], label: 'Clicar no elemento' });
        stepCount++;
        continue;
      }
      
      m = line.match(/await\s+page\.getByRole\(['"\`]([^'"\`]+)['"\`]\s*,\s*\{\s*name:\s*['"\`]([^'"\`]+)['"\`]\s*\}\)\.click\(/);
      if (m) {
        pwSteps.push({ action: 'click', selectorType: 'role', selector: m[1], value: m[2], label: \`Clicar em \${m[1]} \${m[2]}\` });
        stepCount++;
        continue;
      }

      m = line.match(/await\s+page\.waitForURL\(/);
      if (m) {
        pwSteps.push({ action: 'wait', milliseconds: 2000, label: 'Aguardar redirecionamento e carregamento da página' });
        stepCount++;
        continue;
      }
    }

fs.writeFileSync('test_parser_output.json', JSON.stringify({ locators, pwSteps }, null, 2));
