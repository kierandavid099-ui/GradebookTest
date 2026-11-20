import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import {
    FORM_CLASS_ID, FORM_CLASS_NAME, OTHER_CLASS_ID, FIXTURE_SUBJECTS, BLANK_STUDENTS, BLANK_LAST_NAME,
    studentSheetName, expectedFinal, pointsFor,
} from '../../helpers/teacherData.js'
import { uniqueName } from '../../helpers/random.js'

// Grade-entry maths and validation on "auto-tch English — Pri 2A", which this
// suite keeps as an editable draft (it is never submitted; the moderation
// lifecycle runs on "auto-tch Maths" in the e2e suite instead).
//
// The sheet's cases were written for a 20% test / 80% exam scheme
// (49/98 → 88.20). The scheme is owned by the admin suite and is whatever is
// currently applied to Lower Primary, so every expected Final here is worked
// out from the weights printed in the live column headers — e.g. under the
// 40/60 scheme on the server today 49/98 → 78.40, under 20/80 → 88.20.
//
// 2026-10-30: the sheet now scores in points (CA 40 pt, Exam 60 pt, Final =
// the sum) instead of each component out of 100. Values below are written as
// a % of each component's max and converted by fill(), so 49/98 is typed as
// 49/98 on the old sheet and 19.6/58.8 on the points sheet — the Final
// (78.40 under 40/60) is the same either way.
//
// The Final is calculated server-side on Save (the page then reloads), so
// each section saves once in a before hook and its tests read the stored rows.
//
// Leaves behind: draft English scores/remarks for the Tchfixture/Tchzero pupils.

const ADA = studentSheetName('Ada')
const BAYO = studentSheetName('Bayo')
const CHIDI = studentSheetName('Chidi')

