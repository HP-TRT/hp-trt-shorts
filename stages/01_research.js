require('dotenv').config();
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logs/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SERPAPI_KEY = process.env.SERPAPI_KEY;

const SEARCH_TERMS = [
  'TRT testosterone replacement therapy',
  'HRT women hormone therapy',
  'low testosterone symptoms men',
  'testosterone clinic',
  'hormone optimization',
  'TRT benefits side effects',
  'HRT menopause symptoms',
  'testosterone levels age',
  'peptide therapy TRT',
  'low T signs treatment'
];

const COMPETITORS = ['Defy Medical', 'Evolve Telemed', 'Fountain TRT', 'MaxHealth', 'RejuvMedical'];

async function serpSearch(params) {
  const res = await axios.get('https://serpapi.com/search', {
    params: { ...params, api_key: SERPAPI_KEY },
    timeout: 30000
  });
  return res.data;
}

async function getGoogleTrends() {
  try {
    const results = [];
    for (const term of SEARCH_TERMS.slice(0, 5)) {
      const data = await serpSearch({ engine: 'google', q: term, tbm: 'nws', num: 5 });
      if (data.news_results) {
        results.push(...data.news_results.map(r => ({ term, title: r.title, source: 'Google News' })));
      }
    }
    return results;
  } catch (err) {
    logger.error(`Google Trends search failed: ${err.message}`);
    return [];
  }
}

async function getYouTubeResults() {
  try {
    const results = [];
    const queries = ['TRT testosterone therapy', 'HRT women symptoms', 'low testosterone signs', 'hormone clinic'];
    for (const q of queries) {
      const data = await serpSearch({ engine: 'youtube', search_query: q });
      if (data.video_results) {
        results.push(...data.video_results.slice(0, 5).map(v => ({
          title: v.title,
          views: v.views,
          channel: v.channel?.name,
          source: 'YouTube'
        })));
      }
    }
    return results;
  } catch (err) {
    logger.error(`YouTube search failed: ${err.message}`);
    return [];
  }
}

async function getRedditQuestions() {
  try {
    const results = [];
    const subreddits = ['Testosterone', 'TRT', 'Hormones'];
    for (const sub of subreddits) {
      const data = await serpSearch({ engine: 'google', q: `site:reddit.com/r/${sub} TRT HRT`, num: 5 });
      if (data.organic_results) {
        results.push(...data.organic_results.map(r => ({ title: r.title, source: `Reddit r/${sub}` })));
      }
    }
    return results;
  } catch (err) {
    logger.error(`Reddit search failed: ${err.message}`);
    return [];
  }
}

async function analyzeWithClaude(googleResults, youtubeResults, redditResults, recentTopics) {
  const recentList = recentTopics.map(t => t.topic).filter(Boolean).join('\n');

  const prompt = `You are a content strategist for HP-TRT, a men's and women's TRT/HRT clinic.

Here is recent data from Google, YouTube, and Reddit about TRT/HRT topics:

GOOGLE/NEWS RESULTS:
${googleResults.slice(0, 10).map(r => `- ${r.title}`).join('\n')}

YOUTUBE TOP VIDEOS:
${youtubeResults.slice(0, 10).map(r => `- "${r.title}" (${r.views || 'unknown'} views)`).join('\n')}

REDDIT HOT QUESTIONS:
${redditResults.slice(0, 10).map(r => `- ${r.title}`).join('\n')}

COMPETITOR CLINICS TO MONITOR: ${COMPETITORS.join(', ')}

RECENTLY USED TOPICS (do NOT suggest these or similar angles):
${recentList || 'None yet'}

Based on this data, identify the top 10 trending TRT/HRT topics that would make great YouTube Shorts.
Each topic must be on a unique angle not already covered in the recent topics list.
Alternate between men's and women's health topics.

Return ONLY a JSON array with exactly 10 items:
[
  {
    "topic": "What happens to your body in the first 30 days on TRT",
    "keywords": ["TRT first month", "testosterone therapy results"],
    "search_volume_estimate": "high",
    "platform_traction": ["YouTube", "Reddit"],
    "gender_focus": "men",
    "source": "YouTube top results"
  }
]

Return valid JSON only. No other text.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = msg.content[0].text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON for topics');
  return JSON.parse(jsonMatch[0]);
}

async function research(recentTopics = []) {
  logger.info('Stage 1: Starting trend research...');

  const [googleResults, youtubeResults, redditResults] = await Promise.all([
    getGoogleTrends(),
    getYouTubeResults(),
    getRedditQuestions()
  ]);

  logger.info(`Collected ${googleResults.length} Google, ${youtubeResults.length} YouTube, ${redditResults.length} Reddit results`);

  const allTopics = await analyzeWithClaude(googleResults, youtubeResults, redditResults, recentTopics);

  const topic = allTopics[0];
  logger.info(`Top topic selected: "${topic.topic}"`);

  return {
    topic: topic.topic,
    keywords: topic.keywords,
    genderFocus: topic.gender_focus,
    allTopics
  };
}

module.exports = research;

if (require.main === module) {
  research().then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
}
