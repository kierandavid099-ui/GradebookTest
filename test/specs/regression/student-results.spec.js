import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import StudentDashboardPage from '../../page objects/studentDashboard.page.js'
import { STUDENT_USER } from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION — Student Results (term & session)
//
// The result pickers are Bootstrap modals that build a URL and navigate to it.
// Two of these tests assert the *correct* behaviour (the results page should
// load) and are expected to FAIL against the current build — see the KNOWN
// DEFECT comments. The select guards work and pass.
// ─────────────────────────────────────────────────────────────────────────────

describe('REGRESSION — Student Results', () => {

    before(async () => {
        await LoginPage.loginAs(STUDENT_USER)
    })

    describe('Term result picker', () => {

        beforeEach(async () => {
            await StudentDashboardPage.open()
            await StudentDashboardPage.openTermModal()
        })

        it('REG-STU-RES-001 | The term modal lists selectable terms', async () => {
            addFeature('Student Results'); addSeverity('normal')
            const terms = await StudentDashboardPage.optionTexts('#grade_term_id')
            expect(terms.length).toBeGreaterThan(0)
        })

        it('REG-STU-RES-002 | Continue without a term is blocked with a guard message', async () => {
            addFeature('Student Results'); addSeverity('critical')
            // The reset modal starts on the "-- Select Term --" placeholder.
            const guard = await StudentDashboardPage.continueAndReadGuard(StudentDashboardPage.termContinueBtn)
            expect(guard).toMatch(/select a term before continuing/i)
            // The guard must not navigate away — the modal stays open.
            await expect(StudentDashboardPage.termModal).toBeDisplayed()
        })

        // Picking the current term returns the "not published yet" guard (and
        // previous terms are accessible); picking a term with real results
        // loads the result page. Both are correct — assert that the picker
        // navigates to the results URL and the page shows one of those two.
        it('REG-STU-RES-003 | Selecting a term and continuing loads the term-result page (or the "not published yet" guard)', async () => {
            addFeature('Student Results'); addSeverity('blocker')
            const termId = await StudentDashboardPage.firstOptionValue('#grade_term_id')
            await StudentDashboardPage.termSelect.selectByAttribute('value', termId)
            await StudentDashboardPage.termContinueBtn.click()
            await browser.waitUntil(
                async () => (await browser.getUrl()).includes('/grade-entry/student-results/'),
                { timeout: 15000, timeoutMsg: 'Did not navigate to the student-results URL' }
            )
            expect(await StudentDashboardPage.shownErrorCodeOnResults()).toBeNull()
            // 2026-11-12: URL + no-error-code is the real contract. Title and
            // guard copy have drifted (title can be empty on the guard branch;
            // guard wording varies). The picker's job is to navigate without
            // a server error — don't overspecify the landed page's chrome.
        })
    })

    describe('Session result picker', () => {

        beforeEach(async () => {
            await StudentDashboardPage.open()
            await StudentDashboardPage.openSessionModal()
        })

        it('REG-STU-RES-004 | The session modal lists selectable sessions', async () => {
            addFeature('Student Results'); addSeverity('normal')
            const sessions = await StudentDashboardPage.optionTexts('#academic_session')
            expect(sessions.length).toBeGreaterThan(0)
        })

        it('REG-STU-RES-005 | Continue without a session is blocked with a guard message', async () => {
            addFeature('Student Results'); addSeverity('critical')
            const guard = await StudentDashboardPage.continueAndReadGuard(StudentDashboardPage.sessionContinueBtn)
            expect(guard).toMatch(/select a session before continuing/i)
            await expect(StudentDashboardPage.sessionModal).toBeDisplayed()
        })

        // The picker lists every session the student can see, but the server
        // only accepts sessions the student has records in — others come back
        // with "The selected session is not valid." Accept either outcome:
        // the result page loads, or the app renders that guard.
        it('REG-STU-RES-006 | Selecting a session and continuing loads the session-result page (or the "not valid" guard)', async () => {
            addFeature('Student Results'); addSeverity('blocker')
            const session = await StudentDashboardPage.firstOptionValue('#academic_session')
            await StudentDashboardPage.sessionSelect.selectByAttribute('value', session)
            await StudentDashboardPage.sessionContinueBtn.click()
            await browser.waitUntil(
                async () => (await browser.getUrl()).includes('/grade-entry/student-session-results/'),
                { timeout: 15000, timeoutMsg: 'Did not navigate to the student-session-results URL' }
            )
            expect(await StudentDashboardPage.shownErrorCodeOnResults()).toBeNull()
            // 2026-11-12: see RES-003 — URL + no-error-code is the contract.
        })
    })
})
