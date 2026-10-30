import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ClauseExtractionService, type ExtractedClause } from '../src/ai/clause-extraction.service.js';
import { NvidiaClient } from '../src/ai/nvidia.client.js';
import { QwenOcrService } from '../src/ai/qwen-ocr.service.js';
import { runImpactBfs } from '../src/impact/bfs.js';
import { classifyClauseChanges, hashClauseText } from '../src/policies/change-classifier.js';
import { PdfDocumentService } from '../src/policies/pdf-document.service.js';

// Opt-in real-provider check; no database writes or app-service startup.
const directory = new URL('../../samples/policy-pdfs/', import.meta.url);
const pdf = new PdfDocumentService(new QwenOcrService());
const extraction = new ClauseExtractionService(new NvidiaClient());
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

async function extractVersion(version: number, existing: ExtractedClause[] = []) {
  const name = `visitor-access-compact-v${version}`;
  const source = await readFile(new URL(`source/${name}.md`, directory), 'utf8');
  const expected = [...source.matchAll(/^### [^\n]+\n\n([^\n]+)/gm)].map(match => normalize(match[1]));
  assert.equal(expected.length, 3);
  const buffer = await readFile(new URL(`${name}.pdf`, directory));
  assert(buffer.length < 15 * 1024 * 1024);
  const document = await pdf.extract(buffer);
  assert.equal(document.pages, 1);
  const clauses = await extraction.extract(document.text, existing);
  assert.deepEqual(clauses.map(clause => normalize(clause.text)), expected, `${name} must extract exactly the three operative rules, in source order`);
  console.log(`${name}: one page; exactly three expected clauses extracted.`);
  return clauses;
}

async function main() {
  const items: { name: string; type: string; department: string; description: string; content: string }[] = JSON.parse(await readFile(new URL('compact-operational-items.json', directory), 'utf8'));
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(item => item.name), ['Security Desk Visitor Procedure', 'Visitor Information Sheet', 'Visitor Access Training Module']);
  assert(items.every(item => item.description && item.content));
  const base = await extractVersion(1);
  const target = await extractVersion(2, base);
  const withHash = (clauses: ExtractedClause[]) => clauses.map(clause => ({ ...clause, textHash: hashClauseText(clause.text) }));
  const changes = classifyClauseChanges(withHash(base), withHash(target));
  assert.deepEqual(changes.map(change => change.changeType), ['MODIFIED', 'UNCHANGED', 'UNCHANGED']);

  const hours = `clause:${base[0].stableKey}`;
  const registration = `clause:${base[1].stableKey}`;
  const badges = `clause:${base[2].stableKey}`;
  const procedure = 'artifact:caresync-pdf-demo-item-1';
  const sheet = 'artifact:caresync-pdf-demo-item-2';
  const training = 'artifact:caresync-pdf-demo-item-3';
  const edges = [[hours, procedure], [hours, sheet], [registration, procedure], [badges, sheet], [procedure, training]]
    .map(([sourceNodeId, targetNodeId], index) => ({ id: `compact-edge-${index + 1}`, sourceNodeId, targetNodeId, status: 'APPROVED' }));
  const artifacts = new Set([procedure, sheet, training]);
  const impacts = runImpactBfs(changes, edges, artifacts);
  assert.deepEqual(impacts.map(result => [result.artifactId, result.distance]), [
    ['caresync-pdf-demo-item-1', 1], ['caresync-pdf-demo-item-2', 1], ['caresync-pdf-demo-item-3', 2],
  ]);
  assert.deepEqual(impacts[2].pathNodeIds, [hours, procedure, training]);
  for (const [key, expectedCount] of [[base[1].stableKey, 2], [base[2].stableKey, 1]] as const) {
    assert.equal(runImpactBfs([{ stableKey: key, changeType: 'MODIFIED' }], edges, artifacts).length, expectedCount);
  }
  console.log(JSON.stringify({
    seededItemCount: items.length,
    changes: changes.map(({ stableKey, changeType }) => ({ stableKey, changeType })),
    hoursImpacts: impacts.map(result => ({ item: items[Number(result.artifactId.slice(-1)) - 1].name, distance: result.distance })),
    indirectPath: impacts[2].pathNodeIds,
    otherClauseImpactPathsVerified: true,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
