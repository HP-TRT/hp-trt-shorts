require('dotenv').config();
const cron = require('node-cron');
const { runPipeline } = require('./pipeline');
const logger = require('./logs/logger');

const hour = process.env.POST_TIME_HOUR || '9';
const minute = process.env.POST_TIME_MINUTE || '0';
const timezone = process.env.POST_TIMEZONE || 'America/Chicago';

cron.schedule(`${minute} ${hour} * * *`, async () => {
  logger.info(`[${new Date().toISOString()}] Running daily HP-TRT pipeline...`);
  await runPipeline();
}, { timezone });

logger.info(`HP-TRT scheduler running. Pipeline fires daily at ${hour}:${minute.padStart(2,'0')} ${timezone}.`);
