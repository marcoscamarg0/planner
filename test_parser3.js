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
const locators = {};
const lines = code.split('\n').map(l => l.trim());

for (const line of lines) {
  if (!line) continue;
  
  let m = line.match(/await\s+page\.goto\((['"`])(.*?)\1\)/);
  if (m) {
    pwSteps.push({ action: 'goto', value: m[2], label: \`Acessar \${m[2]}\` });
    continue;
  }
  
  m = line.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*page\.locator\((['"`])(.*?)\2/);
  if (m) {
    locators[m[1]] = m[3];
    continue;
  }
  
  m = line.match(/await\s+page\.locator\((['"`])(.*?)\1.*?\)\.fill\((['"`])(.*?)\3\)/);
  if (m) {
    pwSteps.push({ action: 'type', selectorType: 'css', selector: m[2], value: m[4], label: 'Preencher campo' });
    continue;
  }
  
  m = line.match(/await\s+([a-zA-Z0-9_]+)\.fill\((['"`])(.*?)\2\)/);
  if (m && locators[m[1]]) {
    pwSteps.push({ action: 'type', selectorType: 'css', selector: locators[m[1]], value: m[3], label: 'Preencher campo' });
    continue;
  }
  
  m = line.match(/await\s+page\.locator\((['"`])(.*?)\1.*?\)\.click\(/);
  if (m) {
    pwSteps.push({ action: 'click', selectorType: 'css', selector: m[2], value: m[2], label: 'Clicar no elemento' });
    continue;
  }
  
  m = line.match(/await\s+([a-zA-Z0-9_]+)\.click\(/);
  if (m && locators[m[1]]) {
    pwSteps.push({ action: 'click', selectorType: 'css', selector: locators[m[1]], value: locators[m[1]], label: 'Clicar no elemento' });
    continue;
  }

  m = line.match(/await\s+page\.waitForURL\(/);
  if (m) {
    pwSteps.push({ action: 'wait', milliseconds: 2000, label: 'Aguardar redirecionamento' });
    continue;
  }
}

console.log(pwSteps);
