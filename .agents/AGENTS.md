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
