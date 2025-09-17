// lib/gpt.js — utilities to reduce ChatGPT conversation mappings
import path from 'node:path';
import { safeFilename, writeFileUnique } from './io.js';

// Extract a human-readable text from a message.content structure
export function extractTextFromContent(content) {
  if (!content) return '';
  // Common export shape: { content_type: 'text'|'multimodal_text', parts: [...] }
  const parts = Array.isArray(content.parts) ? content.parts : null;
  const out = [];
  const partToString = p => {
    if (p === null || p === undefined) return '';
    if (typeof p === 'string') return p;
    if (typeof p === 'number' || typeof p === 'boolean') return String(p);
    if (typeof p === 'object') {
      if (typeof p.text === 'string') return p.text;
      if (typeof p.content === 'string') return p.content;
      if (Array.isArray(p.content)) return p.content.map(partToString).filter(Boolean).join('\n');
      if (Array.isArray(p.parts)) return p.parts.map(partToString).filter(Boolean).join('\n');
    }
    return '';
  };
  if (parts) {
    for (const p of parts) {
      const s = partToString(p);
      if (s) out.push(s);
    }
  } else if (typeof content.text === 'string') {
    out.push(content.text);
  } else if (typeof content === 'string') {
    out.push(content);
  }
  return out.join('\n').trim();
}

export function extractAuthor(message) {
  const a = message && message.author ? message.author : null;
  if (!a) return 'unknown';
  if (typeof a.role === 'string' && a.role) return a.role;
  if (typeof a.name === 'string' && a.name) return a.name;
  return 'unknown';
}

// Build main path IDs from currentNodeId back to root using parent pointers
export function buildMainPathIds(mapping, currentNodeId) {
  const ids = [];
  let id = currentNodeId;
  const seen = new Set();
  while (id && mapping[id] && !seen.has(id)) {
    seen.add(id);
    ids.push(id);
    id = mapping[id].parent;
  }
  return ids.reverse();
}

// Auto-detect a reasonable leaf if currentNodeId is not provided
export function autoDetectLeafId(mapping) {
  let bestId = null;
  let bestTime = -Infinity;
  for (const [id, node] of Object.entries(mapping)) {
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;
    const msg = node.message;
    const t = msg && typeof msg.create_time === 'number' ? msg.create_time : undefined;
    if (!hasChildren && msg) {
      if (t !== undefined && t > bestTime) {
        bestTime = t;
        bestId = id;
      } else if (t === undefined && (bestId === null || bestId === undefined)) {
        bestId = id;
      }
    }
  }
  return bestId;
}

// Reduce mapping to a sequential array of messages with minimal fields
export function reduceMappingToMessages(
  mapping,
  { currentNodeId, includeRoles = ['user', 'assistant'] } = {},
) {
  if (!mapping || typeof mapping !== 'object') return [];
  const endId = currentNodeId || autoDetectLeafId(mapping);
  if (!endId) return [];
  const pathIds = buildMainPathIds(mapping, endId);
  const result = [];
  for (const id of pathIds) {
    const node = mapping[id];
    if (!node || !node.message) continue;
    const author = extractAuthor(node.message);
    if (
      includeRoles &&
      Array.isArray(includeRoles) &&
      includeRoles.length &&
      !includeRoles.includes(author)
    )
      continue;
    const text = extractTextFromContent(node.message.content);
    if (!text) continue;
    result.push({ author, text });
  }
  return result;
}

// Build a plain-text transcript similar to the viewer formatting
// Each message is rendered as:
//   [author]\n
//   <text>\n
export function buildPlainTextTranscript(messages) {
  const out = [];
  for (const m of messages) {
    const who = m.author || 'unknown';
    out.push(`[${who}]`);
    out.push(String(m.text || ''));
    out.push('');
  }
  return out.join('\n');
}

// Export a conversation as plain text into the `exports/` folder.
// Returns the absolute file path created.
export async function exportConversationPlain(title, messages) {
  const dir = path.resolve('exports');
  const name = safeFilename(title);
  const content = buildPlainTextTranscript(messages);
  const p = await writeFileUnique(dir, name, '.txt', content);
  return p;
}
