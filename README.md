# Grove

Grove is a connected writing space for drafting stories and maintaining a
world bible. The current vertical slice includes:

- A rich-text editor with local autosave
- A responsive project dashboard for separate books and worlds
- Private 2:3 book-cover thumbnails backed by Supabase Storage
- Hierarchical pages and child-page creation
- Changeable page types with light JSON fields
- A dedicated Chapters list and print-to-PDF manuscript export
- Named page relationships, plus a pan-able Web view
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

Open <http://localhost:3000>. With Supabase configured, sign in to reach the
project dashboard and open a project-specific writing workspace.

## Connect Supabase

Supabase is not required for the local vertical slice. When ready:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add the project URL and publishable key from **Project Settings > API**.
4. Generate `AI_KEY_ENCRYPTION_SECRET` with `openssl rand -base64 32`.
5. Apply the SQL files in `supabase/migrations` in numeric order, or link the
   Supabase CLI and run `supabase db push`. Migration `006` creates the private
   `workspace-covers` bucket and project-creation function. Migration `007`
   adds project-specific page tags. Migration `008` adds page types, JSON
   fields, and named page relationships.

Do not expose the database password, service-role key, or encryption secret in
the browser. The migration enables row-level security and provisions one
workspace and starter page for each new account.

## Research search

In-app research search uses Tavily. Add a server-side `TAVILY_API_KEY` to
`.env.local`; never expose it with a `NEXT_PUBLIC_` prefix.

## Cover uploads

Project owners can upload JPEG, PNG, or WebP covers up to 5 MB from the
dashboard. Grove stores the original image in the private
`workspace-covers` bucket and displays it in a consistent 2:3 frame without
stretching the source image.

## AI behavior

In cloud mode, provider keys are encrypted server-side with AES-256-GCM and
stored as ciphertext in `ai_settings`. Decrypted keys remain server-only and
are used solely for the authenticated user's AI request. Use HTTPS in every
deployed environment.

## Verification

```bash
npm run lint
npm test
npm run build
```
