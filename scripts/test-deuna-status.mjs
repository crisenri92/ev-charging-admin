const apiKey = process.env.DEUNA_API_KEY;
const apiSecret = process.env.DEUNA_API_SECRET;
const baseUrl = process.env.DEUNA_BASE_URL || 'https://apis-merchant.qa.deunalab.com';
const reference = process.argv[2];
const idType = process.argv[3] || '1';

if (!apiKey || !apiSecret || !reference) {
  console.error('Uso: node --env-file=.env scripts/test-deuna-status.mjs <referencia> [idType]');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/merchant/v1/payment/info`, {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'x-api-secret': apiSecret,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    idTransacionReference: reference,
    idType,
  }),
});

const body = await response.json();
console.log('HTTP:', response.status);
console.log(JSON.stringify(body, null, 2));
