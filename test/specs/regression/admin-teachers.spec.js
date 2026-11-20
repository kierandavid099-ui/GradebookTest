import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeachersPage from '../../page objects/adminTeachers.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, TEACHER_USER } from '../../helpers/testData.js'
import { randomString, randomEmail, randomPhone } from '../../helpers/random.js'

// Teacher Management > Teachers: create, required fields, auto staff
// number, duplicates and search. Every teacher made here is named
// AutoAdm-<tag> and deleted in the after hook; Chisom is only read.

describe('REGRESSION — Admin Teachers', () => {

    const tag = randomString(5)
    const teacher = { firstName: `AutoAdm${tag}`, lastName: 'Teacher', email: randomEmail('auto-adm-tch'), telephone: randomPhone() }

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await TeachersPage.openOn('teachers')
    })

    afterEach(async () => { await TeachersPage.closeModal() })

    after(async () => {
        await TeachersPage.openOn('teachers')
        const ids = await browser.execute(t => [...document.querySelectorAll('.btn-edit-teacher')]
            .filter(b => (b.dataset.firstName || '').includes(t)).map(b => b.dataset.id), tag)
        for (const id of ids) await AdminApi.deleteTeacher(id)
    })

    describe('List', () => {

        it('REG-ADM-TCR-001 | Teachers tab lists Chisom Okafor with her staff number', async () => {
            addFeature('Teachers'); addSeverity('blocker')
            await expect(TeachersPage.row('Okafor, Chisom')).toBeDisplayed()
            await expect(TeachersPage.row('Okafor, Chisom')).toHaveText(/TCH\d+/)
        })

        it('REG-ADM-TCR-002 | Stat cards show total, full-time, part-time and form-teacher counts', async () => {
            addFeature('Teachers'); addSeverity('minor')
            for (const label of ['Total Teachers', 'Full Time', 'Part Time', 'Form Teachers']) {
                await expect(TeachersPage.statValue(label)).toHaveText(/^\d+$/)
            }
        })

        it('REG-ADM-TCR-003 | The view modal shows a teacher\'s contact and employment details', async () => {
            addFeature('Teachers'); addSeverity('normal')
            const id = await TeachersPage.teacherIdByEmail(TEACHER_USER.email)
            await $(`.btn-view-teacher[data-id="${id}"]`).click()
            await $('#mdl-view-teacher').waitForDisplayed({ timeout: 5000 })
            await expect($('#vt-name')).toHaveText(/Chisom/)
            await expect($('#vt-email')).toHaveText(TEACHER_USER.email)
        })
    })

    describe('Add Teacher', () => {

        it('REG-ADM-TCR-004 | Staff Number is not an input — it says "Auto-generated on save"', async () => {
            addFeature('Teachers'); addSeverity('normal')
            await TeachersPage.openCreateModal()
            await expect(TeachersPage.staffNumberPlaceholder).toHaveText(/Auto-generated on save/i)
            await expect($('#ct-staff-number')).not.toBeExisting()
        })

        it('REG-ADM-TCR-005 | A teacher without a personal email is rejected', async () => {
            addFeature('Teachers'); addSeverity('critical')
            await TeachersPage.fillTeacher({ ...teacher, email: '' })
            await TeachersPage.createBtn.click()
            await expect(TeachersPage.createError).toHaveText(/personal email and telephone are required/i)
        })

        it('REG-ADM-TCR-006 | A teacher without a telephone is rejected', async () => {
            addFeature('Teachers'); addSeverity('critical')
            await TeachersPage.fillTeacher({ ...teacher, telephone: '' })
            await TeachersPage.createBtn.click()
            await expect(TeachersPage.createError).toHaveText(/required/i)
        })

        it('REG-ADM-TCR-007 | A teacher without a first name is rejected', async () => {
            addFeature('Teachers'); addSeverity('normal')
            await TeachersPage.fillTeacher({ ...teacher, firstName: '' })
            await TeachersPage.createBtn.click()
            await expect(TeachersPage.createError).toHaveText(/required/i)
        })

        it('REG-ADM-TCR-008 | A teacher with all required fields is created and listed', async () => {
            addFeature('Teachers'); addSeverity('blocker')
            // The save (account + welcome mail) can outlast the alert wait, so
            // judge success by the list after a reload rather than the alert.
            await TeachersPage.createTeacher(teacher)
            await TeachersPage.openOn('teachers')
            await TeachersPage.editBtnByEmail(teacher.email).waitForExist({ timeout: 20000 })
            await expect(TeachersPage.row(`Teacher, ${teacher.firstName}`)).toBeExisting()
        })

        it('REG-ADM-TCR-009 | The new teacher is given a generated staff number', async () => {
            addFeature('Teachers'); addSeverity('critical')
            const staffNo = await TeachersPage.editBtnByEmail(teacher.email).getAttribute('data-staff-number')
            expect(staffNo).toMatch(/^TCH\d+$/)
            await expect(TeachersPage.row(`Teacher, ${teacher.firstName}`)).toHaveText(new RegExp(staffNo))
        })

        it('REG-ADM-TCR-010 | A second teacher with the same personal email is rejected', async () => {
            addFeature('Teachers'); addSeverity('critical')
            await TeachersPage.fillTeacher({ ...teacher, firstName: `AutoAdm${tag}Dup`, telephone: randomPhone() })
            await TeachersPage.createBtn.click()
            const accepted = await TeachersPage.readAndConfirmSwal(5000)
            expect(accepted).toBeNull()
            // Must be refused for the email, not by a "Server Error".
            await expect(TeachersPage.createError).toHaveText(/email/i)
        })

        it('REG-ADM-TCR-011 | A malformed personal email is rejected', async () => {
            addFeature('Teachers'); addSeverity('normal')
            await TeachersPage.fillTeacher({ ...teacher, firstName: `AutoAdm${tag}Bad`, email: 'not-an-email', telephone: randomPhone() })
            await TeachersPage.createBtn.click()
            const accepted = await TeachersPage.readAndConfirmSwal(5000)
            // DEFECT: "not-an-email" is accepted ("Teacher added successfully")
            // and the teacher is created with it as the personal email.
            expect(accepted).toBeNull()
            await expect(TeachersPage.createError).toHaveText(/email/i)
        })

        it('REG-ADM-TCR-012 | HTML in a teacher name is shown as text', async () => {
            addFeature('Teachers'); addSeverity('normal')
            const xss = { firstName: `AutoAdm${tag}<img src=x onerror=window.__xss=1>`, lastName: 'Xss', email: randomEmail('auto-adm-tchx'), telephone: randomPhone() }
            expect(await TeachersPage.createTeacher(xss)).toMatch(/added successfully/i)
            await TeachersPage.openOn('teachers')
            // Escaping and stripping the tags are both safe, so check that no
            // markup ran or was rendered rather than the exact stored name.
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect(TeachersPage.rowByEmail(xss.email)).toBeExisting()
            await expect(TeachersPage.rowByEmail(xss.email)).toHaveText(new RegExp(`Xss, AutoAdm${tag}`))
            await expect(TeachersPage.rowByEmail(xss.email).$('.teacher-name img')).not.toBeExisting()
        })
    })

    describe('Search', () => {

        it('REG-ADM-TCR-013 | Searching narrows the list to matching teachers', async () => {
            addFeature('Teachers'); addSeverity('minor')
            await TeachersPage.openOn('teachers')
            await TeachersPage.searchInput.setValue(teacher.firstName)
            await expect(TeachersPage.rowByEmail(teacher.email)).toBeDisplayed()
            await expect(TeachersPage.row('Okafor, Chisom')).not.toBeDisplayed()
        })
    })
})
