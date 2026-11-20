import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AuthPage from '../../page objects/auth.page.js'
import StudentDashboardPage from '../../page objects/studentDashboard.page.js'
import StudentProfilePage from '../../page objects/studentProfile.page.js'
import Sidebar from '../../page objects/sidebar.js'
import {
    ADMIN_USER, TEACHER_USER, STUDENT_USER, PARENT_USER,
    ADMIN_DISPLAY_NAME, TEACHER_DISPLAY_NAME, STUDENT_DISPLAY_NAME, PARENT_DISPLAY_NAME,
    STUDENT_ID,
} from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE — Student critical path (+ shared auth sanity)
//
// One lean, read-only pass: the login page loads, every role reaches its
// dashboard, and the student's own GradeBook surfaces (dashboard, stat cards,
// tabs, profile) load with the right title and key elements. No mutations,
// no IDOR/negative cases — those live in test/specs/regression.
// ─────────────────────────────────────────────────────────────────────────────

describe('SMOKE — Student Critical Path', () => {

    describe('Authentication', () => {

        it('SM-AUTH-001 | Login page loads with the email/password form', async () => {
            addFeature('Authentication'); addSeverity('blocker')
            await LoginPage.logout()
            await LoginPage.open()
            await expect(LoginPage.emailInput).toBeDisplayed()
            await expect(LoginPage.passwordInput).toBeDisplayed()
            await expect(LoginPage.loginBtn).toBeDisplayed()
        })

        // Each of the four roles signs in and lands on a dashboard whose page
        // title carries their own "Last, First" display name.
        const roles = [
            ['Admin', ADMIN_USER, ADMIN_DISPLAY_NAME],
            ['Teacher', TEACHER_USER, TEACHER_DISPLAY_NAME],
            ['Student', STUDENT_USER, STUDENT_DISPLAY_NAME],
            ['Parent', PARENT_USER, PARENT_DISPLAY_NAME],
        ]
        roles.forEach(([label, user, name], i) => {
            it(`SM-AUTH-00${i + 2} | ${label} lands on the dashboard titled with their name`, async () => {
                addFeature('Authentication'); addSeverity('critical')
                await LoginPage.loginAs(user)
                expect(await browser.getUrl()).toContain('/dashboard')
                await expect(browser).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
            })
        })
    })

    describe('Student Dashboard', () => {

        before(async () => {
            await LoginPage.loginAs(STUDENT_USER)
            await StudentDashboardPage.open()
        })

        it('SM-STU-DSH-001 | Dashboard loads with the GradeBook breadcrumb', async () => {
            addFeature('Student Dashboard'); addSeverity('blocker')
            await expect(browser).toHaveTitle(/GradeBook/i)
            await expect(StudentDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
        })

        it('SM-STU-DSH-002 | Header shows the student display name', async () => {
            addFeature('Student Dashboard'); addSeverity('normal')
            await expect(StudentDashboardPage.displayName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
        })

        it('SM-STU-DSH-003 | The four stat cards render', async () => {
            addFeature('Student Dashboard'); addSeverity('critical')
            for (const label of ['Subjects', 'Terms Attended', 'Attendance Rate', 'Class Position']) {
                await expect(StudentDashboardPage.statValue(label)).toBeDisplayed()
            }
        })

        it('SM-STU-DSH-004 | The three dashboard tabs are present', async () => {
            addFeature('Student Dashboard'); addSeverity('normal')
            await expect(StudentDashboardPage.subjectsTab).toBeDisplayed()
            await expect(StudentDashboardPage.enrollmentsTab).toBeDisplayed()
            await expect(StudentDashboardPage.quickLinksTab).toBeDisplayed()
        })

        it('SM-STU-DSH-005 | The My Term / My Session Results buttons are present', async () => {
            addFeature('Student Dashboard'); addSeverity('critical')
            await expect(StudentDashboardPage.myTermResultsBtn).toBeDisplayed()
            await expect(StudentDashboardPage.mySessionResultsBtn).toBeDisplayed()
        })
    })

    describe('Student Profile', () => {

        before(async () => await StudentProfilePage.openFor(STUDENT_ID))

        it('SM-STU-PRF-001 | Own profile loads with the correct title', async () => {
            addFeature('Student Profile'); addSeverity('blocker')
            await expect(browser).toHaveTitle(/Student Profile/i)
            await expect(StudentProfilePage.breadcrumb).toHaveText(/Student Profile/i)
        })

        it('SM-STU-PRF-002 | Profile shows the student name and overview tabs', async () => {
            addFeature('Student Profile'); addSeverity('normal')
            await expect(StudentProfilePage.fullName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
            await expect(StudentProfilePage.tab('sprof-overview')).toBeDisplayed()
        })
    })

    describe('Navigation scope', () => {

        before(async () => await StudentDashboardPage.open())

        it('SM-STU-NAV-001 | The GradeBook sidebar menu holds only Dashboard', async () => {
            addFeature('Navigation'); addSeverity('critical')
            await Sidebar.openGroup('student')
            const items = (await Sidebar.itemTexts()).map(t => t.trim()).filter(Boolean)
            expect(items).toHaveLength(1)
            expect(items[0]).toMatch(/Dashboard/i)
        })
    })

    describe('Logout', () => {

        it('SM-AUTH-006 | Logout from the header ends the session', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await LoginPage.loginAs(STUDENT_USER)
            await StudentDashboardPage.open()
            await AuthPage.logoutViaMenu()
            await StudentDashboardPage.open().catch(() => {})
            expect(await browser.getUrl()).toContain('/login')
        })
    })
})
