import { randomBytes } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export interface AtomicWriteDependencies {
  rename?: typeof rename;
}

export async function writeJsonAtomic(
  destination: string,
  value: unknown,
  dependencies: AtomicWriteDependencies = {},
): Promise<void> {
  const directory = dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = join(
    directory,
    `.${basename(destination)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await (dependencies.rename ?? rename)(temporary, destination);

    try {
      const directoryHandle = await open(directory, 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    } catch {
      // Some filesystems/platforms do not support syncing a directory.
    }
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
