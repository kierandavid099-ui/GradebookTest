import TeacherModulePage from './teacherModule.page.js'

// Teacher GradeBook home (/scola-gradebook2/dashboard). Header shortcuts,
// form-class banner, four stat cards, Today's Schedule, Pending Tasks and
// the four-tab panel (My Subjects / My Class / Activity / Notifications).
class TeacherDashboardPage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/dashboard')
    }

    // Header: "Okafor, Chisom (Pri 2A Class Teacher)" and the result shortcuts
    get headerTeacherLabel() { return $('.page-breadcrumb .text-danger') }
    get myPerformanceBtn() { return $('a.btn-teacher-class-performance') }
    get classTermResultsBtn() { return $('a.btn-class-view-term-result') }
    get classSessionResultsBtn() { return $('a.btn-class-view-session-result') }

    get classTermResultModal() { return $('#class-term-result-modal') }
    get classTermSelect() { return $('#term_id') }
    get classTermContinueBtn() { return $('#btn-save-class-term-result') }
    get classSessionResultModal() { return $('#class-session-result-modal') }
    get classSessionSelect() { return $('#session') }
    get classSessionContinueBtn() { return $('#btn-save-class-session-result') }

    get guideCard() { return $('#sgb2-teacher-guide') }
    // "Form Teacher — Pri 2A (A)" banner
    get formClassBanner() { return $('//span[contains(normalize-space(.), "Form Teacher")]') }

    // Pending Tasks card: each <li> holds a title, a hint and an action link.
    get pendingTasksCard() { return $('//h6[contains(., "Pending Tasks")]/ancestor::div[contains(@class,"card")][1]') }
    get todaysScheduleCard() { return $('//h6[contains(., "Today\'s Schedule")]/ancestor::div[contains(@class,"card")][1]') }

    async pendingTasks() {
        return browser.execute(() => {
            const h = [...document.querySelectorAll('h6')].find(x => x.textContent.includes('Pending Tasks'))
            if (!h) return []
            const card = h.closest('.card')
            return [...card.querySelectorAll('li')].map(li => ({
                title: (li.querySelector('div[style*="font-weight:600"]') || li).textContent.trim(),
                text: li.innerText.replace(/\s+/g, ' ').trim(),
                href: li.querySelector('a') ? li.querySelector('a').href : null,
            }))
        })
    }

    // Tabs
    get subjectsTab() { return $('#tchr-subjects-tab') }
    get subjectsPane() { return $('#tchr-subjects-pane') }
    get studentsTab() { return $('#tchr-students-tab') }
    get studentsPane() { return $('#tchr-students-pane') }
    get activityTab() { return $('#tchr-activity-tab') }
    get activityPane() { return $('#tchr-activity-pane') }
    get notificationsTab() { return $('#tchr-notifs-tab') }
    get notificationsPane() { return $('#tchr-notifs-pane') }

    // My Subjects
    get subjectSearchInput() { return $('#subjectSearchInput') }
    get subjectsTable() { return $('#tbl-teacher-subjects') }

    // One entry per subject × class row with its Avg Score chip and the three
    // action links (Results / Grades / Attendance).
    async subjectRows() {
        return browser.execute(() => [...document.querySelectorAll('#tbl-teacher-subjects tbody tr')]
            .filter(tr => tr.cells.length > 5)
            .map(tr => {
                const chip = tr.cells[5].querySelector('span')
                const link = (t) => { const a = [...tr.querySelectorAll('a')].find(x => x.textContent.trim() === t); return a ? a.href : null }
                return {
                    subject: tr.cells[1].innerText.trim(),
                    code: tr.cells[2].innerText.trim(),
                    className: tr.cells[3].innerText.replace(/\(.*\)/, '').trim(),
                    avg: tr.cells[5].innerText.trim(),
                    avgColor: chip ? getComputedStyle(chip).color : null,
                    visible: tr.offsetParent !== null && getComputedStyle(tr).display !== 'none',
                    results: link('Results'), grades: link('Grades'), attendance: link('Attendance'),
                }
            }))
    }

    async findSubjectRow(subject, className) {
        return (await this.subjectRows()).find(r => r.subject === subject && r.className === className)
    }

    // My Class
    get studentSearchInput() { return $('#studentSearchInput') }
    get studentsTable() { return $('#tbl-teacher-students') }

    async studentRows() {
        return browser.execute(() => [...document.querySelectorAll('#tbl-teacher-students tbody tr')]
            .filter(tr => tr.cells.length > 5)
            .map(tr => {
                const chip = tr.cells[5].querySelector('span')
                const profile = tr.querySelector('a[href*="/students/"]')
                return {
                    name: tr.cells[1].innerText.trim(),
                    regNo: tr.cells[2].innerText.trim(),
                    gender: tr.cells[3].innerText.trim(),
                    status: tr.cells[4].innerText.trim(),
                    attendance: tr.cells[5].innerText.replace(/\s+/g, ' ').trim(),
                    atRisk: !!(chip && /at risk/i.test(chip.getAttribute('title') || '')),
                    chipColor: chip ? getComputedStyle(chip).color : null,
                    visible: tr.offsetParent !== null && getComputedStyle(tr).display !== 'none',
                    profile: profile ? profile.href : null,
                }
            }))
    }

    async findStudentRow(name) {
        return (await this.studentRows()).find(r => r.name === name)
    }

    // Typing filters client-side on each keystroke (rows carry data-search).
    async search(input, text) {
        await input.waitForDisplayed({ timeout: 5000 })
        await input.clearValue()
        await input.setValue(text)
        await browser.pause(300) // filter runs on the input event; let it settle
    }

    // Notifications tab → Grade Submission Feedback list
    async feedbackEntries() {
        return browser.execute(() => {
            const pane = document.querySelector('#tchr-notifs-pane')
            if (!pane) return []
            const items = [...pane.querySelectorAll('a, li, .d-flex')]
                .filter(el => /Approved|Flagged/i.test(el.innerText) && el.children.length > 0)
            const seen = new Set()
            return items.map(el => el.innerText.replace(/\s+/g, ' ').trim())
                .filter(t => { if (seen.has(t)) return false; seen.add(t); return true })
        })
    }

    async notificationsPaneText() {
        return browser.execute(() => (document.querySelector('#tchr-notifs-pane') || {}).innerText || '')
    }

    get reviewAndResubmitLink() { return $('//div[@id="tchr-notifs-pane"]//a[contains(., "Review") and contains(., "Resubmit")]') }
}

export default new TeacherDashboardPage()
