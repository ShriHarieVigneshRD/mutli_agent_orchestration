// shortcut: Windows-only workaround. Vitest loads itself twice ("failed to find the current suite")
// when cwd has a lower-case drive letter, as VS Code terminals often do. Drop this once Vitest fixes it.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = path.join(cwd, 'node_modules', 'vitest', 'vitest.mjs');
const { status } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(status ?? 1);
