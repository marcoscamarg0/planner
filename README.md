# 🚀 Planner & QA Automation Suite

<p align="center">
  <strong>Plataforma Completa de Gestão Estratégica de Projetos, Tarefas, Documentação e Automação de Testes de QA com Inteligência Artificial.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3.3-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Appwrite-Cloud-F02E65?style=for-the-badge&logo=appwrite" alt="Appwrite" />
  <img src="https://img.shields.io/badge/Playwright-Automated_QA-2EAD33?style=for-the-badge&logo=playwright" alt="Playwright" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Framer_Motion-11-FF0055?style=for-the-badge&logo=framer" alt="Framer Motion" />
</p>

---

## 📖 Visão Geral

O **Planner** é um ecossistema completo para planejamento, gestão e validação de qualidade de software. Ele integra gestão de projetos hierárquicos (projetos e subprojetos), checklists dinâmicos de tarefas, documentação técnica rica e um executor de testes automatizados inteligente (**Smart Runner**) baseado em Playwright e múltiplos provedores de IA.

---

## ✨ Principais Funcionalidades

### 📊 1. Dashboard em Tempo Real
* **Métricas em Tempo Real:** Acompanhamento instantâneo de Projetos Ativos, Tarefas Pendentes e Progresso Global consolidado.
* **Agrupamento Inteligente:** Projetos principais exibem cards consolidados com seus subprojetos aninhados, mini barras de progresso individuais e totalizadores.
* **Sincronização Instantânea (Cross-Tab Sync):** Alterações feitas em tarefas ou projetos em qualquer aba são refletidas imediatamente no Dashboard via eventos de armazenamento e detecção de visibilidade.
* **Feed de Atividades:** Histórico dinâmico de projetos atualizados e tarefas concluídas.

### 📂 2. Gestão Hierárquica de Projetos & Subprojetos
* **Estrutura Pai-Filho (Tree View):** Subprojetos não poluem a visualização raiz; são agrupados dentro do projeto pai com indicador expansível (`X sub`).
* **Progresso Proporcional:** A taxa de conclusão do projeto pai reflete o somatório das entregas do projeto e de todos os seus subprojetos.
* **Ações em Lote e Exclusão Rápida:** Exclusão individual de 1 clique ou exclusão em massa com limpeza definitiva no banco de dados.

### ✅ 3. Painel de Tarefas & Checklist
* **Ciclo de Estados:** Transição rápida entre `A fazer (todo)`, `Em progresso (in_progress)`, `Concluído (done)` e `Cancelado (cancelled)`.
* **Priorização & Datas:** Definição de prioridades (`alta`, `média`, `baixa`) e datas limites de entrega (`due_date`).
* **Persistência Segura:** Atualizações de tarefas via endpoints dedicados com fallback resiliente para identificadores no Appwrite.

### 🤖 4. Automação de QA & Smart Runner (Playwright + IA)
* **Geração Inteligente de Passos:** Converte descrições em linguagem natural (PT-BR) ou especificações técnicas em passos executáveis do Playwright.
* **Suporte a Multi-Provedores de IA:** Integração com Google Gemini, Cerebras AI, Groq, Mistral AI e OpenRouter com alternância automática (fallback).
* **Auditoria de Acessibilidade:** Execução embutida do motor `axe-core` para detecção de violações de acessibilidade (WCAG).
* **Evidências Visuais em Alta Definição:** Captura automática de screenshots (antes da ação, highlight do elemento e tela cheia).
* **Relatórios Automatizados:** Geração de relatórios completos em formato **HTML** e **PDF** com layout executivo.
* **Limpeza Automática de 3 Dias:** Rotina de retenção que remove automaticamente relatórios locais e registros do banco com mais de 3 dias de criação.

### 📝 5. Páginas & Base de Conhecimento
* Editor de documentação técnica por projeto com suporte a notas, especificações de requisitos e insights contextuais gerados por IA.

---

## 📐 Arquitetura do Sistema

