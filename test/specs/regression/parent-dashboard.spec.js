import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ParentDashboardPage from '../../page objects/parentDashboard.page.js'
import ParentChildProfilePage from '../../page objects/parentChildProfile.page.js'
import ParentRegistrationsPage from '../../page objects/parentRegistrations.page.js'
import { PARENT_USER, STUDENT_ID } from '../../helpers/testData.js'
import { LINKED_FIXTURE } from '../../helpers/parentData.js'

// Parent dashboard + My Children: stat cards, both tabs, the per-child action
// icons, the read-only child profile, and the attendance tab figures.
//
// Leaves behind: the two fixture students (shared with the access-control
// spec), with ParFixLinked linked to Chinedu — created once, reused on re-run.

describe('REGRESSION — Parent Dashboard & My Children', () => {

    let linkedId

    before(async () => {
        ({ linkedId } = await ParentRegistrationsPage.setUpFixtures())
        await LoginPage.loginAs(PARENT_USER)
        await ParentDashboardPage.open()
    })

    describe('Stat Cards', () => {

        it('REG-PAR-DSH-001 | My Children card shows the count of linked children', async () => {
            addFeature('Parent Dashboard'); addSeverity('normal')
            // Two children are linked (Emeka + the fixture), so the count is ≥ 2.
            const value = Number(await ParentDashboardPage.statValue('My Children').getText())
            expect(value).toBeGreaterThanOrEqual(2)
        })

        it('REG-PAR-DSH-002 | Average Score card renders a percentage value', async () => {
            addFeature('Parent Dashboard'); addSeverity('normal')
            await expect(ParentDashboardPage.statValue('Average Score')).toHaveText(/%$/)
        })

        it('REG-PAR-DSH-003 | Attendance Rate card renders a percentage value', async () => {
            addFeature('Parent Dashboard'); addSeverity('normal')
            await expect(ParentDashboardPage.statValue('Attendance Rate')).toHaveText(/%$/)
        })
    })

    describe('My Children Tab', () => {

        before(async () => {
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTab(ParentDashboardPage.childrenTab, ParentDashboardPage.childrenPane)
        })

        it('REG-PAR-CHD-001 | Every linked child is listed (Emeka and the fixture)', async () => {
            addFeature('Parent My Children'); addSeverity('critical')
            const ids = await ParentDashboardPage.childIds()
            expect(ids).toContain(STUDENT_ID)
            expect(ids).toContain(linkedId)
        })

        it('REG-PAR-CHD-002 | Each child row exposes the four action icons', async () => {
            addFeature('Parent My Children'); addSeverity('normal')
            await expect(ParentDashboardPage.viewProfileLink(STUDENT_ID)).toBeDisplayed()
            await expect(ParentDashboardPage.viewAttendanceLink(STUDENT_ID)).toBeDisplayed()
            await expect(ParentDashboardPage.termResultsBtn(STUDENT_ID)).toBeDisplayed()
            await expect(ParentDashboardPage.sessionResultsBtn(STUDENT_ID)).toBeDisplayed()
        })

        it('REG-PAR-CHD-003 | View Profile opens the child\'s Student Profile page', async () => {
            addFeature('Parent My Children'); addSeverity('critical')
            await ParentDashboardPage.viewProfileLink(STUDENT_ID).click()
            await expect(ParentChildProfilePage.breadcrumb).toHaveText(/Student Profile/i)
            await expect(ParentChildProfilePage.headerName).toHaveText(/Okonkwo, Emeka/)
        })

        it('REG-PAR-CHD-004 | Term Results icon opens the term-selection modal', async () => {
            addFeature('Parent My Children'); addSeverity('normal')
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTermModal(STUDENT_ID)
            await expect(ParentDashboardPage.termModal).toBeDisplayed()
            await expect(ParentDashboardPage.termSelect).toBeDisplayed()
            await ParentDashboardPage.closeModal()
        })

        it('REG-PAR-CHD-005 | Session Results icon opens the session-selection modal', async () => {
            addFeature('Parent My Children'); addSeverity('normal')
            await ParentDashboardPage.openSessionModal(STUDENT_ID)
            await expect(ParentDashboardPage.sessionModal).toBeDisplayed()
            await expect(ParentDashboardPage.sessionSelect).toBeDisplayed()
            await ParentDashboardPage.closeModal()
        })
    })

    describe('Child Profile — Read Only', () => {

        before(async () => await ParentChildProfilePage.openChild(STUDENT_ID))

        it('REG-PAR-PRF-001 | Profile shows the child\'s bio in the Overview tab', async () => {
            addFeature('Parent My Children'); addSeverity('normal')
            await expect(ParentChildProfilePage.fieldValue('Gender')).toHaveText(/Male/i)
        })

        it('REG-PAR-PRF-002 | All five profile tabs switch panes', async () => {
            addFeature('Parent My Children'); addSeverity('minor')
            for (const key of ParentChildProfilePage.tabKeys) {
                await ParentChildProfilePage.openTab(ParentChildProfilePage.tab(key), ParentChildProfilePage.pane(key))
                await expect(ParentChildProfilePage.pane(key)).toBeDisplayed()
            }
        })

        it('REG-PAR-PRF-003 | The profile is read-only — no visible edit or save controls', async () => {
            addFeature('Parent My Children'); addSeverity('critical')
            await ParentChildProfilePage.openChild(STUDENT_ID)
            // The admin Edit/Reset/Disable modals ship in the DOM but must
            // stay hidden; the only visible controls are tabs (excluded) and
            // the read-only Term/Session Results shortcuts.
            const controls = await ParentChildProfilePage.visibleWriteControls()
            expect(controls).toEqual([])
            await expect(ParentChildProfilePage.editSaveBtn).not.toBeDisplayed()
            await expect(ParentChildProfilePage.resetPasswordBtn).not.toBeDisplayed()
            await expect(ParentChildProfilePage.disableAccountBtn).not.toBeDisplayed()
        })
    })

    describe('Attendance Tab', () => {

        before(async () => {
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTab(ParentDashboardPage.attendanceTab, ParentDashboardPage.attendancePane)
        })

        it('REG-PAR-ATT-001 | Attendance tab lists every linked child', async () => {
            addFeature('Parent Attendance'); addSeverity('normal')
            await expect(ParentDashboardPage.attendanceRow('Okonkwo, Emeka')).toBeDisplayed()
            await expect(ParentDashboardPage.attendanceRow(`${LINKED_FIXTURE.lastName}, ${LINKED_FIXTURE.firstName}`)).toBeDisplayed()
        })

        it('REG-PAR-ATT-002 | A child row shows Present, Total Days and Rate', async () => {
            addFeature('Parent Attendance'); addSeverity('normal')
            const cells = await ParentDashboardPage.attendanceCells('Okonkwo, Emeka')
            expect(cells.present).toMatch(/^\d+$/)
            expect(cells.totalDays).toMatch(/^\d+$/)
            // Rate is a percentage or an em-dash placeholder when there's no data.
            expect(cells.rate).toMatch(/%|—|-/)
        })

        it('REG-PAR-ATT-003 | View Attendance opens the child\'s attendance page', async () => {
            addFeature('Parent Attendance'); addSeverity('normal')
            // KNOWN DEFECT (reported on Plane): /student-attendance/{id} returns
            // HTTP 500 for both linked and unlinked children, so the parent's
            // only attendance view is the dashboard tab. Asserting the correct
            // behaviour (the page loads) — expected to FAIL until fixed.
            await ParentDashboardPage.open()
            await ParentDashboardPage.openTab(ParentDashboardPage.attendanceTab, ParentDashboardPage.attendancePane)
            await ParentDashboardPage.attendanceRow('Okonkwo, Emeka').$(`a[href$="/student-attendance/${STUDENT_ID}"]`).click()
            await browser.waitUntil(async () => (await browser.getUrl()).includes(`/student-attendance/${STUDENT_ID}`),
                { timeout: 15000, timeoutMsg: 'View Attendance did not navigate to the attendance page' })
            await browser.waitUntil(async () => (await browser.execute(() => document.readyState)) === 'complete',
                { timeout: 15000 })
            // Single-shot read: a .not.toHaveText matcher would pass on the
            // first poll of the transitioning page and miss the error.
            // innerText breaks "500 System Error" across lines, so normalise
            // whitespace before matching.
            const bodyText = (await browser.execute(() => document.body.innerText)).replace(/\s+/g, ' ')
            expect(bodyText).not.toContain('500 System Error')
        })
    })
})
