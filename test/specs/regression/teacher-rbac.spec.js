import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import { BASE_URL, TEACHER_USER, STUDENT_ID } from '../../helpers/testData.js'
import {
    FORM_CLASS_ID, OTHER_CLASS_ID, UNASSIGNED_CLASS_ID, UNASSIGNED_SUBJECT_ID, studentSheetName,
} from '../../helpers/teacherData.js'

// What a teacher must NOT be able to reach. Expected behaviour is an access
// denial (403 page or redirect) — where the live app instead serves the page,
// the test fails and is listed as an RBAC defect in the report.
//
// 2026-10-30, confirmed by the owners: any teacher may VIEW any class,
// subject or pupil, whatever allow_teacher_view_other_grades is set to.
// The switch only governs writing: OFF refuses the save, ON lets a teacher
// edit/create on another teacher's behalf (REG-ADM-SET-010). RBAC-007/008/
// 011/014-017 therefore assert the page is served, not denied.
//
// Settings-dependent cases: allow_teacher_view_other_grades is OFF and
// lock_grade_entry_after_term is OFF on the server (Manage Settings belongs
// to the admin suite, so neither is toggled here). The OFF behaviour is
// tested; the ON behaviour and the term-end freeze are skipped with reasons.
//
// Leaves behind: if the "write to an unassigned subject" defect is present,
// one Basic Science score (55) for Tchfixture, Ada in Pri 2A, and a CA of
// 7/8 for the sheet's first pupil (RBAC-009).

