import { sleep } from 'k6'
import exec from 'k6/execution'
import { login, browseCards, logout, BASE_URL } from './lib/site.js'
import { pickFor } from './lib/accounts.js'
import { k6SummaryToAllure } from './lib/allure.js'

// Env knobs. VU counts and durations default low so an unparameterised
// `npm run stress` is safe against the live server; profiles below crank
// them up.
const DURATION = __ENV.STRESS_DURATION || '2m'
const VUS_ADMIN   = Number(__ENV.VUS_ADMIN   || 1)
const VUS_TEACHER = Number(__ENV.VUS_TEACHER || 2)
const VUS_STUDENT = Number(__ENV.VUS_STUDENT || 5)
const VUS_PARENT  = Number(__ENV.VUS_PARENT  || 2)
const THINK_MIN   = Number(__ENV.THINK_MIN   || 1)
const THINK_MAX   = Number(__ENV.THINK_MAX   || 4)

function scenario(role, vus) {
  if (vus <= 0) return null
  return {
    executor: 'constant-vus',
    exec: `${role}Flow`,
    vus,
    duration: DURATION,
    tags: { role },
  }
}

const scenarios = {}
for (const [role, vus] of [
  ['admin', VUS_ADMIN],
  ['teacher', VUS_TEACHER],
  ['student', VUS_STUDENT],
  ['parent', VUS_PARENT],
]) {
  const s = scenario(role, vus)
  if (s) scenarios[role] = s
}

export const options = {
  scenarios,
  discardResponseBodies: false,
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    'http_req_duration{role:admin}':   ['p(95)<30000'],
    'http_req_duration{role:teacher}': ['p(95)<30000'],
    'http_req_duration{role:student}': ['p(95)<30000'],
    'http_req_duration{role:parent}':  ['p(95)<30000'],
  },
}

function thinkTime() {
  const span = Math.max(0, THINK_MAX - THINK_MIN)
  sleep(THINK_MIN + Math.random() * span)
}

function flow(role) {
  const creds = pickFor(role, exec.vu.idInTest)
  const { ok } = login(creds, role)
  if (!ok) {
    // Login failed; back off a bit before the next iteration so we don't
    // tight-loop against the auth endpoint.
    sleep(2)
    return
  }
  browseCards(role)
  thinkTime()
  logout(role)
}

export function adminFlow()   { flow('admin') }
export function teacherFlow() { flow('teacher') }
export function studentFlow() { flow('student') }
export function parentFlow()  { flow('parent') }

export function setup() {
  return { base: BASE_URL, startedAt: new Date().toISOString() }
}

export function handleSummary(data) {
  return k6SummaryToAllure(data, 'k6 stress — gradebook.ng')
}
