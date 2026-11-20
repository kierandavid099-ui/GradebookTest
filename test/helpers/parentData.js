// Parent-role constants. Shared accounts/ids live in testData.js; these are
// the extra fixtures, routes and small request helpers only the parent specs
// need.
import { BASE_URL } from './testData.js'

// Chinedu's parent record id (Registrations → Parents) — the Link Students
// modal and the parent-update API are keyed on it.
export const PARENT_ID = '70712618-1cbf-4c29-a9ce-a761f43b4040'
export const ORG_ID = '7ab1d069-9bae-4c89-b3ea-d54908b5cc1d'

// Chisom's assigned class — the id in every teacher-only class route.
export const TEACHER_CLASS_ID = 'd2e27229-7606-4bc6-912d-bfd882b18c0d'

// How the two accounts label each other in the Messenger thread list
// ("First Last", unlike the "Last, First" header everywhere else).
export const TEACHER_CHAT_NAME = 'Chisom Okafor'
export const PARENT_CHAT_NAME = 'Chinedu Okonkwo'

// Fixture students the parent suite creates (once) as admin. Fixed names, not
// uniqueName(), so a re-run finds and reuses them instead of piling up new
// students on every run.
//   LINKED   — linked to Chinedu alongside Emeka (for "lists every child").
//   UNLINKED — never linked to any parent (the IDOR target).
export const LINKED_FIXTURE = { firstName: 'ParFixLinked', lastName: 'Autotest', gender: 'female' }
export const UNLINKED_FIXTURE = { firstName: 'ParFixUnlinked', lastName: 'Autotest', gender: 'male' }

// The parent's GradeBook sidebar should hold exactly these items.
export const PARENT_MENU = ['Dashboard', 'Messenger']

// Routes owned by other roles — a parent must be bounced off every one.
export const TEACHER_ONLY_ROUTES = {
    gradeEntry: '/scola-gradebook2/grade-entry',
    classAssessment: `/scola-gradebook2/class-assessment/${TEACHER_CLASS_ID}`,
    classAttendance: `/scola-gradebook2/class-attendance/${TEACHER_CLASS_ID}`,
    classTimetable: `/scola-gradebook2/class-timetable/${TEACHER_CLASS_ID}`,
}
export const ADMIN_ONLY_ROUTES = {
    academicManagement: '/scola-gradebook2/academic-management',
    resultModeration: '/scola-gradebook2/result-moderation',
    registrationManagement: '/scola-gradebook2/registration-management',
    teacherManagement: '/scola-gradebook2/teacher-management',
    manageSettings: '/scola-gradebook2/manage-settings',
}

// Parent-facing per-child routes.
export const CHILD_ROUTES = {
    profile: (id) => `/scola-gradebook2/students/${id}`,
    attendance: (id) => `/scola-gradebook2/student-attendance/${id}`,
    termResults: (id, termId) => `/scola-gradebook2/grade-entry/student-results/${id}?term=${termId}`,
    sessionResults: (id, session) => `/scola-gradebook2/grade-entry/student-session-results/${id}?session=${session}`,
}

export const MESSENGER_PATH = '/fc/communications'

// GETs a path from inside the logged-in page (same cookies) and reports what
// the server really answered — status, where redirects ended, and the body.
// browser.url() can't see status codes, and a 500 page has no breadcrumb.
export function fetchPage(path) {
    return browser.execute(async (url) => {
        const res = await fetch(url, { credentials: 'same-origin' })
        return { status: res.status, url: res.url, redirected: res.redirected, body: await res.text() }
    }, path.startsWith('http') ? path : `${BASE_URL}${path}`)
}
