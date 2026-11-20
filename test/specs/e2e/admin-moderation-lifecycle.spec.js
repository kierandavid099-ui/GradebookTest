import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ModerationPage from '../../page objects/adminModeration.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, TEACHER_USER } from '../../helpers/testData.js'
import { randomString } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Result moderation lifecycle, admin side, on a fixture of its own:
// an Upper Primary class + subject, one enrolled student, Chisom allocated
// for the current term. Chisom enters and submits grades; the admin then
// approves (grades lock), revokes (unlocks with a comment), Chisom
// resubmits, the admin returns it with a comment, edits during the flagged
// window, Chisom resubmits again and the admin approves the final version.
// Grades use the default Upper Primary scheme (CA out of 40, Exam out of
// 60, weights matching the maxes), so the final is the raw sum —
// CA 30 + Exam 50 → final 80.
//
// Leaves behind: nothing — fixture class/subject/student (and their
// grades and submission) are deleted in the after hook.
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Admin Result Moderation Lifecycle', () => {

    const tag = randomString(5).toUpperCase()
    let fx

    const asTeacherOnSheet = async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
    }
    const asAdminOnModeration = async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await ModerationPage.openModeration()
    }
    const enabledInputs = () => browser.execute(id => [...document.querySelectorAll(`.grade-entry[data-val-student-id="${id}"]`)].filter(i => !i.disabled).length, fx.studentId)

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        fx = await AdminApi.moderationFixture(tag, await AcademicPage.currentTermId())
    })

    after(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AdminApi.open()
        await AdminApi.cleanupModerationFixture(fx)
    })

    it('E2E-ADM-MOD-001 | The teacher enters CA 30 / Exam 50 and the final shows 80', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        await asTeacherOnSheet()
        await GradeEntryPage.enterScores(fx.studentId, [30, 50])
        expect(await GradeEntryPage.save()).toMatch(/Saved/i)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(80)
    })

    it('E2E-ADM-MOD-002 | Submitting for review locks the teacher\'s sheet pending admin review', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        expect(await GradeEntryPage.submitForReview()).toMatch(/Submitted/i)
        await expect(GradeEntryPage.statusAlert).toHaveText(/Pending admin review/i)
        expect(await enabledInputs()).toBe(0)
    })

    it('E2E-ADM-MOD-003 | The submission appears in Result Moderation as Pending Review', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        await asAdminOnModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('submitted')
    })

    it('E2E-ADM-MOD-004 | Approving reports success and offers Revoke in place of Approve/Return', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        expect(await ModerationPage.approve(fx.subjectName)).toMatch(/have been approved/i)
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('approved')
        await expect(ModerationPage.flagBtn(fx.subjectName)).toHaveText(/Revoke/i)
        await expect(ModerationPage.approveBtn(fx.subjectName)).not.toBeExisting()
    })

    // DEFECT: the in-place update writes the new badge into the Reviewed
    // column (td 5) and leaves Status (td 3) saying "Pending Review".
    it('E2E-ADM-MOD-005 | Straight after approving, the Status column reads Approved', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('minor')
        await expect(ModerationPage.statusCell(fx.subjectName)).toHaveText(/Approved/i)
    })

    it('E2E-ADM-MOD-006 | After a reload the result is still Approved', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        await ModerationPage.openModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('approved')
        await expect(ModerationPage.statusCell(fx.subjectName)).toHaveText(/Approved/i)
    })

    it('E2E-ADM-MOD-007 | The teacher sees "Approved & Locked" and cannot edit the approved sheet', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        await asTeacherOnSheet()
        await expect(GradeEntryPage.statusBadge).toHaveText(/Approved & Locked/i)
        expect(await enabledInputs()).toBe(0)
        await expect(GradeEntryPage.saveBtn).not.toBeExisting()
    })

    it('E2E-ADM-MOD-008 | The lock is enforced server-side: a direct score update is refused', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        // 2026-11-11: score 10 fits both items (CA ≤ 40, Exam ≤ 60) so the
        // request clears range validation and actually hits the lock check.
        const res = await GradeEntryPage.forceScoreUpdate(fx.classId, fx.subjectId, 10)
        expect(res.status).toBeGreaterThanOrEqual(400)
        expect(res.body).toMatch(/lock/i)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(80)
    })

    // 2026-11-11: E2E-ADM-MOD-009 removed. The old /grade-entry/student-
    // results URL used to 500 (reported on Plane); that 500 is gone but the
    // route now 404s — there's no admin-visible term report card to assert
    // against. Reinstate as a fresh ID once a route exists.

    it('E2E-ADM-MOD-010 | Revoking an approval returns it to the teacher with the admin\'s comment', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        // 2026-11-11: MOD-007/008 run as teacher; the old MOD-009 used to
        // re-login as admin before this test. It's gone — do it explicitly.
        await asAdminOnModeration()
        expect(await ModerationPage.flag(fx.subjectName, `Revoked ${tag}: recheck CA`)).toMatch(/returned with comments/i)
        await ModerationPage.openModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('flagged')
    })

    it('E2E-ADM-MOD-011 | After the revoke the teacher can edit again and sees the comment', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        await asTeacherOnSheet()
        await expect(GradeEntryPage.statusAlert).toHaveText(new RegExp(`Revoked ${tag}: recheck CA`))
        expect(await enabledInputs()).toBe(2)
        await GradeEntryPage.enterScores(fx.studentId, [35, 50])
        expect(await GradeEntryPage.save()).toMatch(/Saved/i)
        expect(await GradeEntryPage.submitForReview()).toMatch(/Submitted/i)
    })

    it('E2E-ADM-MOD-012 | The resubmission is back in moderation as Pending Review', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        await asAdminOnModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('submitted')
    })

    it('E2E-ADM-MOD-013 | Returning a pending result WITH a comment flags it', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        expect(await ModerationPage.flag(fx.subjectName, `Flag ${tag}: exam looks low`)).toMatch(/returned with comments/i)
        await ModerationPage.openModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('flagged')
    })

    // DEFECT: the Comment column stays "—" although the teacher receives it.
    it('E2E-ADM-MOD-014 | The moderation list shows the admin comment and a Flagged status', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('normal')
        await expect(ModerationPage.commentCell(fx.subjectName)).toHaveText(new RegExp(`Flag ${tag}`))
        await expect(ModerationPage.statusCell(fx.subjectName)).toHaveText(/Flagged/i)
    })

    it('E2E-ADM-MOD-015 | The admin can edit the scores while the result is flagged', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await GradeEntryPage.enterScores(fx.studentId, [35, 60])
        expect(await GradeEntryPage.save()).toMatch(/Saved/i)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(95)
    })

    it('E2E-ADM-MOD-016 | The teacher sees the comment and the admin\'s edit, and can edit too', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        await asTeacherOnSheet()
        await expect(GradeEntryPage.statusAlert).toHaveText(new RegExp(`Flag ${tag}: exam looks low`))
        const inputs = await GradeEntryPage.studentInputs(fx.studentId)
        expect(Number(await inputs[1].getValue())).toBe(60)
        expect(await enabledInputs()).toBe(2)
    })

    it('E2E-ADM-MOD-017 | Resubmitting after a flag puts it back to Pending Review for a fresh decision', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('blocker')
        expect(await GradeEntryPage.submitForReview()).toMatch(/Submitted/i)
        await asAdminOnModeration()
        expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('submitted')
        await expect(ModerationPage.approveBtn(fx.subjectName)).toBeDisplayed()
    })

    it('E2E-ADM-MOD-018 | Approving the final version locks it at the corrected score', async () => {
        addFeature('Moderation Lifecycle'); addSeverity('critical')
        expect(await ModerationPage.approve(fx.subjectName, 'Final')).toMatch(/approved/i)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await expect(GradeEntryPage.statusAlert).toHaveText(/Approved/i)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(95)
    })

    // The term-end lock (old MOD-019) moves the live term's end date, which
    // locks every grade sheet on the server, so it runs on its own:
    // test/specs/isolated/admin-term-lock.spec.js (--suite termlock).
})
