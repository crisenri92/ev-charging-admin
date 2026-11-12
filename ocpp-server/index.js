'use strict';

const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_SECRET = process.env.OCPP_API_SECRET || 'dev-secret';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[OCPP] WARNING: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory charger connections: { chargerId: { ws, currentTransactionId } }
const chargers = {};
// Pending calls waiting for response: { msgId: { resolve, reject, timer } }
const pending = {};
let callId = 1;

// --- OCPP helpers ---

function ocppCall(ws, action, payload) {
  return new Promise((resolve, reject) => {
    const id = String(callId++);
    const timer = setTimeout(() => {
      delete pending[id];
      reject(new Error('Timeout waiting for ' + action + ' response'));
    }, 15000);
    pending[id] = { resolve, reject, timer };
    ws.send(JSON.stringify([2, id, action, payload]));
  });
}

// --- OCPP message handlers ---

async function handleBootNotification(chargerId, payload) {
  console.log('[' + chargerId + '] BootNotification:', payload.chargePointModel, payload.firmwareVersion);
  const updateData = {};
  if (payload.chargePointVendor) updateData.vendor = payload.chargePointVendor;
  if (payload.chargePointModel) updateData.model = payload.chargePointModel;
  if (payload.firmwareVersion) updateData.firmware = payload.firmwareVersion;
  if (payload.chargePointSerialNumber) updateData.serial_number = payload.chargePointSerialNumber;
  if (Object.keys(updateData).length) {
    await supabase.from('chargers').update(updateData).eq('id', chargerId);
  }
  return { currentTime: new Date().toISOString(), interval: 300, status: 'Accepted' };
}

async function handleStatusNotification(chargerId, payload) {
  console.log('[' + chargerId + '] Status: ' + payload.status + ' (connector ' + payload.connectorId + ')');
  if (payload.connectorId <= 1) {
    const statusMap = {
      Available: 'Available', Preparing: 'Preparing', Charging: 'Charging',
      SuspendedEV: 'Charging', SuspendedEVSE: 'Charging', Finishing: 'Finishing',
      Reserved: 'Reserved', Unavailable: 'Unavailable', Faulted: 'Faulted',
    };
    const status = statusMap[payload.status] || payload.status;
    await supabase.from('chargers').update({ status }).eq('id', chargerId);
  }
  return {};
}

async function handleStartTransaction(chargerId, payload) {
  console.log('[' + chargerId + '] StartTransaction meter=' + payload.meterStart + ' idTag=' + payload.idTag);
  const transactionId = Date.now();
  if (chargers[chargerId]) chargers[chargerId].currentTransactionId = transactionId;
  return { transactionId, idTagInfo: { status: 'Accepted' } };
}

async function handleStopTransaction(chargerId, payload) {
  console.log('[' + chargerId + '] StopTransaction txId=' + payload.transactionId + ' meterStop=' + payload.meterStop);
  const energyWh = (payload.meterStop || 0) - (payload.meterStart || 0);
  const energyKwh = Math.max(0, energyWh / 1000);
  await supabase.from('charging_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString(), energy_kwh: energyKwh })
    .eq('charger_id', chargerId).eq('status', 'active');
  await supabase.from('chargers').update({ status: 'Available' }).eq('id', chargerId);
  if (chargers[chargerId]) chargers[chargerId].currentTransactionId = null;
  return { idTagInfo: { status: 'Accepted' } };
}

// --- Express HTTP REST API ---

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, connectedChargers: Object.keys(chargers), timestamp: new Date().toISOString() });
});

