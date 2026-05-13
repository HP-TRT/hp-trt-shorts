require('dotenv').config();
const { getLastRuns } = require('./db/database');

const runs = getLastRuns(7);

if (runs.length === 0) {
  console.log('No pipeline runs found yet.');
  process.exit(0);
}

console.log('\n=== HP-TRT Pipeline — Last 7 Runs ===\n');
for (const run of runs) {
  const status = run.status === 'success' ? '✅' : '❌';
  console.log(`${status} ${run.date}`);
  console.log(`   Topic : ${run.topic || 'N/A'}`);
  console.log(`   Title : ${run.title || 'N/A'}`);
  console.log(`   URL   : ${run.youtube_url || 'N/A'}`);
  if (run.status !== 'success') console.log(`   Error : ${run.error}`);
  console.log(`   Time  : ${run.duration_seconds}s\n`);
}
