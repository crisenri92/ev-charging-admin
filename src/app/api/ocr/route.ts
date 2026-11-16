import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/ocr
 * Accepts multipart/form-data with an `image` field.
 * Uses Claude Haiku Vision to extract transfer receipt data:
 * { amount, reference_number, sender_name }
 */
export async function POST(req: NextRequest) {
  // Auth: Bearer token del usuario mÃ³vil
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.substring(7)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const image = formData.get('image') as File | null
  if (!image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API not configured' }, { status: 500 })
  }

  // Convert to base64
  const buffer = await image.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const rawType = image.type || 'image/jpeg'
  const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(rawType)
    ? rawType
    : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const prompt = `Extrae los datos del siguiente comprobante de transferencia bancaria.

Responde ÃNICAMENTE con este JSON (sin markdown, sin texto adicional):
{
  "amount": 150.00,
  "reference_number": "123456789012",
  "sender_name": "Juan PÃ©rez GarcÃ­a"
}

Reglas:
- amount: el monto numÃ©rico de la transferencia (nÃºmero sin sÃ­mbolos). Si no encuentras: null
- reference_number: nÃºmero de folio, referencia o comprobante (string). Si no encuentras: null
- sender_name: nombre del titular o remitente si aparece (string). Si no encuentras: null`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    console.error('[OCR] Claude API error:', response.status, err)
    return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 })
  }

  const result = await response.json()
  const text = result.content?.[0]?.text ?? '{}'

  try {
    const clean = text.replace(/```json?/g, '').replace(/```/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json({ success: true, data })
  } catch {
    console.error('[OCR] Failed to parse response:', text.slice(0, 200))
    return NextResponse.json({ error: 'Failed to parse OCR result' }, { status: 500 })
  }
}
