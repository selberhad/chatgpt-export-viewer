// lib/viewers.js — common viewer spawners (e.g., JSON tree)
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ['inherit', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0 ? resolve() : reject(new Error(path.basename(scriptPath) + ' exit ' + code)),
    );
  });
}

export async function showJsonTreeFile(filePath) {
  const viewerPath = path.resolve('cli/jsontree.js');
  await runNodeScript(viewerPath, [filePath]);
}

export async function showJsonTreeFromObject(obj, { filename = 'data.json', pretty = true } = {}) {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'jsonview-'));
  const file = path.join(dir, filename);
  const json = pretty ? JSON.stringify(obj ?? {}, null, 2) : JSON.stringify(obj ?? {});
  await fsp.writeFile(file, json, 'utf8');
  try {
    await showJsonTreeFile(file);
  } finally {
    try {
      await fsp.rm(dir, { recursive: true, force: true });
    } catch {}
  }
}
