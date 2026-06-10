const express = require('express');
const cors = require('cors');
const http = require('http');
const { db, initializeDatabase } = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Ingress Logger
app.use((req, res, next) => {
  console.log(`[SIMULATOR] ${req.method} ${req.url}`);
  next();
});

// Simulator Global State Configurations
let simulatorConfig = {
  simulateRateLimits: false,
  simulateServerErrors: false,
  simulationSpeed: 1.0 // 1.0 = normal, 2.0 = double speed, 0.5 = half speed
};

// Catalog copy for conversion order generation
const catalog = [
  { name: 'Organic Coffee Beans', price: 18.99, category: 'coffee' },
  { name: 'Espresso Roast Coffee', price: 14.99, category: 'coffee' },
  { name: 'Cold Brew Blend', price: 16.99, category: 'coffee' },
  { name: 'French Press Maker', price: 35.00, category: 'coffee' },
  { name: 'Paper Coffee Filters', price: 5.99, category: 'coffee' },
  { name: 'Classic White Tee', price: 24.99, category: 'apparel' },
  { name: 'Denim Jacket', price: 89.99, category: 'apparel' },
  { name: 'Cozy Hooded Sweatshirt', price: 49.99, category: 'apparel' },
  { name: 'Sport Socks (3-pack)', price: 12.00, category: 'apparel' },
  { name: 'Beanie Hat', price: 19.99, category: 'apparel' },
  { name: 'Hydrating Face Cream', price: 28.00, category: 'beauty' },
  { name: 'Vitamin C Serum', price: 32.00, category: 'beauty' },
  { name: 'Gentle Skin Cleanser', price: 18.00, category: 'beauty' },
  { name: 'Lip Balm Set', price: 10.00, category: 'beauty' },
  { name: 'Clay Face Mask', price: 22.00, category: 'beauty' }
];

// Helper to add random jitter to delays
function getDelay(baseMs) {
  const adjusted = baseMs / simulatorConfig.simulationSpeed;
  const jitter = (Math.random() * 0.4 + 0.8); // 80% to 120%
  return Math.floor(adjusted * jitter);
}

// Enqueue Callback into Reliable Queue
async function enqueueCallback(commId, status, extraPayload = {}) {
  const payload = {
    communication_id: commId,
    status,
    ...extraPayload
  };

  await db('callbacks_queue').insert({
    communication_id: commId,
    status,
    payload: JSON.stringify(payload),
    retry_count: 0,
    callback_status: 'pending',
    next_attempt_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  console.log(`[SIMULATOR] Callback enqueued: Comm ID ${commId} -> ${status}`);
}

// Run async state transitions simulating delivery and customer engagement
async function runCommunicationSimulation(comm) {
  const commId = comm.communication_id;
  const channel = comm.channel;
  const customerId = comm.customer_id;
  const campaignId = comm.campaign_id;

  // Step 1: Dispatch Network Simulation
  setTimeout(async () => {
    const isSuccess = Math.random() < 0.95;
    const nextStatus = isSuccess ? 'delivered' : 'failed';

    await db('outbox').where({ id: commId }).update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    });

    await enqueueCallback(commId, nextStatus);

    if (!isSuccess) return; // Terminate simulation if delivery failed

    // Step 2: Open/Read Simulation
    setTimeout(async () => {
      let openRate = 0.50;
      if (channel === 'whatsapp') openRate = 0.80;
      else if (channel === 'rcs') openRate = 0.60;
      else if (channel === 'email') openRate = 0.30;

      const isOpened = Math.random() < openRate;
      if (!isOpened) return;

      const readStatus = channel === 'email' ? 'opened' : 'read';

      await db('outbox').where({ id: commId }).update({
        status: readStatus,
        updated_at: new Date().toISOString()
      });

      await enqueueCallback(commId, readStatus);

      // Step 3: Link Click Simulation
      setTimeout(async () => {
        const clickRate = 0.20;
        const isClicked = Math.random() < clickRate;
        if (!isClicked) return;

        await db('outbox').where({ id: commId }).update({
          status: 'clicked',
          updated_at: new Date().toISOString()
        });

        await enqueueCallback(commId, 'clicked');

        // Step 4: Purchase Conversion Simulation
        setTimeout(async () => {
          const conversionRate = 0.15;
          const isConverted = Math.random() < conversionRate;
          if (!isConverted) return;

          // Identify catalog categories matching campaign text
          const bodyLower = comm.message_body.toLowerCase();
          let matchedItem = catalog[Math.floor(Math.random() * catalog.length)];
          
          if (bodyLower.includes('coffee')) {
            const coffeeItems = catalog.filter(i => i.category === 'coffee');
            matchedItem = coffeeItems[Math.floor(Math.random() * coffeeItems.length)];
          } else if (bodyLower.includes('tee') || bodyLower.includes('jacket') || bodyLower.includes('apparel')) {
            const apparelItems = catalog.filter(i => i.category === 'apparel');
            matchedItem = apparelItems[Math.floor(Math.random() * apparelItems.length)];
          } else if (bodyLower.includes('skin') || bodyLower.includes('face') || bodyLower.includes('cream') || bodyLower.includes('serum') || bodyLower.includes('beauty')) {
            const beautyItems = catalog.filter(i => i.category === 'beauty');
            matchedItem = beautyItems[Math.floor(Math.random() * beautyItems.length)];
          }

          injectAttributionOrder(customerId, matchedItem).then(async (orderResult) => {
            await db('outbox').where({ id: commId }).update({
              status: 'converted',
              updated_at: new Date().toISOString()
            });

            await enqueueCallback(commId, 'converted', { amount: matchedItem.price });
          }).catch(err => {
            console.error(`[SIMULATOR] Conversion order injection failed for Customer ${customerId}:`, err.message);
          });

        }, getDelay(5000));

      }, getDelay(3000));

    }, getDelay(2000));

  }, getDelay(1000));
}

