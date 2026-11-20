import ModulePage from './modulePage.page.js'

// /scola-gradebook2/students/{id} — the read-only Student Profile a student
// reaches via Full Profile / My Profile. The page template still ships the
// admin edit / password-reset / disable modals in the DOM (hidden), so
// "read-only" is judged by what a user can actually see and click.
class StudentProfilePage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/students/')
    }

    openFor(studentId) {
        return this.open(studentId)
    }

    get fullName() { return $('h4.fw-bold') }
    get backToDashboardLink() { return $('a*=Back to Dashboard') }
    // Header action group — empty for a student, holds Edit etc. for admin.
    get actionButtons() { return $$('.page-breadcrumb .btn-group a, .page-breadcrumb .btn-group button') }

    tab(pane) { return $(`#sprofTab button[data-bs-target="#${pane}"]`) }
    pane(pane) { return $(`#${pane}`) }

    // Overview fields are label/value <p> pairs.
    fieldValue(label) { return $(`//p[contains(@class, "sprof-field-lbl") and normalize-space()="${label}"]/following-sibling::p[contains(@class, "sprof-field-val")]`) }
    statCard(label) { return $(`//div[contains(@class, "sprof-stat-card")][div[contains(@class, "sprof-stat-lbl") and normalize-space()="${label}"]]`) }

    // Anything visible that would let the viewer change the record.
    async visibleEditControls() {
        return browser.execute(() => {
            const sel = [
                '[data-bs-target="#mdl-student-modal"]', '[data-bs-target="#password-reset-modal"]',
                '[data-bs-target="#disable-account-modal"]', '[data-bs-target="#mdl-studentEnrollment-modal"]',
                '[data-bs-target="#editPublicPhoto"]', '.btn-edit-mdl-student-modal', '.btn-delete-mdl-student-modal',
                '#btn-save-mdl-student-modal', '#modify-user-password-reset', '#modify-account-disabled',
            ].join(',')
            const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
                && getComputedStyle(el).visibility !== 'hidden'
            return [...document.querySelectorAll(sel)].filter(visible).map(el => el.outerHTML.slice(0, 120))
        })
    }
}

export default new StudentProfilePage()
