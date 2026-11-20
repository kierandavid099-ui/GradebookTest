import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import StudentDashboardPage from '../../page objects/studentDashboard.page.js'
import { STUDENT_USER, STUDENT_ID, STUDENT_DISPLAY_NAME } from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION — Student Dashboard
//
// Stat cards, profile header, and the three dashboard tabs (My Subjects,
// Enrollment History, Quick Links). The STUDENT_USER (Emeka) currently has no
// enrolled subjects, no grade class and no enrollment history, so several
// data-bearing checks assert the empty state the app renders instead — that
// is itself the correct behaviour for a student with no records yet.
// ─────────────────────────────────────────────────────────────────────────────

describe('REGRESSION — Student Dashboard', () => {

    before(async () => {
        await LoginPage.loginAs(STUDENT_USER)
        await StudentDashboardPage.open()
    })

    describe('Stat cards & header', () => {

        // TC-410..413 — each card renders a value (a count, a %, or a "—"
        // placeholder when there is nothing to show).
        const cards = [
            ['STU-DSH-001', 'Subjects', 'blocker'],
            ['STU-DSH-002', 'Terms Attended', 'normal'],
            ['STU-DSH-003', 'Attendance Rate', 'normal'],
            ['STU-DSH-004', 'Class Position', 'normal'],
        ]
        cards.forEach(([id, label, sev]) => {
            it(`REG-${id} | "${label}" stat card renders a value`, async () => {
                addFeature('Student Dashboard'); addSeverity(sev)
                await expect(StudentDashboardPage.statValue(label)).toBeDisplayed()
                expect((await StudentDashboardPage.statValue(label).getText()).trim().length).toBeGreaterThan(0)
            })
        })

        it('REG-STU-DSH-005 | Profile header shows the student name and class slot', async () => {
            addFeature('Student Dashboard'); addSeverity('normal')
            await expect(StudentDashboardPage.profileStripName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
            // Class • Term • Status meta line renders (class may be N/A when the
            // student has no grade class assigned yet).
            const meta = await StudentDashboardPage.profileStripMetaTexts()
            expect(meta.length).toBeGreaterThanOrEqual(3)
        })

        it('REG-STU-DSH-006 | Header shows the active/current term', async () => {
            addFeature('Student Dashboard'); addSeverity('normal')
            const texts = await StudentDashboardPage.profileStripMetaTexts()
            // Term codes render like "2026-2027-T2".
            expect(texts.join(' ')).toMatch(/\d{4}-\d{4}-T\d/)
        })
    })

    describe('My Subjects tab', () => {

        before(async () => {
            await StudentDashboardPage.open()
            await StudentDashboardPage.openTab(StudentDashboardPage.subjectsTab, StudentDashboardPage.subjectsPane)
        })

        it('REG-STU-SUB-001 | My Subjects tab lists subjects (or an empty state)', async () => {
            addFeature('My Subjects'); addSeverity('critical')
            const rows = await StudentDashboardPage.subjectRows
            if (rows.length > 0) {
                await expect(rows[0]).toBeDisplayed()
            } else {
                await expect(StudentDashboardPage.subjectsEmptyState).toBeDisplayed()
                await expect(StudentDashboardPage.subjectsEmptyState).toHaveText(/no subjects/i)
            }
        })

        it('REG-STU-SUB-002 | Subject rows (when present) show Subject, Code and Type', async () => {
            addFeature('My Subjects'); addSeverity('normal')
            const headers = await browser.execute(() =>
                [...document.querySelectorAll('#stu-subjects-pane thead th')].map(h => h.innerText.trim()))
            if (headers.length === 0) {
                // No subjects for this student — nothing to describe; covered by SUB-001.
                await expect(StudentDashboardPage.subjectsEmptyState).toBeDisplayed()
                return
            }
            const text = headers.join(' ').toLowerCase()
            expect(text).toContain('subject')
            expect(text).toContain('code')
            expect(text).toContain('type')
        })

        it('REG-STU-SUB-003 | No scores or grades are exposed on the My Subjects tab', async () => {
            addFeature('My Subjects'); addSeverity('critical')
            // Scores live behind the results pages; the subjects list must not
            // surface a score/grade/mark column.
            const paneHtml = (await StudentDashboardPage.subjectsPane.getHTML()).toLowerCase()
            expect(/<th[^>]*>\s*(score|grade|mark|total|ca|exam)\b/.test(paneHtml)).toBe(false)
        })
    })

    describe('Enrollment History tab', () => {

        before(async () => {
            await StudentDashboardPage.open()
            await StudentDashboardPage.openTab(StudentDashboardPage.enrollmentsTab, StudentDashboardPage.enrollmentsPane)
        })

        it('REG-STU-ENR-001 | Enrollment History lists Term, Class and Position (or an empty state)', async () => {
            addFeature('Enrollment History'); addSeverity('normal')
            const { rowCount, headers } = await browser.execute(() => ({
                rowCount: document.querySelectorAll('#stu-enrollments-pane tbody tr').length,
                headers: [...document.querySelectorAll('#stu-enrollments-pane thead th')].map(h => h.innerText.trim()).join(' ').toLowerCase(),
            }))
            if (rowCount > 0) {
                expect(headers).toContain('term')
                expect(headers).toContain('class')
                expect(headers).toContain('position')
            } else {
                await expect(StudentDashboardPage.enrollmentsEmptyState).toBeDisplayed()
                await expect(StudentDashboardPage.enrollmentsEmptyState).toHaveText(/no enrollment/i)
            }
        })

        // TC-423 — the View (eye) action can only be exercised with an
        // enrollment row, which this student does not have.
        it.skip('REG-STU-ENR-002 | The View action opens the enrollment record (no enrollment data for this student)', async () => {
            addFeature('Enrollment History'); addSeverity('minor')
        })
    })

    describe('Quick Links tab', () => {

        before(async () => {
            await StudentDashboardPage.open()
            await StudentDashboardPage.openTab(StudentDashboardPage.quickLinksTab, StudentDashboardPage.quickLinksPane)
        })

        it('REG-STU-QLK-001 | My Profile tile links to the student\'s own profile', async () => {
            addFeature('Quick Links'); addSeverity('normal')
            const tile = StudentDashboardPage.quickLinkTile('My Profile')
            await expect(tile).toBeDisplayed()
            expect(await tile.getAttribute('href')).toContain(`/students/${STUDENT_ID}`)
        })

        it('REG-STU-QLK-002 | Term Results tile opens the term-selection modal', async () => {
            addFeature('Quick Links'); addSeverity('normal')
            const tile = StudentDashboardPage.quickLinkTile('Term Results')
            await expect(tile).toBeDisplayed()
            await tile.click()
            await expect(StudentDashboardPage.termModal).toBeDisplayed()
            await StudentDashboardPage.closeModal()
        })

        it('REG-STU-QLK-003 | Session Results tile opens the session-selection modal', async () => {
            addFeature('Quick Links'); addSeverity('normal')
            await StudentDashboardPage.openTab(StudentDashboardPage.quickLinksTab, StudentDashboardPage.quickLinksPane)
            const tile = StudentDashboardPage.quickLinkTile('Session Results')
            await expect(tile).toBeDisplayed()
            await tile.click()
            await expect(StudentDashboardPage.sessionModal).toBeDisplayed()
            await StudentDashboardPage.closeModal()
        })

        it('REG-STU-QLK-004 | Attendance tile links to the student\'s attendance view', async () => {
            addFeature('Quick Links'); addSeverity('normal')
            await StudentDashboardPage.openTab(StudentDashboardPage.quickLinksTab, StudentDashboardPage.quickLinksPane)
            const tile = StudentDashboardPage.quickLinkTile('Attendance')
            await expect(tile).toBeDisplayed()
            expect(await tile.getAttribute('href')).toContain(`/student-attendance/${STUDENT_ID}`)
        })
    })
})
