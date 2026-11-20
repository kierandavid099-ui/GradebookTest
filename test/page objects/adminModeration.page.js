// Result Moderation. The sidebar's /result-moderation link only redirects
// to Academic Management, where moderation lives as the #tab_moderation tab.
import ModulePage from './modulePage.page.js'

class AdminModerationPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/academic-management')
    }

    get legacyPath() { return '/scola-gradebook2/result-moderation' }
    get tab() { return $('a[data-bs-toggle="tab"][href="#tab_moderation"]') }
    get pane() { return $('#tab_moderation') }

    async openModeration() {
        await this.open()
        await this.openTab(this.tab, this.pane)
    }

    filterBtn(filter) { return $(`.btn-mod-filter[data-filter="${filter}"]`) }
    get tableBody() { return $('#mod-table-body') }
    get emptyRow() { return $('//tbody[@id="mod-table-body"]//td[contains(., "No grade submissions found")]') }

    // Rows read "<class code> (<subject name>)" in the first cell.
    row(subjectName) { return $(`//tbody[@id="mod-table-body"]//tr[@data-status][.//td[1][contains(., "(${subjectName})")]]`) }
    async rowStatus(subjectName) { return this.row(subjectName).getAttribute('data-status') }
    statusCell(subjectName) { return this.row(subjectName).$('td:nth-child(3)') }
    reviewedCell(subjectName) { return this.row(subjectName).$('td:nth-child(5)') }
    commentCell(subjectName) { return this.row(subjectName).$('td:nth-child(6)') }
    viewBtn(subjectName) { return this.row(subjectName).$('a[title="View Grades"]') }
    approveBtn(subjectName) { return this.row(subjectName).$('.btn-moderate[data-action="approve"]') }
    // "Return with comment" on a pending row; "Revoke" on an approved row —
    // both send action=flag.
    flagBtn(subjectName) { return this.row(subjectName).$('.btn-moderate[data-action="flag"]') }

    get modal() { return $('#mdl-moderate') }
    get modalTitle() { return $('#mod-title') }
    get commentInput() { return $('#frm-moderate textarea[name="admin_comment"]') }
    get commentLabel() { return $('#mod-comment-label') }
    get confirmBtn() { return $('#mod-btn') }

    // 2026-11-11: Approve/Revoke/Flag sit at the right end of the row, inside
    // a .table-responsive horizontal scroller. The button's absolute rect is
    // "in viewport" (the inner table overflows past the scroller's right
    // edge), so native scrollIntoView won't nudge it — scroll the responsive
    // container by hand, then JS-click to bypass any overlapping cell.
    async openAction(btn) {
        await btn.waitForExist({ timeout: 10000 })
        // 2026-11-11: pass the RESOLVED element to browser.execute — a
        // ChainablePromiseElement serialises to an empty {} with no DOM
        // methods, so el.closest throws (probed, confirmed).
        const el = await btn
        await browser.execute(el => {
            const scroller = el.closest('.table-responsive')
            if (scroller) scroller.scrollLeft = scroller.scrollWidth
            el.scrollIntoView({ block: 'center' })
            el.click()
        }, el)
        await this.modal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(400)
    }

    // Confirm in the modal → "Are you sure?" → "Done!". Returns the final
    // alert text (or the warning text if the page blocked the action).
    async confirm(comment) {
        if (comment !== undefined) await this.commentInput.setValue(comment)
        await this.confirmBtn.click()
        await this.swal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(400) // clicks during SweetAlert's pop-in are ignored
        const first = `${await this.swalTitle.getText()} ${await this.swalText.getText().catch(() => '')}`
        if (!/Are you sure/i.test(first)) {
            await this.swalConfirmBtn.click()
            return first
        }
        await this.swalConfirmBtn.click()
        await browser.waitUntil(async () => /Done|Error/i.test(await this.swalTitle.getText().catch(() => '')),
            { timeout: 15000, timeoutMsg: 'Moderation action never finished' })
        return this.readAndConfirmSwal()
    }

    async approve(subjectName, comment) {
        await this.openAction(this.approveBtn(subjectName))
        return this.confirm(comment)
    }

    async flag(subjectName, comment) {
        await this.openAction(this.flagBtn(subjectName))
        return this.confirm(comment)
    }
}

export default new AdminModerationPage()
