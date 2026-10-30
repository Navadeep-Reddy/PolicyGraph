import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { hashClauseText } from '../src/policies/change-classifier.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pdfDemo = process.argv.includes('--pdf');

interface PdfDemoArtifact {
  id: string;
  name: string;
  type: string;
  department: string;
  description: string;
  content: string;
}

async function loadPdfDemoArtifacts(): Promise<PdfDemoArtifact[]> {
  const source: unknown = JSON.parse(await readFile(new URL('../../samples/policy-pdfs/compact-operational-items.json', import.meta.url), 'utf8'));
  if (!Array.isArray(source)) throw new Error('Invalid PDF-demo operational items');
  const types = new Set(['FORM', 'PROCEDURE', 'CHECKLIST', 'TRAINING_MATERIAL', 'DEPARTMENT_INSTRUCTION', 'INFORMATION_SHEET']);
  const items: PdfDemoArtifact[] = [];
  const names = new Set<string>();
  for (const entry of source as unknown[]) {
    if (typeof entry !== 'object' || entry === null) throw new Error('Invalid PDF-demo operational item');
    const item = entry as Record<string, unknown>;
    const { name, type, department, description, content } = item;
    if (typeof name !== 'string' || !name.trim() || typeof type !== 'string' || !types.has(type)
      || typeof department !== 'string' || !department.trim() || typeof description !== 'string'
      || typeof content !== 'string' || !content.trim() || names.has(name)) throw new Error('Invalid or duplicate PDF-demo operational item');
    names.add(name);
    items.push({ id: `caresync-pdf-demo-item-${items.length + 1}`, name, type, department, description, content });
  }
  if (items.length !== 3) throw new Error('PDF demo requires exactly 3 visitor-access operational items');
  return items;
}
const demo = {
  policyId: 'caresync-demo-hospital-visitor-policy',
  versions: ['caresync-demo-visitor-policy-v1', 'caresync-demo-visitor-policy-v2'],
  artifacts: [
    { id: 'caresync-demo-security-desk-procedure', name: 'Security Desk Procedure', type: 'PROCEDURE', department: 'Security', description: 'Steps for registering visitors and enforcing the 8:00 PM visiting-hours cutoff.', content: 'Register each visitor at the security desk. Confirm the visitor badge is worn inside the hospital. Visiting hours end at 8:00 PM; direct visitors arriving later to leave.' },
    { id: 'caresync-demo-ward-visitor-checklist', name: 'Ward Visitor Checklist', type: 'CHECKLIST', department: 'Ward Operations', description: 'A shift checklist for visitor registration, badges, and the 8:00 PM cutoff.', content: 'Confirm visitors registered at security, wearing badges, and leaving by 8:00 PM.' },
    { id: 'caresync-demo-visitor-information-sheet', name: 'Visitor Information Sheet', type: 'INFORMATION_SHEET', department: 'Visitor Services', description: 'Visitor-facing guidance on registration, badges, and visiting hours.', content: 'All visitors must register at the security desk and wear a visitor badge inside the hospital. Visiting hours end at 8:00 PM.' },
    { id: 'caresync-demo-visitor-access-training', name: 'Visitor Access Training', type: 'TRAINING_MATERIAL', department: 'Staff Education', description: 'Staff training follows the security desk visitor procedure.', content: 'Train staff to follow the Security Desk Procedure for registration, badge use, and the 8:00 PM cutoff.' },
  ],
};
const clauses = [
  { stableKey: 'VISITING-HOURS', title: 'Visiting Hours', category: 'visitor_access', position: 0, v1: 'Visiting hours end at 8:00 PM.', v2: 'Visiting hours end at 6:00 PM.' },
  { stableKey: 'VISITOR-REGISTRATION', title: 'Visitor Registration', category: 'visitor_access', position: 1, v1: 'All visitors must register at the security desk.', v2: 'All visitors must register at the security desk.' },
  { stableKey: 'VISITOR-BADGES', title: 'Visitor Badges', category: 'visitor_access', position: 2, v1: 'Visitors must wear a visitor badge inside the hospital.', v2: 'Visitors must wear a visitor badge inside the hospital.' },
];

