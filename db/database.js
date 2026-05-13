require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'pipeline_runs.jsonl');

function logRun(data) {
  const record = {
    id: Date.now(),
    date: new Date().toISOString(),
    run_id: String(data.runId || ''),
    topic: data.topic || null,
    all_topics: data.allTopics || null,
    title: data.title || null,
    all_titles: data.allTitles || null,
    script: data.script || null,
    heygen_video_id: data.heygenVideoId || null,
    submagic_video_id: data.submagicVideoId || null,
    youtube_video_id: data.videoId || null,
    youtube_url: data.youtubeUrl || null,
    status: data.status || 'unknown',
    error: data.error || null,
    duration_seconds: data.durationSeconds || null
  };
  fs.appendFileSync(DB_FILE, JSON.stringify(record) + '\n', 'utf8');
}

function readAllRuns() {
  if (!fs.existsSync(DB_FILE)) return [];
  return fs.readFileSync(DB_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function getRecentTopics(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return readAllRuns()
    .filter(r => r.status === 'success' && new Date(r.date) >= cutoff)
    .map(r => ({ topic: r.topic, title: r.title }));
}

function getLastRuns(limit = 7) {
  const all = readAllRuns();
  return all.slice(-limit).reverse().map(r => ({
    date: r.date,
    topic: r.topic,
    title: r.title,
    youtube_url: r.youtube_url,
    status: r.status,
    error: r.error,
    duration_seconds: r.duration_seconds
  }));
}

module.exports = { logRun, getRecentTopics, getLastRuns };
