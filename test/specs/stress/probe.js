// One-shot path probe. Logs in once per role, GETs each candidate path, and
// prints the status. Use this to validate listCards() before trusting the
// stress run against the real server.
//
//   npx cross-env PROBE_ROLES=admin,teacher,student,parent k6 run test/specs/stress/probe.js
//
// Add PROBE_EXTRA="/some/path,/other" to probe one-off paths alongside the
// built-in list.

import http from 'k6/http'
import { login, listCards, BASE_URL } from './lib/site.js'
import { pickFor } from './lib/accounts.js'

export const options = {
  scenarios: {
    probe: { executor: 'per-vu-iterations', vus: 1, iterations: 1, exec: 'probe', maxDuration: '2m' },
  },
  thresholds: {}, // probes don't gate
}

function probePath(role, name, path) {
  const r = http.get(BASE_URL + path, {
    headers: {
      'User-Agent': 'k6-probe/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': BASE_URL + '/',
    },
    tags: { step: name, role },
  })
  const finalUrl = (r.url || '').replace(BASE_URL, '')
  console.log(`[${role}] ${name.padEnd(16)} ${String(r.status).padEnd(4)} → ${finalUrl}  (${path})`)
}

// Pull every sidebar GradeBook link out of a landing-page HTML. The shell
// renders them as <a id="lnk_mnu_..._<key>" href="...">.
function sidebarLinks(html) {
  const out = []
  const re = /<a[^>]+id=["']lnk_mnu_[^"']+_([a-z0-9_]+)["'][^>]*href=["']([^"']+)["']/gi
  const re2 = /<a[^>]+href=["']([^"']+)["'][^>]*id=["']lnk_mnu_[^"']+_([a-z0-9_]+)["']/gi
  let m
  while ((m = re.exec(html))) out.push({ key: m[1], href: m[2] })
  while ((m = re2.exec(html))) out.push({ key: m[2], href: m[1] })
  // De-dupe by href.
  const seen = new Set()
  return out.filter(l => (seen.has(l.href) ? false : seen.add(l.href)))
}

export function probe() {
  const roles = (__ENV.PROBE_ROLES || 'admin,teacher,student,parent').split(',').map(s => s.trim()).filter(Boolean)
  const extra = (__ENV.PROBE_EXTRA || '').split(',').map(s => s.trim()).filter(Boolean)
  for (const role of roles) {
    console.log(`\n=== ${role} ===`)
    const creds = pickFor(role, 1)
    const { ok, landingUrl } = login(creds, role)
    console.log(`[${role}] login ok=${ok} landed=${landingUrl}`)
    if (!ok) continue

    // Fetch the dashboard and scrape every sidebar link so we see the real
    // routes the role has in its menu.
    const home = http.get(landingUrl, {
      headers: { 'User-Agent': 'k6-probe/1.0', 'Accept': 'text/html' },
      tags: { step: 'dashboard', role },
    })
    const links = sidebarLinks(home.body || '')
    console.log(`[${role}] sidebar links (${links.length}):`)
    for (const l of links) console.log(`    ${l.key.padEnd(24)} ${l.href}`)

    console.log(`[${role}] probing current listCards():`)
    for (const c of listCards(role)) probePath(role, c.name, c.path)
    for (const p of extra) probePath(role, 'extra', p)
  }
}

export function handleSummary() {
  return { stdout: '\n(probe complete — see per-path log above)\n' }
}
