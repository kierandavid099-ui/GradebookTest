import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import RegistrationPage from '../../page objects/adminRegistration.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, STUDENT_ID } from '../../helpers/testData.js'
import { API } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// Registration Management > Students: create, required fields, the
// transfer-only Previous School field, status toggle, search and view.
// Emeka (the shared student account) is only read — status toggling is
// done on this spec's own fixture student. Fixture students are named
// AutoAdm*<tag> and deleted in the after hook.

describe('REGRESSION — Admin Students', () => {

    const tag = randomString(5)
    const student = { firstName: `AutoAdm${tag}`, lastName: 'Student', gender: 'female' }
    let studentId

    // A 3s pause after every modal opens and before every save/close, so a
    // run can be followed by eye. SweetAlert dialogs count as modals too.
    const MODAL_PAUSE = 3000
    const pause = () => browser.pause(MODAL_PAUSE)
    const close = async () => {
        if (await browser.execute(() => !!document.querySelector('.modal.show'))) await pause()
        await RegistrationPage.closeModal()
    }
    const patched = ['waitModal', 'fillStudent', 'readAndConfirmSwal']

    before(async () => {
        // The modals open, fill and confirm inside page-object methods, so the
        // pauses ride on instance overrides that are dropped in after().
        // fillStudent is always followed by Save, so its pause is the
        // before-save one.
        const waitModal = RegistrationPage.waitModal.bind(RegistrationPage)
        RegistrationPage.waitModal = async (...args) => { await waitModal(...args); await pause() }
        const fillStudent = RegistrationPage.fillStudent.bind(RegistrationPage)
        RegistrationPage.fillStudent = async (...args) => { await fillStudent(...args); await pause() }
        // Text is read before the pause in case a result dialog closes itself.
        RegistrationPage.readAndConfirmSwal = async (timeout = 5000) => {
            const P = RegistrationPage
            if (!(await P.swal.waitForDisplayed({ timeout }).then(() => true, () => false))) return null
            const text = `${await P.swalTitle.getText().catch(() => '')} ${await P.swalText.getText().catch(() => '')}`.trim()
            await pause()
            if (await P.swalConfirmBtn.isDisplayed().catch(() => false)) await P.swalConfirmBtn.click()
            await P.swal.waitForDisplayed({ reverse: true, timeout: 5000 }).catch(() => {})
            return text
        }
        await LoginPage.loginAs(ADMIN_USER)
        await RegistrationPage.openOn('students')
    })

    afterEach(async () => { await close() })

    after(async () => {
        for (const m of patched) delete RegistrationPage[m]
        await RegistrationPage.openOn('students')
        const ids = await browser.execute(t => (window.ALL_STUDENTS || []).filter(s => s.name.includes(t)).map(s => s.id), tag)
        for (const id of ids) if (id !== STUDENT_ID) await AdminApi.destroy(`${API}/students/${id}`)
    })

    describe('List', () => {

        it('REG-ADM-STU-001 | The Students tab lists Emeka Okonkwo with stat cards', async () => {
            addFeature('Students'); addSeverity('blocker')
            await expect(await RegistrationPage.findStudent('Okonkwo')).toBeDisplayed()
            for (const label of ['Total Students', 'Male', 'Female', 'Active']) {
                await expect(RegistrationPage.statValue('students', label)).toHaveText(/^\d+$/)
            }
        })

        it('REG-ADM-STU-002 | The view modal shows a student\'s profile', async () => {
            addFeature('Students'); addSeverity('normal')
            await (await RegistrationPage.findStudent('Okonkwo')).$('button[data-bs-target="#mdl-view-student"]').click()
            await RegistrationPage.waitModal($('#mdl-view-student'))
            await expect($('#vs-name')).toHaveText(/Emeka/)
        })
    })

    describe('Add Student', () => {

        it('REG-ADM-STU-003 | A student without a first or last name is rejected', async () => {
            addFeature('Students'); addSeverity('critical')
            await RegistrationPage.fillStudent({ firstName: student.firstName, gender: 'female' })
            await RegistrationPage.saveStudentBtn.click()
            await expect(RegistrationPage.studentError).toHaveText(/First name and last name are required/i)
        })

        it('REG-ADM-STU-004 | A student without a gender is rejected', async () => {
            addFeature('Students'); addSeverity('critical')
            await RegistrationPage.fillStudent({ firstName: student.firstName, lastName: student.lastName })
            await RegistrationPage.saveStudentBtn.click()
            await expect(RegistrationPage.studentError).toHaveText(/Gender is required/i)
        })

        it('REG-ADM-STU-005 | Previous School only appears for a Transfer admission', async () => {
            addFeature('Students'); addSeverity('minor')
            await RegistrationPage.openCreateStudent()
            await expect(RegistrationPage.prevSchoolRow).not.toBeDisplayed()
            await RegistrationPage.admissionTypeSelect.selectByAttribute('value', 'transfer')
            await expect(RegistrationPage.prevSchoolRow).toBeDisplayed()
            await RegistrationPage.admissionTypeSelect.selectByAttribute('value', 'new_entry')
            await expect(RegistrationPage.prevSchoolRow).not.toBeDisplayed()
        })

        it('REG-ADM-STU-006 | A student with first name, last name and gender is created and listed', async () => {
            addFeature('Students'); addSeverity('blocker')
            expect(await RegistrationPage.createStudent(student)).toMatch(/Student added successfully/i)
            await RegistrationPage.openOn('students')
            await RegistrationPage.studentSearch.setValue(student.firstName)
            await expect(RegistrationPage.studentRow(student.firstName)).toBeDisplayed()
            studentId = await RegistrationPage.studentId(student.lastName, student.firstName)
            expect(studentId).toBeTruthy()
        })

        it('REG-ADM-STU-007 | A transfer student keeps the Previous School that was entered', async () => {
            addFeature('Students'); addSeverity('minor')
            const transfer = { firstName: `AutoAdmT${tag}`, lastName: 'Transfer', gender: 'male', admissionType: 'transfer', prevSchool: 'Old Town Primary' }
            await RegistrationPage.createStudent(transfer)
            await RegistrationPage.openOn('students')
            const data = JSON.parse(await RegistrationPage.studentRow(transfer.firstName).getAttribute('data-student'))
            expect(data.previous_school).toBe('Old Town Primary')
            expect(data.admission_type).toBe('transfer')
        })

        it('REG-ADM-STU-008 | HTML in a student name is shown as text', async () => {
            addFeature('Students'); addSeverity('normal')
            const xss = { firstName: `AutoAdmX${tag}<img src=x onerror=window.__xss=1>`, lastName: 'Xss', gender: 'male' }
            const msg = (await RegistrationPage.createStudent(xss)) ?? await RegistrationPage.studentError.getText().catch(() => '')
            await RegistrationPage.openOn('students')
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect($('#tbl-students img[onerror]')).not.toBeExisting()
            // Refusing the name, stripping the tag or showing it as text are
            // all safe. Names may be re-cased, so match on the lowercase tag
            // plus the Xss last name rather than "AutoAdmX".
            if (!/added successfully/i.test(msg)) return
            await RegistrationPage.findStudent(tag)
            const row = $(`//table[@id="tbl-students"]//tr[@data-student][contains(., "${tag}")][contains(., "Xss")]`)
            await expect(row).toBeDisplayed()
            await expect(row.$('img')).not.toBeExisting()
        })
    })

    describe('Status & search', () => {

        it('REG-ADM-STU-009 | Disabling a student flips the status and persists after reload', async () => {
            addFeature('Students'); addSeverity('normal')
            await RegistrationPage.openOn('students')
            await RegistrationPage.findStudent(student.firstName)
            const btn = RegistrationPage.studentToggleBtn(studentId)
            expect(await btn.getAttribute('data-status')).toBe('active')
            await btn.click()
            expect(await RegistrationPage.readAndConfirmSwal()).toMatch(/Disable/i)
            expect(await RegistrationPage.readAndConfirmSwal(10000)).toMatch(/Disabled/i)
            await RegistrationPage.openOn('students')
            expect(await RegistrationPage.studentToggleBtn(studentId).getAttribute('data-status')).toBe('inactive')
        })

        it('REG-ADM-STU-010 | Re-enabling the student flips it back to active', async () => {
            addFeature('Students'); addSeverity('normal')
            await RegistrationPage.findStudent(student.firstName)
            const btn = RegistrationPage.studentToggleBtn(studentId)
            expect(await btn.getAttribute('data-status')).toBe('inactive')
            await btn.click()
            expect(await RegistrationPage.readAndConfirmSwal()).toMatch(/Enable/i)
            expect(await RegistrationPage.readAndConfirmSwal(10000)).toMatch(/Enabled/i)
            await RegistrationPage.openOn('students')
            expect(await RegistrationPage.studentToggleBtn(studentId).getAttribute('data-status')).toBe('active')
        })

        it('REG-ADM-STU-011 | Search filters the list; no match shows "No students match your search"', async () => {
            addFeature('Students'); addSeverity('minor')
            await RegistrationPage.studentSearch.setValue('okonkwo')
            await expect(RegistrationPage.studentRow('Okonkwo')).toBeDisplayed()
            await RegistrationPage.studentSearch.setValue('zz-no-such-student-zz')
            await expect(RegistrationPage.studentEmptyRow).toHaveText(/No students match your search/i)
        })
    })
})
