import ModulePage from './modulePage.page.js'

// Parent's GradeBook dashboard: three stat cards, then two tabs — My
// Children (one row per linked child with four action icons) and Attendance.
// The Term / Session Results icons open modals whose Continue button builds a
// /grade-entry/student-(session-)results/{id} URL client-side and navigates.
class ParentDashboardPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/dashboard')
    }

    // Stat cards — matched by their label, since the cards carry no ids.
    statCard(label) { return $(`//div[contains(@class,"parent-stat")][.//div[contains(@class,"stat-label")][normalize-space()="${label}"]]`) }
    statValue(label) { return this.statCard(label).$('.stat-value') }

    // Tabs
    get childrenTab() { return $('button[data-bs-target="#par-children-pane"]') }
    get attendanceTab() { return $('button[data-bs-target="#par-attendance-pane"]') }
    get childrenPane() { return $('#par-children-pane') }
    get attendancePane() { return $('#par-attendance-pane') }

    get childRows() { return $$('#par-children-pane tbody tr') }
    get attendanceRows() { return $$('#par-attendance-pane tbody tr') }

    // Child rows show the name as "Last, First Middle" — match on a fragment.
    childRow(name) { return $(`//*[@id="par-children-pane"]//tbody/tr[td[contains(normalize-space(), "${name}")]]`) }
    attendanceRow(name) { return $(`//*[@id="par-attendance-pane"]//tbody/tr[td[contains(normalize-space(), "${name}")]]`) }

    // Row action icons, keyed on the child id baked into each link.
    viewProfileLink(id) { return $(`#par-children-pane a[href$="/students/${id}"]`) }
    viewAttendanceLink(id) { return $(`#par-children-pane a[href$="/student-attendance/${id}"]`) }
    termResultsBtn(id) { return $(`#par-children-pane .btn-student-view-term-result[data-val="${id}"]`) }
    sessionResultsBtn(id) { return $(`#par-children-pane .btn-student-view-session-result[data-val="${id}"]`) }

    // Term result modal
    get termModal() { return $('#student-term-result-modal') }
    get termSelect() { return $('#grade_term_id') }
    get termContinueBtn() { return $('#btn-save-student-term-result') }
    get termStudentId() { return $('#txt-student-term-result-primary-id') }

    // Session result modal
    get sessionModal() { return $('#student-session-result-modal') }
    get sessionSelect() { return $('#academic_session') }
    get sessionContinueBtn() { return $('#btn-save-student-session-result') }
    get sessionStudentId() { return $('#txt-student-session-result-primary-id') }

    // Every child id the My Children tab renders (from the View Profile links).
    async childIds() {
        return browser.execute(() => [...document.querySelectorAll('#par-children-pane a[href*="/students/"]')]
            .map(a => a.getAttribute('href').split('/students/')[1]))
    }

    async childNames() {
        return browser.execute(() => [...document.querySelectorAll('#par-children-pane tbody tr td.fw-semibold')]
            .map(td => td.textContent.trim()))
    }

    // Cells of an Attendance-tab row, by header name.
    async attendanceCells(name) {
        const row = this.attendanceRow(name)
        const cells = await row.$$('td').map(td => td.getText())
        return { child: cells[1], className: cells[2], present: cells[3], totalDays: cells[4], rate: cells[5] }
    }

    // First option that is neither the placeholder nor disabled (the current
    // term is listed but greyed out until results are published).
    async firstSelectableValue(select) {
        return browser.execute((el) => {
            const o = [...el.options].find(opt => opt.value && !opt.disabled)
            return o ? o.value : null
        }, await select)
    }

    // The modal fades in; the icon click is occasionally swallowed while a
    // Bootstrap tooltip is initialising, so retry until it shows.
    async openResultModal(btn, modal) {
        await btn.waitForClickable({ timeout: 10000 })
        await browser.waitUntil(async () => {
            if (!(await modal.isDisplayed())) await btn.click().catch(() => {})
            return modal.waitForDisplayed({ timeout: 3000 }).then(() => true).catch(() => false)
        }, { timeout: 15000, interval: 500, timeoutMsg: 'Results modal did not open' })
        // Wait out the fade-in so the select takes the value.
        await browser.pause(500)
    }

    openTermModal(id) { return this.openResultModal(this.termResultsBtn(id), this.termModal) }
    openSessionModal(id) { return this.openResultModal(this.sessionResultsBtn(id), this.sessionModal) }

    // The select guard uses a native window.alert(), which headless Chrome
    // auto-dismisses before WebDriver can read it — so stub window.alert to
    // record its message instead, then read it back after the click.
    armAlertCapture() {
        return browser.execute(() => {
            window.__lastAlert = null
            window.alert = (m) => { window.__lastAlert = String(m) }
        })
    }

    capturedAlert() {
        return browser.execute(() => window.__lastAlert)
    }
}

export default new ParentDashboardPage()