describe('REGRESSION — Teacher Access Control', () => {

    let ids

    const denied = async () => {
        const status = await TeacherDashboardPage.errorStatus()
        const url = await browser.getUrl()
        return status === 403 || status === 404 || /\/dashboard(\?|$)|\/login/.test(url)
    }
    // View-anything is by design (see header), but the page must still
    // render: no error page, no bounce to the dashboard or login.
    const served = async () => {
        expect(await TeacherDashboardPage.errorStatus()).toBe(null)
        expect(await denied()).toBe(false)
    }

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
    })

    describe('Admin-Only Screens', () => {

        for (const [n, path] of [
            ['001', '/scola-gradebook2/academic-management'],
            ['002', '/scola-gradebook2/teacher-management'],
            ['003', '/scola-gradebook2/registration-management'],
            ['004', '/scola-gradebook2/manage-settings'],
        ]) {
            it(`REG-TCH-RBAC-${n} | Direct URL ${path} is denied to a teacher (403)`, async () => {
                addFeature('Teacher Access Control'); addSeverity('blocker')
                await TeacherDashboardPage.openPath(path)
                expect(await TeacherDashboardPage.errorStatus()).toBe(403)
            })
        }

        it('REG-TCH-RBAC-005 | The teacher menu offers no admin items (no moderation, settings or scheme config)', async () => {
            addFeature('Teacher Access Control'); addSeverity('critical')
            await TeacherDashboardPage.open()
            await Sidebar.openGroup('teacher')
            const items = await Sidebar.itemTexts()
            for (const admin of ['Academic Management', 'Teacher Management', 'Registration', 'Manage Settings', 'Result Moderation']) {
                expect(items.join('|')).not.toContain(admin)
            }
        })

        it('REG-TCH-RBAC-006 | A teacher cannot approve a submission by calling the moderation endpoint directly', async () => {
            addFeature('Teacher Access Control'); addSeverity('blocker')
            await TeacherDashboardPage.open()
            const res = await browser.executeAsync((done) => {
                const fd = new FormData()
                fd.append('_token', document.querySelector('meta[name="csrf-token"]').content)
                fd.append('action', 'approve')
                fd.append('admin_comment', 'auto-tch rbac probe')
                // Any id: authorisation must be checked before the lookup.
                fetch('/scola-gradebook2/result-moderation/00000000-0000-0000-0000-000000000000', { method: 'POST', body: fd, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
                    .then(async r => done({ status: r.status, body: (await r.text()).slice(0, 300) }))
            })
            expect(res.status).toBe(403)
            expect(res.body).toMatch(/administrators/i)
        })
    })

    describe('Unassigned Subjects & Classes (allow_teacher_view_other_grades = OFF)', () => {

        it('REG-TCH-RBAC-007 | Grade entry for a subject taught in a class by someone else is viewable by direct URL', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            // English × Pri 2C exists but is not Chisom's.
            await TeacherGradeEntryPage.openPath(`/scola-gradebook2/grade-entry?cl=${UNASSIGNED_CLASS_ID}&sj=${ids.english}`)
            await served()
            await expect(TeacherGradeEntryPage.table).toBeDisplayed({ wait: 10000 })
        })

        it('REG-TCH-RBAC-008 | Grade entry for an unassigned subject in her own form class is viewable by direct URL', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            // Basic Science × Pri 2A: her pupils, not her subject. The sheet
            // shows live inputs and Save; RBAC-009/010 check the save is refused.
            await TeacherGradeEntryPage.openPath(`/scola-gradebook2/grade-entry?cl=${FORM_CLASS_ID}&sj=${UNASSIGNED_SUBJECT_ID}`)
            await served()
            await expect(TeacherGradeEntryPage.table).toBeDisplayed({ wait: 10000 })
        })

        // The reachable sheet shows live inputs and Save — accepted by the
        // owners (28 Oct) because the server refuses the save, so that
        // refusal is what this checks.
        it('REG-TCH-RBAC-009 | Even if the sheet is reachable, its Save is refused and nothing is stored', async () => {
            addFeature('Teacher Access Control'); addSeverity('critical')
            await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, UNASSIGNED_SUBJECT_ID)
            await TeacherGradeEntryPage.table.waitForDisplayed({ timeout: 10000 })
            const [before] = await TeacherGradeEntryPage.rows()
            const score = before.scores[0] === '7' ? 8 : 7
            await TeacherGradeEntryPage.enterScores(before.name, [score, ...before.scores.slice(1)])
            expect(await TeacherGradeEntryPage.save()).toMatch(/not assigned to teach this subject/i)
            await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, UNASSIGNED_SUBJECT_ID)
            await TeacherGradeEntryPage.table.waitForDisplayed({ timeout: 10000 })
            expect((await TeacherGradeEntryPage.row(before.name)).scores).toEqual(before.scores)
        })

        it('REG-TCH-RBAC-010 | Saving scores for an unassigned subject is refused server-side', async () => {
            addFeature('Teacher Access Control'); addSeverity('blocker')
            // Uses the form class's own (assigned) English sheet to build a
            // valid payload, then retargets it at Basic Science for Ada only.
            await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
            const ada = await TeacherGradeEntryPage.row(studentSheetName('Ada'))
            const res = await TeacherGradeEntryPage.postScoresDirectly(55, { classId: FORM_CLASS_ID, subjectId: UNASSIGNED_SUBJECT_ID, studentId: ada.studentId })
            expect(res.status).toBeGreaterThanOrEqual(400)
        })

        it('REG-TCH-RBAC-011 | The Results view of an unassigned subject × class is viewable', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            await TeacherGradeEntryPage.openPath(`/scola-gradebook2/grade-entry/completed?cl=${UNASSIGNED_CLASS_ID}&sj=${ids.english}`)
            await served()
        })

        it('REG-TCH-RBAC-012 | "Select Subject to Grade" never offers an unassigned subject × class', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
            const values = await browser.execute(() => [...document.querySelectorAll('#teacher-subject-select option')].map(o => o.value))
            expect(values).not.toContain(`${ids.english}|${UNASSIGNED_CLASS_ID}`)
            expect(values.some(v => v.startsWith(UNASSIGNED_SUBJECT_ID))).toBe(false)
        })

        // allow_teacher_view_other_grades is OFF on the server and toggling it
        // belongs to the admin suite — the ON behaviour (edit allowed, by
        // design since 2026-10-30) is covered by REG-ADM-SET-010.
        it.skip('REG-TCH-RBAC-013 | With allow_teacher_view_other_grades ON, other subjects\' grades are editable', async () => {
            addFeature('Teacher Access Control'); addSeverity('critical')
        })
    })

    describe('Form-Class Scope', () => {

        // Pri 2B: Chisom teaches English there but is not its form teacher.
        for (const [n, screen, path] of [
            ['014', 'Class Attendance', `/scola-gradebook2/class-attendance/${OTHER_CLASS_ID}`],
            ['015', 'Conduct', `/scola-gradebook2/class-assessment/${OTHER_CLASS_ID}`],
            ['016', 'Timetable', `/scola-gradebook2/class-timetable/${OTHER_CLASS_ID}`],
        ]) {
            it(`REG-TCH-RBAC-${n} | ${screen} of a class she is not form teacher of is viewable`, async () => {
                addFeature('Teacher Access Control'); addSeverity('normal')
                await TeacherDashboardPage.openPath(path)
                await served()
            })
        }

        it('REG-TCH-RBAC-017 | The profile of a pupil outside her classes is viewable', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            // Emeka (the Student suite's pupil) is not enrolled in any of
            // Chisom's classes.
            await TeacherDashboardPage.openPath(`/scola-gradebook2/students/${STUDENT_ID}`)
            await served()
        })

        it('REG-TCH-RBAC-018 | The teacher\'s menu links only to her own form class', async () => {
            addFeature('Teacher Access Control'); addSeverity('normal')
            await TeacherDashboardPage.open()
            const hrefs = await browser.execute(() => [...document.querySelectorAll('[id^="lnk_mnu_teacher_gradebook2_dashboard_"]')].map(a => a.href))
            hrefs.filter(h => /class-(attendance|assessment|timetable)\//.test(h)).forEach(h => expect(h).toContain(FORM_CLASS_ID))
        })
    })

    describe('Term-End Freeze', () => {

        // lock_grade_entry_after_term is OFF and the current term has not
        // ended; Manage Settings and term dates belong to the admin suite.
        it.skip('REG-TCH-RBAC-019 | After term end (lock ON) neither teacher nor admin can edit that term\'s grades', async () => {
            addFeature('Teacher Access Control'); addSeverity('critical')
        })
    })

    describe('Unauthenticated', () => {

        it('REG-TCH-RBAC-020 | Teacher screens redirect to login once signed out', async () => {
            addFeature('Teacher Access Control'); addSeverity('critical')
            await LoginPage.logout()
            await browser.url(`${BASE_URL}/scola-gradebook2/grade-entry?cl=${FORM_CLASS_ID}&sj=${ids.english}`)
            expect(await browser.getUrl()).toContain('/login')
            await LoginPage.loginAs(TEACHER_USER)
        })
    })
})
