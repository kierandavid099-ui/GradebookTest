import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import TeacherModerationPage from '../../page objects/teacherModeration.page.js'
import { ADMIN_USER, TEACHER_USER, TEACHER_DISPLAY_NAME } from '../../helpers/testData.js'
import { FORM_CLASS_ID, FORM_CLASS_NAME, FIXTURE_SUBJECTS, studentSheetName } from '../../helpers/teacherData.js'
import { uniqueName } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Grade moderation lifecycle for "auto-tch Maths — Pri 2A":
// teacher saves a draft → submits (Pending) → admin approves (Approved &
// Locked) → admin revokes (editable again) → teacher resubmits → admin
// returns it with a comment (Flagged) → teacher sees the feedback, amends and
// resubmits → admin approves again.
//
// The admin steps are done through the Result Moderation UI on Academic
// Management, and only ever on this suite's own Maths submission.
//
// Term-end freeze (lock_grade_entry_after_term) is not covered here: it is
// OFF on the server and the current term hasn't ended, and Manage Settings /
// term dates belong to the admin suite — see teacher-rbac.spec.js.
//
// Leaves behind: the Maths × Pri 2A submission in the Approved state with
// Ada 61 / Bayo 40 / Chidi 39 (the next run revokes it first).
// ─────────────────────────────────────────────────────────────────────────────

const SUBJECT = FIXTURE_SUBJECTS.maths.name
const ADA = studentSheetName('Ada')
const BAYO = studentSheetName('Bayo')
const CHIDI = studentSheetName('Chidi')