```mermaid
graph TD
  User([Usuário / Navegador]) -->|Acessa Interface| NextApp[Next.js 15 App Router]
  
  subgraph Frontend ["Camada de Apresentação (React 19)"]
    Dashboard[DashboardClient]
    Projects[ProjectsClient]
    TaskPanel[TaskPanel & ProjectEditor]
    QAPanel[QA Smart Runner Modal]
  end

  subgraph API ["Next.js API Routes (Server-Side)"]
    StatsAPI["/api/dashboard/stats"]
    TasksAPI["/api/tasks/update"]
    MutateAPI["/api/appwrite/mutate"]
    SmartRunAPI["/api/automation/smart-run"]
    ReportsRoute["/reports/[filename]"]
    CleanupAPI["/api/reports/cleanup"]
  end

  subgraph AI_Engine ["Motor de Inteligência Artificial"]
    Gemini[Google Gemini API]
    Cerebras[Cerebras AI]
    Groq[Groq Llama 3.3]
    OpenRouter[OpenRouter]
  end

  subgraph Automation ["Executor de Automação"]
    Playwright[Playwright Chromium Headless]
    AxeCore[Axe-Core Accessibility Engine]
    ReportGen[Report Generator HTML/PDF]
    CleanupWorker[Cleanup Routine - 3 Dias]
  end

  subgraph Storage_DB ["Banco de Dados & Storage (Appwrite Cloud)"]
    AppwriteDB[(Appwrite Database)]
    AppwriteStorage[(Appwrite Storage)]
    LocalStorage[(Local File Storage: public/reports)]
  end

  NextApp --> Frontend
  Frontend --> API
  API --> AI_Engine
  SmartRunAPI --> Playwright
  Playwright --> AxeCore
  Playwright --> ReportGen
  ReportGen --> LocalStorage
  ReportGen --> CleanupWorker
  API --> AppwriteDB
  API --> AppwriteStorage
  ReportsRoute --> LocalStorage
  ReportsRoute --> AppwriteDB
```

---

## 🔄 Fluxograma do Smart Runner (Automação de QA)

```mermaid
sequenceDiagram
  autonumber
  actor User as Usuário de QA
  participant Modal as Interface de Testes
  participant SmartRun as API /api/automation/smart-run
  participant AI as Provedor de IA (Gemini/Cerebras/Groq)
  participant PW as Playwright (Browser Headless)
  participant Rep as Gerador de Relatórios
  participant Disk as public/reports & Appwrite

  User->>Modal: Informa URL Alvo e Roteiro de Teste
  Modal->>SmartRun: Dispara execução (POST)
  SmartRun->>AI: Solicita desdobramento dos passos em JSON
  AI-->>SmartRun: Retorna passos atômicos (goto, click, type, wait, verify)
  SmartRun->>PW: Inicializa Browser e executa passos
  PW->>PW: Aceita cookies automaticamente + Captura Screenshots HD
  PW->>PW: Executa auditoria de acessibilidade (axe-core)
  PW-->>SmartRun: Retorna resultados, durações e evidências base64
  SmartRun->>Rep: Constrói HTML do Relatório + Gera PDF A4
  Rep->>Disk: Salva report-*.html e report-*.pdf
  Rep->>Disk: Executa rotina cleanOldReports(3 dias)
  SmartRun->>Disk: Registra auditoria na coleção qa_reports
  SmartRun-->>Modal: Stream finalizado (Status + Links do Relatório)
  Modal-->>User: Exibe resumo e botão para abrir Relatório HTML/PDF
```

---

## ⚡ Fluxograma de Sincronização em Tempo Real (Cross-Tab Sync)

```mermaid
flowchart LR
    A[Usuário Conclui Tarefa no Editor] --> B[TaskPanel: Optimistic UI Update]
    B --> C[POST /api/tasks/update]
    C --> D[(Appwrite Database: status = 'done')]
    B --> E[localStorage: planner_tasks_updated]
    E -->|Storage Event| F[Aba Dashboard]
    E -->|Storage Event| G[Aba Projetos]
    F --> H[GET /api/dashboard/stats]
    G --> H
    H --> I[Recálculo de Porcentagens & Barras Atualizadas]
```

---

## 📁 Estrutura do Projeto

