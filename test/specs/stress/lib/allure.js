// Minimal Allure writer for k6 — one testcase per threshold and one per
// named check. We emit JSON result files plus a JUnit XML, both of which
// the existing allure-report generator will pick up out of allure-results/.
//
// This runs only in k6's handleSummary() hook (end-of-test, main thread),
// so SharedArray/open() restrictions don't apply here.

function uuid() {
  // k6 doesn't ship crypto.randomUUID — good enough for result file names
  return (
    's' +
    Math.random().toString(16).slice(2) +
    Math.random().toString(16).slice(2)
  ).slice(0, 36)
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function allureCase({ name, suite, status, message, start, stop }) {
  const uid = uuid()
  const now = Date.now()
  const result = {
    uuid: uid,
    historyId: uid,
    name,
    fullName: `${suite} > ${name}`,
    status, // passed | failed | broken | skipped
    stage: 'finished',
    start: start || now,
    stop: stop || now,
    labels: [
      { name: 'suite', value: suite },
      { name: 'framework', value: 'k6' },
      { name: 'language', value: 'javascript' },
    ],
    statusDetails: message ? { message: String(message) } : undefined,
  }
  return { file: `${uid}-result.json`, body: JSON.stringify(result, null, 2) }
}

function junitXml(suite, cases) {
  const failed = cases.filter(c => c.status === 'failed').length
  const skipped = cases.filter(c => c.status === 'skipped').length
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${xmlEscape(suite)}" tests="${cases.length}" failures="${failed}" skipped="${skipped}">`,
  ]
  for (const c of cases) {
    parts.push(`  <testcase classname="${xmlEscape(suite)}" name="${xmlEscape(c.name)}">`)
    if (c.status === 'failed') {
      parts.push(`    <failure message="${xmlEscape(c.message || 'failed')}"></failure>`)
    } else if (c.status === 'skipped') {
      parts.push(`    <skipped/>`)
    }
    parts.push(`  </testcase>`)
  }
  parts.push('</testsuite>')
  return parts.join('\n')
}

// Walk a k6 Metric's thresholds map (if any) into Allure testcases.
function thresholdCases(data) {
  const out = []
  const metrics = data.metrics || {}
  for (const metricName of Object.keys(metrics)) {
    const thr = metrics[metricName].thresholds
    if (!thr) continue
    for (const expr of Object.keys(thr)) {
      const t = thr[expr]
      out.push({
        name: `threshold ${metricName} ${expr}`,
        status: t.ok ? 'passed' : 'failed',
        message: t.ok ? '' : `threshold breached: ${metricName} ${expr}`,
      })
    }
  }
  return out
}

// Named check() calls in the scripts become one testcase each. A check that
// failed even once in the run is reported as failed.
function checkCases(data) {
  const out = []
  const root = data.root_group || { checks: [], groups: [] }
  function walk(group) {
    for (const c of group.checks || []) {
      const pass = c.passes || 0
      const fail = c.fails || 0
      const status = fail > 0 ? 'failed' : (pass > 0 ? 'passed' : 'skipped')
      out.push({
        name: `check ${c.name}`,
        status,
        message: fail > 0 ? `${fail} of ${pass + fail} runs failed` : '',
      })
    }
    for (const g of group.groups || []) walk(g)
  }
  walk(root)
  return out
}

export function k6SummaryToAllure(data, suite) {
  const suiteName = suite || 'k6 stress'
  const cases = []
    .concat(thresholdCases(data))
    .concat(checkCases(data))

  const files = {}
  for (const c of cases) {
    const { file, body } = allureCase({ ...c, suite: suiteName })
    files[`allure-results/${file}`] = body
  }
  files['allure-results/k6-junit.xml'] = junitXml(suiteName, cases)
  const failed = cases.filter(c => c.status === 'failed')
  const passed = cases.filter(c => c.status === 'passed')
  const lines = []
  lines.push('')
  lines.push(`k6 stress: ${cases.length} cases — ${passed.length} passed, ${failed.length} failed`)
  if (failed.length) {
    lines.push('')
    lines.push('FAILED:')
    for (const c of failed) {
      lines.push(`  ✗ ${c.name}${c.message ? '  — ' + c.message : ''}`)
    }
  }
  lines.push('')
  lines.push('PASSED:')
  for (const c of passed) lines.push(`  ✓ ${c.name}`)
  lines.push('')
  files['stdout'] = lines.join('\n') + '\n'
  return files
}