async function main(): Promise<void> {
  const pdfArtifacts = pdfDemo ? await loadPdfDemoArtifacts() : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL statement_timeout = 15000');

    await client.query('DELETE FROM "ImpactResult"');
    await client.query('DELETE FROM "ImpactRun"');
    await client.query('DELETE FROM "DependencyEdge"');
    await client.query('DELETE FROM "Clause"');
    await client.query('DELETE FROM "PolicyVersion"');
    await client.query('DELETE FROM "Artifact"');
    await client.query('DELETE FROM "Policy"');

    if (pdfDemo) {
      for (const item of pdfArtifacts) await client.query('INSERT INTO "Artifact" (id, name, type, department, description, content) VALUES ($1, $2, $3, $4, $5, $6)', [item.id, item.name, item.type, item.department, item.description, item.content]);
      await client.query('COMMIT');
      console.log(JSON.stringify({ mode: 'pdf', policyCount: 0, artifactCount: pdfArtifacts.length, artifactIds: pdfArtifacts.map(({ id }) => id) }));
      return;
    }

    await client.query('INSERT INTO "Policy" (id, title, description, "createdAt", "updatedAt") VALUES ($1, $2, $3, now(), now())', [demo.policyId, 'Hospital Visitor Policy', 'Visitor access, registration, badges, and visiting-hours policy.']);
    const publishedAt = new Date('2026-10-01T12:00:00.000Z');
    await client.query('INSERT INTO "PolicyVersion" (id, "policyId", "versionNumber", status, "publishedAt", "createdAt") VALUES ($1, $3, 1, $4, $5, now()), ($2, $3, 2, $6, NULL, now())', [demo.versions[0], demo.versions[1], demo.policyId, 'ACTIVE', publishedAt, 'DRAFT']);
    for (const [index, clause] of clauses.entries()) {
      for (const [version, text] of [[demo.versions[0], clause.v1], [demo.versions[1], clause.v2]] as const) {
        await client.query('INSERT INTO "Clause" (id, "policyVersionId", "stableKey", title, text, category, position, "textHash") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [`caresync-demo-clause-v${version === demo.versions[0] ? 1 : 2}-${index + 1}`, version, clause.stableKey, clause.title, text, clause.category, clause.position, hashClauseText(text)]);
      }
    }
    for (const item of demo.artifacts) await client.query('INSERT INTO "Artifact" (id, name, type, department, description, content) VALUES ($1, $2, $3, $4, $5, $6)', [item.id, item.name, item.type, item.department, item.description, item.content]);
    const dependencies = [
      ['CLAUSE', 'VISITING-HOURS', null, demo.artifacts[0].id, 'GOVERNS', 'The visiting-hours clause sets the cutoff security staff enforce at registration.'],
      ['CLAUSE', 'VISITING-HOURS', null, demo.artifacts[1].id, 'UPDATES', 'The checklist guides ward staff through the clause’s visitor cutoff.'],
      ['CLAUSE', 'VISITING-HOURS', null, demo.artifacts[2].id, 'APPEARS_IN', 'The information sheet communicates the visiting-hours rule to visitors.'],
      ['ARTIFACT', null, demo.artifacts[0].id, demo.artifacts[3].id, 'UPDATES', 'Visitor access training follows the security desk procedure.'],
    ] as const;
    for (let index = 0; index < dependencies.length; index++) {
      const [sourceType, sourceClauseKey, sourceArtifactId, targetArtifactId, relationshipType, rationale] = dependencies[index];
      await client.query('INSERT INTO "DependencyEdge" (id, "policyId", "sourceType", "sourceClauseKey", "sourceArtifactId", "targetArtifactId", "relationshipType", status, origin, rationale) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [`caresync-demo-edge-${index + 1}`, demo.policyId, sourceType, sourceClauseKey, sourceArtifactId, targetArtifactId, relationshipType, 'APPROVED', 'MANUAL', rationale]);
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ policyId: demo.policyId, versionIds: demo.versions, artifactIds: demo.artifacts.map(({ id }) => id) }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo setup failed.');
  process.exitCode = 1;
});
