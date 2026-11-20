import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeachersPage from '../../page objects/adminTeachers.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, TEACHER_USER } from '../../helpers/testData.js'
import { API, FIXTURE_LEVEL, TEACHER_ID, FIXTURE_SCHEME_ITEMS } from '../../helpers/adminData.js'
import { randomString, randomEmail, randomPhone } from '../../helpers/random.js'

// Teacher Management > Subject Allocation matrix (subject × class × current
// term). Everything runs on fixtures: two Upper Primary classes, two
// subjects, one enrolled student and a second teacher ("B"). Chisom is
// allocated only to fixture cells — never unassigned from anything she
// already holds. The matrix always saves against the school's current term.
//
// If no default Upper Primary scheme exists, a 40/60 one is created so the
// fixture sheet has columns, and removed afterwards (the existing default
// one is reused otherwise — the teacher suites rely on it).
//
// Leaves behind: nothing (classes, subjects, student, teacher B, any
// created scheme are deleted in after) — except the fixture student's
// grade rows, which go with the class.

describe('REGRESSION — Admin Subject Allocation', () => {

    const tag = randomString(5).toUpperCase()
    const fx = {}
    const teacherB = { firstName: `AutoAdmB${tag}`, lastName: 'Alloc', email: randomEmail('auto-adm-alc'), telephone: randomPhone() }

    // Records the payload of the next /subject_teachers/assign request.
    const captureAssign = () => browser.execute(() => {
        const orig = $.ajax
        window.__assign = null
        $.ajax = function (opts) {
            if (opts && /subject_teachers\/assign/.test(opts.url)) window.__assign = opts.data
            return orig.apply(this, arguments)
        }
    })

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        fx.termId = await AcademicPage.currentTermId()
        fx.classA = (await AdminApi.createClass({ name: `auto-adm-alcA-${tag}`, code: `ALA${tag}`, level: FIXTURE_LEVEL, max: 5 }))[0].id
        fx.classB = (await AdminApi.createClass({ name: `auto-adm-alcB-${tag}`, code: `ALB${tag}`, level: FIXTURE_LEVEL, max: 5 }))[0].id
        fx.subject = (await AdminApi.createSubject({ name: `auto-adm-alc-sub-${tag}`, code: `ALS${tag}`, classIds: [fx.classA, fx.classB] })).id
        fx.subject2 = (await AdminApi.createSubject({ name: `auto-adm-alc-sub2-${tag}`, code: `AL2${tag}`, classIds: [fx.classA] })).id
        fx.student = (await AdminApi.createStudent({ firstName: 'Alloc', lastName: `Fixture${tag}` })).id
        await AdminApi.enroll(fx.classA, [fx.student])
        await AcademicPage.open()
        const hasDefault = await browser.execute(level => !!document.querySelector(`.btn-edit-scheme[data-default="1"][data-applies="${level}"]`), FIXTURE_LEVEL)
        if (!hasDefault) fx.scheme = (await AdminApi.createScheme({ name: `auto-adm-alc-sch-${tag}`, appliesTo: FIXTURE_LEVEL, items: FIXTURE_SCHEME_ITEMS })).id
        await TeachersPage.openOn('teachers')
        await TeachersPage.createTeacher(teacherB)
        await TeachersPage.openOn('teachers')
        fx.teacherB = await TeachersPage.teacherIdByEmail(teacherB.email)
        await TeachersPage.openOn('assignments')
    })

    after(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await TeachersPage.open()
        for (const [s, c] of [[fx.subject, fx.classA], [fx.subject, fx.classB], [fx.subject2, fx.classA]]) {
            await AdminApi.assignTeacher({ subjectId: s, classId: c, termId: fx.termId, teacherId: '' })
        }
        if (fx.teacherB) await AdminApi.deleteTeacher(fx.teacherB)
        for (const id of [fx.subject, fx.subject2]) if (id) await AdminApi.deleteSubject(id)
        for (const id of [fx.classA, fx.classB]) if (id) await AdminApi.deleteClass(id)
        if (fx.student) await AdminApi.destroy(`${API}/students/${fx.student}`)
        if (fx.scheme) await AdminApi.deleteScheme(fx.scheme)
    })

    describe('Matrix', () => {

        it('REG-ADM-ALC-001 | The matrix auto-selects a teacher and shows her staff ID and department', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            expect(await TeachersPage.teacherSelect.getValue()).toBeTruthy()
            await TeachersPage.selectTeacher(TEACHER_ID)
            await expect(TeachersPage.teacherMeta).toHaveText(/Staff ID: TCH\d+/)
        })

        it('REG-ADM-ALC-002 | Fixture subjects appear as matrix rows with one cell per linked class', async () => {
            addFeature('Subject Allocation'); addSeverity('normal')
            await expect(TeachersPage.assignCell(fx.subject, fx.classA)).toBeExisting()
            await expect(TeachersPage.assignCell(fx.subject, fx.classB)).toBeExisting()
        })

        it('REG-ADM-ALC-003 | Ticking a cell assigns the teacher with subject, class, current term and teacher ids', async () => {
            addFeature('Subject Allocation'); addSeverity('blocker')
            await TeachersPage.selectTeacher(TEACHER_ID)
            await captureAssign()
            await TeachersPage.toggleCell(fx.subject, fx.classA)
            const sent = await browser.execute(() => window.__assign)
            expect(sent).toMatchObject({ subject_id: fx.subject, grade_class_id: fx.classA, grade_term_id: fx.termId, teacher_id: TEACHER_ID })
            await expect(TeachersPage.summaryChips).toHaveText(new RegExp(`auto-adm-alc-sub-${tag}`))
        })

        it('REG-ADM-ALC-004 | The assignment persists after a reload', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            await TeachersPage.openOn('assignments')
            await TeachersPage.selectTeacher(TEACHER_ID)
            expect(await TeachersPage.isAssigned(fx.subject, fx.classA)).toBe(true)
        })

        it('REG-ADM-ALC-005 | The assignment is scoped to that subject × class — the other class is untouched', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            expect(await TeachersPage.isAssigned(fx.subject, fx.classB)).toBe(false)
            expect(await TeachersPage.isAssigned(fx.subject2, fx.classA)).toBe(false)
        })

        it('REG-ADM-ALC-006 | The class-subjects endpoint returns only the subjects the teacher is assigned', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            const res = await AdminApi.get(`${API}/class/${fx.classA}/subjects?teacher_id=${TEACHER_ID}`)
            expect(res.status).toBe(200)
            const ids = res.body.map(s => s.id)
            expect(ids).toContain(fx.subject)
            expect(ids).not.toContain(fx.subject2)
        })

        it('REG-ADM-ALC-007 | The assigned teacher sees the fixture subject in her Grade Entry list', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            await LoginPage.loginAs(TEACHER_USER)
            await GradeEntryPage.open()
            await expect(GradeEntryPage.teacherSubjectOption(fx.subject, fx.classA)).toBeExisting()
            await expect(GradeEntryPage.teacherSubjectOption(fx.subject, fx.classB)).not.toBeExisting()
        })

        it('REG-ADM-ALC-008 | The teacher can save a score for the fixture student (data used by the reassignment test)', async () => {
            addFeature('Subject Allocation'); addSeverity('normal')
            await GradeEntryPage.openSheet(fx.classA, fx.subject)
            await GradeEntryPage.enterScores(fx.student, [30])
            expect(await GradeEntryPage.save()).toMatch(/Saved/i)
            await LoginPage.loginAs(ADMIN_USER)
        })
    })

    describe('Unassign & reassign', () => {

        it('REG-ADM-ALC-009 | Mid-term reassignment: teacher B takes over the same subject × class × term cell', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            await TeachersPage.openOn('assignments')
            await TeachersPage.selectTeacher(fx.teacherB)
            await captureAssign()
            await TeachersPage.toggleCell(fx.subject, fx.classA)
            expect((await browser.execute(() => window.__assign)).teacher_id).toBe(fx.teacherB)
            await TeachersPage.openOn('assignments')
            await TeachersPage.selectTeacher(fx.teacherB)
            expect(await TeachersPage.isAssigned(fx.subject, fx.classA)).toBe(true)
            await TeachersPage.selectTeacher(TEACHER_ID)
            expect(await TeachersPage.isAssigned(fx.subject, fx.classA)).toBe(false)
        })

        it('REG-ADM-ALC-010 | Reassignment keeps the grades already entered for that subject × class', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            await GradeEntryPage.openSheet(fx.classA, fx.subject)
            const inputs = await GradeEntryPage.studentInputs(fx.student)
            expect(Number(await inputs[0].getValue())).toBe(30)
        })

        it('REG-ADM-ALC-011 | The previous teacher loses the cell straight away (endpoint and Grade Entry)', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            const res = await AdminApi.get(`${API}/class/${fx.classA}/subjects?teacher_id=${TEACHER_ID}`)
            expect(res.body.map(s => s.id)).not.toContain(fx.subject)
            await LoginPage.loginAs(TEACHER_USER)
            await GradeEntryPage.open()
            await expect(GradeEntryPage.teacherSubjectOption(fx.subject, fx.classA)).not.toBeExisting()
            await LoginPage.loginAs(ADMIN_USER)
        })

        it('REG-ADM-ALC-012 | Unticking an assigned cell sends an empty teacher_id and clears the cell', async () => {
            addFeature('Subject Allocation'); addSeverity('blocker')
            await TeachersPage.openOn('assignments')
            await TeachersPage.selectTeacher(fx.teacherB)
            await captureAssign()
            await TeachersPage.toggleCell(fx.subject, fx.classA)
            expect((await browser.execute(() => window.__assign)).teacher_id).toBe('')
            await TeachersPage.openOn('assignments')
            await TeachersPage.selectTeacher(fx.teacherB)
            expect(await TeachersPage.isAssigned(fx.subject, fx.classA)).toBe(false)
        })

        it('REG-ADM-ALC-013 | Clicking a cell with no teacher selected warns "Please select a teacher first"', async () => {
            addFeature('Subject Allocation'); addSeverity('minor')
            await browser.execute(() => document.querySelector('#assign-teacher-select').tomselect.clear())
            await TeachersPage.assignCell(fx.subject, fx.classB).click()
            expect(await TeachersPage.readAndConfirmSwal()).toMatch(/select a teacher first/i)
        })

        // Needs a school with no subjects at all — can't be arranged on the
        // shared server without deleting the live Basic Science subject.
        it.skip('REG-ADM-ALC-014 | With no subjects defined the matrix shows "Add subjects in Academic Management first"', async () => {
            addFeature('Subject Allocation'); addSeverity('minor')
            await expect(TeachersPage.matrixEmptyState).toBeDisplayed()
        })
    })
})
