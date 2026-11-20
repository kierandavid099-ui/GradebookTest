import ModulePage from './modulePage.page.js'

// The student's GradeBook home: a profile strip, four stat cards, a tabbed
// card (My Subjects / Enrollment History / Quick Links) and, on the right,
// an info card plus a second "Quick Links" list. The term/session result
// pickers are Bootstrap modals that build a URL and navigate to it.
class StudentDashboardPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/dashboard')
    }

    // Name shown in red next to the breadcrumb ("Last, First").
    get displayName() { return $('.page-breadcrumb .text-danger') }
    get myTermResultsBtn() { return $('.page-breadcrumb .btn-student-view-term-result') }
    get mySessionResultsBtn() { return $('.page-breadcrumb .btn-student-view-session-result') }

    // Profile strip: full name, then "<adm no> • <class> • <term> • <status>".
    get fullProfileBtn() { return $('a*=Full Profile') }
    get profileStripName() { return $('//a[contains(., "Full Profile")]/preceding-sibling::div//div[contains(@class, "fw-bold")]') }
    get profileStripMeta() { return $$('//a[contains(., "Full Profile")]/preceding-sibling::div//div[contains(@class, "gap-2")]/span[not(normalize-space()="•")]') }

    // Text of each span in the profile strip's "class • term • status" line.
    async profileStripMetaTexts() {
        return browser.execute(() => {
            const strip = [...document.querySelectorAll('a')].find(a => /Full Profile/.test(a.textContent))
            if (!strip) return []
            const meta = strip.parentElement.querySelector('.gap-2') || strip.closest('div')?.querySelector('.gap-2')
            return meta ? [...meta.querySelectorAll('span')].map(s => s.textContent.trim()).filter(t => t && t !== '•') : []
        })
    }

    // Stat cards are matched by their label so the order can change.
    statCard(label) { return $(`//div[contains(@class, "student-stat")][div[contains(@class, "stat-label") and normalize-space()="${label}"]]`) }
    statValue(label) { return this.statCard(label).$('.stat-value') }
    statViewLink(label) { return this.statCard(label).$('.stat-quick a') }

    // Tabs
    get subjectsTab() { return $('button[data-bs-target="#stu-subjects-pane"]') }
    get enrollmentsTab() { return $('button[data-bs-target="#stu-enrollments-pane"]') }
    get quickLinksTab() { return $('button[data-bs-target="#stu-links-pane"]') }
    get subjectsPane() { return $('#stu-subjects-pane') }
    get enrollmentsPane() { return $('#stu-enrollments-pane') }
    get quickLinksPane() { return $('#stu-links-pane') }

    // With no data each pane renders a centred muted message instead of a table.
    get subjectsEmptyState() { return $('#stu-subjects-pane .text-muted p') }
    get enrollmentsEmptyState() { return $('#stu-enrollments-pane .text-muted p') }
    get subjectRows() { return $$('#stu-subjects-pane tbody tr') }
    get subjectHeaders() { return $$('#stu-subjects-pane thead th') }
    get enrollmentRows() { return $$('#stu-enrollments-pane tbody tr') }
    get enrollmentHeaders() { return $$('#stu-enrollments-pane thead th') }

    // Quick Links tab tiles, matched by their bold caption.
    quickLinkTile(caption) { return $(`//div[@id="stu-links-pane"]//a[.//div[normalize-space()="${caption}"]]`) }

    // Right-hand "Quick Links" card (plain list of links).
    sideQuickLink(text) { return $(`//p[normalize-space()="Quick Links"]/following-sibling::ul//a[normalize-space()="${text}"]`) }
    get roleBadge() { return $('span.badge*=Student') }

    // Term result picker
    get termModal() { return $('#student-term-result-modal') }
    get termSelect() { return $('#grade_term_id') }
    get termContinueBtn() { return $('#btn-save-student-term-result') }
    // Session result picker
    get sessionModal() { return $('#student-session-result-modal') }
    get sessionSelect() { return $('#academic_session') }
    get sessionContinueBtn() { return $('#btn-save-student-session-result') }
    // The (hidden) class-term picker carries the "- Current Term" marker.
    get classTermSelect() { return $('#term_id') }

    // Lobibox toast the app flashes after redirecting back with an error.
    get toast() { return $('.lobibox-notify') }

    async openTermModal() {
        await this.myTermResultsBtn.waitForClickable({ timeout: 10000 })
        await this.myTermResultsBtn.click()
        await this.termModal.waitForDisplayed({ timeout: 5000 })
        // The select is reset as the modal fades in; let it settle first.
        await browser.pause(500)
    }

    async openSessionModal() {
        await this.mySessionResultsBtn.waitForClickable({ timeout: 10000 })
        await this.mySessionResultsBtn.click()
        await this.sessionModal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(500)
    }

    // First real option of a picker — the term/session ids differ per
    // environment, so never hardcode them. Resolved by selector inside the
    // page to avoid stale element-handle issues across modal fade-ins.
    async firstOptionValue(selector) {
        return browser.execute(sel => {
            const el = document.querySelector(sel)
            return el ? Array.from(el.options).map(o => o.value).find(Boolean) || null : null
        }, selector)
    }

    async optionTexts(selector) {
        return browser.execute(sel => {
            const el = document.querySelector(sel)
            return el ? Array.from(el.options).filter(o => o.value).map(o => o.textContent.trim()) : []
        }, selector)
    }

    // The Continue guards use a native window.alert(), not a SweetAlert.
    // The BiDi automation auto-dismisses native dialogs before a test can
    // read them, so we override window.alert to record its message instead —
    // which also keeps the click synchronous and leaves the modal open.
    async captureAlerts() {
        await browser.execute(() => {
            window.__lastAlert = null
            if (!window.__alertPatched) {
                window.__alertPatched = true
                window.alert = (msg) => { window.__lastAlert = String(msg) }
            }
        })
    }

    async lastAlert() {
        return browser.execute(() => window.__lastAlert)
    }

    // Clicks Continue and returns the guard message raised (or null if it
    // navigated away instead of blocking).
    async continueAndReadGuard(continueBtn) {
        await this.captureAlerts()
        await continueBtn.click()
        await browser.pause(400)
        return this.lastAlert()
    }

    async ownStudentId() {
        return this.myTermResultsBtn.getAttribute('data-val')
    }

    // After a results navigation, returns the big faded error code ('500',
    // '403', ...) if the app's full-page error screen is showing, else null.
    async shownErrorCodeOnResults() {
        const el = $('h1.font-black')
        if (!(await el.isExisting())) return null
        return (await el.getText()).trim() || null
    }
}

export default new StudentDashboardPage()
