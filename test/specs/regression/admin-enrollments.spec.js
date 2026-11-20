import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import RegistrationPage from '../../page objects/adminRegistration.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { API, FIXTURE_LEVEL } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// Registration Management > Enrollment, plus the capacity figures on the
// Academic Management Classes tab. All on fixtures: a 1-seat class (for the
// overflow guard), a 3-arm class (capacity arithmetic), three students and
// the moderation-style graded fixture for the "has grades" unenroll guard.
// Every fixture is deleted in the after hook.
//
// Selector assumption (no enrollments existed when the page was mapped):
// enrollment rows carry data-enr-class and an onclick="confirmUnenroll(…)"
// button, as the page script expects.
//
// The server refuses to enroll into a class with no subjects, so the 1-seat
// class gets a fixture subject.

describe('REGRESSION — Admin Enrollments & Capacity', () => {

    const tag = randomString(5).toUpperCase()
    const fx = { students: [] }
    const stat = async (label) => Number(await AcademicPage.statValue('classes', label).getText())
    const name = (i) => `Fixture${i}${tag}, Enrol`

    // A 3s pause after every modal opens and before every save/close, so a
    // run can be followed by eye. SweetAlert dialogs count as modals too.
    const MODAL_PAUSE = 3000
    const pause = () => browser.pause(MODAL_PAUSE)
    const close = async () => {
        if (await browser.execute(() => !!document.querySelector('.modal.show'))) await pause()
        await RegistrationPage.closeModal()
    }
    const patched = [
        [RegistrationPage, ['waitModal', 'fillEnroll', 'readAndConfirmSwal']],
        [AcademicPage, ['openModalVia', 'fillClass', 'readAndConfirmSwal']],
    ]

    // The unenroll confirm has closeOnConfirm: false, so the result dialog
    // replaces it in place rather than opening after it closes. Confirm,
    // wait for the title to change, then read the result.
    const confirmUnenroll = async () => {
        await RegistrationPage.swal.waitForDisplayed({ timeout: 5000 })
        const ask = await RegistrationPage.swalTitle.getText()
        await pause()
        await RegistrationPage.swalConfirmBtn.click()
        await browser.waitUntil(async () => (await RegistrationPage.swalTitle.getText().catch(() => '')) !== ask,
            { timeout: 15000, timeoutMsg: `Unenroll result never replaced "${ask}"` })
        return RegistrationPage.readAndConfirmSwal(10000)
    }

    before(async () => {
        // The modals open, fill and confirm inside page-object methods, so the
        // pauses ride on instance overrides that are dropped in after().
        // fillEnroll and fillClass are always followed by Save, so their
        // pause is the before-save one.
        for (const P of [RegistrationPage, AcademicPage]) {
            const open = P === RegistrationPage ? 'waitModal' : 'openModalVia'
            const fill = P === RegistrationPage ? 'fillEnroll' : 'fillClass'
            for (const m of [open, fill]) {
                const orig = P[m].bind(P)
                P[m] = async (...args) => { await orig(...args); await pause() }
            }
            // Text is read before the pause in case a result dialog closes itself.
            P.readAndConfirmSwal = async (timeout = 5000) => {
                if (!(await P.swal.waitForDisplayed({ timeout }).then(() => true, () => false))) return null
                const text = `${await P.swalTitle.getText().catch(() => '')} ${await P.swalText.getText().catch(() => '')}`.trim()
                await pause()
                if (await P.swalConfirmBtn.isDisplayed().catch(() => false)) await P.swalConfirmBtn.click()
                await P.swal.waitForDisplayed({ reverse: true, timeout: 5000 }).catch(() => {})
                return text
            }
        }
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        const termId = await AcademicPage.currentTermId()
        fx.tiny = (await AdminApi.createClass({ name: `auto-adm-enr1-${tag}`, code: `EN1${tag}`, level: FIXTURE_LEVEL, max: 1 }))[0].id
        fx.subject = (await AdminApi.createSubject({ name: `auto-adm-enr-sub-${tag}`, code: `ENS${tag}`, classIds: [fx.tiny] })).id
        for (let i = 0; i < 3; i++) fx.students.push((await AdminApi.createStudent({ firstName: 'Enrol', lastName: `Fixture${i}${tag}` })).id)
        fx.graded = await AdminApi.moderationFixture(`E${tag}`, termId)
        await RegistrationPage.openOn('enrollment')
    })

    afterEach(async () => { await close() })

    after(async () => {
        for (const [P, methods] of patched) for (const m of methods) delete P[m]
        await LoginPage.loginAs(ADMIN_USER)
        if (fx.subject) await AdminApi.deleteSubject(fx.subject)
        await AcademicPage.openOn('classes')
        const ids = await browser.execute(t => [...document.querySelectorAll('.btn-delete-group')]
            .filter(b => b.dataset.name.includes(t)).flatMap(b => JSON.parse(b.dataset.ids)), tag)
        for (const id of ids) await AdminApi.deleteClass(id)
        for (const id of fx.students) await AdminApi.destroy(`${API}/students/${id}`)
        await AdminApi.cleanupModerationFixture(fx.graded)
    })

    describe('Enroll', () => {

        it('REG-ADM-ENR-001 | The Enroll button stays disabled until a class is chosen', async () => {
            addFeature('Enrollments'); addSeverity('normal')
            expect(await RegistrationPage.openEnrollBtn.isEnabled()).toBe(false)
            await RegistrationPage.chooseEnrollClass(fx.tiny)
            expect(await RegistrationPage.openEnrollBtn.isEnabled()).toBe(true)
        })

        it('REG-ADM-ENR-002 | Enrolling with nobody ticked asks for at least one student', async () => {
            addFeature('Enrollments'); addSeverity('minor')
            await RegistrationPage.openEnrollBtn.click()
            await RegistrationPage.waitModal(RegistrationPage.enrollModal)
            await pause()
            await RegistrationPage.doEnrollBtn.click()
            await expect(RegistrationPage.enrollError).toHaveText(/select at least one student/i)
            await close()
        })

        it('REG-ADM-ENR-003 | Enrolling a student decrements Available Spots and increments Total Enrolled', async () => {
            addFeature('Enrollments'); addSeverity('blocker')
            await AcademicPage.openOn('classes')
            const [spots, enrolled] = [await stat('Available Spots'), await stat('Total Enrolled')]
            await RegistrationPage.openOn('enrollment')
            expect(await RegistrationPage.enroll(fx.tiny, [fx.students[0]])).toMatch(/enrolled successfully/i)
            await AcademicPage.openOn('classes')
            expect(await stat('Available Spots')).toBe(spots - 1)
            expect(await stat('Total Enrolled')).toBe(enrolled + 1)
        })

        it('REG-ADM-ENR-004 | The enrollment is listed under its class on the Enrollment tab', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            await RegistrationPage.openOn('enrollment')
            await RegistrationPage.chooseEnrollClass(fx.tiny)
            await expect(RegistrationPage.enrollmentRow(name(0))).toBeDisplayed()
            await expect(RegistrationPage.enrollCountLabel).toHaveText('1 enrollment')
        })

        it('REG-ADM-ENR-005 | An already-enrolled student is not offered again for the same class', async () => {
            addFeature('Enrollments'); addSeverity('normal')
            await RegistrationPage.openEnrollBtn.click()
            await RegistrationPage.waitModal(RegistrationPage.enrollModal)
            await expect(RegistrationPage.enrollCheckbox(fx.students[0])).not.toBeExisting()
            await close()
        })

        it('REG-ADM-ENR-006 | Enrolling beyond the arm\'s capacity is blocked with a capacity message', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            const text = await RegistrationPage.enroll(fx.tiny, [fx.students[1]])
            const inline = await RegistrationPage.enrollError.isDisplayed().catch(() => false)
            expect(inline ? await RegistrationPage.enrollError.getText() : text).toMatch(/capacity|full|spots|exceed/i)
            await close()
            await RegistrationPage.openOn('enrollment')
            await RegistrationPage.chooseEnrollClass(fx.tiny)
            await expect(RegistrationPage.enrollCountLabel).toHaveText('1 enrollment')
        })
    })

    describe('Capacity', () => {

        it('REG-ADM-ENR-007 | Total Capacity grows by exactly the sum of a new class\'s arm caps (3 × 4)', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            await RegistrationPage.openOn('enrollment')
            const before = Number(await RegistrationPage.capacityStat.getText())
            await AcademicPage.openOn('classes')
            const beforeAcad = await stat('Total Capacity')
            await AcademicPage.fillClass({ name: `auto-adm-enr3-${tag}`, code: `EN3${tag}`, level: FIXTURE_LEVEL, arms: 'A, B, C', max: 4 })
            await AcademicPage.submitClass()
            await AcademicPage.openOn('classes')
            expect(await AcademicPage.classCap(`auto-adm-enr3-${tag}`)).toBe(12)
            expect(await stat('Total Capacity')).toBe(beforeAcad + 12)
            await RegistrationPage.openOn('enrollment')
            expect(Number(await RegistrationPage.capacityStat.getText())).toBe(before + 12)
        })

        it('REG-ADM-ENR-008 | Editing the per-arm cap recomputes the class and school totals (3 × 5)', async () => {
            addFeature('Enrollments'); addSeverity('normal')
            await AcademicPage.openOn('classes')
            const before = await stat('Total Capacity')
            await AcademicPage.findClass(`auto-adm-enr3-${tag}`)
            await AcademicPage.openModalVia(AcademicPage.classGroupEditBtn(`auto-adm-enr3-${tag}`), AcademicPage.editGroupModal)
            await AcademicPage.editGroupMaxInput.setValue('5')
            await pause()
            await AcademicPage.updateGroupBtn.click()
            await AcademicPage.readAndConfirmSwal(15000)
            await AcademicPage.openOn('classes')
            expect(await AcademicPage.classCap(`auto-adm-enr3-${tag}`)).toBe(15)
            expect(await stat('Total Capacity')).toBe(before + 3)
        })

        it('REG-ADM-ENR-009 | The Classes tab and Enrollment tab agree on Total Capacity', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            await AcademicPage.openOn('classes')
            const acad = await stat('Total Capacity')
            await RegistrationPage.openOn('enrollment')
            expect(Number(await RegistrationPage.capacityStat.getText())).toBe(acad)
        })
    })

    describe('Unenroll', () => {

        it('REG-ADM-ENR-010 | Unenrolling a student with grades is blocked and they stay enrolled', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            const g = fx.graded
            await GradeEntryPage.openSheet(g.classId, g.subjectId)
            await GradeEntryPage.enterScores(g.studentId, [20, 30])
            await GradeEntryPage.save()
            await RegistrationPage.openOn('enrollment')
            await RegistrationPage.chooseEnrollClass(g.classId)
            await RegistrationPage.unenrollBtn(`${g.studentLast}, ${g.studentFirst}`).click()
            expect(await confirmUnenroll()).toMatch(/Error|grades|cannot/i)
            await RegistrationPage.openOn('enrollment')
            await RegistrationPage.chooseEnrollClass(g.classId)
            await expect(RegistrationPage.enrollmentRow(`${g.studentLast}, ${g.studentFirst}`)).toBeDisplayed()
        })

        it('REG-ADM-ENR-011 | Unenrolling a student with no grades succeeds and frees the spot', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            await AcademicPage.openOn('classes')
            const spots = await stat('Available Spots')
            await RegistrationPage.openOn('enrollment')
            await RegistrationPage.chooseEnrollClass(fx.tiny)
            await RegistrationPage.unenrollBtn(name(0)).click()
            expect(await confirmUnenroll()).toMatch(/unenrolled/i)
            await AcademicPage.openOn('classes')
            expect(await stat('Available Spots')).toBe(spots + 1)
        })
    })
})
