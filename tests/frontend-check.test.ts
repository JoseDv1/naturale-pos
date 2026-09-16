import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

describe('Frontend Typecheck & Svelte 5 Diagnostics', () => {
  it('cd frontend && bun run check must pass with 0 errors', () => {
    const frontendDir = resolve(__dirname, '../frontend');
    const result = spawnSync('bun', ['run', 'check'], {
      cwd: frontendDir,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}` }
    });

    console.log('SVELTE-CHECK OUTPUT:\n', result.stdout);
    if (result.stderr) {
      console.error('SVELTE-CHECK ERROR:\n', result.stderr);
    }

    expect(result.status).toBe(0);
  }, 30000);
});
