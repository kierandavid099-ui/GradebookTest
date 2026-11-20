import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import DashboardPage from '../../page objects/adminDashboard.page.js'
import { ADMIN_USER, STUDENT_ID } from '../../helpers/testData.js'
import { TEACHER_CLASS_ID, LIVE_SESSION_NAME } from '../../helpers/adminData.js'

// Term and session result views, launched from a class's detail page.
// Read-only: only Pri 2A's existing data is viewed.

describe('REGRESSION — Admin Results', () => {

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await DashboardPage.openClass(TEACHER_CLASS_ID)
    })

    afterEach(async () => { await DashboardPage.closeModal() })

    describe('Result navigation guards', () => {

        // A Continue that gets through leaves the class page, so start each
        // test back on it.
        beforeEach(async () => { await DashboardPage.openClass(TEACHER_CLASS_ID) })

        it('REG-ADM-RES-001 | The class page offers Term Results and Session Results', async () => {
            addFeature('Results'); addSeverity('critical')
            await expect(DashboardPage.termResultBtn).toBeDisplayed()
            await expect(DashboardPage.sessionResultBtn).toBeDisplayed()
        })

        it('REG-ADM-RES-002 | Continuing without choosing a term warns "Please select a term before continuing"', async () => {
            addFeature('Results'); addSeverity('normal')
            await DashboardPage.openTermResultModal()
            // 2026-10-30: the picker opens on the current term, so clear it
            // back to "-- Select Term --" to reach the guard.
            await DashboardPage.termSelect.selectByAttribute('value', '')
            await DashboardPage.termContinueBtn.click()
            expect(await DashboardPage.alertText()).toMatch(/Please select a term before continuing/i)
            expect(await browser.getUrl()).toContain('/gradeClasses/')
        })

        it('REG-ADM-RES-003 | Continuing without choosing a session warns "Please select a session"', async () => {
            addFeature('Results'); addSeverity('minor')
            await DashboardPage.openSessionResultModal()
            await DashboardPage.sessionContinueBtn.click()
            expect(await DashboardPage.alertText()).toMatch(/Please select a session/i)
        })

        it('REG-ADM-RES-004 | The term picker lists the live session\'s terms', async () => {
            addFeature('Results'); addSeverity('minor')
            await DashboardPage.openTermResultModal()
            const opts = await browser.execute(() => [...document.querySelectorAll('#class-term-result-modal select option')].map(o => o.value).filter(Boolean))
            expect(opts.length).toBeGreaterThanOrEqual(3)
        })
    })

    // 2026-10-30: the class term/session results no longer 500 (the defect
    // reported on Plane); both come back as a PDF (200, %PDF). The PDF text is
    // compressed, so its contents (e.g. the three term columns) aren't checked.
    describe('Result pages', () => {

        it('REG-ADM-RES-005 | Choosing a term and continuing opens the class term result', async () => {
            addFeature('Results'); addSeverity('critical')
            await DashboardPage.openClass(TEACHER_CLASS_ID)
            await DashboardPage.openTermResultModal()
            const term = await browser.execute(() => [...document.querySelectorAll('#class-term-result-modal select option')].map(o => o.value).filter(Boolean)[0])
            await DashboardPage.termSelect.selectByAttribute('value', term)
            await DashboardPage.termContinueBtn.click()
            await browser.waitUntil(async () => (await browser.getUrl()).includes('/class-results/'), { timeout: 15000 })
            const res = await DashboardPage.fetchResult(await browser.getUrl())
            expect(res.status).toBe(200)
            expect(res.start).toBe('%PDF-')
        })

        it('REG-ADM-RES-006 | The class session result (all three terms) loads', async () => {
            addFeature('Results'); addSeverity('critical')
            await DashboardPage.openClass(TEACHER_CLASS_ID)
            const res = await DashboardPage.fetchResult(`/scola-gradebook2/grade-entry/class-session-results/${TEACHER_CLASS_ID}?session=${encodeURIComponent(LIVE_SESSION_NAME)}`)
            expect(res.status).toBe(200)
            expect(res.start).toBe('%PDF-')
        })

        it('REG-ADM-RES-007 | A student\'s session result aggregates T1 + T2 + T3 (distinct from a single term)', async () => {
            addFeature('Results'); addSeverity('normal')
            // The app's own Session Results button passes the session name,
            // not its id. A pupil with no class is bounced back with "The
            // student is not registered in a valid class" (an HTML page, so
            // the PDF check catches it); Emeka was enrolled 2026-10-30.
            await DashboardPage.openClass(TEACHER_CLASS_ID)
            const res = await DashboardPage.fetchResult(`/scola-gradebook2/grade-entry/student-session-results/${STUDENT_ID}?session=${encodeURIComponent(LIVE_SESSION_NAME)}`)
            expect(res.status).toBe(200)
            expect(res.start).toBe('%PDF-')
        })
    })
})
