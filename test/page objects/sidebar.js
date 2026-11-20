// Same Scola shell as the eLearning suite: at ~1370px the sidebar starts
// collapsed to an icon strip (`.wrapper.toggled`) and only expands while the
// mouse is over it, so hover it before looking for a link.
//
// Each role gets its own GradeBook menu group, all built the same way:
//   #mnu_<prefix>_dashboard            → the "GradeBook" header
//   #lnk_mnu_<prefix>_dashboard_<item> → the link under it
// metisMenu auto-expands the group for the current page, and clicking an
// already-open header collapses it again, so only click it when needed.
const SIDEBAR = '.sidebar-wrapper'

export const MENU_PREFIX = {
    admin: 'gradebook2',
    teacher: 'teacher_gradebook2',
    student: 'student_gradebook2',
    parent: 'parent_gradebook2',
}

class Sidebar {

    get sidebar() { return $(SIDEBAR) }

    // Platform driver.js tour — if it shows, its overlay blocks the hover
    // that expands the sidebar.
    get tourCloseBtn() { return $('.driver-popover-close-btn') }

    groupHeader(role) { return $(`#mnu_${MENU_PREFIX[role]}_dashboard > a`) }
    group(role) { return $(`#mnu_${MENU_PREFIX[role]}_dashboard`) }
    item(role, key) { return $(`#lnk_mnu_${MENU_PREFIX[role]}_dashboard_${key}`) }

    // Every GradeBook link visible in the sidebar, as the text a user sees.
    async itemTexts() {
        return browser.execute(() => [...document.querySelectorAll('[id^="lnk_mnu_"]')]
            .map(a => a.textContent.trim()).filter(Boolean))
    }

    async dismissTour(timeout = 1500) {
        const shown = await this.tourCloseBtn.waitForDisplayed({ timeout }).catch(() => false)
        if (shown) {
            await this.tourCloseBtn.click()
            await this.tourCloseBtn.waitForDisplayed({ reverse: true, timeout: 5000 })
        }
        await browser.execute(() => {
            const sb = document.querySelector('.sidebar-wrapper')
            if (sb && !document.querySelector('.driver-popover')) {
                sb.classList.remove('tour-active')
                sb.style.width = ''
                sb.style.left = ''
            }
        })
    }

    async expand() {
        await this.sidebar.waitForDisplayed({ timeout: 10000 })
        await this.dismissTour(500)
        await this.sidebar.moveTo()
        await browser.waitUntil(
            async () => {
                const cls = await $('.wrapper').getAttribute('class') || ''
                return cls.includes('sidebar-hovered') || !cls.includes('toggled')
            },
            { timeout: 3000, timeoutMsg: 'Sidebar did not expand on hover' }
        )
    }

    // Opens the role's GradeBook group so its links are visible, without
    // clicking anything inside it.
    async openGroup(role) {
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 15000, timeoutMsg: 'Page did not finish loading' }
        )
        await this.group(role).waitForExist({ timeout: 10000 })
        await this.expand()
        const first = $(`#mnu_${MENU_PREFIX[role]}_dashboard [id^="lnk_mnu_"]`)
        if (!(await first.isDisplayed())) {
            await this.groupHeader(role).click()
        }
        await first.waitForDisplayed({ timeout: 5000, timeoutMsg: `GradeBook menu for ${role} never opened` })
    }

    async goVia(role, key) {
        await this.openGroup(role)
        const link = this.item(role, key)
        await link.waitForDisplayed({ timeout: 5000, timeoutMsg: `Sidebar item ${key} (${role}) never became visible` })
        await link.click()
    }

    // Admin
    goToAdminDashboard() { return this.goVia('admin', 'dashboard') }
    goToAcademicManagement() { return this.goVia('admin', 'academic_management') }
    goToTeacherManagement() { return this.goVia('admin', 'teacher_management') }
    goToRegistrations() { return this.goVia('admin', 'registration_management') }
    goToManageSettings() { return this.goVia('admin', 'manage_settings') }

    // Teacher
    goToTeacherDashboard() { return this.goVia('teacher', 'dashboard') }
    goToAssessment() { return this.goVia('teacher', 'assessment') }
    goToAttendance() { return this.goVia('teacher', 'attendance') }
    goToTimetable() { return this.goVia('teacher', 'timetable') }
    goToTeacherMessenger() { return this.goVia('teacher', 'messenger') }

    // Student / Parent
    goToStudentDashboard() { return this.goVia('student', 'dashboard') }
    goToParentDashboard() { return this.goVia('parent', 'dashboard') }
    goToParentMessenger() { return this.goVia('parent', 'messenger') }
}

export default new Sidebar()
