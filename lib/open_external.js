// lib/open_external.js — cross-platform "open externally" helper
import { spawn } from 'node:child_process';
import process from 'node:process';

function spawnDetached(cmd, args, opts = {}) {
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget: attempt to open a file/URL using the platform's default handler.
// Intentionally does not throw; failures are ignored to match previous behavior.
export function openExternal(targetPath) {
  const p = String(targetPath || '');
  const plt = process.platform;

  if (plt === 'darwin') {
    spawnDetached('open', [p]);
    return;
  }
  if (plt === 'win32') {
    // Use cmd's built-in 'start' with empty title argument
    spawnDetached('cmd', ['/c', 'start', '', p], { windowsVerbatimArguments: true });
    return;
  }

  // Linux/Unix: try common openers, best-effort
  if (spawnDetached('xdg-open', [p])) return;
  if (spawnDetached('gio', ['open', p])) return;
  if (spawnDetached('gnome-open', [p])) return;
  if (spawnDetached('kde-open', [p])) return;
  // WSL integration if present
  spawnDetached('wslview', [p]);
}