```plaintext
planner/
├── app/
│   ├── (app)/
│   │   ├── dashboard/          # Dashboard Principal com Métricas e Feed
│   │   ├── projects/           # Listagem Hierárquica de Projetos
│   │   │   └── [id]/           # Editor do Projeto (Tarefas, Docs, Automação)
│   │   ├── settings/           # Configurações de Perfil e Integrações
│   │   └── layout.tsx          # Layout Principal da Aplicação
│   ├── api/
│   │   ├── ai/                 # Endpoints de IA (Insights, Organograma, etc)
│   │   ├── appwrite/mutate/    # Proxy seguro de mutações no banco
│   │   ├── auth/               # Endpoints de Sessão e Autenticação
│   │   ├── automation/         # Execução Playwright e Smart Runner
│   │   ├── dashboard/stats/    # Estatísticas e Métricas em Tempo Real
│   │   ├── reports/cleanup/    # Endpoint de Limpeza Automática de 3 Dias
│   │   └── tasks/update/       # Atualização Segura de Tarefas
│   ├── reports/[filename]/     # Rota Dinâmica de Entrega e Reconstrução de Relatórios
│   └── page.tsx                # Landing Page / Redirecionamento
├── components/
│   ├── dashboard/              # Cards, Modais, TaskPanel, NewProjectModal
│   ├── layout/                 # Sidebar, Topbar, ThemeToggle, Navegação
│   └── ui/                     # Componentes Base (Botões, Badges, Inputs)
├── lib/
│   ├── appwrite/               # Configuração, REST Client e Supabase Shim Adapter
│   ├── automation/             # Parsers de scripts e roteiros em linguagem natural
│   ├── utils/                  # Utilitários gerais e rotina cleanOldReports
│   └── worker/                 # Executor de testes, Gerador de Relatório HTML/PDF
├── public/
│   └── reports/                # Armazenamento temporário de relatórios HTML/PDF
├── types/                      # Definições TypeScript (Project, Task, etc)
├── .env                        # Variáveis de Ambiente
├── package.json                # Dependências e Scripts
└── README.md                   # Documentação do Projeto
```

---

## 🛠️ Tecnologias Utilizadas

* **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
* **Linguagem:** [TypeScript 5](https://www.typescriptlang.org/)
* **Interface & Estilização:** [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) e [Lucide Icons](https://lucide.dev/)
* **Banco de Dados & Auth:** [Appwrite Cloud REST API](https://appwrite.io/)
* **Automação & Browser Testing:** [Playwright](https://playwright.dev/) & [Axe-Core](https://github.com/dequelabs/axe-core)
* **Modelos de IA Suportados:**
  * Google Gemini (`gemini-flash-latest`, `gemini-1.5-pro`)
  * Cerebras (`llama-3.3-70b`)
  * Groq (`llama-3.3-70b-versatile`)
  * Mistral AI (`mistral-small-latest`)
  * OpenRouter (`llama-3.3-70b-instruct`)

---

## ⚙️ Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto com as seguintes chaves:

```env
# --- Appwrite Cloud ---
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://nyc.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=seu_project_id
APPWRITE_API_KEY=sua_secret_api_key_appwrite
APPWRITE_DATABASE_ID=planner_db

# --- Coleções Appwrite ---
APPWRITE_COLLECTION_PROJECTS=projects
APPWRITE_COLLECTION_TASKS=tasks
APPWRITE_COLLECTION_PAGES=pages
APPWRITE_COLLECTION_INSIGHTS=ai_insights
APPWRITE_COLLECTION_QA_REPORTS=qa_reports

# --- Provedores de Inteligência Artificial ---
GEMINI_API_KEY=sua_chave_google_gemini
CEREBRAS_API_KEY=sua_chave_cerebras
GROQ_API_KEY=sua_chave_groq
MISTRAL_API_KEY=sua_chave_mistral
OPENROUTER_API_KEY=sua_chave_openrouter
```

---

## 🚀 Como Executar o Projeto

### 1. Pré-requisitos
* **Node.js:** Versão 18.18+ ou 20+ instalada.
* **NPM** ou **Yarn**.

### 2. Instalação das Dependências
```bash
npm install
```

### 3. Instalação dos Navegadores do Playwright (para testes de QA)
```bash
npx playwright install chromium
```

### 4. Executando em Modo de Desenvolvimento
```bash
npm run dev
```
Acesse no navegador: **`http://localhost:3000`**

### 5. Build para Produção
```bash
npm run build
npm run start
```

---

## 📄 Licença

Este projeto é desenvolvido para planejamento, gestão e automação de qualidade de software. Todos os direitos reservados.
