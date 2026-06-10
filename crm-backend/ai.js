const { GoogleGenAI } = require('@google/genai');

let aiClient = null;
const hasApiKey = !!process.env.GEMINI_API_KEY;

if (hasApiKey) {
  aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Gemini AI Engine initialized using GEMINI_API_KEY');
} else {
  console.warn('GEMINI_API_KEY not found in environment. Running AI Engine in local MOCK mode.');
}

// Parse natural language segmentation prompts into structured filters
async function generateSegmentRules(promptText) {
  if (hasApiKey && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a CRM segmentation assistant. Translate the following request for customer segmentation into a structured JSON filter.
Request: "${promptText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              minTotalSpend: { type: 'NUMBER', description: 'Minimum total amount spent by customer across all orders' },
              minPurchaseCount: { type: 'INTEGER', description: 'Minimum number of orders placed' },
              maxPurchaseCount: { type: 'INTEGER', description: 'Maximum number of orders placed' },
              inactiveDaysMin: { type: 'INTEGER', description: 'Number of days since last purchase date. Find customers whose last purchase was at least this many days ago (or who have never ordered)' },
              purchasedItems: { 
                type: 'ARRAY', 
                items: { type: 'STRING' },
                description: 'Keywords/names of items the customer must have purchased. E.g., ["Coffee Beans", "Classic White Tee"]'
              },
              excludedItems: { 
                type: 'ARRAY', 
                items: { type: 'STRING' },
                description: 'Keywords/names of items the customer must NOT have purchased.'
              }
            }
          }
        }
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
    } catch (error) {
      console.error('Gemini API error in generateSegmentRules, falling back to mock:', error);
    }
  }

  // Fallback mock heuristics
  return mockGenerateSegmentRules(promptText);
}

// Write templates and select optimal gateway channel
async function generateCampaignMessage(promptText, segmentName, customerCount) {
  if (hasApiKey && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a CRM marketer. Draft a personalized campaign message and recommend the best channel (whatsapp, sms, email, or rcs) for the segment "${segmentName}" containing ${customerCount} customers.
User Request: "${promptText}"

Guidelines for message:
- Use double curly braces for personalization variables, e.g. {{first_name}}, {{last_name}}, or {{recent_purchase}} if appropriate.
- Keep SMS short (under 160 chars).
- Keep WhatsApp engaging, possibly with emojis.
- Email can include a Subject Line.
- RCS can contain rich media features.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              recommendedChannel: { type: 'STRING', enum: ['whatsapp', 'sms', 'email', 'rcs'] },
              recommendationReason: { type: 'STRING' },
              subjectLine: { type: 'STRING', description: 'Email subject line (leave empty for other channels)' },
              messageTemplate: { type: 'STRING', description: 'Personalized message body using {{first_name}} and other variables' }
            },
            required: ['recommendedChannel', 'recommendationReason', 'messageTemplate']
          }
        }
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
    } catch (error) {
      console.error('Gemini API error in generateCampaignMessage, falling back to mock:', error);
    }
  }

  // Fallback mock heuristics
  return mockGenerateCampaignMessage(promptText, segmentName);
}

// Audits metrics to output campaign recommendations
async function generateCampaignReview(campaignName, stats) {
  if (hasApiKey && aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze the performance stats for the campaign "${campaignName}" and provide smart, actionable recommendations.
Stats:
- Sent: ${stats.sent}
- Delivered: ${stats.delivered} (Rate: ${((stats.delivered/stats.sent)*100).toFixed(1)}%)
- Failed: ${stats.failed}
- Opened/Read: ${stats.opened} (Rate: ${((stats.opened/stats.delivered)*100).toFixed(1)}%)
- Clicked: ${stats.clicked} (Rate: ${((stats.clicked/stats.opened)*100).toFixed(1)}%)
- Converted/Purchased: ${stats.converted} (Rate: ${((stats.converted/stats.clicked)*100).toFixed(1)}%)
- Revenue Generated: $${stats.revenue.toFixed(2)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              overallSummary: { type: 'STRING', description: 'Brief paragraph summarizing campaign performance' },
              strengths: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Bullet points of what worked well' },
              weaknesses: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Bullet points of what underperformed' },
              actionableSuggestions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Concrete, next-step recommendations' }
            },
            required: ['overallSummary', 'strengths', 'weaknesses', 'actionableSuggestions']
          }
        }
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
    } catch (error) {
      console.error('Gemini API error in generateCampaignReview, falling back to mock:', error);
    }
  }

  // Fallback mock heuristics
  return mockGenerateCampaignReview(campaignName, stats);
}

// --- Local Fallback Parser ---

