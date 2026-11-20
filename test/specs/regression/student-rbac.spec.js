import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import StudentDashboardPage from '../../page objects/studentDashboard.page.js'
import StudentRegistrationsPage from '../../page objects/studentRegistrations.page.js'
import StudentAccessPage from '../../page objects/studentAccess.page.js'
import { ADMIN_USER, STUDENT_USER } from '../../helpers/testData.js'
import { FIXTURE_STUDENT, TEACHER_CLASS_ID } from '../../helpers/studentData.js'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION — Student RBAC (nav scoping, IDOR, route authz)
//
// A student must only reach their own data and their own (Dashboard-only)
// menu. These tests swap in a SECOND student's id (the auto fixture, created
// as admin in the before hook if missing) and prove the app refuses it, and
// that admin/teacher routes are blocked.
// 2026-10-30: the direct-API write tests (RBAC-013/014) were dropped — out of
// scope; only what a student can do through the web app's own UI is tested.
//
// Fixture left behind: one student "Idor AutoStuFixture"
// (autostu.idor.fixture@yopmail.com) — reused across runs, never deleted.
// A term grade-entry id is read from the live app, never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

describe('REGRESSION — Student RBAC', () => {

    let otherId
    let termId

    before(async () => {
        // Create/find the second student as admin, and grab a real term id.
        await LoginPage.loginAs(ADMIN_USER)
        otherId = await StudentRegistrationsPage.ensureStudent(FIXTURE_STUDENT)

        // Now become the student for every test below.
        await LoginPage.loginAs(STUDENT_USER)
        await StudentDashboardPage.open()
        await StudentDashboardPage.openTermModal()
        termId = await StudentDashboardPage.firstOptionValue('#grade_term_id')
        await StudentDashboardPage.closeModal()
    })

    describe('Navigation scoping', () => {

        it('REG-STU-RBAC-001 | Only the student Dashboard appears in the GradeBook menu', async () => {
            addFeature('RBAC'); addSeverity('critical')
            await StudentDashboardPage.open()
            await Sidebar.openGroup('student')
            const items = (await Sidebar.itemTexts()).map(t => t.trim()).filter(Boolean)
            expect(items).toHaveLength(1)
            expect(items[0]).toMatch(/Dashboard/i)
            // No admin/teacher menu groups are rendered at all.
            const otherGroups = await browser.execute(() =>
                ['gradebook2', 'teacher_gradebook2', 'parent_gradebook2']
                    .filter(p => document.querySelector(`#mnu_${p}_dashboard`)))
            expect(otherGroups).toEqual([])
        })
    })

    describe('IDOR — another student\'s records', () => {

        it('REG-STU-RBAC-002 | Another student\'s term result cannot be opened by id swap', async () => {
            addFeature('RBAC'); addSeverity('blocker')
            await StudentAccessPage.visit(`/scola-gradebook2/grade-entry/student-results/${otherId}?term=${termId}`)
            await StudentAccessPage.assertBlocked('/scola-gradebook2/grade-entry/student-results/' + otherId,
                [FIXTURE_STUDENT.lastName])
        })

        it('REG-STU-RBAC-003 | Another student\'s session result cannot be opened by id swap', async () => {
            addFeature('RBAC'); addSeverity('blocker')
            await StudentAccessPage.visit(`/scola-gradebook2/grade-entry/student-session-results/${otherId}?session=2026/2027`)
            await StudentAccessPage.assertBlocked('/scola-gradebook2/grade-entry/student-session-results/' + otherId,
                [FIXTURE_STUDENT.lastName])
        })

        // DEFECT (IDOR): a student can open another student's full profile by
        // swapping the id in /students/{id}. Correct behaviour is a denial —
        // this asserts that and is expected to FAIL until it is fixed.
        it('REG-STU-RBAC-004 | Another student\'s full profile cannot be opened by id swap', async () => {
            addFeature('RBAC'); addSeverity('blocker')
            await StudentAccessPage.visit(`/scola-gradebook2/students/${otherId}`)
            await StudentAccessPage.assertBlocked('/scola-gradebook2/students/' + otherId,
                [FIXTURE_STUDENT.firstName, FIXTURE_STUDENT.lastName])
        })

        it('REG-STU-RBAC-005 | Another student\'s attendance leaks no data by id swap', async () => {
            addFeature('RBAC'); addSeverity('blocker')
            await StudentAccessPage.visit(`/scola-gradebook2/student-attendance/${otherId}`)
            // The page currently errors (HTTP 500) rather than rendering, so the
            // security property to hold is simply: no other-student data leaks.
            const body = await StudentAccessPage.bodyText()
            expect(body).not.toContain(FIXTURE_STUDENT.firstName)
            expect(body).not.toContain(FIXTURE_STUDENT.lastName)
        })
    })

    describe('Blocked admin / teacher routes', () => {

        const routes = [
            ['006', 'teacher grade-entry (class results)', `/scola-gradebook2/grade-entry/class-results/${TEACHER_CLASS_ID}`],
            ['007', 'admin academic-management', '/scola-gradebook2/academic-management'],
            ['008', 'result moderation', '/scola-gradebook2/result-moderation'],
            ['009', 'registration management', '/scola-gradebook2/registration-management'],
            ['010', 'teacher management', '/scola-gradebook2/teacher-management'],
            ['011', 'manage settings', '/scola-gradebook2/manage-settings'],
            ['012', 'grade-entry hub', '/scola-gradebook2/grade-entry'],
        ]
        routes.forEach(([n, label, path]) => {
            it(`REG-STU-RBAC-${n} | ${label} route is blocked for a student`, async () => {
                addFeature('RBAC'); addSeverity('blocker')
                await StudentAccessPage.visit(path)
                await StudentAccessPage.assertBlocked(path)
            })
        })
    })
})
