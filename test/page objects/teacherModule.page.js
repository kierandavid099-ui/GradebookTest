// Base for every Teacher-suite page object. Adds two things on top of
// ModulePage that the Teacher screens need:
//
//  1. Session recovery. Other agents sign in as Chisom on the same server
//     (e.g. to reply to a parent chat) and that sometimes drops our session,
//     so a plain browser.url() lands on /login. open() notices and signs back
//     in as the page's role before retrying, instead of failing on the
//     breadcrumb wait.
//  2. Small helpers for the patterns every Teacher screen repeats: the
//     stat-card value lookup, the "save → SweetAlert → location.reload(true)"
//     dance, and reading whatever alert/swal text the page shows.
import ModulePage from './modulePage.page.js'
import LoginPage from './login.page.js'
import { BASE_URL, TEACHER_USER } from '../helpers/testData.js'

export default class TeacherModulePage extends ModulePage {

    constructor(path, user = TEACHER_USER) {
        super(path)
        this.user = user
    }

    get pageContent() { return $('.page-content') }
    get subtitle() { return $('.page-breadcrumb .text-danger') }

    async isOnLogin() {
        return (await browser.getUrl()).includes('/login')
    }

    async openUrl(url) {
        await browser.url(url)
        if (await this.isOnLogin()) {
            await LoginPage.login(this.user.email, this.user.password)
            await browser.url(url)
        }
    }

    async open(suffix = '') {
        await this.openUrl(this.url + suffix)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        await this.dismissTour(500)
    }

    // Opens any app path (relative to BASE_URL) without waiting for a
    // breadcrumb — used by the direct-URL / RBAC tests where the response may
    // be a 403/500 error page that has no breadcrumb.
    async openPath(path) {
        await this.openUrl(`${BASE_URL}${path}`)
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 15000, timeoutMsg: `${path} never finished loading` }
        )
    }

    async bodyText() {
        return browser.execute(() => document.body.innerText)
    }

    // The 403 / 500 error pages are full-page public templates that print the
    // status code as a heading.
    async errorStatus() {
        const text = await this.bodyText()
        const m = text.match(/\b(403|404|419|500)\b\s*\n?\s*(Access Denied|System Error|Not Found|Page Expired)/i)
        return m ? Number(m[1]) : null
    }

    // Stat cards are "<value> <label>" pairs; the class names differ per
    // screen (stat-val/stat-lbl, stat-value/stat-label, sprof-stat-*), so
    // match any of them by label text.
    async statValue(label) {
        return browser.execute((label) => {
            const lbl = [...document.querySelectorAll('.stat-lbl, .stat-label, .ge-stat-lbl, .sprof-stat-lbl')]
                .find(el => el.textContent.trim().toLowerCase() === label.toLowerCase())
            if (!lbl) return null
            const val = lbl.parentElement.querySelector('.stat-val, .stat-value, .ge-stat-val, .sprof-stat-val')
            return val ? val.textContent.trim() : null
        }, label)
    }

    // Every save on these screens shows a SweetAlert then calls
    // location.reload(true) ~1.2–1.4s later. Waiting for the alert and then
    // for the old document to go away avoids reading the pre-reload DOM —
    // and Chrome restores typed form values across that reload, so callers
    // that need the persisted state should re-open() the page afterwards.
    //
    // Usage: await page.markPage(); await saveBtn.click(); await page.waitForReload()
    async markPage() {
        await browser.execute(() => { window.__tchMarker = true })
    }

    async waitForReload(timeout = 20000) {
        await browser.waitUntil(
            async () => !(await browser.execute(() => window.__tchMarker === true).catch(() => true)),
            { timeout, interval: 300, timeoutMsg: 'Page did not reload after saving' }
        )
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState).catch(() => '')) === 'complete',
            { timeout: 15000, timeoutMsg: 'Reloaded page never finished loading' }
        )
    }

    // Clicks the confirm button of a SweetAlert "Are you sure?" prompt.
    // SweetAlert v1 pops in with an animation and drops clicks that land
    // before it settles, which silently cancels the whole action.
    async confirmSwal(timeout = 5000) {
        await this.swalConfirmBtn.waitForDisplayed({ timeout })
        await browser.pause(700)
        await this.swalConfirmBtn.click()
    }

    // Text of the visible SweetAlert (if any) without dismissing it.
    async swalTextNow() {
        return browser.execute(() => {
            const el = document.querySelector('.sweet-alert.showSweetAlert, .swal2-popup.swal2-show')
            return el ? el.innerText.replace(/\s+/g, ' ').trim() : null
        })
    }
}
