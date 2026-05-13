require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logs/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateTitle(topic, keywords, recentTopics = []) {
  logger.info('Stage 2: Generating title...');

  const promptTemplate = fs.readFileSync(path.join(__dirname, '../prompts/title_prompt.txt'), 'utf8');
  const recentTitlesList = recentTopics.map(t => t.title).filter(Boolean).join('\n');

  const prompt = promptTemplate
    .replace('{topic}', topic)
    .replace('{keywords}', Array.isArray(keywords) ? keywords.join(', ') : keywords)
    .replace('{platform_traction}', 'YouTube, Google, Reddit')
    .replace('{recent_titles}', recentTitlesList || 'None yet');

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = msg.content[0].text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON for titles');

  const allTitles = JSON.parse(jsonMatch[0]);
  allTitles.sort((a, b) => b.score - a.score);

  const selected = allTitles.find(t => t.score >= 8) || allTitles[0];
  logger.info(`Title selected: "${selected.title}" (score: ${selected.score})`);

  return { title: selected.title, allTitles };
}

module.exports = generateTitle;

if (require.main === module) {
  generateTitle('5 signs your testosterone is low', ['low T', 'testosterone symptoms'])
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .catch(console.error);
}