function mockGenerateSegmentRules(promptText) {
  const normalized = promptText.toLowerCase();
  const rules = {};

  // Extract total spend (e.g. spent $100, spent over 100)
  const spendMatch = normalized.match(/(?:spent|spend|over|>\s*)\$?(\d+)/);
  if (spendMatch) {
    rules.minTotalSpend = parseFloat(spendMatch[1]);
  } else if (normalized.includes('vip')) {
    rules.minTotalSpend = 100.0;
  }

  // Extract inactivity in days
  const inactivityMatch = normalized.match(/(?:inactive|no purchase|last ordered|not ordered|haven't ordered)(?: for)?(?: over| at least)?\s*(\d+)\s*days/);
  if (inactivityMatch) {
    rules.inactiveDaysMin = parseInt(inactivityMatch[1], 10);
  } else if (normalized.includes('inactive') || normalized.includes('churn')) {
    rules.inactiveDaysMin = 30; // default to 30 days
  }

  // Extract purchase count (e.g. 1 order, one order, 3 orders)
  if (normalized.includes('one-time') || normalized.includes('1 order') || normalized.includes('one order') || normalized.includes('single order')) {
    rules.minPurchaseCount = 1;
    rules.maxPurchaseCount = 1;
  } else {
    const ordersMatch = normalized.match(/(?:at least|>=|min)?\s*(\d+)\s*(?:orders|purchases)/);
    if (ordersMatch) {
      rules.minPurchaseCount = parseInt(ordersMatch[1], 10);
    }
  }

  // Extract item keywords
  const itemKeywords = [
    { key: 'coffee beans', matches: ['coffee beans', 'beans'] },
    { key: 'espresso', matches: ['espresso'] },
    { key: 'french press', matches: ['french press', 'press'] },
    { key: 'coffee', matches: ['coffee'] },
    { key: 'tee', matches: ['tee', 't-shirt', 'shirt'] },
    { key: 'jacket', matches: ['jacket', 'denim'] },
    { key: 'sweatshirt', matches: ['sweatshirt', 'hoodie'] },
    { key: 'socks', matches: ['socks'] },
    { key: 'apparel', matches: ['apparel', 'clothing'] },
    { key: 'cream', matches: ['cream', 'moisturizer'] },
    { key: 'serum', matches: ['serum', 'vitamin c'] },
    { key: 'cleanser', matches: ['cleanser', 'skincare'] },
    { key: 'mask', matches: ['mask', 'clay mask'] },
    { key: 'beauty', matches: ['beauty', 'cosmetics'] }
  ];

  const purchased = [];
  const excluded = [];

  // Simple heuristic to split prompt into inclusion and exclusion phrases
  const parts = normalized.split(/\b(?:but not|exclude|without|excluding|except)\b/);
  const inclusionText = parts[0];
  const exclusionText = parts[1] || '';

  // Scan inclusion
  for (const kw of itemKeywords) {
    if (kw.matches.some(m => inclusionText.includes(m))) {
      purchased.push(kw.key);
    }
  }

  // Scan exclusion
  for (const kw of itemKeywords) {
    if (kw.matches.some(m => exclusionText.includes(m))) {
      excluded.push(kw.key);
    }
  }

  if (purchased.length > 0) rules.purchasedItems = purchased;
  if (excluded.length > 0) rules.excludedItems = excluded;

  return rules;
}

function mockGenerateCampaignMessage(promptText, segmentName) {
  const normalized = promptText.toLowerCase();
  
  let recommendedChannel = 'whatsapp';
  let recommendationReason = 'We recommend WhatsApp for this segment as they are mobile-first active buyers, offering the highest read rates for personalized engagements.';
  let subjectLine = '';
  let messageTemplate = '';

  // Channel heuristics
  if (normalized.includes('email') || normalized.includes('newsletter') || normalized.includes('subject')) {
    recommendedChannel = 'email';
    recommendationReason = 'Recommended Email for detailed newsletters or text-heavy campaigns where layout presentation and spam-filtering compliance matter.';
  } else if (normalized.includes('sms') || normalized.includes('alert') || normalized.includes('quick')) {
    recommendedChannel = 'sms';
    recommendationReason = 'SMS chosen for immediate, low-latency delivery of direct discounts, keeping user attention focused.';
  } else if (normalized.includes('rcs') || normalized.includes('rich') || normalized.includes('media')) {
    recommendedChannel = 'rcs';
    recommendationReason = 'RCS provides custom card carousels and verified sender marks, making it highly effective for premium visual brands.';
  }

  // Template heuristics
  if (normalized.includes('discount') || normalized.includes('offer') || normalized.includes('sale') || normalized.includes('promo')) {
    const discountMatch = normalized.match(/(\d+)%/);
    const discountStr = discountMatch ? `${discountMatch[1]}%` : '15%';

    if (recommendedChannel === 'email') {
      subjectLine = `Exclusive: Your ${discountStr} Discount Code Inside! 🎁`;
      messageTemplate = `Hi {{first_name}},\n\nWe noticed you haven't shopped with us in a while, so we wanted to treat you! Here is an exclusive discount code for your next order:\n\nUse code: TREAT${discountStr.replace('%', '')} at checkout for ${discountStr} off everything.\n\nShop now: https://aura-shop.com\n\nBest,\nThe Aura Team`;
    } else if (recommendedChannel === 'whatsapp') {
      messageTemplate = `Hey {{first_name}}! 🌟 We miss you around here. To welcome you back, here's an exclusive *${discountStr} discount* on your next purchase! Use code *TREAT${discountStr.replace('%', '')}* at checkout. Shop here: https://aura-shop.com`;
    } else {
      messageTemplate = `Hi {{first_name}}, we miss you! Get ${discountStr} off your next order with code TREAT${discountStr.replace('%', '')}. Shop now: https://aura-shop.com`;
    }
  } else if (normalized.includes('coffee') || segmentName.toLowerCase().includes('coffee')) {
    if (recommendedChannel === 'email') {
      subjectLine = 'Brewing Something New: Premium Organic Blends ☕';
      messageTemplate = `Hi {{first_name}},\n\nAs a valued coffee lover, we wanted to let you know we've just restocked our premium organic blends!\n\nGet yours today and elevate your morning ritual. Pair it with our French Press for the perfect brew.\n\nShop our collection: https://aura-shop.com/coffee\n\nEnjoy,\nThe Aura Team`;
    } else {
      messageTemplate = `Hey {{first_name}}! ☕ Fresh coffee beans are back in stock! Elevate your morning brew today. Order now: https://aura-shop.com/coffee`;
    }
  } else {
    // Default message
    if (recommendedChannel === 'email') {
      subjectLine = 'A Special Note from Aura ✨';
      messageTemplate = `Hi {{first_name}},\n\nWe are so grateful to have you as a customer. We wanted to reach out and share our latest arrivals in apparel and beauty.\n\nCheck out the new collection today: https://aura-shop.com\n\nWarmly,\nThe Aura Team`;
    } else {
      messageTemplate = `Hi {{first_name}}! Check out the new arrivals at Aura. Fresh styles and skincare products are waiting for you: https://aura-shop.com`;
    }
  }

  return {
    recommendedChannel,
    recommendationReason,
    subjectLine,
    messageTemplate
  };
}

function mockGenerateCampaignReview(campaignName, stats) {
  const delivered = stats.delivered || 1;
  const opened = stats.opened || 0;
  const clicked = stats.clicked || 0;
  
  const openRate = (opened / delivered) * 100;
  const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
  const convRate = clicked > 0 ? (stats.converted / clicked) * 100 : 0;

  let overallSummary = `The campaign "${campaignName}" generated $${stats.revenue.toFixed(2)} in attributed revenue. It had a solid delivery rate, but overall shopper engagement suggests room for optimization.`;
  const strengths = [];
  const weaknesses = [];
  const actionableSuggestions = [];

  // Analyze open rates
  if (openRate > 60) {
    strengths.push(`Excellent open/read rate of ${openRate.toFixed(1)}%, indicating strong template copy and high trust in the channel.`);
  } else {
    weaknesses.push(`Low read/open rate of ${openRate.toFixed(1)}%. Many shoppers in the segment are ignoring the message.`);
    actionableSuggestions.push('Consider testing a different channel or changing the message sender name to increase visibility.');
    actionableSuggestions.push('Rewrite the subject line (if Email) or first 5 words (if SMS/WhatsApp) to create urgency.');
  }

  // Analyze click rates
  if (clickRate > 15) {
    strengths.push(`Strong CTR (Click-Through Rate) of ${clickRate.toFixed(1)}% among those who read it, showing that the promotion code or link was highly compelling.`);
  } else {
    weaknesses.push(`Poor Click-Through Rate of ${clickRate.toFixed(1)}% once opened. Shoppers are reading the message but not tapping the links.`);
    actionableSuggestions.push('Format your links more prominently. On WhatsApp, try using emojis like 🛒 or 🔗 to direct attention.');
    actionableSuggestions.push('Offer a slightly higher discount (e.g. 20% instead of 10%) or add a time-sensitive expiration (e.g., "Expires in 24 hours").');
  }

  // Analyze conversions
  if (convRate > 10) {
    strengths.push(`Excellent conversion rate of ${convRate.toFixed(1)}% from click-to-purchase, suggesting strong product intent once shoppers hit the landing page.`);
  } else {
    weaknesses.push(`Low conversion rate of ${convRate.toFixed(1)}% from clicks. Shoppers are visiting the store but not finishing checkout.`);
    actionableSuggestions.push('Check the checkout funnel for friction or add a cart-abandonment trigger.');
  }

  if (strengths.length === 0) {
    strengths.push('Campaign completed without fatal network errors, and simulated metrics were successfully logged.');
  }

  return {
    overallSummary,
    strengths,
    weaknesses,
    actionableSuggestions
  };
}

// Conversational marketing copilot agent
async function processCopilotChat(message, chatHistory = []) {
  if (hasApiKey && aiClient) {
    try {
      const formattedHistory = chatHistory.map(h => `${h.sender.toUpperCase()}: ${h.text}`).join('\n');
      const systemContext = `You are Xeno CRM Copilot, an intelligent AI marketing agent. Help the user brainstorm segments and campaign message drafts.
Always return a structured JSON response matching the following schema.
If the user's intent is to create a campaign, draft a message, or build an audience segment, populate the "action" field. Otherwise, keep "action" null.

Schema:
{
  "reply": "your conversational answer to the user",
  "action": {
    "type": "create_campaign" | null,
    "segmentName": "descriptive name for the segment",
    "segmentRules": {
      "minTotalSpend": number (optional),
      "minPurchaseCount": number (optional),
      "maxPurchaseCount": number (optional),
      "inactiveDaysMin": number (optional),
      "purchasedItems": [string] (optional),
      "excludedItems": [string] (optional)
    },
    "messageTemplate": "personalized message text using {{first_name}}, etc.",
    "channel": "whatsapp" | "sms" | "email" | "rcs"
  }
}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemContext}\n\nChat History:\n${formattedHistory}\n\nUSER: ${message}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reply: { type: 'STRING', description: 'Your conversational reply to the user' },
              action: {
                type: 'OBJECT',
                nullable: true,
                properties: {
                  type: { type: 'STRING', enum: ['create_campaign'] },
                  segmentName: { type: 'STRING' },
                  segmentRules: {
                    type: 'OBJECT',
                    properties: {
                      minTotalSpend: { type: 'NUMBER' },
                      minPurchaseCount: { type: 'INTEGER' },
                      maxPurchaseCount: { type: 'INTEGER' },
                      inactiveDaysMin: { type: 'INTEGER' },
                      purchasedItems: { type: 'ARRAY', items: { type: 'STRING' } },
                      excludedItems: { type: 'ARRAY', items: { type: 'STRING' } }
                    }
                  },
                  messageTemplate: { type: 'STRING' },
                  channel: { type: 'STRING', enum: ['whatsapp', 'sms', 'email', 'rcs'] }
                },
                required: ['type', 'segmentName', 'segmentRules', 'messageTemplate', 'channel']
              }
            },
            required: ['reply']
          }
        }
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      }
    } catch (error) {
      console.error('Gemini API error in processCopilotChat, falling back to mock:', error);
    }
  }

  // Fallback mock heuristics
  return mockProcessCopilotChat(message);
}

function mockProcessCopilotChat(message) {
  const normalized = message.toLowerCase();
  
  if (normalized.includes('campaign') || normalized.includes('draft') || normalized.includes('discount') || normalized.includes('send') || normalized.includes('coffee') || normalized.includes('shopper')) {
    const segmentRules = mockGenerateSegmentRules(message);
    
    if (Object.keys(segmentRules).length === 0) {
      segmentRules.inactiveDaysMin = 30; // default fallback rule
    }
    
    const segmentName = segmentRules.inactiveDaysMin ? 'Inactive 30-Day Shoppers' : 'VIP Coffee Shoppers';
    const draft = mockGenerateCampaignMessage(message, segmentName);

    return {
      reply: `I've prepared a marketing campaign recommendations for you. I suggest creating a segment named "${segmentName}" and targeting them on the ${draft.recommendedChannel.toUpperCase()} channel. I've drafted a personalized copy template below. You can initialize this campaign instantly by clicking the button!`,
      action: {
        type: 'create_campaign',
        segmentName,
        segmentRules,
        messageTemplate: draft.recommendedChannel === 'email' && draft.subjectLine ? `Subject: ${draft.subjectLine}\n\n${draft.messageTemplate}` : draft.messageTemplate,
        channel: draft.recommendedChannel
      }
    };
  }

  return {
    reply: "Hello! I am your Xeno CRM Copilot. I can help you segment your customers, draft personalized message copies, and recommend the best marketing channels. For example, tell me: 'Help me draft a discount campaign for coffee lovers who spent over $100'",
    action: null
  };
}

module.exports = {
  generateSegmentRules,
  generateCampaignMessage,
  generateCampaignReview,
  processCopilotChat
};

