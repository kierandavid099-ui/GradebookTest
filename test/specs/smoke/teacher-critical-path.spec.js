import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import TeacherAttendancePage from '../../page objects/teacherAttendance.page.js'
import TeacherConductPage from '../../page objects/teacherConduct.page.js'
import TeacherTimetablePage from '../../page objects/teacherTimetable.page.js'
import TeacherMessengerPage from '../../page objects/teacherMessenger.page.js'
import { TEACHER_USER, TEACHER_DISPLAY_NAME } from '../../helpers/testData.js'
import { FORM_CLASS_ID, FORM_CLASS_NAME } from '../../helpers/teacherData.js'

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE — gradebook.ng critical path, as a Teacher
//
// Lean load-and-inspect pass over every screen in Chisom Okafor's GradeBook
// menu (Dashboard, Attendance, Timetable, Conduct, Messenger) plus Grade
// Entry. No mutations and no fixture setup: the grade-sheet check works with
// whatever subject the teacher is assigned (or the "no subjects" message).
// ─────────────────────────────────────────────────────────────────────────────

describe('SMOKE — GradeBook Critical Path (Teacher)', () => {

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
    })

    describe('Dashboard', () => {

        before(async () => await TeacherDashboardPage.open())

        it('SM-TCH-DSH-001 | Dashboard loads with the teacher\'s name in the title', async () => {
            addFeature('Teacher Dashboard'); addSeverity('blocker')
            await expect(browser).toHaveTitle(new RegExp(`GradeBook - ${TEACHER_DISPLAY_NAME}`))
        })

        it('SM-TCH-DSH-002 | Breadcrumb shows GradeBook', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            await expect(TeacherDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
        })

        it('SM-TCH-DSH-003 | Form-teacher banner and the four stat cards render', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            await expect(TeacherDashboardPage.formClassBanner).toHaveText(new RegExp(FORM_CLASS_NAME))
            for (const l of ['Subjects Teaching', 'My Class Students', 'Attendance Rate', 'Active Term']) {
                expect(await TeacherDashboardPage.statValue(l)).not.toBeNull()
            }
        })

        it('SM-TCH-DSH-004 | My Subjects / My Class / Activity / Notifications tabs are present', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            for (const t of [TeacherDashboardPage.subjectsTab, TeacherDashboardPage.studentsTab, TeacherDashboardPage.activityTab, TeacherDashboardPage.notificationsTab]) {
                await expect(t).toBeDisplayed()
            }
        })

        it('SM-TCH-DSH-005 | Sidebar shows the five teacher menu items', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            await Sidebar.openGroup('teacher')
            expect(await Sidebar.itemTexts()).toEqual(['Dashboard', 'Attendance', 'Timetable', 'Conduct', 'Messenger'])
        })
    })

    describe('Grade Entry', () => {

        before(async () => await TeacherGradeEntryPage.open())

        it('SM-TCH-GRD-001 | Grade Entry loads with the correct breadcrumb', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            await expect(TeacherGradeEntryPage.breadcrumb).toHaveText(/Grade Entry/i)
        })

        it('SM-TCH-GRD-002 | Either the subject picker or the "no subjects assigned" message is shown', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            const picker = await TeacherGradeEntryPage.subjectSelect.isExisting()
            const none = await TeacherGradeEntryPage.noSubjectsMsg.isExisting()
            expect(picker || none).toBe(true)
        })
    })

    describe('Attendance', () => {

        before(async () => {
            await TeacherDashboardPage.open()
            await Sidebar.goToAttendance()
            await TeacherAttendancePage.breadcrumb.waitForDisplayed({ timeout: 15000 })
        })

        it('SM-TCH-ATT-001 | Attendance menu item opens Class Attendance for the form class', async () => {
            addFeature('Teacher Attendance'); addSeverity('blocker')
            await expect(TeacherAttendancePage.breadcrumb).toHaveText(/Class Attendance/i)
            expect(await browser.getUrl()).toContain(`/class-attendance/${FORM_CLASS_ID}`)
        })

        it('SM-TCH-ATT-002 | Record Attendance button is available', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            await expect(TeacherAttendancePage.recordBtn).toBeDisplayed()
        })
    })

    describe('Timetable', () => {

        before(async () => {
            await TeacherDashboardPage.open()
            await Sidebar.goToTimetable()
            await TeacherTimetablePage.breadcrumb.waitForDisplayed({ timeout: 15000 })
        })

        it('SM-TCH-TTB-001 | Timetable menu item opens the form class timetable', async () => {
            addFeature('Teacher Timetable'); addSeverity('blocker')
            await expect(TeacherTimetablePage.breadcrumb).toHaveText(/Timetable/i)
            expect(await browser.getUrl()).toContain(`/class-timetable/${FORM_CLASS_ID}`)
        })

        it('SM-TCH-TTB-002 | Add Period button is available', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            await expect(TeacherTimetablePage.addBtn).toBeDisplayed()
        })
    })

    describe('Conduct', () => {

        before(async () => {
            await TeacherDashboardPage.open()
            await Sidebar.goToAssessment()
            await TeacherConductPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
        })

        it('SM-TCH-CON-001 | Conduct menu item opens Conduct for the form class', async () => {
            addFeature('Teacher Conduct'); addSeverity('blocker')
            await expect(TeacherConductPage.breadcrumb).toHaveText(/Conduct/i)
            expect(await browser.getUrl()).toContain(`/class-assessment/${FORM_CLASS_ID}`)
        })

        it('SM-TCH-CON-002 | Add Conduct and Save All Scores buttons are available', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            await expect(TeacherConductPage.addBtn).toBeDisplayed()
            await expect(TeacherConductPage.saveAllBtn).toBeExisting()
        })
    })

    describe('Messenger', () => {

        before(async () => {
            await TeacherDashboardPage.open()
            await Sidebar.goToTeacherMessenger()
            await TeacherMessengerPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
        })

        it('SM-TCH-MSG-001 | Messenger menu item opens Chats', async () => {
            addFeature('Teacher Messenger'); addSeverity('blocker')
            await expect(TeacherMessengerPage.breadcrumb).toHaveText(/Chats/i)
            await expect(browser).toHaveTitle(/Chats/i)
        })

        it('SM-TCH-MSG-002 | New Chat button is available', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await expect(TeacherMessengerPage.newChatBtn).toBeDisplayed()
        })
    })
})
