// Teacher-suite constants. Shared accounts/URLs live in testData.js; this file
// only holds what the Teacher specs need on top of that.
//
// The live school started with no subjects assigned to Chisom and no pupils
// in her form class, so the Teacher suite brings its own fixtures (created
// once by TeacherFixtures.ensure() as admin, then reused on later runs):
//   - two subjects, "auto-tch English" (Pri 2A, 2B, 2C) and "auto-tch Maths" (Pri 2A)
//   - Chisom assigned to English in Pri 2A + Pri 2B and Maths in Pri 2A
//     (English in Pri 2C is deliberately left unassigned for the RBAC tests)
//   - three pupils "Tchfixture, Ada/Bayo/Chidi" enrolled in Pri 2A
// Other agents enrol their own pupils into Pri 2A too, so specs always look
// rows up by these names and never assume the class only holds ours.

// Chisom's form class (Pri 2A) — every class-scoped teacher URL uses it.
export const FORM_CLASS_ID = 'd2e27229-7606-4bc6-912d-bfd882b18c0d'
export const FORM_CLASS_NAME = 'Pri 2A'

// Pri 2B: Chisom teaches English there but is NOT its form teacher, and it has
// no pupils — used for the empty-state and form-class-scope tests.
export const OTHER_CLASS_ID = 'abab96a8-f86f-4598-a2ab-2dddc9b38d9f'
export const OTHER_CLASS_NAME = 'Pri 2B'

// Pri 2C: English is taught there, but not by Chisom.
export const UNASSIGNED_CLASS_ID = '7513e93f-480e-4d67-9522-2d96c83295a6'
export const UNASSIGNED_CLASS_NAME = 'Pri 2C'

// Pre-existing school subject that Chisom has never been assigned.
export const UNASSIGNED_SUBJECT_ID = 'ce1af4f8-0738-482a-9e27-90be49ac00f8'
export const UNASSIGNED_SUBJECT_NAME = 'Basic Science'

// Chisom's teacher record id (My Performance link, admin assignment matrix).
export const TEACHER_ID = '36d8b8e3-c329-4622-b1ff-a29c531d7f78'

export const FIXTURE_SUBJECTS = {
    english: { name: 'auto-tch English', code: 'ATE', classIds: [FORM_CLASS_ID, OTHER_CLASS_ID, UNASSIGNED_CLASS_ID], assignedTo: [FORM_CLASS_ID, OTHER_CLASS_ID] },
    maths: { name: 'auto-tch Maths', code: 'ATM', classIds: [FORM_CLASS_ID], assignedTo: [FORM_CLASS_ID] },
}

export const FIXTURE_LAST_NAME = 'Tchfixture'
// Pupils the specs score freely.
export const FIXTURE_STUDENTS = [
    { first: 'Ada', last: FIXTURE_LAST_NAME, gender: 'female' },
    { first: 'Bayo', last: FIXTURE_LAST_NAME, gender: 'male' },
    { first: 'Chidi', last: FIXTURE_LAST_NAME, gender: 'male' },
]
// Pupils reserved for the "blank counts as 0" cases. Once a cell has been
// saved the server ignores a later blank, and a graded pupil can't be
// unenrolled or deleted, so these keep specific English cells blank for good:
// Tenblank never gets a 2nd-component score, Allblank never gets any, and
// Examonly never gets a 1st-component score. No other spec may score them.
// The first set ("Tchblank, …") was scored by hand around 26 Oct 2026 and
// can't be cleared again, so it is retired and left in Pri 2A.
export const BLANK_LAST_NAME = 'Tchzero'
export const BLANK_STUDENTS = {
    tenBlank: { first: 'Tenblank', last: BLANK_LAST_NAME, gender: 'female' },
    allBlank: { first: 'Allblank', last: BLANK_LAST_NAME, gender: 'female' },
    examOnly: { first: 'Examonly', last: BLANK_LAST_NAME, gender: 'female' },
}
export const ALL_FIXTURE_STUDENTS = [...FIXTURE_STUDENTS, ...Object.values(BLANK_STUDENTS)]

// How each pupil's name renders on the grade sheet / attendance / conduct
// tables ("Last, First"); the dashboard's My Class tab shows "First Last".
export const studentSheetName = (first, last = FIXTURE_LAST_NAME) => `${last}, ${first}`
export const studentListName = (first, last = FIXTURE_LAST_NAME) => `${first} ${last}`

// The parent account is the agreed chat counterpart for Messenger tests.
export const CHAT_COUNTERPART_EMAIL = 'chinedu.okonkwo@yopmail.com'
export const CHAT_COUNTERPART_NAME = 'Chinedu Okonkwo'

// Pass mark used by the profile "X passed (≥40)" counter.
export const PASS_MARK = 40

// The WAEC/Secondary scale the sheet's band tests are written against.
// [grade, min, max] — banding should use the raw (unrounded) Final.
export const WAEC_BANDS = [
    ['A1', 75, 100], ['B2', 70, 74], ['B3', 65, 69], ['C4', 60, 64], ['C5', 55, 59],
    ['C6', 50, 54], ['D7', 45, 49], ['E8', 40, 44], ['F9', 0, 39],
]

// Weighted Final the way the sheet defines it: Σ score / max × weight%,
// blanks as 0, rounded to 2dp. `comps` ([{ max, weight }]) is read off the
// live grade-sheet headers so the maths tests follow whatever scheme the
// admin currently has applied.
// 2026-10-30: components used to be out of 100 (score × weight / 100); the
// sheet now scores in points (CA 40 pt, Exam 60 pt, Final = the sum). Both
// are the same formula, since max = weight on the points sheet.
export function expectedFinal(scores, comps) {
    const total = scores.reduce((sum, s, i) => sum + (s === '' || s === null || s === undefined ? 0 : Number(s)) / comps[i].max * comps[i].weight, 0)
    return (Math.round(total * 100) / 100).toFixed(2)
}

// Converts a score given as a % of the component's max into what to type in
// that column (55 → 55 out of 100, or 22 out of a 40 pt CA). '' stays blank.
export function pointsFor(pct, comp) {
    return pct === '' ? '' : String(Math.round(Number(pct) * comp.max) / 100)
}

// Picks component scores (one per component) that produce `target` exactly
// under the live scheme: every component gets target% of its max, which works
// for any scheme whose weights total 100%.
export function scoresFor(target, comps) {
    return comps.map(c => pointsFor(target, c))
}
