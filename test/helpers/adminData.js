// Admin-only constants for the GradeBook admin suites. Shared account data
// (logins, display names, STUDENT_ID) stays in testData.js.

// The one school on gradebook.ng. Every admin write carries it.
export const ORG_ID = '7ab1d069-9bae-4c89-b3ea-d54908b5cc1d'

export const API = '/api/scola-gradebook2-api'

// Pre-existing records the admin suites read but never rename or delete.
export const LIVE_SESSION_ID = '9be8a856-e9a9-4187-b45d-5bb7278ac7c1'   // 2026/2027
export const LIVE_SESSION_NAME = '2026/2027'
export const TEACHER_ID = '36d8b8e3-c329-4622-b1ff-a29c531d7f78'         // Okafor, Chisom
export const TEACHER_CLASS_ID = 'd2e27229-7606-4bc6-912d-bfd882b18c0d'   // Pri 2A (lower primary)
export const LIVE_SUBJECT_ID = 'ce1af4f8-0738-482a-9e27-90be49ac00f8'    // Basic Science

// The school is a Primary school, so the class/scheme level options are
// only these two (secondary levels appear for secondary/combined schools).
export const LEVELS = ['lower_primary', 'upper_primary']

// Fixture classes/schemes go on Upper Primary: Chisom's own class (Pri 2A)
// is Lower Primary, so an Upper Primary scheme never changes her grade sheet.
export const FIXTURE_LEVEL = 'upper_primary'

// Manage Settings > Preferences toggles (keys are stored as fc-api settings).
export const PREFS = {
    notifyGradeSubmission: 'scola_gradebook2_notify_grade_submission',
    notifyResultsPublished: 'scola_gradebook2_notify_results_published',
    resultsPublished: 'scola_gradebook2_results_published',
    allowTeacherViewOtherGrades: 'scola_gradebook2_allow_teacher_view_other_grades',
    lockGradeEntryAfterTerm: 'scola_gradebook2_lock_grade_entry_after_term',
}

// Grade-scale presets as the sheet defines them: [letter, min, max].
export const WAEC_BANDS = [
    ['A1', 75, 100], ['B2', 70, 74], ['B3', 65, 69], ['C4', 60, 64], ['C5', 55, 59],
    ['C6', 50, 54], ['D7', 45, 49], ['E8', 40, 44], ['F9', 0, 39],
]

// A 40/60 continuous-assessment / exam split used by the moderation fixture.
export const FIXTURE_SCHEME_ITEMS = [
    { title: 'CA', weight: 40 },
    { title: 'Exam', weight: 60 },
]

// CSV bodies for the bulk student import. The class code column must match
// an existing grade_class code; the bad-code row is deliberately unknown.
export const studentCsv = (rows) => [
    'first_name,last_name,gender,grade_class_code',
    ...rows.map(r => [r.first, r.last, r.gender || 'male', r.classCode].join(',')),
].join('\n')