describe('E2E — Teacher Grade Moderation Lifecycle', () => {

    let ids
    const revokeComment = `auto-tch revoke ${uniqueName('c')}`
    const flagComment = `auto-tch please recheck ${uniqueName('c')}`
    const openSheet = () => TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.maths)
    // Component scores that make a Final of `v`: each component gets v% of
    // its max (2026-10-30: CA 40 pt + Exam 60 pt, so 60 → 24 + 36).
    const sameAll = (v) => async () => (await TeacherGradeEntryPage.components()).map(c => String(Math.round(v * c.max) / 100))

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
        // A previous run leaves the submission Approved; return it first.
        await LoginPage.loginAs(ADMIN_USER)
        await TeacherModerationPage.makeEditable(FORM_CLASS_NAME, SUBJECT, `auto-tch reset ${uniqueName('c')}`)
        await LoginPage.loginAs(TEACHER_USER)
    })

    describe('Draft → Submitted', () => {

        it('E2E-TCH-MOD-001 | Teacher saves a Maths draft and the sheet stays editable', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await openSheet()
            await TeacherGradeEntryPage.enterScores(ADA, await sameAll(60)())
            await TeacherGradeEntryPage.enterScores(BAYO, await sameAll(40)())
            await TeacherGradeEntryPage.enterScores(CHIDI, await sameAll(39)())
            await TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.maths)
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe('60.00')
            await expect(TeacherGradeEntryPage.submitBtn).toBeDisplayed()
        })

        it('E2E-TCH-MOD-002 | Submit for Review asks for confirmation, then shows "Pending admin review"', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await TeacherGradeEntryPage.submitBtn.click()
            await TeacherGradeEntryPage.swal.waitForDisplayed({ timeout: 5000 })
            await expect(TeacherGradeEntryPage.swalTitle).toHaveText(/Submit Grades for Review/i)
            await TeacherGradeEntryPage.markPage()
            await TeacherGradeEntryPage.confirmSwal()
            await TeacherGradeEntryPage.waitForReload()
            await openSheet()
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Submitted.*Pending admin review/i)
            await expect(TeacherGradeEntryPage.statusBadge).toHaveText(/Submitted — Pending Review/i)
        })

        it('E2E-TCH-MOD-003 | While pending, every score input is disabled and Save / Submit are gone', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            for (const n of [ADA, BAYO, CHIDI]) (await TeacherGradeEntryPage.row(n)).disabled.forEach(d => expect(d).toBe(true))
            await expect(TeacherGradeEntryPage.saveBtn).not.toBeExisting()
            await expect(TeacherGradeEntryPage.submitBtn).not.toBeExisting()
        })

        it('E2E-TCH-MOD-004 | The pending lock is enforced server-side — a direct save request is refused', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            const res = await TeacherGradeEntryPage.postScoresDirectly(99, { classId: FORM_CLASS_ID, subjectId: ids.maths })
            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(res.body).toMatch(/locked/i)
            await openSheet()
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe('60.00')
        })

        it('E2E-TCH-MOD-005 | The submission reaches admin Result Moderation under Pending Review, attributed to the teacher', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await LoginPage.loginAs(ADMIN_USER)
            await TeacherModerationPage.openModeration()
            await TeacherModerationPage.filterBtn('submitted').click()
            const info = await TeacherModerationPage.rowInfo(FORM_CLASS_NAME, SUBJECT)
            expect(info).not.toBeNull()
            expect(info.status).toBe('submitted')
            expect(info.visible).toBe(true)
            expect(info.teacher).toBe(TEACHER_DISPLAY_NAME)
            expect(info.actions).toEqual(expect.arrayContaining(['approve', 'flag']))
        })
    })

    describe('Approved & Locked', () => {

        before(async () => {
            // Still signed in as admin from MOD-005.
            await TeacherModerationPage.openModeration()
            await TeacherModerationPage.moderate(FORM_CLASS_NAME, SUBJECT, 'approve', 'auto-tch approved')
            await LoginPage.loginAs(TEACHER_USER)
            await openSheet()
        })

        it('E2E-TCH-MOD-006 | The approved sheet shows the green "Approved — locked for editing" banner with a reviewed timestamp', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Approved.*locked for editing/i)
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Reviewed: \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} [AP]M/)
            expect(await TeacherGradeEntryPage.statusBanner.getAttribute('class')).toContain('alert-success')
        })

        it('E2E-TCH-MOD-007 | The sheet header carries the "Approved & Locked" badge and no Save / Submit buttons', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            await expect(TeacherGradeEntryPage.statusBadge).toHaveText(/Approved & Locked/i)
            await expect(TeacherGradeEntryPage.saveBtn).not.toBeExisting()
            await expect(TeacherGradeEntryPage.submitBtn).not.toBeExisting()
        })

        it('E2E-TCH-MOD-008 | Every score input on the approved sheet is greyed out (disabled)', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            for (const n of [ADA, BAYO, CHIDI]) (await TeacherGradeEntryPage.row(n)).disabled.forEach(d => expect(d).toBe(true))
        })

        it('E2E-TCH-MOD-009 | Remark inputs on the approved sheet are locked too', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            // Live app: score inputs are disabled but the Remark inputs stay
            // editable on an approved (locked) sheet.
            for (const n of [ADA, BAYO, CHIDI]) expect((await TeacherGradeEntryPage.row(n)).remarkDisabled).toBe(true)
        })

        it('E2E-TCH-MOD-010 | The approval lock is enforced server-side — a direct save request is refused', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            const res = await TeacherGradeEntryPage.postScoresDirectly(99, { classId: FORM_CLASS_ID, subjectId: ids.maths })
            expect(res.status).toBeGreaterThanOrEqual(400)
            expect(res.body).toMatch(/locked/i)
            await openSheet()
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe('60.00')
        })
    })

    describe('Revoke → Resubmit', () => {

        before(async () => {
            await LoginPage.loginAs(ADMIN_USER)
            await TeacherModerationPage.openModeration()
            expect((await TeacherModerationPage.rowInfo(FORM_CLASS_NAME, SUBJECT)).actions).toEqual(['flag']) // "Revoke"
            await TeacherModerationPage.moderate(FORM_CLASS_NAME, SUBJECT, 'flag', revokeComment)
            await LoginPage.loginAs(TEACHER_USER)
            await openSheet()
        })

        it('E2E-TCH-MOD-011 | After the admin revokes the approval the sheet is editable again', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            for (const n of [ADA, BAYO, CHIDI]) (await TeacherGradeEntryPage.row(n)).disabled.forEach(d => expect(d).toBe(false))
            await expect(TeacherGradeEntryPage.saveBtn).toBeDisplayed()
            await expect(TeacherGradeEntryPage.submitBtn).toBeDisplayed()
        })

        it('E2E-TCH-MOD-012 | The re-opened sheet tells the teacher why, showing the admin\'s comment', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(new RegExp(revokeComment))
        })

        it('E2E-TCH-MOD-013 | The teacher amends a score and resubmits — status returns to Pending', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await TeacherGradeEntryPage.enterScores(ADA, await sameAll(61)())
            await TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.maths)
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe('61.00')
            await TeacherGradeEntryPage.submitForReview()
            await openSheet()
            await expect(TeacherGradeEntryPage.statusBadge).toHaveText(/Pending Review/i)
        })
    })

    describe('Flagged With Comment', () => {

        before(async () => {
            await LoginPage.loginAs(ADMIN_USER)
            await TeacherModerationPage.openModeration()
            await TeacherModerationPage.moderate(FORM_CLASS_NAME, SUBJECT, 'flag', flagComment)
            await LoginPage.loginAs(TEACHER_USER)
            await openSheet()
        })

        it('E2E-TCH-MOD-014 | A returned sheet shows the "Flagged — please review admin comment and resubmit" banner', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Flagged.*review admin comment and resubmit/i)
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Reviewed: /)
        })

        it('E2E-TCH-MOD-015 | The flagged banner quotes the admin\'s comment', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(new RegExp(flagComment))
        })

        it('E2E-TCH-MOD-016 | A flagged sheet is editable with Save Grades and Submit for Review restored', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            for (const n of [ADA, BAYO, CHIDI]) (await TeacherGradeEntryPage.row(n)).disabled.forEach(d => expect(d).toBe(false))
            await expect(TeacherGradeEntryPage.saveBtn).toBeDisplayed()
            await expect(TeacherGradeEntryPage.submitBtn).toBeDisplayed()
        })

        it('E2E-TCH-MOD-017 | Dashboard → Notifications → Grade Submission Feedback shows "Flagged — Review Required" for the sheet', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            await TeacherDashboardPage.open()
            await TeacherDashboardPage.openTab(TeacherDashboardPage.notificationsTab, TeacherDashboardPage.notificationsPane)
            const text = await TeacherDashboardPage.notificationsPaneText()
            expect(text).toMatch(new RegExp(`Flagged — Review Required:?\\s*${SUBJECT}\\s*•\\s*${FORM_CLASS_NAME}`))
        })

        it('E2E-TCH-MOD-018 | The feedback entry carries the admin comment', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            expect(await TeacherDashboardPage.notificationsPaneText()).toContain(flagComment)
        })

        it('E2E-TCH-MOD-019 | "Review & Resubmit" opens the flagged subject × class grade sheet', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            const link = $(`//div[@id="tchr-notifs-pane"]//*[contains(., "${SUBJECT}")]/ancestor-or-self::*[.//a[contains(., "Resubmit")]][1]//a[contains(., "Resubmit")]`)
            await link.waitForDisplayed({ timeout: 5000 })
            await link.click()
            await TeacherGradeEntryPage.sheetTitle.waitForDisplayed({ timeout: 15000 })
            const url = await browser.getUrl()
            expect(url).toContain(`sj=${ids.maths}`)
            expect(url).toContain(`cl=${FORM_CLASS_ID}`)
        })

        it('E2E-TCH-MOD-020 | Resubmitting after a flag returns the sheet to Pending for a fresh decision', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('blocker')
            await openSheet()
            await TeacherGradeEntryPage.submitForReview()
            await openSheet()
            await expect(TeacherGradeEntryPage.statusBanner).toHaveText(/Pending admin review/i)
        })
    })

    describe('Final Approval', () => {

        before(async () => {
            await LoginPage.loginAs(ADMIN_USER)
            await TeacherModerationPage.openModeration()
            await TeacherModerationPage.moderate(FORM_CLASS_NAME, SUBJECT, 'approve', 'auto-tch final approval')
        })

        it('E2E-TCH-MOD-021 | Admin Result Moderation shows the row as Approved with a reviewed date and the comment', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            await TeacherModerationPage.openModeration()
            const info = await TeacherModerationPage.rowInfo(FORM_CLASS_NAME, SUBJECT)
            expect(info.status).toBe('approved')
            expect(info.reviewed).toMatch(/\d{1,2} \w{3} \d{4}/)
            expect(info.comment).toContain('auto-tch final approval')
        })

        it('E2E-TCH-MOD-022 | Grade Submission Feedback lists the Approved decision with a relative timestamp', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('normal')
            await LoginPage.loginAs(TEACHER_USER)
            await TeacherDashboardPage.open()
            await TeacherDashboardPage.openTab(TeacherDashboardPage.notificationsTab, TeacherDashboardPage.notificationsPane)
            const text = await TeacherDashboardPage.notificationsPaneText()
            expect(text).toMatch(new RegExp(`Approved[^\\n]*\\n?[^\\n]*${SUBJECT}`))
            expect(text).toMatch(/(seconds?|minutes?|hours?) ago|just now/i)
        })

        it('E2E-TCH-MOD-023 | The final approved sheet keeps the resubmitted values', async () => {
            addFeature('Teacher Grade Moderation'); addSeverity('critical')
            await openSheet()
            expect((await TeacherGradeEntryPage.row(ADA)).final).toBe('61.00')
            expect((await TeacherGradeEntryPage.row(BAYO)).final).toBe('40.00')
            expect((await TeacherGradeEntryPage.row(CHIDI)).final).toBe('39.00')
            await expect(TeacherGradeEntryPage.statusBadge).toHaveText(/Approved & Locked/i)
        })
    })
})
