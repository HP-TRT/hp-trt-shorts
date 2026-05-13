require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logs/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripSectionLabels(script) {
  return script
    .replace(/\[HOOK[^\]]*\]\s*/gi, '')
    .replace(/\[VALUE[^\]]*\]\s*/gi, '')
    .replace(/\[CTA[^\]]*\]\s*/gi, '')
    .trim();
}

async function writeScript(title, topic) {
  logger.info('Stage 3: Writing script...');

  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/script_prompt.txt'), 'utf8');
  const prompt = promptTemplate
    .replace('{title}', title)
    .replace('{topic}', topic);

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  const script = msg.content[0].text.trim();

  if (!script.includes('[HOOK') || !script.includes('[VALUE') || !script.includes('[CTA')) {
    throw new Error('Script is missing required sections [HOOK], [VALUE], or [CTA]');
  }

  const cleanScript = stripSectionLabels(script);
  const wordCount = cleanScript.split(/\s+/).length;
  logger.info(`Script written: ${wordCount} words`);

  return { script, cleanScript };
}

module.exports = writeScript;

if (require.main === module) {
  writeScript('5 Signs Your Testosterone Is Crashing', 'low testosterone symptoms men')
    .then(r => console.log(r.script))
    .catch(console.error);
}
