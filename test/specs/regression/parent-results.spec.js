import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ParentDashboardPage from '../../page objects/parentDashboard.page.js'
import ParentRegistrationsPage from '../../page objects/parentRegistrations.page.js'
import { PARENT_USER, STUDENT_ID, BASE_URL } from '../../helpers/testData.js'

// Parent Term / Session Results modals: the select guards (block Continue
// with nothing chosen) and the Continue → results-page flow, which currently
// 500s. The modals' Continue button builds a /grade-entry/student-(session-)
// results/{id} URL client-side and navigates there.
//
// Leaves behind: the two fixture students (shared with the other parent
// specs) — created once, reused on re-run.

describe('REGRESSION — Parent Results', () => {

    let termId
    let session

    before(async () => {
        await ParentRegistrationsPage.setUpFixtures()
        await LoginPage.loginAs(PARENT_USER)
        await ParentDashboardPage.open()
        termId = await ParentDashboardPage.firstSelectableValue(ParentDashboardPage.termSelect)
        session = await ParentDashboardPage.firstSelectableValue(ParentDashboardPage.sessionSelect)
    })

    describe('Select Guards', () => {

        it('REG-PAR-RES-001 | Continue with no term selected is blocked with a message', async () => {
            addFeature('Parent Results'); addSeverity('normal')
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTermModal(STUDENT_ID)
            // Leave the term on its placeholder and Continue — a native alert
            // guards it and the page must not navigate away.
            await ParentDashboardPage.armAlertCapture()
            await ParentDashboardPage.termContinueBtn.click()
            expect(await ParentDashboardPage.capturedAlert()).toMatch(/select a term/i)
            await expect(ParentDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
            await ParentDashboardPage.closeModal()
        })

        it('REG-PAR-RES-002 | Continue with no session selected is blocked with a message', async () => {
            addFeature('Parent Results'); addSeverity('normal')
            await ParentDashboardPage.open()
            await ParentDashboardPage.openSessionModal(STUDENT_ID)
            await ParentDashboardPage.armAlertCapture()
            await ParentDashboardPage.sessionContinueBtn.click()
            expect(await ParentDashboardPage.capturedAlert()).toMatch(/select a session/i)
            await expect(ParentDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
            await ParentDashboardPage.closeModal()
        })
    })

    describe('Results Load (known 500 defect)', () => {

        it('REG-PAR-RES-003 | Selecting a term and continuing opens the term result page', async () => {
            addFeature('Parent Results'); addSeverity('critical')
            // KNOWN DEFECT (reported on Plane): /grade-entry/student-results/{id}
            // returns HTTP 500 (the server redirects back to the dashboard for
            // the current browser request), same endpoint as the student
            // portal. Asserting the correct behaviour — expected to FAIL.
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTermModal(STUDENT_ID)
            await ParentDashboardPage.termSelect.selectByAttribute('value', termId)
            await ParentDashboardPage.termContinueBtn.click()
            await browser.waitUntil(async () => !(await browser.getUrl()).endsWith('/dashboard'),
                { timeout: 10000, timeoutMsg: 'Term result navigation redirected back to the dashboard (500 defect)' })
            await expect($('body')).not.toHaveText(/500 System Error/i)
        })

        it('REG-PAR-RES-004 | Selecting a session and continuing opens the session result page', async () => {
            addFeature('Parent Results'); addSeverity('critical')
            // KNOWN DEFECT (reported on Plane): /grade-entry/student-session-results/{id}
            // returns HTTP 500. Asserting correct behaviour — expected to FAIL.
            await ParentDashboardPage.open()
            await ParentDashboardPage.openSessionModal(STUDENT_ID)
            await ParentDashboardPage.sessionSelect.selectByAttribute('value', session)
            await ParentDashboardPage.sessionContinueBtn.click()
            await browser.waitUntil(async () => !(await browser.getUrl()).endsWith('/dashboard'),
                { timeout: 10000, timeoutMsg: 'Session result navigation redirected back to the dashboard (500 defect)' })
            await expect($('body')).not.toHaveText(/500 System Error/i)
        })

        it('REG-PAR-RES-005 | The term result endpoint actually serves a result page', async () => {
            addFeature('Parent Results'); addSeverity('critical')
            // Direct confirmation of the defect via fetch (browser.url hides
            // the status). KNOWN DEFECT (Plane): instead of rendering the
            // result, the server bounces the request back to the dashboard —
            // so the final URL is never the result page. Asserting the correct
            // behaviour — expected to FAIL until fixed.
            const finalUrl = await browser.execute(async (url) => {
                const r = await fetch(url, { credentials: 'same-origin' })
                return r.url
            }, `${BASE_URL}/scola-gradebook2/grade-entry/student-results/${STUDENT_ID}?term=${termId}`)
            expect(finalUrl).toContain('/grade-entry/student-results/')
        })
    })
})
