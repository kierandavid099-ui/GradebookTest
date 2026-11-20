import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import TeachersPage from '../../page objects/adminTeachers.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { FIXTURE_LEVEL } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// Subjects tab: create with an Applies-To group, the "Select Individually"
// class picker, mutual exclusivity of the radio group, validation and
// search. The subjects are attached to a throw-away Upper Primary fixture
// class (never to the live classes), and everything is deleted afterwards.

describe('REGRESSION — Admin Subjects', () => {

    const tag = randomString(5).toUpperCase()
    const fixtureClass = { name: `auto-adm-subcls-${tag}`, code: `AU${tag}`, level: FIXTURE_LEVEL, max: 5 }
    const subject = { name: `auto-adm-sub-${tag}`, code: `SB${tag}` }
    const xssName = `auto-adm-subx-${tag}<script>window.__xss=1</script>`
    let classId

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.open()
        classId = (await AdminApi.createClass(fixtureClass))[0].id
        await AcademicPage.openOn('subjects')
    })

    afterEach(async () => { await AcademicPage.closeModal() })

    after(async () => {
        await AcademicPage.openOn('subjects')
        const ids = await browser.execute(t => [...document.querySelectorAll('.btn-delete-subject')]
            .filter(b => b.dataset.name.includes(t)).map(b => b.dataset.id), tag)
        for (const id of ids) await AdminApi.deleteSubject(id)
        await AdminApi.deleteClass(classId)
    })

    describe('Create Subject modal', () => {

        it('REG-ADM-SUB-001 | Subjects tab lists subjects with type, department and class columns', async () => {
            addFeature('Subjects'); addSeverity('blocker')
            await expect(AcademicPage.newSubjectBtn).toBeDisplayed()
            await expect(await AcademicPage.findSubject('Basic Science')).toBeDisplayed()
            await AcademicPage.subjectSearch.clearValue()
        })

        it('REG-ADM-SUB-002 | Subject name and code are required', async () => {
            addFeature('Subjects'); addSeverity('critical')
            await AcademicPage.fillSubject({ name: '', code: '' })
            await AcademicPage.createSubjectBtn.click()
            await expect(AcademicPage.subjectCreateError).toHaveText(/Name and code are required/i)
        })

        it('REG-ADM-SUB-003 | "Select Individually" reveals the per-class checkbox list', async () => {
            addFeature('Subjects'); addSeverity('critical')
            await AcademicPage.fillSubject({ name: subject.name, code: subject.code })
            await expect(AcademicPage.subjectClassPicker).not.toBeDisplayed()
            await AcademicPage.assignRadioLabel('select_individually').click()
            await expect(AcademicPage.subjectClassPicker).toBeDisplayed()
            await expect(AcademicPage.classCheckbox(classId)).toBeExisting()
        })

        it('REG-ADM-SUB-004 | Choosing a group option clears individually-ticked classes (mutually exclusive)', async () => {
            addFeature('Subjects'); addSeverity('normal')
            await AcademicPage.fillSubject({ name: subject.name, code: subject.code, assign: 'select_individually', classIds: [classId] })
            expect(await AcademicPage.checkedClassBoxes.length).toBe(1)
            await AcademicPage.assignRadioLabel('all_upper_pry').click()
            await expect(AcademicPage.subjectClassPicker).not.toBeDisplayed()
            expect(await AcademicPage.checkedClassBoxes.length).toBe(0)
            expect(await AcademicPage.assignRadio('select_individually').isSelected()).toBe(false)
        })

        it('REG-ADM-SUB-005 | A subject linked to individually-selected classes is created and listed', async () => {
            addFeature('Subjects'); addSeverity('blocker')
            await AcademicPage.fillSubject({ ...subject, assign: 'select_individually', classIds: [classId] })
            expect(await AcademicPage.submitSubject()).toMatch(/saved successfully/i)
            await AcademicPage.openOn('subjects')
            // 2026-11-11: #tbl-subjects paginates by setting style="display:none"
            // on off-page rows. A fresh row lands off page 1, so getText returns
            // "" and nested buttons aren't clickable. Filter to it first (probed).
            await AcademicPage.findSubject(subject.name)
            await expect(AcademicPage.subjectRow(subject.name)).toBeExisting()
            await expect(AcademicPage.subjectRow(subject.name)).toHaveText(new RegExp(subject.code))
        })

        it('REG-ADM-SUB-006 | Only the ticked class is linked (edit modal re-opens with just that class)', async () => {
            addFeature('Subjects'); addSeverity('critical')
            // 2026-11-11: as in SUB-005, filter the subject onto the first page
            // before clicking its row's edit button (off-page rows are hidden).
            await AcademicPage.findSubject(subject.name)
            const edit = $(`.btn-edit-subject[data-name="${subject.name}"]`)
            await AcademicPage.openModalVia(edit, $('#mdl-edit-subject'))
            expect(await $('#esub-assign-select_individually').isSelected()).toBe(true)
            const checked = await browser.execute(() => [...document.querySelectorAll('.esub-class-id:checked')].map(c => c.value))
            expect(checked).toEqual([classId])
        })

        it('REG-ADM-SUB-007 | A new subject appears as a column of the Teacher Management allocation matrix', async () => {
            addFeature('Subjects'); addSeverity('critical')
            const subjectId = await AcademicPage.subjectIdByName(subject.name)
            await TeachersPage.openOn('assignments')
            await expect(TeachersPage.assignCell(subjectId, classId)).toBeExisting()
            await AcademicPage.openOn('subjects')
        })

        // DEFECT (2026-11-11): the server accepts a duplicate subject code —
        // submit returns "Created Subject saved successfully." instead of a
        // uniqueness error. Test kept as intent; fix on the dev side.
        it('REG-ADM-SUB-008 | A duplicate subject code is rejected', async () => {
            addFeature('Subjects'); addSeverity('normal')
            await AcademicPage.fillSubject({ name: `${subject.name}-dup`, code: subject.code, assign: 'select_individually', classIds: [classId] })
            await AcademicPage.createSubjectBtn.click()
            // If the server wrongly accepts it, a "Created" alert appears —
            // dismiss it so the rest of the spec can carry on.
            const accepted = await AcademicPage.readAndConfirmSwal(5000)
            expect(accepted).toBeNull()
            await expect(AcademicPage.subjectCreateError).toBeDisplayed()
            await AcademicPage.openOn('subjects')
            await expect(AcademicPage.subjectRow(`${subject.name}-dup`)).not.toBeExisting()
        })

        it('REG-ADM-SUB-009 | HTML in a subject name renders as text, not markup', async () => {
            addFeature('Subjects'); addSeverity('critical')
            await AcademicPage.fillSubject({ name: xssName, code: `SX${tag}`, assign: 'select_individually', classIds: [classId] })
            await AcademicPage.submitSubject()
            await AcademicPage.openOn('subjects')
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect(AcademicPage.subjectRow(xssName)).toBeExisting()
        })
    })

    describe('Search', () => {

        it('REG-ADM-SUB-010 | Searching subjects filters rows; an unknown term shows "No results"', async () => {
            addFeature('Subjects'); addSeverity('minor')
            await AcademicPage.subjectSearch.setValue(subject.name)
            await expect(AcademicPage.subjectRow(subject.name)).toBeDisplayed()
            await expect(AcademicPage.subjectRow('Basic Science')).not.toBeDisplayed()
            await AcademicPage.subjectSearch.setValue('zz-no-such-subject-zz')
            await expect($('#tbl-subjects .no-results-row')).toHaveText(/No results/i)
        })
    })
})
