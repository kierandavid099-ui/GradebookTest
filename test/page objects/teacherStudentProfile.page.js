import TeacherModulePage from './teacherModule.page.js'

// Student Profile as a teacher sees it (/scola-gradebook2/students/{id}),
// reached from the My Class tab's "Profile" button. Four headline stats
// (Attendance, Avg Score, Subjects Scored, Class Rank) and five tabs.
class TeacherStudentProfilePage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/students')
    }

    async openFor(studentId) {
        await this.open(`/${studentId}`)
    }

    get studentName() { return $('.page-breadcrumb .text-danger') }

    get overviewTab() { return $('button[data-bs-target="#sprof-overview"]') }
    get overviewPane() { return $('#sprof-overview') }
    get gradesTab() { return $('button[data-bs-target="#sprof-grades"]') }
    get gradesPane() { return $('#sprof-grades') }
    get attendanceTab() { return $('button[data-bs-target="#sprof-attendance"]') }
    get attendancePane() { return $('#sprof-attendance') }
    get assessmentsTab() { return $('button[data-bs-target="#sprof-assessments"]') }
    get assessmentsPane() { return $('#sprof-assessments') }
    get historyTab() { return $('button[data-bs-target="#sprof-history"]') }
    get historyPane() { return $('#sprof-history') }

    // Headline stat card: { value, sub } — e.g. Class Rank → { '#1', 'this term' }
    async stat(label) {
        return browser.execute((label) => {
            const lbl = [...document.querySelectorAll('.sprof-stat-lbl')].find(el => el.textContent.trim().toLowerCase() === label.toLowerCase())
            if (!lbl) return null
            const card = lbl.closest('.sprof-stat-card')
            return {
                value: (card.querySelector('.sprof-stat-val') || {}).textContent?.trim(),
                sub: (card.querySelector('.sprof-stat-sub') || {}).textContent?.trim(),
            }
        }, label)
    }

    // Grades tab: per-subject Score, performance-bar width and Grade band.
    async gradeRows() {
        return browser.execute(() => {
            const pane = document.querySelector('#sprof-grades')
            const table = pane && [...pane.querySelectorAll('table')].find(t => /Subject/.test(t.innerText) && /Grade/.test(t.innerText))
            if (!table) return []
            return [...table.querySelectorAll('tbody tr')].filter(tr => tr.cells.length >= 6).map(tr => {
                const bar = tr.querySelector('.sprof-score-bar-fill')
                return {
                    subject: tr.cells[1].innerText.trim(),
                    code: tr.cells[2].innerText.trim(),
                    score: tr.cells[3].innerText.trim(),
                    bar: bar ? bar.style.width : null,
                    grade: tr.cells[5].innerText.trim(),
                }
            })
        })
    }

    async gradeFor(subject) {
        return (await this.gradeRows()).find(r => r.subject === subject)
    }

    // Grades tab summary: Average / Highest / Lowest / Passed
    async gradesSummary() {
        return browser.execute(() => {
            const pane = document.querySelector('#sprof-grades')
            const out = {}
            if (!pane) return out
            pane.querySelectorAll('*').forEach(el => {
                const t = el.childElementCount === 0 ? el.textContent.trim() : ''
                if (/^(Average|Highest|Lowest|Passed)$/.test(t)) {
                    const val = el.previousElementSibling || el.parentElement.firstElementChild
                    if (val && val !== el) out[t] = val.textContent.trim()
                }
            })
            return out
        })
    }

    async paneText(pane) {
        return browser.execute(el => el.innerText, await pane)
    }

    // Attendance tab monthly breakdown rows: { month, present, absent, total, rate }
    async monthlyAttendance() {
        return browser.execute(() => {
            const pane = document.querySelector('#sprof-attendance')
            const table = pane && [...pane.querySelectorAll('table')].find(t => /Month/.test(t.innerText))
            if (!table) return []
            return [...table.querySelectorAll('tbody tr')].filter(tr => tr.cells.length >= 5).map(tr => ({
                month: tr.cells[0].innerText.trim(), present: tr.cells[1].innerText.trim(), absent: tr.cells[2].innerText.trim(),
                total: tr.cells[3].innerText.trim(), rate: tr.cells[4].innerText.trim(),
            }))
        })
    }
}

export default new TeacherStudentProfilePage()
