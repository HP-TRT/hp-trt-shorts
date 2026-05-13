require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const logger = require('../logs/logger');

const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
const PENDING_DIR = path.join(__dirname, '../downloads/pending_submagic');

async function uploadToSubmagic(rawVideoPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(rawVideoPath));
  form.append('caption_style', 'bold_highlight');
  form.append('broll', 'true');
  form.append('language', 'en');

  const res = await axios.post('https://api.submagic.co/v1/videos', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${SUBMAGIC_API_KEY}`
    },
    timeout: 60000
  });
  return res.data.id || res.data.video_id;
}

async function pollSubmagic(videoId, maxMinutes = 15) {
  const maxAttempts = (maxMinutes * 60) / 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 20000));
    const res = await axios.get(`https://api.submagic.co/v1/videos/${videoId}/status`, {
      headers: { 'Authorization': `Bearer ${SUBMAGIC_API_KEY}` },
      timeout: 30000
    });
    const { status, output_url } = res.data;
    logger.info(`Submagic status: ${status} (attempt ${i + 1})`);
    if (status === 'ready' || status === 'completed') return output_url;
    if (status === 'failed') throw new Error('Submagic processing failed');
  }
  throw new Error('Submagic timed out after 15 minutes');
}

async function downloadFinal(outputUrl, filename) {
  const dest = path.join(DOWNLOADS_DIR, filename);
  const res = await axios.get(outputUrl, { responseType: 'stream', timeout: 120000 });
  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(dest);
    res.data.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return dest;
}

async function addCaptionsBroll(rawVideoPath) {
  logger.info('Stage 5: Adding captions and B-roll via Submagic...');

  const date = new Date().toISOString().slice(0, 10);
  const finalFilename = `${date}_final.mp4`;

  try {
    const submagicId = await uploadToSubmagic(rawVideoPath);
    logger.info(`Submagic job created: ${submagicId}`);

    const outputUrl = await pollSubmagic(submagicId);
    logger.info(`Submagic complete: ${outputUrl}`);

    const finalPath = await downloadFinal(outputUrl, finalFilename);
    logger.info(`Final video saved: ${finalPath}`);

    fs.unlinkSync(rawVideoPath);

    return { finalVideoPath: finalPath, submagicVideoId: submagicId };

  } catch (err) {
    logger.error(`Submagic failed: ${err.message}. Falling back to raw video.`);

    if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
    const pendingPath = path.join(PENDING_DIR, path.basename(rawVideoPath));
    fs.copyFileSync(rawVideoPath, pendingPath);
    logger.info(`Raw video saved to pending_submagic/ for manual upload: ${pendingPath}`);

    return { finalVideoPath: rawVideoPath, submagicVideoId: null };
  }
}

module.exports = addCaptionsBroll;
