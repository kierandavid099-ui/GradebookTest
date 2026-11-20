import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AuthPage from '../../page objects/auth.page.js'
import StudentDashboardPage from '../../page objects/studentDashboard.page.js'
import StudentProfilePage from '../../page objects/studentProfile.page.js'
import { STUDENT_USER, STUDENT_ID, STUDENT_DISPLAY_NAME } from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Student portal journey
//
// One continuous, read-only pass through a student's own session, in the
// order a real student would use it: sign in → read the dashboard → walk the
// three tabs → open (and guard) a result picker → open the full profile →
// sign out and confirm the session is gone. No mutations, nothing left behind.
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Student Portal Journey', () => {

    it('E2E-STU-JRN-001 | A student signs in and reaches their GradeBook dashboard', async () => {
        addFeature('Student Journey'); addSeverity('blocker')
        await LoginPage.loginAs(STUDENT_USER)
        await StudentDashboardPage.open()
        await expect(StudentDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
        await expect(StudentDashboardPage.displayName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
    })

    it('E2E-STU-JRN-002 | They can read their stat cards and all three dashboard tabs', async () => {
        addFeature('Student Journey'); addSeverity('critical')
        for (const label of ['Subjects', 'Terms Attended', 'Attendance Rate', 'Class Position']) {
            await expect(StudentDashboardPage.statValue(label)).toBeDisplayed()
        }
        await StudentDashboardPage.openTab(StudentDashboardPage.subjectsTab, StudentDashboardPage.subjectsPane)
        await StudentDashboardPage.openTab(StudentDashboardPage.enrollmentsTab, StudentDashboardPage.enrollmentsPane)
        await StudentDashboardPage.openTab(StudentDashboardPage.quickLinksTab, StudentDashboardPage.quickLinksPane)
        await expect(StudentDashboardPage.quickLinkTile('My Profile')).toBeDisplayed()
    })

    it('E2E-STU-JRN-003 | Opening the term results picker and continuing blind is guarded', async () => {
        addFeature('Student Journey'); addSeverity('normal')
        await StudentDashboardPage.open()
        await StudentDashboardPage.openTermModal()
        const guard = await StudentDashboardPage.continueAndReadGuard(StudentDashboardPage.termContinueBtn)
        expect(guard).toMatch(/select a term before continuing/i)
        await StudentDashboardPage.closeModal()
    })

    it('E2E-STU-JRN-004 | They can open their own read-only full profile', async () => {
        addFeature('Student Journey'); addSeverity('critical')
        await StudentProfilePage.openFor(STUDENT_ID)
        await expect(StudentProfilePage.fullName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
        // Read-only: no edit controls are reachable.
        expect(await StudentProfilePage.visibleEditControls()).toEqual([])
    })

    it('E2E-STU-JRN-005 | Signing out ends the session', async () => {
        addFeature('Student Journey'); addSeverity('critical')
        await StudentDashboardPage.open()
        await AuthPage.logoutViaMenu()
        await StudentDashboardPage.open().catch(() => {})
        expect(await browser.getUrl()).toContain('/login')
    })
})
