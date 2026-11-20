import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import StudentProfilePage from '../../page objects/studentProfile.page.js'
import StudentAccessPage from '../../page objects/studentAccess.page.js'
import { STUDENT_USER, STUDENT_ID, STUDENT_DISPLAY_NAME } from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION — Student Profile & Attendance
//
// The student's own read-only profile page (/students/{id}) and the
// attendance view (/student-attendance/{id}). The attendance page currently
// errors server-side — see the KNOWN DEFECT test.
// ─────────────────────────────────────────────────────────────────────────────

describe('REGRESSION — Student Profile & Attendance', () => {

    before(async () => {
        await LoginPage.loginAs(STUDENT_USER)
    })

    describe('Own profile (read-only)', () => {

        before(async () => await StudentProfilePage.openFor(STUDENT_ID))

        it('REG-STU-PRF-001 | Own profile opens with the student name and breadcrumb', async () => {
            addFeature('Student Profile'); addSeverity('blocker')
            await expect(StudentProfilePage.breadcrumb).toHaveText(/Student Profile/i)
            await expect(StudentProfilePage.fullName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
        })

        it('REG-STU-PRF-002 | The profile is read-only (no edit/save/disable controls visible)', async () => {
            addFeature('Student Profile'); addSeverity('critical')
            // The admin template ships hidden edit modals in the DOM; none may
            // be reachable (visible) for a student viewing their own profile.
            const controls = await StudentProfilePage.visibleEditControls()
            expect(controls).toEqual([])
            expect(await StudentProfilePage.actionButtons.length).toBe(0)
        })

        it('REG-STU-PRF-003 | Overview tab shows personal fields (DOB, gender)', async () => {
            addFeature('Student Profile'); addSeverity('normal')
            await expect(StudentProfilePage.fieldValue('Gender')).toBeDisplayed()
            await expect(StudentProfilePage.fieldValue('Date of Birth')).toBeDisplayed()
        })

        it('REG-STU-PRF-004 | The profile exposes its Grades/Attendance/History tabs', async () => {
            addFeature('Student Profile'); addSeverity('normal')
            for (const pane of ['sprof-grades', 'sprof-attendance', 'sprof-history']) {
                await expect(StudentProfilePage.tab(pane)).toBeDisplayed()
            }
        })

        it('REG-STU-PRF-005 | Attendance tab on the profile shows Present/Absent/Rate figures', async () => {
            addFeature('Student Profile'); addSeverity('normal')
            await StudentProfilePage.openTab(StudentProfilePage.tab('sprof-attendance'), StudentProfilePage.pane('sprof-attendance'))
            for (const label of ['Present', 'Absent', 'Rate']) {
                await expect(StudentProfilePage.statCard(label)).toBeDisplayed()
            }
        })
    })

    describe('Attendance view', () => {

        // KNOWN DEFECT (reported on Plane): /student-attendance/{id} returns
        // HTTP 500 (System Error page) instead of the attendance records — for
        // the student's OWN id. Correct-behaviour assertion, expected to FAIL.
        it('REG-STU-ATT-001 | The attendance view loads the student\'s own records', async () => {
            addFeature('Attendance'); addSeverity('critical')
            await StudentAccessPage.visit(`/scola-gradebook2/student-attendance/${STUDENT_ID}`)
            // No full-page error; the attendance screen should render.
            expect(await StudentAccessPage.shownErrorCode()).toBeNull()
            expect(await StudentAccessPage.currentPath()).toContain(`/student-attendance/${STUDENT_ID}`)
        })
    })
})
