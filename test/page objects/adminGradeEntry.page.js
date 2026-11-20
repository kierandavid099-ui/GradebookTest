// Grade Entry sheet (/scola-gradebook2/grade-entry?cl=<class>&sj=<subject>).
// The admin suites open it as the admin AND as the teacher (to enter and
// submit the moderation fixture's grades) — the markup is the same.
import ModulePage from './modulePage.page.js'

class AdminGradeEntryPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/grade-entry')
    }

    async openSheet(classId, subjectId) {
        await this.open(`?cl=${classId}&sj=${subjectId}`)
    }

    get teacherSubjectSelect() { return $('#teacher-subject-select') }
    teacherSubjectOption(subjectId, classId) { return $(`#teacher-subject-select option[value="${subjectId}|${classId}"]`) }
    get adminClassSelect() { return $('#sel_class') }
    get adminSubjectSelect() { return $('#sel_subject') }

    get saveBtn() { return $('#btn-save-student-scores') }
    get submitBtn() { return $('#btn-submit-grades') }
    get scoreInputs() { return $$('.grade-entry') }
    // Status banner above the sheet: Submitted / Approved / Flagged (+ admin comment).
    get statusAlert() { return $('div.alert[role="alert"]') }
    get statusBadge() { return $('.card-header .badge') }

    // One input per scheme item per student: id s_<itemId>_<studentId>.
    studentInputs(studentId) { return $$(`.grade-entry[data-val-student-id="${studentId}"]`) }
    finalScore(studentId) { return $(`#fs-${studentId}`) }
    remarkInput(studentId) { return $(`#rmk-${studentId}`) }

    async enterScores(studentId, scores) {
        const inputs = await this.studentInputs(studentId)
        for (let i = 0; i < scores.length; i++) await inputs[i].setValue(String(scores[i]))
    }

    // Save shows "Saving…", then "Saved!", then reloads itself after ~1.2 s.
    async save() {
        await this.saveBtn.click()
        // 2026-11-11: capture the title inside waitUntil — the swal can auto-
        // dismiss between a successful match and a follow-up getText(), which
        // then throws "element not found".
        let captured = ''
        await browser.waitUntil(async () => {
            const t = await this.swalTitle.getText().catch(() => '')
            if (/Saved|Error/i.test(t)) {
                // 2026-11-12: include the swal body too — the title on refusal
                // is just "Error"; the reason (e.g. "expired term") is in the
                // body, and tests may match on it before the swal auto-dismisses.
                const body = await this.swalText.getText().catch(() => '')
                captured = `${t} ${body}`.trim()
                return true
            }
            return false
        }, { timeout: 20000, timeoutMsg: 'Grade save never finished' })
        await browser.pause(2000) // the page reloads itself after a successful save
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        return captured
    }

    // Submit for Review: confirm alert, then "Submitted!" and a reload.
    // 2026-11-12: rewritten to mirror the teacher POM's proven flow — mark
    // the page, click submit, confirm the "Are you sure?" swal, then wait
    // for either (a) a terminal swal title, (b) the page to reload, or
    // (c) the on-page status banner/badge to flip to a submitted state.
    // Any of those is proof the submit landed; we only throw if all three
    // fail together.
    async submitForReview() {
        await browser.execute(() => { window.__admMarker = true })
        await this.submitBtn.waitForClickable({ timeout: 10000 })
        await this.submitBtn.click()
        await this.swal.waitForDisplayed({ timeout: 10000 })
        await browser.pause(700) // clicks during SweetAlert pop-in are dropped
        await this.swalConfirmBtn.click()
        const submitted = /Pending admin review|Pending review|Awaiting review|Submitted/i
        let captured = ''
        try {
            await browser.waitUntil(async () => {
                // (a) a terminal swal title
                const t = await this.swalTitle.getText().catch(() => '')
                if (/Submitted|Done|Success|Error/i.test(t)) {
                    const body = await this.swalText.getText().catch(() => '')
                    captured = `${t} ${body}`.trim()
                    return true
                }
                // (b) the page reloaded past our marker
                const gone = await browser.execute(() => window.__admMarker !== true).catch(() => false)
                if (gone) { captured = 'Submitted (page reloaded)'; return true }
                // (c) the status banner/badge flipped
                const banner = await this.statusAlert.getText().catch(() => '')
                const badge = await this.statusBadge.getText().catch(() => '')
                if (submitted.test(banner) || submitted.test(badge)) {
                    captured = 'Submitted (inferred from status banner)'
                    return true
                }
                return false
            }, { timeout: 20000, interval: 400, timeoutMsg: 'Submit never resolved (no swal, no reload, no status change)' })
        } catch (e) {
            // final poll after the whole wait window elapsed
            const banner = await this.statusAlert.getText().catch(() => '')
            const badge = await this.statusBadge.getText().catch(() => '')
            if (!submitted.test(banner) && !submitted.test(badge)) throw e
            captured = 'Submitted (inferred from status banner)'
        }
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState).catch(() => '')) === 'complete',
            { timeout: 15000, timeoutMsg: 'Submit: page never finished reloading' }
        )
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        return captured
    }

    // Posts a score change straight to /score-update from the open sheet —
    // the same request Save sends — to prove a lock is enforced server-side
    // and not just by disabled inputs.
    forceScoreUpdate(classId, subjectId, score) {
        return browser.executeAsync((classId, subjectId, score, done) => {
            const list = [...document.querySelectorAll('.grade-entry')].map(e => ({
                score: String(score), max_mp: e.dataset.valMaxMp, input_selector: e.dataset.valSelector,
                grade_contrib_pct: e.dataset.valGcp, grade_title: e.dataset.valTitle,
                grading_scheme_item_id: e.dataset.valGradeId, student_id: e.dataset.valStudentId,
                subject_id: subjectId, class_id: classId,
            }))
            const fd = new FormData()
            fd.append('_token', document.querySelector('meta[name="csrf-token"]').content)
            fd.append('grade_list', JSON.stringify(list))
            fd.append('remark_list', '[]')
            fetch('/scola-gradebook2/score-update', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
                .then(async r => done({ status: r.status, body: await r.text() }))
                .catch(e => done({ status: 0, body: e.message }))
        }, classId, subjectId, score)
    }
}

export default new AdminGradeEntryPage()
