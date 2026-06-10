require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { db, initializeDatabase, querySegmentCustomers } = require('./db');
const { generateSegmentRules, generateCampaignMessage, generateCampaignReview, processCopilotChat } = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[CRM] ${req.method} ${req.url}`);
  next();
});

// Paginated customer list
app.get('/api/customers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const customers = await db('customers')
      .select('customers.*')
      .leftJoin('orders', 'customers.id', '=', 'orders.customer_id')
      .groupBy('customers.id')
      .sum('orders.amount as total_spend')
      .count('orders.id as order_count')
      .max('orders.purchase_date as last_purchase')
      .limit(limit)
      .offset(offset);

    const countRes = await db('customers').count('id as count').first();
    res.json({
      customers,
      total: countRes.count,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List saved audience segments
app.get('/api/segments', async (req, res) => {
  try {
    const segments = await db('segments').select('*').orderBy('created_at', 'desc');
    
    // Supplement segments with customer counts
    const segmentsWithCounts = [];
    for (const seg of segments) {
      const customers = await querySegmentCustomers(seg.rules);
      segmentsWithCounts.push({
        ...seg,
        rules: JSON.parse(seg.rules),
        customer_count: customers.length
      });
    }

    res.json(segmentsWithCounts);
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Translate NL prompt into segment rules for preview
app.post('/api/segments/analyze-prompt', async (req, res) => {
  const { promptText } = req.body;
  if (!promptText) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }

  try {
    const rules = await generateSegmentRules(promptText);
    const previewCustomers = await querySegmentCustomers(rules);
    
    res.json({
      rules,
      match_count: previewCustomers.length,
      preview: previewCustomers.slice(0, 10) // Return first 10 for UI preview
    });
  } catch (error) {
    console.error('Error analyzing segmentation prompt:', error);
    res.status(500).json({ error: 'Failed to analyze prompt' });
  }
});

// Create audience segment
app.post('/api/segments', async (req, res) => {
  const { name, description, rules } = req.body;
  if (!name || !rules) {
    return res.status(400).json({ error: 'Name and rules are required' });
  }

  try {
    const rulesString = typeof rules === 'object' ? JSON.stringify(rules) : rules;
    const result = await db('segments').insert({
      name,
      description,
      rules: rulesString
    }).returning('id');
    const id = typeof result[0] === 'object' ? result[0].id : result[0];

    res.status(201).json({ id, name, description, rules: JSON.parse(rulesString) });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Preview rules matches
app.post('/api/segments/preview', async (req, res) => {
  const { rules } = req.body;
  try {
    const customers = await querySegmentCustomers(rules);
    res.json(customers);
  } catch (error) {
    console.error('Error querying segment customers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Brainstorm copy template and delivery channel
app.post('/api/ai/draft-campaign', async (req, res) => {
  const { promptText, segmentName, customerCount } = req.body;
  if (!promptText) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }

  try {
    const draft = await generateCampaignMessage(promptText, segmentName || 'Target Audience', customerCount || 0);
    res.json(draft);
  } catch (error) {
    console.error('Error drafting campaign via AI:', error);
    res.status(500).json({ error: 'Failed to generate campaign draft' });
  }
});

// Copilot chat helper
app.post('/api/ai/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const reply = await processCopilotChat(message, history || []);
    res.json(reply);
  } catch (error) {
    console.error('Error in Copilot chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Audits campaign metrics
app.get('/api/campaigns/:id/review', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const stats = {
      sent: campaign.sent_count,
      delivered: campaign.delivered_count,
      failed: campaign.failed_count,
      opened: campaign.opened_count,
      clicked: campaign.clicked_count,
      converted: campaign.converted_count,
      revenue: campaign.revenue
    };

    const review = await generateCampaignReview(campaign.name, stats);
    res.json(review);
  } catch (error) {
    console.error('Error generating campaign review:', error);
    res.status(500).json({ error: 'Failed to generate review' });
  }
});

// Create campaign and dispatch payloads to simulator
app.post('/api/campaigns', async (req, res) => {
  const { name, segment_id, channel, message_template } = req.body;
  if (!name || !segment_id || !channel || !message_template) {
    return res.status(400).json({ error: 'Missing required campaign fields' });
  }

  try {
    // 1. Fetch Segment
    const segment = await db('segments').where({ id: segment_id }).first();
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    // 2. Query target customers
    const targetCustomers = await querySegmentCustomers(segment.rules);
    if (targetCustomers.length === 0) {
      return res.status(400).json({ error: 'Target segment has 0 customers' });
    }

    // 3. Create Campaign (Initially 'sending')
    const campResult = await db('campaigns').insert({
      name,
      segment_id,
      channel,
      message_template,
      status: 'sending',
      sent_count: targetCustomers.length,
      created_at: new Date().toISOString()
    }).returning('id');
    const campaignId = typeof campResult[0] === 'object' ? campResult[0].id : campResult[0];

    // 4. Create Communication records
    const communicationsToInsert = targetCustomers.map((customer) => {
      // Replace personalization tags E.g. {{first_name}}
      let messageBody = message_template
        .replace(/\{\{first_name\}\}/gi, customer.first_name || '')
        .replace(/\{\{last_name\}\}/gi, customer.last_name || '')
        .replace(/\{\{recent_purchase\}\}/gi, customer.last_purchase || 'item');

      return {
        campaign_id: campaignId,
        customer_id: customer.id,
        recipient: channel === 'email' ? customer.email : customer.phone,
        message_body: messageBody,
        status: 'sent', // Initially dispatched
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    const commIds = [];
    for (const comm of communicationsToInsert) {
      const commResult = await db('communications').insert(comm).returning('id');
      const id = typeof commResult[0] === 'object' ? commResult[0].id : commResult[0];
      commIds.push({ ...comm, id });
    }

    // 5. Send Batch to Simulator asynchronously
    // Format dispatch payload
    const simulatorPayload = commIds.map(c => ({
      communication_id: c.id,
      campaign_id: c.campaign_id,
      customer_id: c.customer_id,
      recipient: c.recipient,
      message_body: c.message_body,
      channel: channel
    }));

    // Perform HTTP dispatch in background
    dispatchToSimulator(simulatorPayload).catch(err => {
      console.error('Failed to dispatch to simulator:', err.message);
    });

    // Update campaign status to completed (dispatch finished)
    await db('campaigns').where({ id: campaignId }).update({ status: 'completed' });

    res.status(201).json({
      campaignId,
      name,
      sent_count: targetCustomers.length,
      status: 'completed'
    });

  } catch (error) {
    console.error('Error launching campaign:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper for Simulator Dispatch
function dispatchToSimulator(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/send-batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[CRM] Dispatched ${payload.length} communications to Channel Service.`);
          resolve(body);
        } else {
          reject(new Error(`Simulator returned status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// List campaigns
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await db('campaigns')
      .select('campaigns.*', 'segments.name as segment_name')
      .leftJoin('segments', 'campaigns.segment_id', '=', 'segments.id')
      .orderBy('campaigns.created_at', 'desc');
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Campaign analytics detail view
app.get('/api/campaigns/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const campaign = await db('campaigns')
      .select('campaigns.*', 'segments.name as segment_name')
      .leftJoin('segments', 'campaigns.segment_id', '=', 'segments.id')
      .where('campaigns.id', id)
      .first();

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const logs = await db('communications')
      .select('communications.*', 'customers.first_name', 'customers.last_name')
      .join('customers', 'communications.customer_id', '=', 'customers.id')
      .where({ campaign_id: id })
      .orderBy('updated_at', 'desc')
      .limit(100); // Latest 100 delivery reports

    res.json({ campaign, logs });
  } catch (error) {
    console.error('Error fetching campaign details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Recent updates across all campaigns
app.get('/api/communications/recent', async (req, res) => {
  try {
    const logs = await db('communications')
      .select('communications.*', 'customers.first_name', 'customers.last_name', 'campaigns.name as campaign_name', 'campaigns.channel')
      .join('customers', 'communications.customer_id', '=', 'customers.id')
      .join('campaigns', 'communications.campaign_id', '=', 'campaigns.id')
      .orderBy('updated_at', 'desc')
      .limit(50);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching recent communications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// State transition weights to prevent regressions
const STATE_HIERARCHY = {
  sent: 0,
  delivered: 1,
  failed: 1, // failed is a terminal state, but equal weight to delivered
  opened: 2,
  read: 2, // 'read' and 'opened' are equivalent in weight
  clicked: 3,
  converted: 4
};

function shouldUpdateState(currentStatus, newStatus) {
  // If the status is not in the hierarchy, reject it
  if (STATE_HIERARCHY[currentStatus] === undefined) return true;
  if (STATE_HIERARCHY[newStatus] === undefined) return false;

  // Do not downgrade (e.g. going from converted back to opened)
  return STATE_HIERARCHY[newStatus] > STATE_HIERARCHY[currentStatus];
}

// Webhook callback receipt endpoint
app.post('/api/callbacks/delivery', async (req, res) => {
  const { communication_id, status, amount } = req.body;
  if (!communication_id || !status) {
    return res.status(400).json({ error: 'Missing communication_id or status' });
  }

  // Support simulator testing: inject simulated rate-limiting or errors
  if (req.headers['x-simulate-rate-limit'] === 'true') {
    console.log('[CRM] [SIMULATED] Returning 429 Too Many Requests to test backoff queue.');
    return res.status(429).json({ error: 'Rate limit exceeded. Please back off.' });
  }
  if (req.headers['x-simulate-server-error'] === 'true') {
    console.log('[CRM] [SIMULATED] Returning 500 Server Error to test backoff queue.');
    return res.status(500).json({ error: 'Internal server error occurred.' });
  }

  try {
    // 1. Fetch communication record
    const comm = await db('communications').where({ id: communication_id }).first();
    if (!comm) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    const currentStatus = comm.status;
    
    // 2. Validate state transition to prevent out-of-order callback regressions
    if (!shouldUpdateState(currentStatus, status)) {
      console.log(`[CRM] Ignored out-of-order callback state downgrade for Comm ID ${communication_id}: ${currentStatus} -> ${status}`);
      return res.json({ success: true, message: 'State transition ignored to prevent regression.' });
    }

    // 3. Update communication status
    await db('communications')
      .where({ id: communication_id })
      .update({
        status,
        updated_at: new Date().toISOString()
      });

    // 4. Update campaign aggregates
    const campaignId = comm.campaign_id;
    const campaign = await db('campaigns').where({ id: campaignId }).first();

    if (campaign) {
      const updates = {};

      // Calculate increments
      if (status === 'delivered') {
        updates.delivered_count = campaign.delivered_count + 1;
      } else if (status === 'failed') {
        updates.failed_count = campaign.failed_count + 1;
      } else if (status === 'opened' || status === 'read') {
        // Increment opened count if transitioning from delivered/sent to opened
        if (currentStatus === 'sent' || currentStatus === 'delivered') {
          updates.opened_count = campaign.opened_count + 1;
        }
        // If transitioning from sent directly, also increment delivered count
        if (currentStatus === 'sent') {
          updates.delivered_count = campaign.delivered_count + 1;
        }
      } else if (status === 'clicked') {
        if (currentStatus === 'sent' || currentStatus === 'delivered' || currentStatus === 'opened' || currentStatus === 'read') {
          updates.clicked_count = campaign.clicked_count + 1;
        }
        if (currentStatus === 'sent' || currentStatus === 'delivered') {
          updates.opened_count = campaign.opened_count + 1;
        }
        if (currentStatus === 'sent') {
          updates.delivered_count = campaign.delivered_count + 1;
        }
      } else if (status === 'converted') {
        // Max upgrade
        if (currentStatus !== 'converted') {
          updates.converted_count = campaign.converted_count + 1;
          
          if (amount) {
            updates.revenue = campaign.revenue + parseFloat(amount);
          }
        }
        // Adjust lower stats if skipped
        if (currentStatus === 'sent' || currentStatus === 'delivered' || currentStatus === 'opened' || currentStatus === 'read') {
          if (currentStatus !== 'clicked') updates.clicked_count = campaign.clicked_count + 1;
        }
        if (currentStatus === 'sent' || currentStatus === 'delivered') {
          updates.opened_count = campaign.opened_count + 1;
        }
        if (currentStatus === 'sent') {
          updates.delivered_count = campaign.delivered_count + 1;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db('campaigns').where({ id: campaignId }).update(updates);
      }
    }

    res.json({ success: true, newStatus: status });

  } catch (error) {
    console.error('Error processing delivery callback:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Attributed order ingestion
app.post('/api/orders/ingest', async (req, res) => {
  const { customer_id, amount, items } = req.body;
  if (!customer_id || !amount || !items) {
    return res.status(400).json({ error: 'Missing required order ingestion fields' });
  }

  try {
    const orderResult = await db('orders').insert({
      customer_id,
      amount,
      item_count: Array.isArray(items) ? items.length : 1,
      items: typeof items === 'object' ? JSON.stringify(items) : items,
      purchase_date: new Date().toISOString()
    }).returning('id');
    const orderId = typeof orderResult[0] === 'object' ? orderResult[0].id : orderResult[0];

    console.log(`[CRM] Ingested conversion order ID ${orderId} for customer ${customer_id} ($${amount})`);
    res.status(201).json({ success: true, orderId });
  } catch (error) {
    console.error('Error ingesting order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Bootstrapper
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[CRM] CRM Backend Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize CRM database:', err);
  process.exit(1);
});
