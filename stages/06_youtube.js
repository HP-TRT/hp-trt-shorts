require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../logs/logger');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getYouTubeClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return google.youtube({ version: 'v3', auth: oauth2Client });
}

async function generateDescription(title, script, keywords) {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Write a 2-sentence YouTube description for a Short titled "${title}".
Script summary: ${script.slice(0, 300)}
End with: "Visit hp-trt.com to join the program. Subscribe for daily tips on TRT and HRT."
Return only the description text, no quotes.`
    }]
  });
  const desc = msg.content[0].text.trim();
  const hashtags = '#TRT #testosterone #HRT #hormoneoptimization #hptrt #shorts #hormones #lowT #testosteronetherapy #hormonebalance';
  return `${desc}\n\n🔗 Join the HP-TRT program: https://hp-trt.com\n📱 Instagram: @hp_trt\n\n${hashtags}`;
}

function generateTags(keywords) {
  const base = ['TRT', 'testosterone', 'HRT', 'hormone replacement therapy',
    'low testosterone', 'hormone optimization', 'testosterone therapy',
    'TRT clinic', 'HRT for women', 'hormones'];
  const extra = (keywords || []).slice(0, 4);
  return [...new Set([...base, ...extra])].slice(0, 15);
}

async function uploadToYouTube(finalVideoPath, title, script, keywords) {
  logger.info('Stage 6: Uploading to YouTube...');

  const youtube = getYouTubeClient();
  const description = await generateDescription(title, script, keywords);
  const tags = generateTags(keywords);

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: `${title} #Shorts`,
        description,
        tags,
        categoryId: '26',
        defaultLanguage: 'en'
      },
      status: {
        privacyStatus: 'public',
        madeForKids: false
      }
    },
    media: { body: fs.createReadStream(finalVideoPath) }
  });

  const videoId = res.data.id;
  const youtubeUrl = `https://www.youtube.com/shorts/${videoId}`;
  logger.info(`YouTube upload complete: ${youtubeUrl}`);

  fs.unlinkSync(finalVideoPath);

  return { videoId, youtubeUrl };
}

module.exports = uploadToYouTube;
