/**
 * Prueba directa contra Deuna QA usando variables de entorno.
 * No imprime secretos.
 */

const apiKey = process.env.DEUNA_API_KEY;
const apiSecret = process.env.DEUNA_API_SECRET;
const pointOfSale = process.env.DEUNA_POINT_OF_SALE;
const baseUrl = process.env.DEUNA_BASE_URL || 'https://apis-merchant.qa.deunalab.com';

if (!apiKey || !apiSecret || !pointOfSale) {
  console.error('Faltan DEUNA_API_KEY, DEUNA_API_SECRET o DEUNA_POINT_OF_SALE');
  process.exit(1);
}

const headers = {
  'x-api-key': apiKey,
  'x-api-secret': apiSecret,
  'Content-Type': 'application/json',
};

function shortRef(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${stamp}${rand}`.substring(0, 20);
}

async function post(label, payload) {
  console.log(`\n=== ${label} ===`);
  console.log('Payload (sin secretos):', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/merchant/v1/payment/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  console.log('HTTP:', response.status);
  console.log('Respuesta:', JSON.stringify(body, null, 2));
  return { status: response.status, body };
}

const tests = [
  {
    label: '1. Payload exacto de tu cURL (amount entero 4001)',
    payload: {
      pointOfSale,
      qrType: 'dynamic',
      amount: 4001,
      detail: 'test-payment-coops',
      internalTransactionReference: shortRef('QA'),
      format: '2',
    },
  },
  {
    label: '2. Payload de nuestro cliente (amount decimal + extras)',
    payload: {
      pointOfSale,
      qrType: 'dynamic',
      amount: 20.0,
      detail: 'Recarga de wallet $20.00',
      internalTransactionReference: shortRef('RCH'),
      format: '2',
      expiredTime: 30,
      qrFormat: 'svgQr300x300_color',
      callbackUrl: 'https://example.com/wallet',
    },
  },
  {
    label: '3. Payload de nuestro cliente (amount entero, extras)',
    payload: {
      pointOfSale,
      qrType: 'dynamic',
      amount: 2000,
      detail: 'Recarga de wallet $20.00',
      internalTransactionReference: shortRef('RCH'),
      format: '2',
      expiredTime: 30,
      qrFormat: 'svgQr300x300_color',
    },
  },
];

const results = [];
for (const test of tests) {
  try {
    const result = await post(test.label, test.payload);
    results.push({
      label: test.label,
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      transactionId: result.body?.transactionId || result.body?.idTransaction || null,
    });
  } catch (error) {
    console.error(`Error en ${test.label}:`, error.message);
    results.push({ label: test.label, ok: false, error: error.message });
  }
}

console.log('\n=== RESUMEN ===');
console.log(JSON.stringify(results, null, 2));
