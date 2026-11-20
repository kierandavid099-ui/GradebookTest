import http from 'k6/http'
import { check, sleep } from 'k6'

export const BASE_URL = __ENV.GRADEBOOK_BASE_URL || 'https://gradebook.ng'

function headers(extra) {
  const h = {
    'User-Agent': 'k6-stress/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  if (extra) Object.assign(h, extra)
  return h
}

// Pull Laravel's CSRF token out of the login page. Site serves it as a
// <meta name="csrf-token" content="..."> and as a hidden _token input;
// either will do.
function extractCsrf(html) {
  let m = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i)
  if (m) return m[1]
  m = html.match(/name=["']_token["']\s+value=["']([^"']+)["']/i)
  return m ? m[1] : null
}

// The login form carries a hidden organization_id (tenant selector). Grab it
// in either attribute order.
function extractHidden(html, name) {
  const re = new RegExp(`<input[^>]+name=["']${name}["'][^>]*value=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<input[^>]+value=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i')
  const m = html.match(re) || html.match(re2)
  return m ? m[1] : null
}

// Log a VU in. Cookies land in the per-VU jar; subsequent http.get calls
// re-send them automatically.
export function login(creds, role) {
  const loginUrl = `${BASE_URL}/login`
  const first = http.get(loginUrl, { headers: headers(), tags: { step: 'login_page', role } })
  check(first, { 'login page 200': r => r.status === 200 }, { role })
  // If a session is still live the GET redirects straight to the dashboard —
  // treat that as already-logged-in and skip the POST.
  if (first.url && !/\/login\/?$/.test(first.url)) {
    return { ok: true, landingUrl: first.url }
  }
  const token = extractCsrf(first.body)
  check(first, { 'csrf token present': () => !!token }, { role })
  const orgId = extractHidden(first.body, 'organization_id')
  check(first, { 'organization_id present': () => !!orgId }, { role })

  // The server needs a beat after GET /login before it will honour a POST —
  // the WDIO login page object documents the same race (2s pause). Without
  // this delay every POST re-renders the login page.
  sleep(Number(__ENV.LOGIN_SETTLE || 2))

  const payload = { email: creds.email, password: creds.password }
  if (token) payload._token = token
  if (orgId) payload.organization_id = orgId

  function submit(tk, org) {
    const body = { email: creds.email, password: creds.password }
    if (tk) body._token = tk
    if (org) body.organization_id = org
    return http.post(loginUrl, body, {
      headers: headers({
        'Referer': loginUrl,
        'Origin': BASE_URL,
        'X-XSRF-TOKEN': tk || '',
      }),
      redirects: 5,
      tags: { step: 'login_submit', role },
    })
  }
  let post = submit(token, orgId)
  let ok = post.status === 200 || post.status === 302
  let landed = post.url && !/\/login\/?$/.test(post.url)
  // Transient POST failure under load — refetch the login page for a fresh
  // CSRF/session and try once more before giving up.
  if (!(ok && landed)) {
    const retryFirst = http.get(loginUrl, { headers: headers(), tags: { step: 'login_page', role } })
    if (retryFirst.status === 200) {
      const tk2 = extractCsrf(retryFirst.body)
      const org2 = extractHidden(retryFirst.body, 'organization_id')
      sleep(Number(__ENV.LOGIN_SETTLE || 2))
      post = submit(tk2, org2)
      ok = post.status === 200 || post.status === 302
      landed = post.url && !/\/login\/?$/.test(post.url)
    }
  }
  if (!landed && __ENV.STRESS_DEBUG) {
    const raw = (post.body || '').toString()
    // Pull out anything that looks like an inline error message Laravel would render.
    const errMatch = raw.match(/<(?:div|span|p)[^>]*class=["'][^"']*(?:invalid-feedback|text-red-500|text-danger|alert-danger)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|p)>/i)
    const err = errMatch ? errMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '(no inline error found)'
    console.log(`[${role}] login redirected back to login. final=${post.url} status=${post.status} email=${creds.email}`)
    console.log(`[${role}] inline error: ${err}`)
  }
  check(post, {
    'login status 2xx/3xx': () => ok,
    'landed off /login': () => landed,
  }, { role })
  return { ok: ok && landed, landingUrl: post.url }
}

// Headers for XHR calls the app itself fires after login.
export function apiHeaders(role) {
  return headers({
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json, text/plain, */*',
    'Referer': BASE_URL + '/',
    ...(role ? { 'X-Stress-Role': role } : {}),
  })
}

// Headers for a top-level page navigation (sidebar card clicks). These need
// to look like an ordinary browser GET — the XHR variant above makes
// Laravel's auth middleware answer with JSON 401/403 instead of the HTML
// page, which showed up as every teacher:academic hit failing while the
// probe (plain HTML headers) saw a clean 200.
export function pageHeaders(role) {
  return headers({
    'Referer': BASE_URL + '/',
    ...(role ? { 'X-Stress-Role': role } : {}),
  })
}

// Hit a list of cards/pages for a role. Each entry is {name, path, checkFn?}.
// checkFn is optional and gets (response) — defaults to status-200 only.
// Tenant slug for the fixture school — the WDIO page objects route every
// authenticated URL under /scola-gradebook2/.
const TENANT = __ENV.TENANT_SLUG || 'scola-gradebook2'
const T = p => `/${TENANT}${p}`

// Verified against the real product shell (probe run 2026-11-19). The sidebar
// menu is role-agnostic at the shell level — every role sees the same six
// modules — but authorisation is enforced per route, so we exercise only the
// pages each role can actually reach without a 4xx.
export function listCards(role) {
  if (role === 'admin') return [
    { name: 'dashboard', path: T('/dashboard') },
    { name: 'academic',  path: T('/academic-management') },
    { name: 'teachers',  path: T('/teacher-management') },
    { name: 'students',  path: T('/student-management') },
    { name: 'analytics', path: T('/analytics') },
    { name: 'settings',  path: T('/manage-settings') },
  ]
  if (role === 'teacher') return [
    { name: 'dashboard', path: T('/dashboard') },
    // /academic-management is in the shell sidebar for teachers but the
    // server returns 403 for ordinary teacher accounts (confirmed under
    // STRESS_DEBUG=1). Only privileged teachers (e.g. department heads)
    // can load it. Leave it out of the stress browse list so we don't
    // measure a known-forbidden route.
  ]
  if (role === 'student') return [
    { name: 'dashboard', path: T('/dashboard') },
  ]
  if (role === 'parent') return [
    { name: 'dashboard', path: T('/dashboard') },
  ]
  throw new Error(`unknown role: ${role}`)
}

export function browseCards(role) {
  const cards = listCards(role)
  for (const c of cards) {
    let r = http.get(BASE_URL + c.path, {
      headers: pageHeaders(role),
      tags: { step: c.name, role },
    })
    let ok = r.status > 0 && r.status < 400
    // Single retry on transient blip (5xx / connection reset under load).
    if (!ok) {
      r = http.get(BASE_URL + c.path, {
        headers: pageHeaders(role),
        tags: { step: c.name, role },
      })
      ok = r.status > 0 && r.status < 400
    }
    if (!ok && __ENV.STRESS_DEBUG) {
      const finalPath = (r.url || '').replace(BASE_URL, '')
      console.log(`[${role}] ${c.name} status=${r.status} final=${finalPath} bodyLen=${(r.body || '').length}`)
    }
    check(r, {
      [`${role}:${c.name} status < 400`]: () => ok,
    }, { role, card: c.name })
  }
}

// The app's logout is a CSRF-protected POST via #logout-form. For stress we
// keep the per-VU session across iterations — login() detects the live
// session and skips the POST on subsequent iterations, which is cheaper and
// still exercises the server. Call logout() only when a scenario needs it.
export function logout(role) {
  // Hit the dashboard once to pick up a fresh CSRF token for the logout form.
  const home = http.get(`${BASE_URL}/${TENANT}/dashboard`, {
    headers: headers(),
    tags: { step: 'logout_prep', role },
  })
  const token = extractCsrf(home.body)
  if (!token) return
  let r = http.post(`${BASE_URL}/logout`, { _token: token }, {
    headers: headers({ Referer: `${BASE_URL}/${TENANT}/dashboard`, 'X-XSRF-TOKEN': token }),
    redirects: 2,
    tags: { step: 'logout', role },
  })
  // One retry with a fresh CSRF on a transient failure — under load the token
  // occasionally races session rotation and the first POST comes back 419/5xx.
  if (!(r.status > 0 && r.status < 400)) {
    const home2 = http.get(`${BASE_URL}/${TENANT}/dashboard`, { headers: headers(), tags: { step: 'logout_prep', role } })
    const token2 = extractCsrf(home2.body)
    if (token2) {
      r = http.post(`${BASE_URL}/logout`, { _token: token2 }, {
        headers: headers({ Referer: `${BASE_URL}/${TENANT}/dashboard`, 'X-XSRF-TOKEN': token2 }),
        redirects: 2,
        tags: { step: 'logout', role },
      })
    }
  }
  if (!(r.status > 0 && r.status < 400) && __ENV.STRESS_DEBUG) {
    console.log(`[${role}] logout failed status=${r.status} final=${(r.url || '').replace(BASE_URL, '')}`)
  }
  check(r, { 'logout < 400': res => res.status > 0 && res.status < 400 }, { role })
}
