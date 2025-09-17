#!/usr/bin/env node
// mapping_reduce — reduce a conversation mapping to a minimal messages array
import fs from 'node:fs';
import { reduceMappingToMessages } from '../lib/gpt.js';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function usage() {
  process.stderr.write('Usage:\n');
  process.stderr.write('  node cli/mapping_reduce.js conversations.json [index] > messages.json\n');
  process.stderr.write(
    '  node cli/mapping_reduce.js mapping.json [current_node_id] > messages.json\n',
  );
  process.exit(1);
}

function main() {
  const file = process.argv[2];
  if (!file) usage();
  const arg2 = process.argv[3];
  const data = readJson(file);
  let mapping, current;
  if (Array.isArray(data)) {
    const idx = arg2 ? Number(arg2) : 0;
    const convo = data[idx];
    if (!convo || typeof convo !== 'object') {
      process.stderr.write('Invalid conversation index\n');
      process.exit(1);
    }
    mapping = convo.mapping || {};
    current = convo.current_node || undefined;
  } else if (data && typeof data === 'object') {
    if (data.mapping) {
      mapping = data.mapping;
      current = data.current_node || arg2;
    } else {
      mapping = data;
      current = arg2;
    }
  } else {
    process.stderr.write('Unrecognized JSON shape\n');
    process.exit(1);
  }

  const messages = reduceMappingToMessages(mapping, { currentNodeId: current });
  process.stdout.write(JSON.stringify(messages, null, 2));
}

main();