describe('REGRESSION — Teacher Grade Entry', () => {

    let ids
    let comps
    const openSheet = () => TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
    const saveAndReopen = () => TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.english)
    // One value per component, as a % of that component's max (converted to
    // what is typed); any extra components get the last value.
    const fill = (vals) => comps.map((c, i) => pointsFor(i < vals.length ? vals[i] : vals[vals.length - 1], c))
    // How the sheet shows those values once stored: 2dp.
    const shown = (vals) => fill(vals).map(v => (v === '' ? '' : Number(v).toFixed(2)))

    before(async function () {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
        await openSheet()
        comps = await TeacherGradeEntryPage.components()
        // No scheme applied to Lower Primary → no score columns to test.
        if (!comps.length) this.skip()
    })

    describe('Grade Sheet Render', () => {

        it('REG-TCH-GRD-001 | Grade Entry opens for an assigned subject × class', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            await expect(TeacherGradeEntryPage.breadcrumb).toHaveText(/Grade Entry/i)
            await expect(TeacherGradeEntryPage.sheetTitle).toHaveText(new RegExp(`${FIXTURE_SUBJECTS.english.name}.*Grade Sheet`, 'i'))
            await expect(TeacherGradeEntryPage.subtitle).toHaveText(new RegExp(FORM_CLASS_NAME))
        })

        it('REG-TCH-GRD-002 | Each scheme component renders as "<max> pt • <weight>%" with max = weight, followed by a 100 pt total and Remark', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            // 2026-10-30: was "<title> / 100 pts • <weight>%" and "Final 100 pts".
            expect(comps.length).toBeGreaterThan(0)
            comps.forEach(c => expect(c.max).toBe(c.weight))
            const headers = await TeacherGradeEntryPage.headerTexts()
            expect(headers[0]).toMatch(/Student/)
            expect(headers[1]).toMatch(/Adm/)
            expect(headers[headers.length - 2]).toMatch(/^(?:Final|Total) 100 pts?$/)
            expect(headers[headers.length - 1]).toMatch(/^Remark$/)
        })

        it('REG-TCH-GRD-003 | Scheme component weights add up to exactly 100%', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            expect(comps.reduce((a, c) => a + c.weight, 0)).toBe(100)
        })

        it('REG-TCH-GRD-004 | Every enrolled fixture pupil has one input per component, a read-only Final and a Remark', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            for (const name of [ADA, BAYO, CHIDI]) {
                const row = await TeacherGradeEntryPage.row(name)
                expect(row.scoreIds.length).toBe(comps.length)
                await expect(TeacherGradeEntryPage.finalInput(row.studentId)).toBeDisabled()
                await expect(TeacherGradeEntryPage.remarkInput(row.studentId)).toBeDisplayed()
            }
        })

        it('REG-TCH-GRD-005 | Score inputs are numeric with min 0 / max = component max and 0.01 steps', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const row = await TeacherGradeEntryPage.row(ADA)
            const input = TeacherGradeEntryPage.scoreInput(row.scoreIds[0])
            expect(await input.getAttribute('type')).toBe('number')
            expect(await input.getAttribute('min')).toBe('0')
            expect(Number(await input.getAttribute('max'))).toBe(comps[0].max)
            expect(await input.getAttribute('step')).toBe('0.01')
        })

        it('REG-TCH-GRD-006 | Stat cards match the sheet: Students = rows, Grade Columns = components', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const rows = await TeacherGradeEntryPage.rows()
            expect(Number(await TeacherGradeEntryPage.statValue('Students'))).toBe(rows.length)
            expect(Number(await TeacherGradeEntryPage.statValue('Grade Columns'))).toBe(comps.length)
        })
    })

    describe('Weighted Final', () => {

        before(async () => {
            await openSheet()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['49', '98']))
            await TeacherGradeEntryPage.enterScores(BAYO, fill(['55']))
            await TeacherGradeEntryPage.enterScores(CHIDI, fill(['100']))
            await saveAndReopen()
        })

        it('REG-TCH-GRD-007 | Final is the weighted total of the components — 49/98', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            // 20/80 → 88.20 (sheet); 40/60 → 78.40 — follows the live scheme.
            const row = await TeacherGradeEntryPage.row(ADA)
            expect(row.final).toBe(expectedFinal(fill(['49', '98']), comps))
        })

        it('REG-TCH-GRD-008 | Equal components give that same Final — 55/55 → 55.00', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            expect((await TeacherGradeEntryPage.row(BAYO)).final).toBe('55.00')
        })

        it('REG-TCH-GRD-009 | Full marks give the maximum Final — 100/100 → 100.00', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            expect((await TeacherGradeEntryPage.row(CHIDI)).final).toBe('100.00')
        })

        it('REG-TCH-GRD-010 | Final and stored component scores are shown to exactly two decimals', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            for (const name of [ADA, BAYO, CHIDI]) {
                const row = await TeacherGradeEntryPage.row(name)
                expect(row.final).toMatch(/^\d+\.\d{2}$/)
                row.scores.forEach(s => expect(s).toMatch(/^\d+\.\d{2}$/))
            }
        })
    })

    describe('Blank Components', () => {

        // Once a cell has been saved the server ignores a later blank (see
        // GRD-014), so these cases use the reserved Tchzero pupils whose
        // tested cells are never given a score by any spec.
        const TEN_BLANK = studentSheetName(BLANK_STUDENTS.tenBlank.first, BLANK_LAST_NAME)
        const ALL_BLANK = studentSheetName(BLANK_STUDENTS.allBlank.first, BLANK_LAST_NAME)
        const EXAM_ONLY = studentSheetName(BLANK_STUDENTS.examOnly.first, BLANK_LAST_NAME)

        before(async () => {
            await openSheet()
            await TeacherGradeEntryPage.enterScores(TEN_BLANK, fill(['10', '']))
            await TeacherGradeEntryPage.enterScores(ALL_BLANK, fill(['']))
            await TeacherGradeEntryPage.enterScores(EXAM_ONLY, fill(['', '50']))
            await saveAndReopen()
        })

        it('REG-TCH-GRD-011 | A blank component counts as 0 — 10%/blank → 10% of the first weight', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            // OBSERVATION (not a defect, per the sheet): a half-entered row
            // already shows a real, low Final, which can be mistaken for the
            // pupil's actual result mid-entry.
            const row = await TeacherGradeEntryPage.row(TEN_BLANK)
            expect(row.final).toBe(expectedFinal(fill(['10', '']), comps))
        })

        it('REG-TCH-GRD-012 | A row with every component blank shows Final 0.00', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            expect((await TeacherGradeEntryPage.row(ALL_BLANK)).final).toBe('0.00')
        })

        it('REG-TCH-GRD-013 | A blank first component with a later one filled weights only the filled one', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            expect((await TeacherGradeEntryPage.row(EXAM_ONLY)).final).toBe(expectedFinal(fill(['', '50']), comps))
        })
    })

    describe('Clearing A Saved Score', () => {

        before(async () => {
            await openSheet()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['49', '98']))
            await saveAndReopen()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['49', '']))
            await saveAndReopen()
        })

        it('REG-TCH-GRD-014 | Clearing a previously saved component stores it as blank and the Final drops accordingly', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            // Live app: the blank is ignored and the old 98 stays, so a
            // mistyped exam score can never be removed — only overwritten.
            const row = await TeacherGradeEntryPage.row(ADA)
            expect(row.scores[1]).toBe('')
            expect(row.final).toBe(expectedFinal(fill(['49', '']), comps))
        })
    })

    describe('Determinism', () => {

        before(async () => {
            await openSheet()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['63.5', '71.25']))
            await TeacherGradeEntryPage.enterScores(BAYO, fill(['63.5', '71.25']))
            await saveAndReopen()
        })

        it('REG-TCH-GRD-015 | Identical inputs for two pupils produce the identical Final', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            const a = await TeacherGradeEntryPage.row(ADA)
            const b = await TeacherGradeEntryPage.row(BAYO)
            expect(a.final).toBe(b.final)
            expect(a.final).toBe(expectedFinal(fill(['63.5', '71.25']), comps))
        })

        it('REG-TCH-GRD-016 | Re-opening the saved sheet shows the same Final again', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const before = (await TeacherGradeEntryPage.row(ADA)).final
            await openSheet()
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe(before)
        })

        it('REG-TCH-GRD-017 | Decimal component scores are stored as entered (e.g. 25.40 / 42.75)', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const row = await TeacherGradeEntryPage.row(ADA)
            expect(row.scores.slice(0, 2)).toEqual(shown(['63.5', '71.25']).slice(0, 2))
        })
    })

    describe('Score Validation', () => {

        let saveMessage

        before(async () => {
            // Start from a known good row for each pupil, then try to save
            // out-of-range values over it.
            await openSheet()
            for (const n of [ADA, BAYO, CHIDI]) await TeacherGradeEntryPage.enterScores(n, fill(['50']))
            await saveAndReopen()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['101', '50']))
            await TeacherGradeEntryPage.enterScores(BAYO, fill(['-1', '50']))
            await TeacherGradeEntryPage.enterScores(CHIDI, fill(['50', '150']))
            saveMessage = await TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.english)
        })

        it('REG-TCH-GRD-018 | A component score just over its max (101%) is not stored', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            const row = await TeacherGradeEntryPage.row(ADA)
            expect(row.scores[0]).not.toBe(shown(['101'])[0])
            expect(Number(row.final)).toBeLessThanOrEqual(100)
        })

        it('REG-TCH-GRD-019 | A component score well over its max (150%) is not stored', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            const row = await TeacherGradeEntryPage.row(CHIDI)
            expect(row.scores[1]).not.toBe(shown(['50', '150'])[1])
            expect(Number(row.final)).toBeLessThanOrEqual(100)
        })

        it('REG-TCH-GRD-020 | A negative component score is not stored', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            const row = await TeacherGradeEntryPage.row(BAYO)
            expect(row.scores[0]).not.toBe(shown(['-1'])[0])
            expect(Number(row.final)).toBeGreaterThanOrEqual(0)
        })

        it('REG-TCH-GRD-021 | Saving out-of-range scores tells the teacher they were rejected', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            // The whole save is refused (nothing in that batch is stored) and
            // a SweetAlert error is shown. It's only a generic "An error
            // occurred" though — it doesn't say which cell was out of range.
            expect(saveMessage || '').toMatch(/error/i)
            expect(saveMessage || '').not.toMatch(/saved successfully/i)
        })

        it('REG-TCH-GRD-022 | Non-numeric text cannot be typed into a score input', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const row = await TeacherGradeEntryPage.row(ADA)
            const input = TeacherGradeEntryPage.scoreInput(row.scoreIds[0])
            await input.clearValue()
            await input.setValue('abc')
            expect(await input.getValue()).toBe('')
            await openSheet() // discard the unsaved edit
        })
    })

    describe('Save Draft & Remarks', () => {

        const remark = `auto-tch remark ${uniqueName('r')}`
        const htmlRemark = '<b>bold</b><img src=x onerror="window.__tchXss=1">'

        before(async () => {
            await openSheet()
            await TeacherGradeEntryPage.enterScores(ADA, fill(['80', '70']))
            await TeacherGradeEntryPage.enterRemark(ADA, remark)
            await TeacherGradeEntryPage.enterRemark(BAYO, htmlRemark)
            await saveAndReopen()
        })

        it('REG-TCH-GRD-023 | Save Grades persists the scores across a fresh reload', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('blocker')
            const row = await TeacherGradeEntryPage.row(ADA)
            expect(row.scores.slice(0, 2)).toEqual(shown(['80', '70']).slice(0, 2))
        })

        // Once an admin has returned the sheet (ensure() does that if it was
        // found locked) a "Flagged" banner stays until it is approved, so only
        // a Submitted/Approved banner counts against a draft.
        it('REG-TCH-GRD-024 | A saved draft stays editable — Save and Submit for Review remain, no Submitted/Approved banner', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            await expect(TeacherGradeEntryPage.saveBtn).toBeDisplayed()
            await expect(TeacherGradeEntryPage.submitBtn).toBeDisplayed()
            if (await TeacherGradeEntryPage.statusBanner.isExisting()) {
                expect(await TeacherGradeEntryPage.statusBanner.getText()).not.toMatch(/Submitted|Approved/i)
            }
            const row = await TeacherGradeEntryPage.row(ADA)
            row.disabled.forEach(d => expect(d).toBe(false))
        })

        it('REG-TCH-GRD-025 | An optional remark is saved against that pupil only', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            expect((await TeacherGradeEntryPage.row(ADA)).remark).toBe(remark)
            expect((await TeacherGradeEntryPage.row(CHIDI)).remark).not.toBe(remark)
        })

        it('REG-TCH-GRD-026 | HTML in a remark is stored and shown as plain text, never executed', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            expect((await TeacherGradeEntryPage.row(BAYO)).remark).toBe(htmlRemark)
            expect(await browser.execute(() => window.__tchXss)).toBeFalsy()
        })
    })

    describe('Subject Switch', () => {

        before(async () => await openSheet())

        it('REG-TCH-GRD-027 | "Select Subject to Grade" lists each assigned subject × class', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            const options = await browser.execute(() => [...document.querySelectorAll('#teacher-subject-select option')].map(o => o.textContent.trim()))
            expect(options).toContain(`${FIXTURE_SUBJECTS.english.name} — ${FORM_CLASS_NAME}`)
            expect(options).toContain(`${FIXTURE_SUBJECTS.maths.name} — ${FORM_CLASS_NAME}`)
        })

        it('REG-TCH-GRD-028 | Choosing another subject reloads the sheet for that subject and class', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('critical')
            await TeacherGradeEntryPage.subjectSelect.selectByAttribute('value', `${ids.maths}|${FORM_CLASS_ID}`)
            await browser.waitUntil(async () => (await browser.getUrl()).includes(`sj=${ids.maths}`),
                { timeout: 10000, timeoutMsg: 'Switching subject did not navigate' })
            await TeacherGradeEntryPage.sheetTitle.waitForDisplayed({ timeout: 10000 })
            await expect(TeacherGradeEntryPage.sheetTitle).toHaveText(new RegExp(FIXTURE_SUBJECTS.maths.name))
            expect(await browser.getUrl()).toContain(`cl=${FORM_CLASS_ID}`)
        })
    })

    describe('Empty Class', () => {

        before(async () => await TeacherGradeEntryPage.openSheet(OTHER_CLASS_ID, ids.english))

        it('REG-TCH-GRD-029 | A subject × class with no enrolled pupils has no editable score rows', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('normal')
            expect((await TeacherGradeEntryPage.rows()).length).toBe(0)
            expect(Number(await TeacherGradeEntryPage.statValue('Students'))).toBe(0)
        })

        it('REG-TCH-GRD-030 | The empty sheet explains that no students are enrolled', async () => {
            addFeature('Teacher Grade Entry'); addSeverity('minor')
            await expect(TeacherGradeEntryPage.pageContent).toHaveText(/No students enrolled/i)
        })
    })
})
