// src/lib/analyze-receipt.ts
// Analyzes a payment receipt image using Claude Vision API
// to determine if it is a legitimate bank transfer receipt.

export interface ReceiptAnalysis {
  is_valid: boolean
  confidence: number          // 0.0 - 1.0
  amount_detected: number | null
  status_is_completed: boolean
  signs_of_tampering: boolean
  bank_detected: string | null
  reason: string
  auto_decision: 'approved' | 'rejected' | 'pending'
}

/**
 * Fetches an image from a URL and converts it to base64.
 * Works with both public URLs and Supabase Storage URLs.
 */
async function imageUrlToBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar la imagen: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const bytes = Buffer.from(buffer)
  const base64 = bytes.toString('base64')
  const contentType = res.headers.get('content-type') || 'image/jpeg'
  const mediaType = contentType.split(';')[0].trim()
  return { data: base64, mediaType }
}

/**
 * Analyzes a receipt image using Claude claude-haiku-5-5 vision.
 * Returns structured analysis and an automatic decision.
 *
 * Auto-decision logic:
 *   approved  → confidence >= 0.85, is_valid, !signs_of_tampering, status_is_completed
 *   rejected  → is_valid = false OR signs_of_tampering = true
 *   pending   → uncertain (confidence 0.5–0.84), needs manual review
 */
export async function analyzeReceipt(receiptUrl: string, expectedAmount?: number): Promise<ReceiptAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurado en variables de entorno')

  // Download image and encode to base64
  const { data: imageData, mediaType } = await imageUrlToBase64(receiptUrl)

  const amountHint = expectedAmount
    ? `El usuario afirma que transfirió $${expectedAmount.toFixed(2)} USD. Verifica si el monto en el comprobante coincide.`
    : 'No se especificó monto esperado. Extrae el monto que aparezca en el comprobante.'

  const prompt = `Eres un sistema experto en verificación de comprobantes de transferencia bancaria para México y América Latina.

Analiza esta imagen de comprobante y determina si es legítima.

${amountHint}

Busca:
1. Señales de edición digital: píxeles inconsistentes, fuentes mezcladas, números que no encajan, fondos editados
2. Formato bancario válido: membrete del banco, número de referencia/folio, fecha, monto, concepto, sellos
3. Estado de la operación: debe decir "exitosa", "completada", "aplicada" o equivalente — NO "pendiente" o "rechazada"
4. Coherencia interna: el monto en números debe coincidir con el monto en letras si aparece

Responde ÚNICAMENTE con este JSON exacto (sin markdown, sin explicación adicional):
{
  "is_valid": true,
  "confidence": 0.92,
  "amount_detected": 150.00,
  "status_is_completed": true,
  "signs_of_tampering": false,
  "bank_detected": "BBVA",
  "reason": "Comprobante BBVA con folio válido, monto claro, estado exitoso, sin señales de edición"
}

Si la imagen NO es un comprobante bancario (es una foto, texto, otra cosa), responde con is_valid: false y confidence: 0.99.
Si hay CUALQUIER duda, baja el confidence y explícalo en reason.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Error en API de Claude: ${response.status} — ${err}`)
  }

  const result = await response.json()
  const text = result.content?.[0]?.text ?? ''

  let parsed: Omit<ReceiptAnalysis, 'auto_decision'>
  try {
    // Strip any accidental markdown fences
    const clean = text.replace(/```json?/g, '').replace(/```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {
    throw new Error(`Respuesta inesperada del análisis: ${text.slice(0, 200)}`)
  }

  // Determine automatic decision
  let auto_decision: ReceiptAnalysis['auto_decision']
  if (!parsed.is_valid || parsed.signs_of_tampering) {
    auto_decision = 'rejected'
  } else if (parsed.confidence >= 0.85 && parsed.status_is_completed) {
    auto_decision = 'approved'
  } else {
    auto_decision = 'pending'
  }

  return { ...parsed, auto_decision }
}
