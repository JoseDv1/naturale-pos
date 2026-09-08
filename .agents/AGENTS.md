# Project Rules for Naturale POS

## Svelte 5 Component Validation Rule

Whenever you create or modify a Svelte component file (extension `.svelte` under `frontend/` directory), you **MUST** invoke the `svelte5-validator` subagent to validate the file. 

The subagent will:
1. Validate that the code uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`, etc.) correctly.
2. Ensure event handlers use the modern syntax (e.g. `onclick` instead of `on:click`).
3. Check that repeating layout sections are abstracted using snippets (`{#snippet}`) and renders (`{@render}`).
4. Verify proper accessibility/semantic HTML attributes on interactive elements.
5. Execute type checking and Svelte linting by running `cd frontend && bun run check` to verify the build remains error-free.

Always present the subagent's report or recommendations to the user before finalizing the task.

## Database Migration Checker Rule

Whenever you create or modify database schemas (`prisma/schema.prisma`), SQL migrations (`prisma/migrations/**`), or migrator scripts (`src/migrator.ts`, `scripts/generate-migrations.ts`), you **MUST** invoke the `migration-checker` subagent to validate the changes.

The subagent will:
1. Validate schema syntax via `bunx prisma validate`.
2. Ensure client generation and embedded migration synchronization (`bun run db:generate && bun run build:migrations`).
3. Audit SQLite migration safety (table recreation risk, column loss, defaults, foreign key cascades).
4. Verify that seed scripts (`prisma/seed.ts` and `src/migrator.ts`) stay in sync with updated models.
5. Present the migration safety report and risk level to the user.

## QA Engineer Rule

Whenever you create or modify backend API routes (`src/api/**`), transaction handlers, financial calculations (sales, discounts, expenses), inventory stock operations, or prepare a release/deployment, you **MUST** invoke the `qa-engineer` subagent.

The subagent will:
1. Verify route request/response contracts and Zod schema validations.
2. Audit calculation logic (sale totals, stock increments/decrements, table state transitions).
3. Test edge cases and proper HTTP error codes (400, 401, 404, 500).
4. Execute tests (`bun test`) or run smoke test checks against the API.
5. Present the QA audit report and test results to the user.

