// Shared shape for GradeBook pages: load by URL, find the breadcrumb, and
// the Bootstrap-modal / SweetAlert helpers most screens need.
import Sidebar from './sidebar.js'
import { BASE_URL } from '../helpers/testData.js'

export default class ModulePage {

    // `path` is relative to BASE_URL, e.g. '/scola-gradebook2/dashboard'.
    constructor(path) {
        this.path = path
    }

    get url() { return `${BASE_URL}${this.path}` }

    get breadcrumb() { return $('.breadcrumb-title') }

    async open(suffix = '') {
        await browser.url(this.url + suffix)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        await this.dismissTour()
    }

    dismissTour(timeout = 1000) {
        return Sidebar.dismissTour(timeout)
    }

    // Bootstrap tabs: <button|a data-bs-target|href="#pane">. Clicks the tab
    // and waits for its pane to become active.
    async openTab(tab, pane) {
        await tab.waitForClickable({ timeout: 10000 })
        await tab.click()
        await browser.waitUntil(
            async () => (await pane.getAttribute('class') || '').includes('active'),
            { timeout: 5000, timeoutMsg: 'Tab pane did not become active' }
        )
    }

    get openModal() { return $('.modal.show') }

    // The × click is sometimes lost while the modal is still fading in, and
    // an open modal blocks every later click, so retry until it has gone.
    async closeModal() {
        // A save can reload the page as this runs ("Cannot find context"),
        // so retry until the new document answers.
        const { id } = await browser.waitUntil(async () => {
            try {
                return await browser.execute(() => document.readyState === 'complete' && {
                    id: [...document.querySelectorAll('.modal.show')].find(m => getComputedStyle(m).display !== 'none')?.id
                })
            } catch { return false }
        }, { timeout: 15000, interval: 500, timeoutMsg: 'Page never settled to close the modal' })
        if (!id) return
        const modal = $(`#${id}`)
        await browser.waitUntil(async () => {
            if (await modal.isDisplayed()) {
                await modal.$('.btn-close, [data-bs-dismiss="modal"]').click().catch(() => {})
                await modal.waitForDisplayed({ reverse: true, timeout: 3000 }).catch(() => {})
            }
            return !(await modal.isDisplayed())
        }, { timeout: 15000, interval: 500, timeoutMsg: 'Modal did not close' })
    }

    // The platform loads SweetAlert v1 (.sweet-alert.showSweetAlert); a few
    // GradeBook screens bundle SweetAlert2 (.swal2-popup) — match either.
    get swal() { return $('.sweet-alert.showSweetAlert, .swal2-popup.swal2-show') }
    get swalTitle() { return $('.sweet-alert.showSweetAlert h2, .swal2-popup.swal2-show .swal2-title') }
    get swalText() { return $('.sweet-alert.showSweetAlert p, .swal2-popup.swal2-show .swal2-html-container') }
    get swalConfirmBtn() { return $('.sweet-alert.showSweetAlert button.confirm, .swal2-popup.swal2-show .swal2-confirm') }
    get swalCancelBtn() { return $('.sweet-alert.showSweetAlert button.cancel, .swal2-popup.swal2-show .swal2-cancel') }

    // Reads and dismisses a SweetAlert if one appears; returns its title +
    // text (or null if none showed within the timeout).
    async readAndConfirmSwal(timeout = 5000) {
        const shown = await this.swal.waitForDisplayed({ timeout }).catch(() => false)
        if (!shown) return null
        const text = `${await this.swalTitle.getText().catch(() => '')} ${await this.swalText.getText().catch(() => '')}`.trim()
        // SweetAlert v1 adds .visible once its open animation ends; a button
        // clicked before that just closes the alert WITHOUT running its
        // callback (seen on Start Term: the confirm vanished, no request sent).
        await $('.sweet-alert.showSweetAlert.visible, .swal2-popup.swal2-show').waitForExist({ timeout: 3000 }).catch(() => {})
        if (await this.swalConfirmBtn.isDisplayed().catch(() => false)) {
            await this.swalConfirmBtn.click()
        }
        await this.swal.waitForDisplayed({ reverse: true, timeout: 5000 }).catch(() => {})
        return text
    }
}
