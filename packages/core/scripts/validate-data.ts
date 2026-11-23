/**
 * Data-quality gate. Runs every check in src/validate and prints an audit report.
 * Exits non-zero on any error so CI and Vercel builds fail on bad data.
 *   pnpm validate:data           human-readable report
 *   pnpm validate:data --json    machine-readable report
 */
import { rawDataset, rawFootprints, rawOpenSpaces } from '../src/data.js';
import { validateOpenSpaces } from '../src/openSpaces.js';
import { validateFootprints } from '../src/validate/footprints.js';
import { validateDataset } from '../src/validate/index.js';

const report = validateDataset(rawDataset);
const buildings = (rawDataset.buildings as { id: string; status: string }[]);
const fpIssues = validateFootprints(
  rawFootprints,
  buildings.map((b) => b.id),
  buildings.filter((b) => b.status === 'verified').map((b) => b.id),
);
const osIssues = validateOpenSpaces(rawOpenSpaces, {
  buildingIds: buildings.map((b) => b.id),
  sourceIds: (rawDataset.sources as { id: string }[]).map((s) => s.id),
});
for (const i of [...fpIssues, ...osIssues]) (i.severity === 'error' ? report.errors : report.warnings).push(i);
report.ok = report.errors.length === 0;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Nittany Rooms data audit — ${report.generatedAt}`);
  console.log(Object.entries(report.counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  console.log(`  user-facing: ${report.userFacing.buildingIds.length} buildings, ${report.userFacing.roomIds.length} rooms`);
  for (const i of [...report.errors, ...report.warnings]) {
    console.log(`  ${i.severity === 'error' ? '✗' : '!'} [${i.code}] ${i.ref ?? ''} ${i.message}`);
  }
  for (const e of report.excluded) console.log(`  – excluded ${e.ref}: ${e.reasons.join(', ')}`);
  console.log(report.ok ? '✓ data OK' : `✗ ${report.errors.length} error(s)`);
}
process.exit(report.ok ? 0 : 1);
