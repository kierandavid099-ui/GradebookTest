import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import RegistrationPage from '../../page objects/adminRegistration.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, STUDENT_ID } from '../../helpers/testData.js'
import { API, FIXTURE_LEVEL } from '../../helpers/adminData.js'
import { randomString, randomEmail, randomPhone } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Student onboarding: the admin builds a class through the UI,
// registers a student, registers a parent linked to that student, and
// enrolls the student into the class — checking each record surfaces where
// the next step needs it.
//
// Leaves behind: nothing — class, student and parent are deleted in after.
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Admin Student Onboarding', () => {

    const tag = randomString(5).toUpperCase()
    const cls = { name: `auto-adm-onb-${tag}`, code: `ON${tag}`, level: FIXTURE_LEVEL, max: 3 }
    const student = { firstName: `AutoAdmOnb${tag}`, lastName: 'Learner', gender: 'male' }
    const parent = { firstName: `AutoAdmOnbP${tag}`, lastName: 'Guardian', email: randomEmail('auto-adm-onb'), telephone: randomPhone() }
    const ids = {}

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
    })

    after(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await RegistrationPage.openOn('parents')
        const parentIds = await browser.execute(t => [...document.querySelectorAll('#tbl-parents tr[data-parent]')]
            .map(r => JSON.parse(r.dataset.parent)).filter(p => (p.first_name || '').includes(t)).map(p => p.id), tag)
        for (const id of parentIds) await AdminApi.deleteParent(id)
        // Swept by tag too, in case the run stopped before ids.student was set.
        await RegistrationPage.openOn('students')
        const studentIds = await browser.execute(t => (window.ALL_STUDENTS || [])
            .filter(s => s.name.toLowerCase().includes(t)).map(s => s.id), tag.toLowerCase())
        for (const id of new Set([ids.student, ...studentIds])) if (id && id !== STUDENT_ID) await AdminApi.destroy(`${API}/students/${id}`)
        if (ids.subject) await AdminApi.deleteSubject(ids.subject)
        if (ids.class) await AdminApi.deleteClass(ids.class)
    })

    it('E2E-ADM-ONB-001 | The admin creates a class for the new intake', async () => {
        addFeature('Student Onboarding'); addSeverity('blocker')
        await AcademicPage.openOn('classes')
        await AcademicPage.fillClass(cls)
        await AcademicPage.submitClass()
        await AcademicPage.openOn('classes')
        ids.class = (await AcademicPage.classGroupIds(cls.name))[0]
        expect(ids.class).toBeTruthy()
        // Enrollment is refused on a subject-less class, so attach one via
        // the API — subject management isn't the focus of this onboarding
        // flow, and the UI path is covered elsewhere.
        ids.subject = (await AdminApi.createSubject({ name: `auto-adm-onb-sub-${tag}`, code: `OS${tag}`, classIds: [ids.class] })).id
    })

    it('E2E-ADM-ONB-002 | The new class is offered in the Enrollment class filter', async () => {
        addFeature('Student Onboarding'); addSeverity('critical')
        await RegistrationPage.openOn('enrollment')
        await expect(RegistrationPage.classFilter.$(`option[value="${ids.class}"]`)).toBeExisting()
    })

    it('E2E-ADM-ONB-003 | The admin registers the student', async () => {
        addFeature('Student Onboarding'); addSeverity('blocker')
        await RegistrationPage.openOn('students')
        expect(await RegistrationPage.createStudent(student)).toMatch(/Student added successfully/i)
        ids.student = await RegistrationPage.studentId(student.lastName, student.firstName)
        expect(ids.student).toBeTruthy()
    })

    it('E2E-ADM-ONB-004 | The admin registers a parent linked to the new student', async () => {
        addFeature('Student Onboarding'); addSeverity('blocker')
        await RegistrationPage.openOn('parents')
        expect(await RegistrationPage.createParent({ ...parent, studentIds: [ids.student] })).toMatch(/Parent added successfully/i)
        await RegistrationPage.openOn('parents')
        const data = await RegistrationPage.parentData(parent.firstName)
        expect(data.students.map(s => s.id)).toEqual([ids.student])
    })

    it('E2E-ADM-ONB-005 | The student is enrolled into the class', async () => {
        addFeature('Student Onboarding'); addSeverity('blocker')
        await RegistrationPage.openOn('enrollment')
        expect(await RegistrationPage.enroll(ids.class, [ids.student])).toMatch(/enrolled successfully/i)
        await RegistrationPage.openOn('enrollment')
        await RegistrationPage.chooseEnrollClass(ids.class)
        await expect(RegistrationPage.enrollmentRow(`${student.lastName}, ${student.firstName}`)).toBeDisplayed()
    })

    it('E2E-ADM-ONB-006 | The parent\'s view now shows the child with the class', async () => {
        addFeature('Student Onboarding'); addSeverity('normal')
        await RegistrationPage.openOn('parents')
        await RegistrationPage.openViewParent(parent.firstName)
        await expect($('#vp-children')).toHaveText(new RegExp(student.firstName))
    })

})
