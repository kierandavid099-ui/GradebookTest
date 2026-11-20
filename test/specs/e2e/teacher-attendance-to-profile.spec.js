import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherAttendancePage from '../../page objects/teacherAttendance.page.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import TeacherStudentProfilePage from '../../page objects/teacherStudentProfile.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import { FORM_CLASS_ID, studentSheetName, studentListName } from '../../helpers/teacherData.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Attendance flows through to My Class and the Student Profile:
// the teacher records a day with Bayo absent, then sees the at-risk flag and
// the updated counts on the dashboard and in Bayo's profile; deleting the day
// rolls every figure back.
//
// Leaves behind: nothing (the recorded date is deleted at the end, and swept
// at the start if an earlier run aborted).
// ─────────────────────────────────────────────────────────────────────────────

const DAY = '2026-10-16'
const BAYO = 'Bayo'

describe('E2E — Teacher Attendance to Profile', () => {

    let before
    let bayoId

    const myClassRow = async () => {
        await TeacherDashboardPage.open()
        return TeacherDashboardPage.findStudentRow(studentListName(BAYO))
    }
    const days = (row) => { const m = row.attendance.match(/(\d+)\/(\d+) days/); return m ? { present: Number(m[1]), total: Number(m[2]) } : { present: 0, total: 0 } }

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await TeacherFixtures.ensure()
        await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        if (await TeacherAttendancePage.deleteDate(DAY)) await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        const row = await myClassRow()
        bayoId = row.profile.split('/students/')[1]
        before = days(row)
    })

    after(async () => {
        await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        await TeacherAttendancePage.deleteDate(DAY)
    })

    it('E2E-TCH-ATP-001 | Teacher records a day with Bayo absent', async () => {
        addFeature('Teacher Attendance Lifecycle'); addSeverity('blocker')
        await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        await TeacherAttendancePage.openRecordModal()
        await TeacherAttendancePage.setDate(DAY)
        await TeacherAttendancePage.allPresentBtn.click()
        await TeacherAttendancePage.setStatus(studentSheetName(BAYO), 'absent', 'auto-tch e2e absent')
        await TeacherAttendancePage.save()
        await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        expect(await TeacherAttendancePage.cellFor(studentSheetName(BAYO), DAY)).toMatch(/^Absent/)
    })

    it('E2E-TCH-ATP-002 | My Class shows one more recorded day for Bayo, with no extra present day', async () => {
        addFeature('Teacher Attendance Lifecycle'); addSeverity('critical')
        const now = days(await myClassRow())
        expect(now).toEqual({ present: before.present, total: before.total + 1 })
    })

    it('E2E-TCH-ATP-003 | The at-risk flag on My Class follows the new attendance %', async () => {
        addFeature('Teacher Attendance Lifecycle'); addSeverity('normal')
        const row = await myClassRow()
        const p = Number(row.attendance.match(/^(\d+)%/)[1])
        expect(row.atRisk).toBe(p < 60)
    })

    it('E2E-TCH-ATP-004 | Bayo\'s profile Attendance card and tab reflect the absence', async () => {
        addFeature('Teacher Attendance Lifecycle'); addSeverity('critical')
        await TeacherStudentProfilePage.openFor(bayoId)
        const card = await TeacherStudentProfilePage.stat('Attendance')
        expect(card.sub).toBe(`${before.present}/${before.total + 1} days`)
        await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.attendanceTab, TeacherStudentProfilePage.attendancePane)
        const oct = (await TeacherStudentProfilePage.monthlyAttendance()).find(m => /Oct 2026/.test(m.month))
        expect(oct).toBeDefined()
        expect(Number(oct.absent)).toBeGreaterThanOrEqual(1)
    })

    it('E2E-TCH-ATP-005 | Deleting the day rolls My Class back to the previous figures', async () => {
        addFeature('Teacher Attendance Lifecycle'); addSeverity('critical')
        await TeacherAttendancePage.openClass(FORM_CLASS_ID)
        expect(await TeacherAttendancePage.deleteDate(DAY)).toBe(true)
        expect(days(await myClassRow())).toEqual(before)
    })
})
