/**
 * Shared plumbing for the CLI scripts (`leaks`, `split-hands`): failing loud and
 * walking a directory of exports. Kept out of `src/lib/hh` because it touches the
 * filesystem, which the library layer deliberately does not.
 */

import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';

export function die(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * Whether an entry is a directory, following symlinks. A stale symlink — an
 * unmounted drive, a renamed download folder — is skipped rather than crashing
 * the whole run.
 */
function isDirectory(path: string, entry: Dirent): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Every .txt under a target, recursively — tournaments and cash sessions live in
 * subfolders. Symlinked directories are followed, because pointing a folder at
 * the client's download directory is the obvious way to use this; `seen` holds
 * real paths so a symlink back up its own tree terminates instead of looping.
 */
export function collect(target: string, seen = new Set<string>()): string[] {
  if (!existsSync(target)) die(`no such path: ${target}`);
  if (statSync(target).isFile()) return [target];

  const real = realpathSync(target);
  if (seen.has(real)) return [];
  seen.add(real);

  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const path = join(target, entry.name);
    if (isDirectory(path, entry)) return collect(path, seen);
    return entry.name.toLowerCase().endsWith('.txt') ? [path] : [];
  });
}

/**
 * Every .txt under every target, each file once. Overlapping targets — `hands`
 * and `hands/cash`, or a file named alongside its own folder — share one `seen`
 * set and are deduped by real path; walked separately, every hand in the
 * overlap came back as a duplicate of itself and was reported excluded.
 */
export function collectAll(targets: string[]): string[] {
  const seen = new Set<string>();
  const files = new Map<string, string>();
  for (const target of targets) {
    for (const path of collect(target, seen)) {
      const real = realpathSync(path);
      if (!files.has(real)) files.set(real, path);
    }
  }
  return [...files.values()];
}
