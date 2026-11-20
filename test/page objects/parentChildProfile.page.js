import ModulePage from './modulePage.page.js'

// /scola-gradebook2/students/{id} as a parent sees it (View Profile icon on
// My Children), plus /student-attendance/{id} (View Attendance icon). The
// profile view ships the admin's Edit / Reset Password / Disable / Bulk
// Enrollment modals in the DOM even for a parent — hidden, with no visible
// trigger — so read-only checks look at what is *displayed*, not what exists.
class ParentChildProfilePage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/students/')
    }

    // Child's "Last, First Middle" shown next to the breadcrumb.
    get headerName() { return $('.page-breadcrumb .text-danger') }
    get termResultsBtn() { return $('.page-breadcrumb .btn-student-view-term-result') }
    get sessionResultsBtn() { return $('.page-breadcrumb .btn-student-view-session-result') }
    get backToDashboardLink() { return $('a*=Back to Dashboard') }

    tab(key) { return $(`button[data-bs-target="#sprof-${key}"]`) }
    pane(key) { return $(`#sprof-${key}`) }
    get tabKeys() { return ['overview', 'grades', 'attendance', 'assessments', 'history'] }

    // Overview field value by its label ("Gender", "Date of Birth", ...).
    fieldValue(label) { return $(`//p[contains(@class,"sprof-field-lbl")][normalize-space()="${label}"]/following-sibling::p[1]`) }

    // Hidden admin controls that must never become visible to a parent.
    get editSaveBtn() { return $('#btn-save-mdl-student-modal') }
    get resetPasswordBtn() { return $('#modify-user-password-reset') }
    get disableAccountBtn() { return $('#modify-account-disabled') }

    async openChild(id) {
        await this.open(id)
    }

    // Every visible control in the page body that could change data: form
    // fields and buttons/links, excluding tab buttons and the results icons.
    async visibleWriteControls() {
        return browser.execute(() => [...document.querySelectorAll(
            'main input:not([type=hidden]), main textarea, main select, main button, main a.btn')]
            .filter(e => e.offsetParent !== null)
            .filter(e => !e.matches('[data-bs-toggle="tab"], .btn-student-view-term-result, .btn-student-view-session-result'))
            .map(e => `${e.tagName.toLowerCase()}#${e.id} ${(e.textContent || e.placeholder || '').trim().slice(0, 30)}`))
    }

    // Text of the main content — used by the IDOR checks to see whose data
    // a page actually rendered.
    async mainText() {
        return browser.execute(() => (document.querySelector('main') || document.body).innerText)
    }
}

export default new ParentChildProfilePage()
