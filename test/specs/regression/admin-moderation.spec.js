import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ModerationPage from '../../page objects/adminModeration.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, TEACHER_USER, BASE_URL } from '../../helpers/testData.js'
import { randomString } from '../../helpers/random.js'

// Result Moderation screen: where it lives, filters, the moderate modal and
// the flag-comment rules. Only the spec's own fixture submission is ever
// moderated (class auto-adm-mod-<tag>, Chisom allocated for the current
// term, grades entered and submitted by Chisom in before) — never Chisom's
// pre-existing classes. The full approve → lock → revoke → flag → resubmit
// cycle is in e2e/admin-moderation-lifecycle.spec.js.
//
// Leaves behind: nothing — the fixture (and its submission) is deleted in after.

describe('REGRESSION — Admin Result Moderation', () => {

    const tag = randomString(5).toUpperCase()
    let fx

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        fx = await AdminApi.moderationFixture(tag, await AcademicPage.currentTermId())
        await LoginPage.loginAs(TEACHER_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await GradeEntryPage.enterScores(fx.studentId, [30, 50])
        await GradeEntryPage.save()
        await GradeEntryPage.submitForReview()
        await LoginPage.loginAs(ADMIN_USER)
        await ModerationPage.openModeration()
    })

    afterEach(async () => { await ModerationPage.closeModal() })

    after(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AdminApi.open()
        await AdminApi.cleanupModerationFixture(fx)
    })

    describe('Location & list', () => {

        it('REG-ADM-MOD-001 | The Result Moderation menu link lands on Academic Management, which hosts the Moderation tab', async () => {
            addFeature('Result Moderation'); addSeverity('critical')
            await browser.url(`${BASE_URL}${ModerationPage.legacyPath}`)
            await ModerationPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
            expect(await browser.getUrl()).toContain('/academic-management')
            await expect(ModerationPage.tab).toBeExisting()
            await ModerationPage.openModeration()
            await expect(ModerationPage.pane).toBeDisplayed()
        })

        it('REG-ADM-MOD-002 | A submitted result is listed as "Pending Review" with Approve and Return actions', async () => {
            addFeature('Result Moderation'); addSeverity('blocker')
            await expect(ModerationPage.row(fx.subjectName)).toBeDisplayed()
            expect(await ModerationPage.rowStatus(fx.subjectName)).toBe('submitted')
            await expect(ModerationPage.statusCell(fx.subjectName)).toHaveText(/Pending Review/i)
            await expect(ModerationPage.row(fx.subjectName)).toHaveText(/Okafor, Chisom/)
            await expect(ModerationPage.approveBtn(fx.subjectName)).toBeDisplayed()
            await expect(ModerationPage.flagBtn(fx.subjectName)).toBeDisplayed()
        })

        it('REG-ADM-MOD-003 | The row names the class, subject and term code', async () => {
            addFeature('Result Moderation'); addSeverity('normal')
            await expect(ModerationPage.row(fx.subjectName)).toHaveText(new RegExp(fx.classCode))
            await expect(ModerationPage.row(fx.subjectName)).toHaveText(/\d{4}-\d{4}-T\d/)
        })

        it('REG-ADM-MOD-004 | The status filters show only matching rows', async () => {
            addFeature('Result Moderation'); addSeverity('normal')
            await ModerationPage.filterBtn('approved').click()
            await expect(ModerationPage.row(fx.subjectName)).not.toBeDisplayed()
            await ModerationPage.filterBtn('submitted').click()
            await expect(ModerationPage.row(fx.subjectName)).toBeDisplayed()
            await ModerationPage.filterBtn('all').click()
            await expect(ModerationPage.row(fx.subjectName)).toBeDisplayed()
        })

        it('REG-ADM-MOD-005 | View Grades opens the fixture grade sheet', async () => {
            addFeature('Result Moderation'); addSeverity('minor')
            const href = await ModerationPage.viewBtn(fx.subjectName).getAttribute('href')
            expect(href).toContain(`cl=${fx.classId}`)
            expect(href).toContain(`sj=${fx.subjectId}`)
        })
    })

    describe('Moderate modal', () => {

        it('REG-ADM-MOD-006 | Approve opens "Approve Grades" with an optional comment', async () => {
            addFeature('Result Moderation'); addSeverity('normal')
            await ModerationPage.openAction(ModerationPage.approveBtn(fx.subjectName))
            await expect(ModerationPage.modalTitle).toHaveText('Approve Grades')
            await expect(ModerationPage.commentLabel).toHaveText(/optional/i)
        })

        it('REG-ADM-MOD-007 | Return opens "Return Grades with Comment"', async () => {
            addFeature('Result Moderation'); addSeverity('normal')
            await ModerationPage.openAction(ModerationPage.flagBtn(fx.subjectName))
            await expect(ModerationPage.modalTitle).toHaveText(/Return Grades with Comment/i)
        })

        it('REG-ADM-MOD-008 | Cancelling the confirmation leaves the result unchanged', async () => {
            addFeature('Result Moderation'); addSeverity('minor')
            await ModerationPage.openModeration()
            const before = await ModerationPage.rowStatus(fx.subjectName)
            const btn = ModerationPage.approveBtn(fx.subjectName)
            await ModerationPage.openAction(btn)
            await ModerationPage.confirmBtn.click()
            await ModerationPage.swal.waitForDisplayed({ timeout: 5000 })
            await browser.pause(400)
            await ModerationPage.swalCancelBtn.click()
            await ModerationPage.openModeration()
            expect(await ModerationPage.rowStatus(fx.subjectName)).toBe(before)
        })

        // The site owners confirmed a flag must carry a comment. Flagging with
        // one is covered in e2e/admin-moderation-lifecycle.
        it('REG-ADM-MOD-009 | Flagging WITHOUT a comment is refused and the result is unchanged', async () => {
            addFeature('Result Moderation'); addSeverity('normal')
            await ModerationPage.openModeration()
            const before = await ModerationPage.rowStatus(fx.subjectName)
            expect(await ModerationPage.flag(fx.subjectName, '')).toMatch(/Comment required/i)
            await ModerationPage.openModeration()
            expect(await ModerationPage.rowStatus(fx.subjectName)).toBe(before)
        })
    })
})
