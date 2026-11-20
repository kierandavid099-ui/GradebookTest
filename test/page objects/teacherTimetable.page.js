import TeacherModulePage from './teacherModule.page.js'

// Class Timetable (/scola-gradebook2/class-timetable/{classId}). A Day ×
// Period grid; "Add Period" opens #buildTimeTableModal (Day, Period No,
// Title, Subject-or-Break, Teacher, Start, End). Each filled cell carries an
// Edit link (re-opens the same modal via editPeriod(...)) and a Delete form.
class TeacherTimetablePage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/class-timetable')
    }

    async openClass(classId) {
        await this.open(`/${classId}`)
    }

    get addBtn() { return $('[data-bs-target="#buildTimeTableModal"]') }
    get modal() { return $('#buildTimeTableModal') }
    get daySelect() { return $('#buildTimetableForm [name="day_of_week"]') }
    get periodInput() { return $('#buildTimetableForm [name="period_number"]') }
    get titleInput() { return $('#buildTimetableForm [name="title"]') }
    get subjectSelect() { return $('#build-subject-select') }
    get teacherSelect() { return $('#build-teacher-select') }
    get startInput() { return $('#buildTimetableForm [name="start_time"]') }
    get endInput() { return $('#buildTimetableForm [name="end_time"]') }
    get saveBtn() { return $('#btn-save-period') }
    get emptyState() { return $('//*[contains(., "No periods added yet")]') }

    async openAddModal() {
        await this.addBtn.waitForClickable({ timeout: 5000 })
        await this.addBtn.click()
        await this.modal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(600) // modal fade-in
    }

    async setTime(input, hhmm) {
        await browser.execute((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) }, await input, hhmm)
    }

    // Fills the open modal; omitted fields stay as they are.
    async fill({ day, period, title, subject, start, end }) {
        if (day) await this.daySelect.selectByAttribute('value', day)
        if (period !== undefined) { await this.periodInput.clearValue(); await this.periodInput.setValue(String(period)) }
        if (title !== undefined) { await this.titleInput.clearValue(); if (title) await this.titleInput.setValue(title) }
        if (subject) {
            await this.subjectSelect.selectByAttribute('value', subject)
            // Picking a subject loads its teachers over AJAX.
            if (subject !== 'break') {
                await browser.waitUntil(async () => !(await this.teacherSelect.getText()).includes('Loading'), { timeout: 10000 })
            }
        }
        if (start) await this.setTime(this.startInput, start)
        if (end) await this.setTime(this.endInput, end)
    }

    // Save → success swal + reload, or an error swal / HTML5 block that
    // leaves the modal open. Returns { saved, message }.
    async save() {
        await this.markPage()
        await this.saveBtn.click()
        let message = null
        let saved = false
        await browser.waitUntil(async () => {
            const marked = await browser.execute(() => window.__tchMarker === true).catch(() => false)
            if (!marked) { saved = true; return true }
            const t = await this.swalTextNow().catch(() => null)
            if (t) message = t
            return !!(t && /error/i.test(t))
        }, { timeout: 8000, interval: 250 }).catch(() => {})
        if (saved) await this.waitForReload().catch(() => {})
        else if (message) await this.swalConfirmBtn.click().catch(() => {})
        return { saved, message }
    }

    async firstInvalidField() {
        return browser.execute(() => {
            const el = document.querySelector('#buildTimetableForm :invalid')
            return el ? el.getAttribute('name') : null
        })
    }

    // Grid cells: { day, period, text, isBreak }
    async cells() {
        return browser.execute(() => {
            const table = [...document.querySelectorAll('table')].find(t => /1st Period|Period/.test((t.tHead || {}).innerText || '') && t.querySelector('.tt-cell'))
            if (!table) return []
            const heads = [...table.tHead.rows[0].cells].map(c => c.innerText.trim())
            const out = []
            for (const tr of table.tBodies[0].rows) {
                const day = tr.cells[0].innerText.trim()
                ;[...tr.cells].slice(1).forEach((td, i) => out.push({
                    day, period: heads[i + 1], text: td.innerText.replace(/\s+/g, ' ').trim(),
                    isBreak: !!td.querySelector('.tt-break'),
                }))
            }
            return out
        })
    }

    async cellsFor(title) {
        return (await this.cells()).filter(c => c.text.includes(title))
    }

    cellXpath(day, text) {
        return `//tr[td[1][contains(normalize-space(.), "${day}")]]/td[contains(@class,"tt-cell")][contains(., "${text}")]`
    }

    editLink(day, text) { return $(`${this.cellXpath(day, text)}//a[@title="Edit"]`) }

    async openEdit(day, text) {
        const link = this.editLink(day, text)
        await link.scrollIntoView({ block: 'center' })
        await link.click()
        await this.modal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(600)
    }

    // Deletes every period on `day` whose cell text contains `text`.
    async deleteMatching(day, text) {
        let deleted = 0
        for (let i = 0; i < 10; i++) {
            const form = $(`${this.cellXpath(day, text)}//form[contains(@action, "process-delete-period")]//button`)
            if (!(await form.isExisting())) break
            await form.scrollIntoView({ block: 'center' })
            await form.click()
            await this.markPage()
            await this.confirmSwal()
            await this.waitForReload()
            deleted++
        }
        return deleted
    }
}

export default new TeacherTimetablePage()
