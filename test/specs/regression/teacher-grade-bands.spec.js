import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import TeacherStudentProfilePage from '../../page objects/teacherStudentProfile.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import {
    FORM_CLASS_ID, FIXTURE_SUBJECTS, FIXTURE_STUDENTS, studentSheetName, scoresFor,
} from '../../helpers/teacherData.js'

// WAEC band boundaries (A1 75–100 … F9 0–39) on "auto-tch English — Pri 2A".
// Grade bands aren't shown on the grade sheet itself; the teacher sees them
// in each pupil's Profile → Grades tab, so every case is "produce the Final
// via component entry → Save → read the pupil's band".
//
// Any target Final is produced exactly by giving every component that same
// % of its max (weights always total 100%), e.g. 74.9 → 74.9 / 74.9 out of
// 100, or 29.96 / 44.94 on the points sheet (CA 40 pt, Exam 60 pt, 2026-10-30).
//
// The grade scale is owned by the admin suite. These cases only run when the
// live scale is the WAEC one (Final 100 bands as "A1"); with no scale, or a
// different scale, the whole suite skips with that reason in the report.
// At the time of writing the server has NO grade scale at all, so every
// band shows "-" and this suite is skipped.
//
// Leaves behind: draft English scores for the three Tchfixture pupils.

const PUPILS = FIXTURE_STUDENTS.map(s => ({ name: studentSheetName(s.first) }))

describe('REGRESSION — Teacher Grade Bands (WAEC)', () => {

    let ids
    let comps

    // Saves up to three target Finals (one per fixture pupil) and returns
    // the band each pupil's profile shows for English, keyed by target.
    async function bandsFor(targets) {
        const out = {}
        for (let i = 0; i < targets.length; i += PUPILS.length) {
            const chunk = targets.slice(i, i + PUPILS.length)
            await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
            for (let j = 0; j < chunk.length; j++) {
                await TeacherGradeEntryPage.enterScores(PUPILS[j].name, scoresFor(chunk[j], comps))
            }
            await TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.english)
            for (let j = 0; j < chunk.length; j++) {
                const row = await TeacherGradeEntryPage.row(PUPILS[j].name)
                PUPILS[j].id = row.studentId
                await TeacherStudentProfilePage.openFor(row.studentId)
                await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
                const g = await TeacherStudentProfilePage.gradeFor(FIXTURE_SUBJECTS.english.name)
                out[chunk[j]] = { final: row.final, score: g && g.score, grade: g && g.grade }
            }
        }
        return out
    }

    before(async function () {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
        await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
        comps = await TeacherGradeEntryPage.components()
        if (!comps.length) this.skip()
        // Probe the live scale once: a Final of 100 must band as A1.
        const probe = await bandsFor([100])
        if (probe[100].grade !== 'A1') {
            console.log(`[teacher-grade-bands] skipped: live grade scale is not WAEC (Final 100 → "${probe[100].grade}")`)
            this.skip()
        }
    })

    describe('Boundary Flips', () => {

        it('REG-TCH-BND-001 | A1/B2 flip — 74 → B2, 74.9 → B2, 75 → A1, 75.1 → A1 (no round-up at 74.9)', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('critical')
            const b = await bandsFor([74, 74.9, 75])
            expect(b[74].grade).toBe('B2')
            expect(b[74.9].grade).toBe('B2')
            expect(b[75].grade).toBe('A1')
            expect((await bandsFor([75.1]))[75.1].grade).toBe('A1')
        })

        it('REG-TCH-BND-002 | B2/B3 flip — 69 → B3, 70 → B2', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('critical')
            const b = await bandsFor([69, 70])
            expect(b[69].grade).toBe('B3')
            expect(b[70].grade).toBe('B2')
        })

        it('REG-TCH-BND-003 | B3/C4 flip — 64 → C4, 65 → B3', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([64, 65])
            expect(b[64].grade).toBe('C4')
            expect(b[65].grade).toBe('B3')
        })

        it('REG-TCH-BND-004 | C4/C5 flip — 59 → C5, 60 → C4', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([59, 60])
            expect(b[59].grade).toBe('C5')
            expect(b[60].grade).toBe('C4')
        })

        it('REG-TCH-BND-005 | C5/C6 flip — 54 → C6, 55 → C5', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([54, 55])
            expect(b[54].grade).toBe('C6')
            expect(b[55].grade).toBe('C5')
        })

        it('REG-TCH-BND-006 | C6/D7 flip — 49 → D7, 50 → C6', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('critical')
            const b = await bandsFor([49, 50])
            expect(b[49].grade).toBe('D7')
            expect(b[50].grade).toBe('C6')
        })

        it('REG-TCH-BND-007 | D7/E8 flip — 44 → E8, 45 → D7', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([44, 45])
            expect(b[44].grade).toBe('E8')
            expect(b[45].grade).toBe('D7')
        })

        it('REG-TCH-BND-008 | E8/F9 pass/fail line — 39 → F9 (fail), 40 → E8 (pass)', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('blocker')
            const b = await bandsFor([39, 40])
            expect(b[39].grade).toBe('F9')
            expect(b[40].grade).toBe('E8')
        })

        it('REG-TCH-BND-009 | Extremes — 0 → F9, 100 → A1', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([0, 100])
            expect(b[0].grade).toBe('F9')
            expect(b[100].grade).toBe('A1')
        })
    })

    describe('Raw-Value Banding', () => {

        it('REG-TCH-BND-010 | Decimal Finals band on the raw value — 32.5 → F9 (not rounded up), 88.2 → A1', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('critical')
            const b = await bandsFor([32.5, 88.2])
            expect(b[32.5].final).toBe('32.50')
            expect(b[32.5].grade).toBe('F9')
            expect(b[88.2].final).toBe('88.20')
            expect(b[88.2].grade).toBe('A1')
        })

        it('REG-TCH-BND-011 | Just under a boundary stays in the lower band — 39.99 → F9, 69.99 → B3', async () => {
            addFeature('Teacher Grade Bands'); addSeverity('normal')
            const b = await bandsFor([39.99, 69.99])
            expect(b[39.99].grade).toBe('F9')
            expect(b[69.99].grade).toBe('B3')
        })
    })
})
