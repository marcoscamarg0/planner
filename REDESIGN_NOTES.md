# Redesign — o que mudou

## 1. Modo claro/escuro
- Novo sistema de temas com `next-themes` (`components/theme/ThemeProvider.tsx`).
- `app/globals.css` reescrito: paleta neutra (zinc/cinza) + um único acento
  violeta, com variáveis separadas para `:root` (claro) e `.dark` (escuro).
- Botão de alternância em `components/theme/ThemeToggle.tsx`, já integrado na
  Topbar. O tema escolhido persiste (via `next-themes`) e respeita o tema do
  sistema operacional por padrão.

## 2. Chat de IA no menu lateral
- `components/chat/FloatingChat.tsx` (bolha flutuante) foi **removido**.
- Novo `components/chat/ChatSidebar.tsx`: painel lateral grande (420–460px),
  abre com o botão **"Assistente IA"** na Topbar (ou tecla Esc para fechar).
  Tem duas abas: **Chat** e **Referências**.
- Controlado em `components/layout/AppShell.tsx` (estado `chatOpen`).

## 3. Referências (links, PDF e texto) para a IA consultar
- Nova aba **Referências** dentro do painel (`components/chat/ReferencesPanel.tsx`):
  adicionar um link, um PDF ou um texto livre; listar, ver prévia e excluir.
- Extração de conteúdo em `lib/knowledge/extract.ts`:
  - **Link**: busca a página no servidor, remove scripts/estilos/tags e extrai
    o texto + título.
  - **PDF**: extrai o texto com `pdf-parse` (upload via `multipart/form-data`,
    limite de 15MB).
  - **Texto**: salvo diretamente.
- Novas rotas: `app/api/references/route.ts` (GET/POST) e
  `app/api/references/[id]/route.ts` (DELETE).
- Nova tabela no Supabase: `supabase/migrations/002_add_knowledge_sources.sql`
  (com RLS: cada usuário só vê/edita as próprias referências).
- **Rodar a migração é obrigatório** antes de usar a nova aba — no painel do
  Supabase (SQL editor) ou via CLI: `supabase db push`.

## 4. IA agora "puxa" as referências
- `app/api/ai/chat/route.ts` passou a buscar as 12 referências mais recentes
  do usuário e injetá-las no contexto (RAG) junto de projetos/tarefas.
- `lib/openrouter/prompts.ts` foi ajustado para instruir o modelo a citar
  explicitamente qual referência usou ao responder.

## 5. Dependências novas (rode `npm install`)
- `next-themes` — tema claro/escuro
- `pdf-parse` (+ `@types/pdf-parse`) — extração de texto de PDF

## Passo a passo para aplicar
1. `npm install`
2. Rodar a migration `002_add_knowledge_sources.sql` no seu projeto Supabase.
3. Conferir se as variáveis de ambiente já existentes continuam no `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, etc.) — nada novo foi
   adicionado nesse quesito.
4. `npm run dev` e testar o botão **Assistente IA** na Topbar.

## Não incluído (fora do escopo desta rodada)
- Escopar referências por projeto (hoje elas são globais por usuário).
- OCR para PDFs escaneados (só extrai texto de PDFs com texto real).
- Busca semântica/embeddings nas referências — hoje o conteúdo (truncado) vai
  inteiro no prompt, o que funciona bem até ~10-15 referências.

## Atualização — "Colar do Teams" com escolha de projeto
- `components/dashboard/MagicAddModal.tsx` (botão **✨ Magic Add** na Topbar,
  disponível em todas as telas) agora tem um **seletor de projeto**.
  - Com projeto selecionado → chama `/api/ai/magic-add`: a IA extrai
    **tarefas** e um **resumo executivo** da mensagem colada (Teams, e-mail,
    ata), cria as tarefas no projeto e salva o resumo como uma página +
    um insight (`ai_insights`, tipo `summary`) — aparece automaticamente no
    dashboard, no card do projeto e no relatório do projeto.
  - Sem projeto selecionado → mantém o comportamento anterior (IA tenta
    detectar o projeto/intenção sozinha via `/api/ai/command`).
- Prompt (`buildMagicAddPrompt` em `lib/openrouter/prompts.ts`) ajustado para
  lidar melhor com mensagens coladas de chat (ignora saudações/ruído, foca em
  decisões, pendências e responsáveis).
- Nenhuma migration nova é necessária para essa parte (usa tabelas já
  existentes: `tasks`, `pages`, `ai_insights`).