function requireSecret(req, res, next) {
  const secret = req.headers['x-ocpp-secret'] || req.query.secret;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/remote-start', requireSecret, async (req, res) => {
  const { chargerId, idTag = 'APP_USER', connectorId = 1 } = req.body;
  if (!chargerId) return res.status(400).json({ error: 'chargerId required' });
  const charger = chargers[chargerId];
  if (!charger || charger.ws.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'charger_not_connected', chargerId, connected: Object.keys(chargers) });
  }
  try {
    const result = await ocppCall(charger.ws, 'RemoteStartTransaction', { idTag, connectorId });
    console.log('[' + chargerId + '] RemoteStartTransaction:', result);
    if (result.status === 'Accepted') {
      res.json({ ok: true, status: result.status });
    } else {
      res.status(400).json({ error: 'remote_start_rejected', status: result.status });
    }
  } catch (err) {
    console.error('[' + chargerId + '] RemoteStart error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/remote-stop', requireSecret, async (req, res) => {
  const { chargerId } = req.body;
  const charger = chargers[chargerId];
  if (!charger || charger.ws.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'charger_not_connected' });
  }
  const transactionId = charger.currentTransactionId;
  if (!transactionId) return res.status(400).json({ error: 'no_active_transaction' });
  try {
    const result = await ocppCall(charger.ws, 'RemoteStopTransaction', { transactionId });
    res.json({ ok: true, status: result.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- HTTP + WebSocket server ---

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url.startsWith('/ocpp/')) {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  } else {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws, request) => {
  const url = request.url || '';
  const parts = url.split('/');
  const chargerId = decodeURIComponent(parts[parts.length - 1] || 'UNKNOWN');
  console.log('[OCPP] Connected: ' + chargerId + ' from ' + request.socket.remoteAddress);
  chargers[chargerId] = { ws, currentTransactionId: null };

  ws.on('message', async (rawData) => {
    let msg;
    try { msg = JSON.parse(rawData.toString()); }
    catch (e) { console.error('[OCPP] Invalid JSON'); return; }

    const [type, msgId, ...rest] = msg;

    if (type === 3) {
      const cb = pending[msgId];
      if (cb) { clearTimeout(cb.timer); delete pending[msgId]; cb.resolve(rest[0]); }
      return;
    }
    if (type === 4) {
      const cb = pending[msgId];
      if (cb) { clearTimeout(cb.timer); delete pending[msgId]; cb.reject(new Error('OCPP error: ' + rest[0])); }
      return;
    }
    if (type === 2) {
      const [action, payload] = rest;
      let response;
      try {
        switch (action) {
          case 'BootNotification': response = await handleBootNotification(chargerId, payload); break;
          case 'Heartbeat': response = { currentTime: new Date().toISOString() }; break;
          case 'StatusNotification': response = await handleStatusNotification(chargerId, payload); break;
          case 'Authorize': response = { idTagInfo: { status: 'Accepted' } }; break;
          case 'StartTransaction': response = await handleStartTransaction(chargerId, payload); break;
          case 'StopTransaction': response = await handleStopTransaction(chargerId, payload); break;
          case 'MeterValues': response = {}; break;
          case 'DataTransfer': response = { status: 'Accepted' }; break;
          default:
            console.log('[' + chargerId + '] Unknown action: ' + action);
            response = {};
        }
        ws.send(JSON.stringify([3, msgId, response]));
      } catch (err) {
        console.error('[' + chargerId + '] Error handling ' + action + ':', err.message);
        ws.send(JSON.stringify([4, msgId, 'InternalError', err.message, {}]));
      }
    }
  });

  ws.on('close', (code) => {
    console.log('[OCPP] Disconnected: ' + chargerId + ' (' + code + ')');
    delete chargers[chargerId];
  });

  ws.on('error', (err) => console.error('[OCPP] Error ' + chargerId + ':', err.message));

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
    else clearInterval(pingInterval);
  }, 60000);
});

server.listen(PORT, () => {
  console.log('[OCPP] Server on port ' + PORT);
  console.log('[OCPP] WebSocket: ws://host:' + PORT + '/ocpp/<chargerId>');
  console.log('[OCPP] REST API:  http://host:' + PORT + '/health');
});
