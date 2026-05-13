require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../logs/logger');

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const AVATAR_ID = process.env.HEYGEN_AVATAR_ID;
const VOICE_ID = process.env.HEYGEN_VOICE_ID;
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');

const heygen = axios.create({
  baseURL: 'https://api.heygen.com',
  headers: { 'X-Api-Key': HEYGEN_API_KEY, 'Content-Type': 'application/json' },
  timeout: 30000
});

async function createVideo(cleanScript) {
  const res = await heygen.post('/v2/video/generate', {
    video_inputs: [{
      character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' },
      voice: { type: 'text', input_text: cleanScript, voice_id: VOICE_ID, speed: 1.05 },
      background: { type: 'color', value: '#000000' }
    }],
    dimension: { width: 1080, height: 1920 },
    aspect_ratio: '9:16'
  });
  return res.data.data.video_id;
}

async function pollStatus(videoId, maxMinutes = 10) {
  const maxAttempts = (maxMinutes * 60) / 15;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 15000));
    const res = await heygen.get(`/v1/video_status.get?video_id=${videoId}`);
    const { status, video_url, error } = res.data.data;
    logger.info(`HeyGen status: ${status} (attempt ${i + 1})`);
    if (status === 'completed') return video_url;
    if (status === 'failed') throw new Error(`HeyGen render failed: ${error}`);
  }
  throw new Error('HeyGen render timed out after 10 minutes');
}

async function downloadVideo(videoUrl, filename) {
  if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  const dest = path.join(DOWNLOADS_DIR, filename);
  const res = await axios.get(videoUrl, { responseType: 'stream', timeout: 120000 });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(dest);
    res.data.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return dest;
}

async function generateVideo(cleanScript) {
  logger.info('Stage 4: Generating HeyGen video...');

  const videoId = await createVideo(cleanScript);
  logger.info(`HeyGen video job created: ${videoId}`);

  const videoUrl = await pollStatus(videoId);
  logger.info(`HeyGen render complete: ${videoUrl}`);

  const date = new Date().toISOString().slice(0, 10);
  const rawPath = await downloadVideo(videoUrl, `${date}_raw.mp4`);
  logger.info(`Video downloaded to: ${rawPath}`);

  return { rawVideoPath: rawPath, heygenVideoId: videoId };
}

module.exports = generateVideo;
