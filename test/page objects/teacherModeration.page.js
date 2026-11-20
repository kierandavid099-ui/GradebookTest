import TeacherModulePage from './teacherModule.page.js'
import { ADMIN_USER } from '../helpers/testData.js'

// Admin-side Result Moderation (Academic Management → Moderation tab), as
// the Teacher suite drives it to move *its own* submissions through their
// states. Rows read "<Class> (<Subject>) / <Term>"; actions per status:
//   submitted → Approve / Return (data-action="flag", comment required)
//   approved  → Revoke (also data-action="flag", comment required)
// Each action opens #mdl-moderate, then a SweetAlert "Are you sure?".
class TeacherModerationPage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/academic-management', ADMIN_USER)
    }

    get moderationTab() { return $('a[href="#tab_moderation"]') }
    get moderationPane() { return $('#tab_moderation') }
    filterBtn(filter) { return $(`.btn-mod-filter[data-filter="${filter}"]`) }
    get modal() { return $('#mdl-moderate') }
    get modalTitle() { return $('#mod-title') }
    get commentInput() { return $('#mdl-moderate textarea[name="admin_comment"]') }
    get confirmBtn() { return $('#mod-btn') }

    async openModeration() {
        await this.open()
        await this.openTab(this.moderationTab, this.moderationPane)
    }

    row(className, subject) {
        return $(`//tbody[@id="mod-table-body"]/tr[contains(., "${className} (${subject})")]`)
    }

    async rowInfo(className, subject) {
        const row = this.row(className, subject)
        if (!(await row.isExisting())) return null
        return browser.execute((tr) => ({
            status: tr.getAttribute('data-status'),
            badge: tr.cells[2].innerText.trim(),
            teacher: tr.cells[1].innerText.trim(),
            submitted: tr.cells[3].innerText.trim(),
            reviewed: tr.cells[4].innerText.trim(),
            comment: tr.cells[5].innerText.trim(),
            actions: [...tr.querySelectorAll('.btn-moderate')].map(b => b.getAttribute('data-action')),
            visible: tr.offsetParent !== null && getComputedStyle(tr).display !== 'none',
        }), await row)
    }

    // action: 'approve' | 'flag' (Return or Revoke). Returns the "Done!" text.
    async moderate(className, subject, action, comment = '') {
        const btn = this.row(className, subject).$(`.btn-moderate[data-action="${action}"]`)
        await btn.waitForExist({ timeout: 10000, timeoutMsg: `No "${action}" action for ${className} (${subject})` })
        await btn.scrollIntoView({ block: 'center' })
        await btn.click()
        await this.modal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(500) // modal fade-in; the textarea ignores typing before it settles
        if (comment) await this.commentInput.setValue(comment)
        await this.confirmBtn.click()
        await this.confirmSwal() // "Are you sure?"
        await browser.waitUntil(async () => /Done!/.test((await this.swalTextNow()) || ''),
            { timeout: 15000, timeoutMsg: `Moderation "${action}" did not complete` })
        const text = await this.swalTextNow()
        await this.swalConfirmBtn.click()
        return text
    }

    // Brings a submission back to an editable state before a lifecycle run
    // starts (a previous run may have left it Approved or Pending).
    async makeEditable(className, subject, comment) {
        await this.openModeration()
        const info = await this.rowInfo(className, subject)
        if (!info) return 'none'
        if (info.status === 'approved' || info.status === 'submitted') {
            await this.moderate(className, subject, 'flag', comment)
            return 'flagged'
        }
        return info.status
    }
}

export default new TeacherModerationPage()