// Ingest attributed order into CRM backend
function injectAttributionOrder(customerId, item) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      customer_id: customerId,
      amount: item.price,
      items: [item]
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/orders/ingest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`CRM returned code ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// --- Endpoints ---

// 1. Receive batch of messages to dispatch
app.post('/api/send-batch', async (req, res) => {
  const comms = req.body;
  if (!Array.isArray(comms) || comms.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of communications' });
  }

  try {
    // Write communications to simulator outbox
    const inserts = comms.map(c => ({
      id: c.communication_id,
      campaign_id: c.campaign_id,
      recipient: c.recipient,
      message_body: c.message_body,
      channel: c.channel,
      status: 'queued',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    await db.batchInsert('outbox', inserts, 100);
    console.log(`[SIMULATOR] Enqueued ${comms.length} messages in outbox queue.`);

    // Start simulation loop for each message asynchronously
    for (const c of comms) {
      runCommunicationSimulation(c);
    }

    res.json({ success: true, count: comms.length });

  } catch (error) {
    console.error('Error in send-batch:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Fetch simulator queues state for dashboard visualizer
app.get('/api/simulator/status', async (req, res) => {
  try {
    const outboxCounts = await db('outbox')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const pendingCallbacks = await db('callbacks_queue')
      .where({ callback_status: 'pending' })
      .count('id as count')
      .first();

    const failedCallbacks = await db('callbacks_queue')
      .where({ callback_status: 'failed' })
      .count('id as count')
      .first();

    const totalCallbacks = await db('callbacks_queue')
      .count('id as count')
      .first();

    res.json({
      config: simulatorConfig,
      outbox: outboxCounts,
      callbacks: {
        pending: pendingCallbacks.count,
        failed: failedCallbacks.count,
        total: totalCallbacks.count
      }
    });
  } catch (error) {
    console.error('Error fetching simulator status:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Update simulator configurations
app.post('/api/simulator/config', (req, res) => {
  const { simulateRateLimits, simulateServerErrors, simulationSpeed } = req.body;

  if (simulateRateLimits !== undefined) simulatorConfig.simulateRateLimits = !!simulateRateLimits;
  if (simulateServerErrors !== undefined) simulatorConfig.simulateServerErrors = !!simulateServerErrors;
  if (simulationSpeed !== undefined) {
    const speed = parseFloat(simulationSpeed);
    if (speed > 0 && speed <= 10) {
      simulatorConfig.simulationSpeed = speed;
    }
  }

  console.log('[SIMULATOR] Configuration updated:', simulatorConfig);
  res.json({ success: true, config: simulatorConfig });
});

// 4. Reset simulator queues
app.post('/api/simulator/reset', async (req, res) => {
  try {
    await db('outbox').truncate();
    await db('callbacks_queue').truncate();
    console.log('[SIMULATOR] Cleared outbox and callback queues.');
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting simulator databases:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Reliable Callback Dispatcher Loop (Worker) ---

async function processCallbacksQueue() {
  try {
    const nowStr = new Date().toISOString();
    
    // Fetch callbacks that are pending and due
    const pendingCallbacks = await db('callbacks_queue')
      .where({ callback_status: 'pending' })
      .andWhere('next_attempt_at', '<=', nowStr)
      .orderBy('created_at', 'asc')
      .limit(10); // Batch size 10

    if (pendingCallbacks.length === 0) return;

    for (const callback of pendingCallbacks) {
      const payloadString = callback.payload;
      
      // Perform dispatch
      await dispatchCallback(callback, payloadString);
    }
  } catch (error) {
    console.error('[SIMULATOR] Error in processCallbacksQueue worker:', error.message);
  }
}

function dispatchCallback(callbackRecord, payloadString) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/callbacks/delivery',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString)
      }
    };

    // Inject simulated error headers if configured
    if (simulatorConfig.simulateRateLimits) {
      options.headers['X-Simulate-Rate-Limit'] = 'true';
    }
    if (simulatorConfig.simulateServerErrors) {
      options.headers['X-Simulate-Server-Error'] = 'true';
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Success
          await db('callbacks_queue')
            .where({ id: callbackRecord.id })
            .update({ callback_status: 'success' });
          
          console.log(`[SIMULATOR] [CALLBACK SUCCESS] Dispatched Comm ID ${callbackRecord.communication_id} -> ${callbackRecord.status}`);
          resolve(true);
        } else {
          // Failed callback response (e.g. 500 or 429)
          console.warn(`[SIMULATOR] [CALLBACK FAIL] CRM returned status ${res.statusCode} for Comm ID ${callbackRecord.communication_id}`);
          await handleCallbackFailure(callbackRecord);
          resolve(false);
        }
      });
    });

    req.on('error', async (err) => {
      console.warn(`[SIMULATOR] [CALLBACK NETWORK ERROR] Failed to connect to CRM:`, err.message);
      await handleCallbackFailure(callbackRecord);
      resolve(false);
    });

    req.write(payloadString);
    req.end();
  });
}

// Exponential Backoff Calculations
async function handleCallbackFailure(callbackRecord) {
  const nextRetryCount = callbackRecord.retry_count + 1;
  
  if (nextRetryCount >= 5) {
    // Max retries exceeded, mark as dead-letter
    await db('callbacks_queue')
      .where({ id: callbackRecord.id })
      .update({
        callback_status: 'failed',
        retry_count: nextRetryCount
      });
    console.error(`[SIMULATOR] [CALLBACK DEAD-LETTER] Comm ID ${callbackRecord.communication_id} -> ${callbackRecord.status} failed after 5 retries.`);
  } else {
    // Backoff delay: 2 ^ retry_count * 2 seconds
    const backoffSeconds = Math.pow(2, nextRetryCount) * 2;
    const nextAttempt = new Date();
    nextAttempt.setSeconds(nextAttempt.getSeconds() + backoffSeconds);

    await db('callbacks_queue')
      .where({ id: callbackRecord.id })
      .update({
        retry_count: nextRetryCount,
        next_attempt_at: nextAttempt.toISOString()
      });
    console.log(`[SIMULATOR] [CALLBACK RETRY SCHEDULED] Retrying Comm ID ${callbackRecord.communication_id} -> ${callbackRecord.status} (Attempt ${nextRetryCount}) in ${backoffSeconds}s.`);
  }
}

// Initialize simulator database and start Server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`[SIMULATOR] Channel Service Simulator running on port ${PORT}`);
    
    // Start reliable callback worker loop every 2 seconds
    setInterval(processCallbacksQueue, 2000);
  });
}).catch(err => {
  console.error('Failed to initialize Simulator database:', err);
  process.exit(1);
});
