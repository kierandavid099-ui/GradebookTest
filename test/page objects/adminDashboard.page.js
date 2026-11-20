// Admin Dashboard (stats, setup guide, classes/subjects tables) and the
// class detail page (/gradeClasses/<id>) that launches the term/session
// result views.
import ModulePage from './modulePage.page.js'
import { BASE_URL } from '../helpers/testData.js'

class AdminDashboardPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/dashboard')
    }

    stat(label) { return $(`//div[contains(@class,"admin-stat")][.//div[contains(@class,"stat-label")][normalize-space()="${label}"]]//div[contains(@class,"stat-value")]`) }

    // ── Setup guide ─────────────────────────────────────────────────────────
    get setupChecklist() { return $('#sgb2-setup-checklist') }
    get setupProgress() { return $('//div[@id="sgb2-setup-checklist"]//strong') }
    get setupSteps() { return $$('#sgb2-setup-body .col-md-6') }
    setupStep(title) { return $(`//div[@id="sgb2-setup-body"]//div[contains(@class,"col-md-6")][.//div[normalize-space()="${title}"]]`) }

    // ── Tables ──────────────────────────────────────────────────────────────
    get classesTab() { return $('#admin-classes-tab') }
    get subjectsTab() { return $('#admin-subjects-tab') }
    get classesPane() { return $('#admin-classes-pane') }
    get subjectsPane() { return $('#admin-subjects-pane') }
    get classSearch() { return $('#classSearchInput') }
    get subjectSearch() { return $('#subjectListSearchInput') }
    get classEmptyState() { return $('#classEmptyState') }
    classRow(code) { return $(`//table[@id="tbl-admin-classes"]//tr[.//span[contains(@class,"fw-semibold")][normalize-space()="${code}"]]`) }
    subjectRow(name) { return $(`//table[@id="tbl-admin-subjects"]//tr[contains(., "${name}")]`) }

    // ── Class detail page + result launchers ────────────────────────────────
    async openClass(classId) {
        await browser.url(`${BASE_URL}/scola-gradebook2/gradeClasses/${classId}`)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
    }

    get termResultBtn() { return $('.btn-class-view-term-result') }
    get sessionResultBtn() { return $('.btn-class-view-session-result') }
    get termResultModal() { return $('#class-term-result-modal') }
    get sessionResultModal() { return $('#class-session-result-modal') }
    get termSelect() { return $('#class-term-result-modal select') }
    get sessionSelect() { return $('#class-session-result-modal select') }
    get termContinueBtn() { return $('#btn-save-class-term-result') }
    get sessionContinueBtn() { return $('#btn-save-class-session-result') }

    async openTermResultModal() {
        await this.termResultBtn.click()
        await this.termResultModal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(400)
        await this.recordAlerts()
    }

    async openSessionResultModal() {
        await this.sessionResultBtn.click()
        await this.sessionResultModal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(400)
        await this.recordAlerts()
    }

    // The term/session guards use window.alert(). WebdriverIO v9 dismisses
    // native dialogs on its own, so reading the real one races it; record
    // the messages instead.
    async recordAlerts() {
        await browser.execute(() => {
            window.__alerts = []
            window.alert = (msg) => { window.__alerts.push(String(msg)) }
        })
    }

    async alertText(timeout = 5000) {
        let text
        await browser.waitUntil(async () => {
            text = await browser.execute(() => (window.__alerts || [])[0])
            return text !== undefined
        }, { timeout, timeoutMsg: 'No alert appeared' })
        return text
    }

    // A result page loaded properly when it has the app shell and isn't the
    // site's "500" error page.
    async isServerError() {
        return browser.execute(() => [...document.querySelectorAll('h1')].some(h => h.textContent.trim() === '500'))
    }

    // The class result views are served as PDFs, which Chrome shows in its
    // viewer (an empty DOM). Fetch the URL instead and report what came back.
    async fetchResult(url) {
        return browser.executeAsync((u, done) => fetch(u).then(async r => done({
            status: r.status, url: r.url, type: r.headers.get('content-type'), start: (await r.text()).slice(0, 5),
        })), url)
    }
}

export default new AdminDashboardPage()
