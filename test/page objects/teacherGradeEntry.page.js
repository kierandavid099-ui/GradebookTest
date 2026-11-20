import TeacherModulePage from './teacherModule.page.js'

// Grade Entry (/scola-gradebook2/grade-entry?cl=<class>&sj=<subject>).
// One row per enrolled pupil, one number input per assessment-scheme
// component, a read-only Final and a free-text Remark. The Final is NOT
// computed in the browser — the server works it out on Save, and the page
// then reloads, so every maths test is "type → Save → reopen → read Final".
class TeacherGradeEntryPage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/grade-entry')
    }

    async openSheet(classId, subjectId) {
        await this.open(`?cl=${classId}&sj=${subjectId}`)
    }

    get subjectSelect() { return $('#teacher-subject-select') }
    get sheetTitle() { return $('//h6[contains(., "Grade Sheet")]') }
    get table() { return $('.ge-table') }
    get saveBtn() { return $('#btn-save-student-scores') }
    get submitBtn() { return $('#btn-submit-grades') }
    // Status banner above the sheet (Submitted / Approved / Flagged) and the
    // badge in the sheet header that replaces the buttons while locked.
    get statusBanner() { return $('.page-content .alert[role="alert"]') }
    get statusBadge() { return $('//h6[contains(., "Grade Sheet")]/following-sibling::div//span[contains(@class,"badge")]') }
    get noSubjectsMsg() { return $('//p[contains(., "no subjects assigned")]') }

    // Column headers read "CA / 100 pts • 40%" — returns [{ title, max, weight }].
    // 2026-10-30: now "CA 40 pt • 40%" (scored in points out of the
    // component's max, Final = the sum); both forms are accepted.
    async components() {
        return browser.execute(() => [...document.querySelectorAll('.ge-table thead th')]
            .map(th => th.innerText.replace(/\s+/g, ' ').trim())
            .map(t => t.match(/^(.+?) (?:\/ )?(\d+(?:\.\d+)?) pts? • (\d+(?:\.\d+)?)%$/))
            .filter(Boolean)
            .map(m => ({ title: m[1], max: Number(m[2]), weight: Number(m[3]) })))
    }

    async weights() {
        return (await this.components()).map(c => c.weight)
    }

    async headerTexts() {
        return browser.execute(() => [...document.querySelectorAll('.ge-table thead th')].map(th => th.innerText.replace(/\s+/g, ' ').trim()))
    }

    // Rows keyed by the pupil's "Last, First" name, with input ids so callers
    // can type into a specific cell.
    async rows() {
        return browser.execute(() => [...document.querySelectorAll('.ge-table tbody tr')]
            .filter(tr => tr.querySelector('.score-input'))
            .map(tr => ({
                name: tr.cells[0].innerText.trim(),
                studentId: tr.querySelector('.score-input').getAttribute('data-val-student-id'),
                scoreIds: [...tr.querySelectorAll('.score-input')].map(i => i.id),
                scores: [...tr.querySelectorAll('.score-input')].map(i => i.value),
                disabled: [...tr.querySelectorAll('.score-input')].map(i => i.disabled),
                final: (tr.querySelector('[id^="fs-"]') || {}).value,
                remark: (tr.querySelector('.remark-entry') || {}).value,
                remarkDisabled: !!(tr.querySelector('.remark-entry') || {}).disabled,
            })))
    }

    async row(name) {
        const row = (await this.rows()).find(r => r.name === name)
        if (!row) throw new Error(`Grade sheet has no row for "${name}"`)
        return row
    }

    scoreInput(id) { return $(`[id="${id}"]`) }
    remarkInput(studentId) { return $(`#rmk-${studentId}`) }
    finalInput(studentId) { return $(`#fs-${studentId}`) }

    // Types one value per component ('' leaves the cell blank).
    async enterScores(name, scores) {
        const row = await this.row(name)
        for (let i = 0; i < row.scoreIds.length; i++) {
            const input = this.scoreInput(row.scoreIds[i])
            await input.scrollIntoView({ block: 'center' })
            await input.clearValue()
            const v = scores[i] === undefined ? '' : String(scores[i])
            if (v !== '') await input.setValue(v)
        }
    }

    async enterRemark(name, text) {
        const row = await this.row(name)
        const input = this.remarkInput(row.studentId)
        await input.clearValue()
        if (text) await input.setValue(text)
    }

    // Save → "Saving…" swal → "Saved!" → location.reload(true). Returns the
    // last swal text seen before the reload (e.g. a server error message).
    async save() {
        await this.markPage()
        await this.saveBtn.scrollIntoView({ block: 'center' })
        await this.saveBtn.click()
        let lastSwal = null
        await browser.waitUntil(async () => {
            const marked = await browser.execute(() => window.__tchMarker === true).catch(() => false)
            if (!marked) return true
            const t = await this.swalTextNow().catch(() => null)
            if (t) lastSwal = t
            // An error swal never reloads — stop waiting once it's on screen.
            return !!(t && /error/i.test(t) && !/saving/i.test(t))
        }, { timeout: 25000, interval: 250, timeoutMsg: 'Grade save never completed' })
        await this.waitForReload().catch(() => {})
        return lastSwal
    }

    // Saves, then re-opens the sheet fresh so the values read back are what
    // the server stored (not Chrome's restored form state).
    async saveAndReopen(classId, subjectId) {
        const swalText = await this.save()
        await this.openSheet(classId, subjectId)
        await this.table.waitForDisplayed({ timeout: 10000 })
        return swalText
    }

    async submitForReview() {
        await this.submitBtn.waitForClickable({ timeout: 5000 })
        await this.submitBtn.click()
        await this.markPage()
        await this.confirmSwal()
        await this.waitForReload()
    }

    // Direct POST of the sheet's own save payload with every score set to
    // `score` — the same request the Save button sends, minus the UI. Used to
    // prove locks/RBAC are enforced server-side, not just by hiding buttons.
    async postScoresDirectly(score, { classId, subjectId, studentId } = {}) {
        return browser.executeAsync((score, classId, subjectId, studentId, done) => {
            const inputs = [...document.querySelectorAll('.ge-table .score-input')]
                .filter(i => !studentId || i.dataset.valStudentId === studentId)
            const userMatch = [...document.scripts].map(s => s.textContent).join('\n').match(/'user_id':\s*'([0-9a-f-]{36})'/)
            const list = inputs.map(i => ({
                score: String(score), max_mp: i.dataset.valMaxMp, input_selector: i.dataset.valSelector,
                grade_contrib_pct: i.dataset.valGcp, grade_title: i.dataset.valTitle,
                grading_scheme_item_id: i.dataset.valGradeId, student_id: i.dataset.valStudentId,
                user_id: userMatch ? userMatch[1] : '', subject_id: subjectId, class_id: classId,
            }))
            const fd = new FormData()
            fd.append('_token', document.querySelector('input[name="_token"]').value)
            fd.append('grade_list', JSON.stringify(list))
            fd.append('remark_list', '[]')
            fetch('/scola-gradebook2/score-update', { method: 'POST', body: fd, headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
                .then(async r => done({ status: r.status, body: (await r.text()).slice(0, 500) }))
                .catch(e => done({ status: 0, body: String(e) }))
        }, score, classId, subjectId, studentId)
    }
}

export default new TeacherGradeEntryPage()
