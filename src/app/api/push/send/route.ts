import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

webpush.setVapidDetails(
  'mailto:crisenri92@gmail.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, url = '/mobile' } = await req.json()
    
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)

    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({ title, body, url, tag: 'ev-' + Date.now() })
    let sent = 0

    await Promise.allSettled(subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        sent++
      } catch (e: any) {
        // Remove invalid subscriptions
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', row.subscription.endpoint)
        }
      }
    }))

    return NextResponse.json({ sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
