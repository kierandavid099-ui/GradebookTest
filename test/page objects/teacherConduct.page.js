import TeacherModulePage from './teacherModule.page.js'

// Conduct (/scola-gradebook2/class-assessment/{classId}) — the teacher menu
// calls it "Conduct" but its link key and URL say "assessment". Conduct
// items are columns (title + "Max: N pts" + edit/delete buttons), pupils are
// rows of score inputs, and "Save All Scores" posts every input at once.
class TeacherConductPage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/class-assessment')
    }

    async openClass(classId) {
        await this.open(`/${classId}`)
    }

    get addBtn() { return $('[data-bs-target="#addAssessmentModal"]') }
    get addModal() { return $('#addAssessmentModal') }
    get addTitleInput() { return $('#addAssessmentForm input[name="title"]') }
    get addMaxInput() { return $('#addAssessmentForm input[name="max_score"]') }
    get addSaveBtn() { return $('#btn-add-assessment') }
    get editModal() { return $('#editAssessmentModal') }
    get editTitleInput() { return $('#edit-assessment-title') }
    get editMaxInput() { return $('#edit-assessment-max') }
    get editSaveBtn() { return $('#btn-update-assessment') }
    get saveAllBtn() { return $('#btn-save-student-assessments') }
    get emptyItemsMsg() { return $('//p[contains(., "No conduct items added yet")]') }

    editBtn(title) { return $(`.btn-edit-assessment[data-title="${title}"]`) }
    deleteBtn(title) { return $(`.btn-delete-assessment[data-title="${title}"]`) }

    async items() {
        return browser.execute(() => [...document.querySelectorAll('.btn-edit-assessment')].map(b => ({
            id: b.getAttribute('data-assessment-id'), title: b.getAttribute('data-title'), max: b.getAttribute('data-max-score'),
        })))
    }

    async item(title) {
        return (await this.items()).find(i => i.title === title)
    }

    async headerFor(title) {
        return browser.execute((t) => {
            const th = [...document.querySelectorAll('th.assessment-header-cell')].find(h => h.innerText.includes(t))
            return th ? th.innerText.replace(/\s+/g, ' ').trim() : null
        }, title)
    }

    async openAddModal() {
        await this.addBtn.waitForClickable({ timeout: 5000 })
        await this.addBtn.click()
        await this.addModal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(600) // modal fade-in; typing earlier gets lost
    }

    async addItem(title, max) {
        await this.openAddModal()
        if (title) await this.addTitleInput.setValue(title)
        if (max !== undefined) { await this.addMaxInput.clearValue(); await this.addMaxInput.setValue(String(max)) }
        await this.markPage()
        await this.addSaveBtn.click()
        await this.waitForReload()
    }

    async editItem(title, { newTitle, newMax }) {
        await this.editBtn(title).scrollIntoView({ block: 'center' })
        await this.editBtn(title).click()
        await this.editModal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(600)
        if (newTitle !== undefined) { await this.editTitleInput.clearValue(); await this.editTitleInput.setValue(newTitle) }
        if (newMax !== undefined) { await this.editMaxInput.clearValue(); await this.editMaxInput.setValue(String(newMax)) }
        await this.markPage()
        await this.editSaveBtn.click()
        await this.waitForReload()
    }

    async deleteItem(title) {
        const btn = this.deleteBtn(title)
        if (!(await btn.isExisting())) return false
        await btn.scrollIntoView({ block: 'center' })
        await btn.click()
        await this.markPage()
        await this.confirmSwal()
        await this.waitForReload()
        return true
    }

    // Score input for (item, pupil name). Rows are pupils, "Last, First".
    async scoreInputId(itemId, name) {
        return browser.execute((itemId, name) => {
            const tr = [...document.querySelectorAll('tbody tr')].find(r => r.cells[0] && r.cells[0].innerText.trim() === name)
            const input = tr && tr.querySelector(`.score-entry[data-val-assessment-id="${itemId}"]`)
            return input ? input.id : null
        }, itemId, name)
    }

    async scoreInput(itemTitle, name) {
        // 2026-11-13: openClass resolves on the breadcrumb, but the conduct
        // table paints a beat later — poll briefly so the first setScore in a
        // before() hook doesn't race the render.
        let id = null
        await browser.waitUntil(async () => {
            const item = await this.item(itemTitle)
            id = item && await this.scoreInputId(item.id, name)
            return !!id
        }, { timeout: 10000, interval: 300, timeoutMsg: `No conduct score input for "${itemTitle}" × "${name}"` })
        return $(`[id="${id}"]`)
    }

    async setScore(itemTitle, name, value) {
        const input = await this.scoreInput(itemTitle, name)
        await input.scrollIntoView({ block: 'center' })
        await input.clearValue()
        if (value !== '') await input.setValue(String(value))
    }

    async getScore(itemTitle, name) {
        return (await this.scoreInput(itemTitle, name)).getValue()
    }

    // Save All Scores → success swal + reload, or an error swal that stays.
    // Returns the swal text either way.
    async saveAll() {
        await this.markPage()
        // The sticky top nav covers the Save button when the page is scrolled
        // up, so scroll it into the middle of the viewport before clicking.
        await this.saveAllBtn.scrollIntoView({ block: 'center' })
        await this.saveAllBtn.waitForClickable({ timeout: 5000 })
        await this.saveAllBtn.click()
        let text = null
        await browser.waitUntil(async () => {
            const marked = await browser.execute(() => window.__tchMarker === true).catch(() => false)
            if (!marked) return true
            const t = await this.swalTextNow().catch(() => null)
            if (t) text = t
            return !!(t && /error/i.test(t))
        }, { timeout: 20000, interval: 250, timeoutMsg: 'Save All Scores never completed' })
        if (text && /error/i.test(text)) {
            await this.swalConfirmBtn.click().catch(() => {})
            return text
        }
        await this.waitForReload().catch(() => {})
        return text
    }
}

export default new TeacherConductPage()
