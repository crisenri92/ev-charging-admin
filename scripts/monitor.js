#!/usr/bin/env node
// 🤖 Monitor Agent 24/7 — ev-charging-admin
// Checks health, logs, code quality. Auto-fixes or alerts via email.

const APP_URL = process.env.APP_URL || 'https://recargat.app'
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'crisenri92@gmail.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = process.env.REPO || 'crisenri92/ev-charging-admin'

const issues = []
const fixes = []

// ─── 1. ENDPOINT HEALTH CHECK ───────────────────────────────────────────────
async function checkEndpoints() {
  const endpoints = [
    { name: 'Home', path: '/' },
    { name: 'API Login', path: '/api/login', method: 'POST', body: JSON.stringify({ email: '_healthcheck_', password: '_healthcheck_' }), expectStatus: [400, 401, 422] },
    { name: 'API Users', path: '/api/admin/users', expectStatus: [200, 401, 403] },
    { name: 'API Stripe Webhook', path: '/api/payment/webhook', method: 'POST', body: '{}', expectStatus: [200, 400] },
  ]
  for (const ep of endpoints) {
    try {
      const res = await fetch(APP_URL + ep.path, {
        method: ep.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: ep.body,
        signal: AbortSignal.timeout(10000)
      })
      const allowed = ep.expectStatus || [200]
      if (!allowed.includes(res.status)) {
        issues.push({ type: 'endpoint', severity: 'high', name: ep.name, detail: `Status ${res.status} — expected ${allowed.join('/')}`, path: ep.path })
      } else {
        console.log(`✅ ${ep.name}: ${res.status}`)
      }
    } catch (e) {
      issues.push({ type: 'endpoint', severity: 'critical', name: ep.name, detail: `Unreachable: ${e.message}`, path: ep.path })
    }
  }
}

// ─── 2. RAILWAY LOGS CHECK ──────────────────────────────────────────────────
async function checkRailwayLogs() {
  if (!RAILWAY_TOKEN || !RAILWAY_SERVICE_ID) return
  try {
    const query = `
      query {
        deployments(serviceId: "${RAILWAY_SERVICE_ID}", first: 1) {
          edges { node { id status logs { timestamp message } } }
        }
      }
    `
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RAILWAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    const data = await res.json()
    const deployment = data?.data?.deployments?.edges?.[0]?.node
    if (!deployment) return
    if (deployment.status === 'FAILED' || deployment.status === 'CRASHED') {
      issues.push({ type: 'deployment', severity: 'critical', name: 'Railway Deploy', detail: `Status: ${deployment.status}` })
    }
    // Find error lines in logs
    const errorLines = (deployment.logs || []).filter(l => /error|exception|crash|fatal|uncaught/i.test(l.message)).slice(0, 5)
    if (errorLines.length > 0) {
      issues.push({ type: 'logs', severity: 'medium', name: 'Runtime Errors in Logs', detail: errorLines.map(l => l.message).join('\n') })
    }
    console.log(`✅ Railway logs checked. Errors found: ${errorLines.length}`)
  } catch (e) {
    console.error('Railway logs check failed:', e.message)
  }
}

// ─── 3. AI CODE REVIEW ──────────────────────────────────────────────────────
async function aiCodeReview() {
  if (!ANTHROPIC_API_KEY || !GITHUB_TOKEN) return
  try {
    // Get recent commits
    const commitsRes = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=3`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    })
    const commits = await commitsRes.json()
    if (!Array.isArray(commits) || commits.length === 0) return
    const latestSha = commits[0].sha
    // Get diff of latest commit
    const diffRes = await fetch(`https://api.github.com/repos/${REPO}/commits/${latestSha}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    })
    const diffData = await diffRes.json()
    const patch = diffData.files?.slice(0, 3).map(f => `File: ${f.filename}\n${(f.patch || '').substring(0, 800)}`).join('\n\n')
    if (!patch) return
    // Ask Claude to review
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a security and quality code reviewer for a Next.js EV charging admin panel. Review this diff for bugs, security issues, or critical errors. Be concise.\n\n${patch}\n\nRespond with JSON: { "has_issues": boolean, "severity": "low|medium|high", "issues": [{"description": string, "file": string, "fix": string}] }`
        }]
      })
    })
    const claudeData = await claudeRes.json()
    const text = claudeData.content?.[0]?.text || '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return
    const review = JSON.parse(jsonMatch[0])
    if (review.has_issues && review.issues?.length > 0) {
      for (const issue of review.issues) {
        issues.push({ type: 'code', severity: review.severity, name: `Code Issue: ${issue.file}`, detail: issue.description, fix: issue.fix })
      }
    }
    console.log(`✅ AI code review done. Issues: ${review.issues?.length || 0}`)
  } catch (e) {
    console.error('AI code review failed:', e.message)
  }
}

// ─── 4. AUTO-RESTART RAILWAY IF DOWN ────────────────────────────────────────
async function restartIfDown() {
  const criticalDown = issues.filter(i => i.type === 'endpoint' && i.severity === 'critical')
  if (criticalDown.length === 0 || !RAILWAY_TOKEN || !RAILWAY_SERVICE_ID) return
  try {
    const mutation = `mutation { serviceInstanceRedeploy(environmentId: "${process.env.RAILWAY_ENV_ID || ''}", serviceId: "${RAILWAY_SERVICE_ID}") }`
    await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RAILWAY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation })
    })
    fixes.push('🔄 Railway service restarted automatically')
    console.log('🔄 Restart triggered')
  } catch (e) {
    console.error('Restart failed:', e.message)
  }
}

// ─── 5. SEND EMAIL ALERT ────────────────────────────────────────────────────
async function sendAlert() {
  if (issues.length === 0) { console.log('🟢 All systems healthy — no alert needed'); return }
  const highIssues = issues.filter(i => ['critical', 'high'].includes(i.severity))
  if (highIssues.length === 0 && fixes.length === 0) { console.log('ℹ️ Only low-severity issues, skipping alert'); return }
  const body = [
    `<h2>🚨 Monitor Agent Report — ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</h2>`,
    fixes.length > 0 ? `<h3>✅ Auto-fixed</h3><ul>${fixes.map(f => `<li>${f}</li>`).join('')}</ul>` : '',
    issues.length > 0 ? `<h3>⚠️ Issues requiring attention</h3><ul>${issues.map(i => `<li><strong>[${i.severity.toUpperCase()}] ${i.name}</strong><br>${i.detail}${i.fix ? `<br>💡 Suggested fix: ${i.fix}` : ''}</li>`).join('')}</ul>` : '',
    `<p><small>App: ${APP_URL} | Repo: ${REPO}</small></p>`
  ].join('')
  if (!RESEND_API_KEY) { console.log('📧 Would send alert:\n' + issues.map(i => `[${i.severity}] ${i.name}: ${i.detail}`).join('\n')); return }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'monitor@recargat.app', to: ALERT_EMAIL, subject: `🚨 [Monitor] ${highIssues.length} issue(s) en ev-charging-admin`, html: body })
  })
  const result = await res.json()
  console.log('📧 Alert sent:', result.id || result)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Monitor Agent starting...')
  console.log('🔍 Checking endpoints...')
  await checkEndpoints()
  console.log('📋 Checking Railway logs...')
  await checkRailwayLogs()
  console.log('🧠 Running AI code review...')
  await aiCodeReview()
  console.log('🔄 Auto-restarting if down...')
  await restartIfDown()
  console.log(`\n📊 Summary: ${issues.length} issues found, ${fixes.length} auto-fixed`)
  await sendAlert()
}

main().catch(e => { console.error('Agent crashed:', e); process.exit(1) })
