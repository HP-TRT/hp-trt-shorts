require('dotenv').config();
const research = require('./stages/01_research');
const generateTitle = require('./stages/02_title');
const writeScript = require('./stages/03_script');
const generateVideo = require('./stages/04_heygen');
const addCaptionsBroll = require('./stages/05_submagic');
const uploadToYouTube = require('./stages/06_youtube');
const { logRun, getRecentTopics } = require('./db/database');
const logger = require('./logs/logger');

async function withRetry(fn, stageName, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      logger.error(`${stageName} failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt === maxRetries) {
        err.stage = stageName;
        throw err;
      }
      await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
}

async function runPipeline() {
  logger.info('--- HP-TRT Pipeline starting ---');
  const runId = Date.now();
  const startTime = Date.now();

  try {
    const recentTopics = getRecentTopics(30);

    logger.info('[1/6] Researching viral topics...');
    const { topic, keywords, allTopics } = await withRetry(
      () => research(recentTopics), 'Stage 1: Research'
    );

    logger.info('[2/6] Generating title...');
    const { title, allTitles } = await withRetry(
      () => generateTitle(topic, keywords, recentTopics), 'Stage 2: Title'
    );

    logger.info('[3/6] Writing script...');
    const { script, cleanScript } = await withRetry(
      () => writeScript(title, topic), 'Stage 3: Script'
    );

    logger.info('[4/6] Generating HeyGen video...');
    const { rawVideoPath, heygenVideoId } = await withRetry(
      () => generateVideo(cleanScript), 'Stage 4: HeyGen'
    );

    logger.info('[5/6] Adding captions and B-roll via Submagic...');
    const { finalVideoPath, submagicVideoId } = await withRetry(
      () => addCaptionsBroll(rawVideoPath), 'Stage 5: Submagic'
    );

    logger.info('[6/6] Uploading to YouTube...');
    const { youtubeUrl, videoId } = await withRetry(
      () => uploadToYouTube(finalVideoPath, title, script, keywords), 'Stage 6: YouTube'
    );

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    logRun({ runId, topic, allTopics, title, allTitles, script, heygenVideoId, submagicVideoId, videoId, youtubeUrl, status: 'success', durationSeconds });
    logger.info(`Pipeline complete in ${durationSeconds}s. Video live at: ${youtubeUrl}`);

  } catch (err) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    logger.error(`Pipeline failed at ${err.stage || 'unknown stage'}: ${err.message}`);
    logRun({ runId, status: 'failed', error: err.message, durationSeconds });
  }
}

module.exports = { runPipeline };

if (require.main === module) {
  runPipeline();
}
