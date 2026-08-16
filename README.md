# StoryTree

StoryTree is a connected writing space for drafting stories and maintaining a
world bible. The current vertical slice includes:

- A rich-text editor with local autosave
- Hierarchical pages and child-page creation
- `Alt+P` to turn the word before the caret into a linked child page
- `Alt+A` to open the AI writing panel with the current selection
- BYOK provider selection for OpenAI, Anthropic, and Google Gemini
- A Supabase schema for accounts, cloud pages, permissions, and encrypted AI
  key records

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The editor works immediately and stores draft
pages in this browser. API keys remain in memory and are cleared when the tab
closes.

## Connect Supabase

Supabase is not required for the local vertical slice. When ready:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add the project URL and publishable key from **Project Settings > API**.
4. Generate `AI_KEY_ENCRYPTION_SECRET` with `openssl rand -base64 32`.
5. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor,
   or link the Supabase CLI and run `supabase db push`.

Do not expose the database password, service-role key, or encryption secret in
the browser. The migration enables row-level security and provisions one
workspace and starter page for each new account.

## AI behavior

The local AI panel sends the selected provider key directly to this app's
server endpoint over the current connection and does not persist it. Before
deployment, use HTTPS. The cloud phase will move key writes to authenticated
server routes and store only AES-GCM ciphertext in `ai_settings`.

## Verification

```bash
npm run lint
npm run build
```
