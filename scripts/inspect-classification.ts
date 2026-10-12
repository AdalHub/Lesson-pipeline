import { eq } from 'drizzle-orm';
import { db, pool } from '../src/server/db';
import { classifications } from '../src/server/db/schema';

const submissionId = process.argv[2];
if (!submissionId) throw new Error('Usage: inspect-classification.ts <submission-id>');

async function main() {
try {
  const [row] = await db
    .select({ rawResponse: classifications.rawResponse })
    .from(classifications)
    .where(eq(classifications.submissionId, submissionId));
  if (!row) throw new Error(`No classification for ${submissionId}`);

  const raw = row.rawResponse as Record<string, unknown>;
  const samples = Array.isArray(raw.samples)
    ? (raw.samples as Array<Record<string, unknown>>).map((sample) => ({
        selectedCandidateKey: sample.selectedCandidateKey,
        object: sample.object,
      }))
    : [];

  console.log(
    JSON.stringify(
      {
        selectedCandidateKey: raw.selectedCandidateKey,
        retrievalPlan: raw.retrievalPlan,
        webResearch: raw.webResearch,
        retrievedCandidates: raw.retrievedCandidates,
        samples,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
