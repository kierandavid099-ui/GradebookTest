// Teacher-suite fixtures. The live school had no subject assigned to Chisom
// and no pupils in her form class, so nothing on the Teacher screens could
// be exercised without first setting some up as admin. ensure() makes that
// setup idempotent: it checks from Chisom's own dashboard first and only
// signs in as admin to create whatever is missing, through the same admin
// screens a person would use.
//
// What it may create (once — later runs reuse it):
//   subjects "auto-tch English" / "auto-tch Maths", Chisom's assignments to
//   them, pupils "Tchfixture, Ada/Bayo/Chidi" + "Tchzero, Tenblank/Allblank/
//   Examonly" and their Pri 2A enrolment. Graded pupils can't be unenrolled
//   or deleted on this app, so these are permanent by design.
// It never touches grading schemes, grade scales or Manage Settings — those
// belong to the admin suite.
import TeacherModulePage from './teacherModule.page.js'
import TeacherDashboardPage from './teacherDashboard.page.js'
import LoginPage from './login.page.js'
import TeacherGradeEntryPage from './teacherGradeEntry.page.js'
import TeacherModerationPage from './teacherModeration.page.js'
import { ADMIN_USER, TEACHER_USER } from '../helpers/testData.js'
import {
    FORM_CLASS_ID, FORM_CLASS_NAME, OTHER_CLASS_NAME, FIXTURE_SUBJECTS, ALL_FIXTURE_STUDENTS,
    FIXTURE_LAST_NAME, TEACHER_ID, studentListName,
} from '../helpers/teacherData.js'
import { uniqueName } from '../helpers/random.js'

const param = (href, key) => (href ? new URL(href).searchParams.get(key) : null)

class TeacherFixtures extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/academic-management', ADMIN_USER)
    }

    // Admin screens used for setup
    get subjectsTab() { return $('a[href="#tab_subjects"]') }
    get subjectsPane() { return $('#tab_subjects') }
    get newSubjectBtn() { return $('[data-bs-target="#mdl-create-subject"]') }
    get subjectModal() { return $('#mdl-create-subject') }
    get subjectNameInput() { return $('#csub-name') }
    get subjectCodeInput() { return $('#csub-code') }
    get subjectSelectIndividually() { return $('#csub-assign-select_individually') }
    subjectClassCheckbox(classId) { return $(`#csub-class-${classId}`) }
    get saveSubjectBtn() { return $('#btn-create-subject') }

    // Reads what Chisom can already see. Returns ids keyed by fixture, and
    // what (if anything) is missing.
    async inspectAsTeacher() {
        await TeacherDashboardPage.open()
        const subjects = await TeacherDashboardPage.subjectRows()
        const students = await TeacherDashboardPage.studentRows()
        const ids = {}
        const missingAssignments = []
        for (const [key, s] of Object.entries(FIXTURE_SUBJECTS)) {
            const rows = subjects.filter(r => r.subject === s.name)
            const formRow = rows.find(r => r.className === FORM_CLASS_NAME)
            ids[key] = param((formRow || rows[0] || {}).grades, 'sj')
            const wanted = key === 'english' ? [FORM_CLASS_NAME, OTHER_CLASS_NAME] : [FORM_CLASS_NAME]
            for (const c of wanted) if (!rows.find(r => r.className === c)) missingAssignments.push(`${s.name} @ ${c}`)
        }
        const missingStudents = ALL_FIXTURE_STUDENTS.filter(st => !students.find(r => r.name === studentListName(st.first, st.last)))
        return { ids, missingAssignments, missingStudents }
    }

    async ensure() {
        let state = await this.inspectAsTeacher()
        if (state.missingAssignments.length || state.missingStudents.length) {
            await LoginPage.loginAs(ADMIN_USER)
            await this.ensureSubjects()
            await this.ensureStudents()
            await this.ensureAssignments()
            await LoginPage.loginAs(TEACHER_USER)

            state = await this.inspectAsTeacher()
            if (state.missingAssignments.length || state.missingStudents.length) {
                throw new Error(`Teacher fixtures still missing: ${[...state.missingAssignments, ...state.missingStudents.map(s => s.first)].join(', ')}`)
            }
        }
        await this.ensureEnglishEditable(state.ids)
        return state.ids
    }

    // The suites keep English × Pri 2A as an editable draft, but it can be
    // submitted/approved by hand (it was found Approved on 26 Oct, every
    // score input disabled). If it is locked, the admin returns it.
    async ensureEnglishEditable(ids) {
        await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
        const locked = await browser.execute(() => !!document.querySelector('.ge-table .score-input:disabled'))
        if (!locked) return
        await LoginPage.loginAs(ADMIN_USER)
        await TeacherModerationPage.makeEditable(FORM_CLASS_NAME, FIXTURE_SUBJECTS.english.name, `auto-tch reset ${uniqueName('c')}`)
        await LoginPage.loginAs(TEACHER_USER)
    }

    async subjectIdByName(name) {
        return browser.execute((name) => {
            // The buttons used to carry name="…"; now they carry data-name="…".
            const btn = [...document.querySelectorAll('#tbl-subjects button[data-id]')]
                .find(b => (b.dataset.name ?? b.getAttribute('name')) === name)
            return btn ? btn.dataset.id : null
        }, name)
    }

    async ensureSubjects() {
        await this.open()
        await this.openTab(this.subjectsTab, this.subjectsPane)
        for (const s of Object.values(FIXTURE_SUBJECTS)) {
            if (await this.subjectIdByName(s.name)) continue
            await this.newSubjectBtn.click()
            await this.subjectModal.waitForDisplayed({ timeout: 5000 })
            await browser.pause(800) // modal fade-in; typing earlier gets lost
            await this.subjectNameInput.setValue(s.name)
            await this.subjectCodeInput.setValue(s.code)
            await this.subjectSelectIndividually.click()
            for (const cid of s.classIds) {
                const cb = this.subjectClassCheckbox(cid)
                await cb.waitForExist({ timeout: 5000 })
                if (!(await cb.isSelected())) await browser.execute(el => el.click(), await cb)
            }
            await this.saveSubjectBtn.click()
            await this.readAndConfirmSwal(10000) // "Created" → reloads the page
            await this.open()
            await this.openTab(this.subjectsTab, this.subjectsPane)
        }
    }

    // Registration Management → Students / Enrollment
    get studentsTable() { return $('#tbl-students') }
    get studentFirstName() { return $('#cs-first-name') }
    get studentLastName() { return $('#cs-last-name') }
    get studentGender() { return $('#cs-gender') }
    get saveStudentBtn() { return $('#btn-cs-save') }
    get enrollmentTab() { return $('a[href="#tab_enrollment"]') }
    get enrollmentPane() { return $('#tab_enrollment') }
    get enrollClassFilter() { return $('#enroll-class-filter') }
    get openEnrollBtn() { return $('#btn-open-enroll') }
    get enrollSearch() { return $('#enroll-search-students') }
    get enrollSelectedCount() { return $('#enroll-selected-count') }
    get doEnrollBtn() { return $('#btn-do-enroll') }

    get registrationPath() { return '/scola-gradebook2/registration-management' }

    // The Students table is paginated client-side (15 per page) and only the
    // current page is in the DOM, so filter it by name first.
    async searchStudents(text) {
        await browser.execute((t) => {
            const el = document.querySelector('#search-students')
            el.value = t
            el.dispatchEvent(new Event('input', { bubbles: true }))
        }, text)
        await browser.pause(300) // client-side filter runs on the input event
    }

    async studentExists(first, last = FIXTURE_LAST_NAME) {
        await this.searchStudents(last)
        return browser.execute((full) => [...document.querySelectorAll('#tbl-students tbody tr')]
            .some(tr => tr.innerText.includes(full)), `${last}, ${first}`)
    }

    async createStudent(first, last, gender) {
        await browser.execute(() => window.openCreateStudent())
        await this.studentFirstName.waitForDisplayed({ timeout: 5000 })
        await browser.pause(800) // modal fade-in; typing earlier gets lost
        // Only the required fields: on the live server adding an email,
        // session or entry class makes this endpoint return HTTP 500.
        await this.studentFirstName.setValue(first)
        await this.studentLastName.setValue(last)
        await this.studentGender.selectByAttribute('value', gender)
        await this.saveStudentBtn.click()
        await this.readAndConfirmSwal(10000)
        await this.openPath(this.registrationPath)
    }

    // Enrols every not-yet-enrolled pupil whose name matches `search` into
    // the form class — the enrol modal only lists pupils not already in it.
    async enrollIntoFormClass(search) {
        await this.openTab(this.enrollmentTab, this.enrollmentPane)
        await this.enrollClassFilter.selectByAttribute('value', FORM_CLASS_ID)
        await this.openEnrollBtn.waitForEnabled({ timeout: 5000 })
        await this.openEnrollBtn.click()
        await this.enrollSearch.waitForDisplayed({ timeout: 5000 })
        await this.enrollSearch.setValue(search.toLowerCase())
        await browser.execute(() => window.enrollSelectAll(true))
        if (Number(await this.enrollSelectedCount.getText()) > 0) {
            await this.doEnrollBtn.click()
            await this.readAndConfirmSwal(10000)
        } else {
            await this.closeModal()
        }
    }

    async ensureStudents() {
        await this.openPath(this.registrationPath)
        for (const st of ALL_FIXTURE_STUDENTS) {
            if (!(await this.studentExists(st.first, st.last))) await this.createStudent(st.first, st.last, st.gender)
        }
        for (const last of new Set(ALL_FIXTURE_STUDENTS.map(s => s.last))) await this.enrollIntoFormClass(last)
    }

    // Teacher Management → Assignments: clicking a matrix cell toggles that
    // subject × class for the selected teacher, so only click unassigned cells.
    get assignmentsTab() { return $('a[href="#tab_assignments"]') }
    get assignmentsPane() { return $('#tab_assignments') }
    assignCell(subjectId, classId) { return $(`.assign-cell[data-subject-id="${subjectId}"][data-class-id="${classId}"]`) }

    async ensureAssignments() {
        await this.open()
        await this.openTab(this.subjectsTab, this.subjectsPane)
        const subjectIds = {}
        for (const [key, s] of Object.entries(FIXTURE_SUBJECTS)) subjectIds[key] = await this.subjectIdByName(s.name)

        await this.openPath('/scola-gradebook2/teacher-management')
        await this.openTab(this.assignmentsTab, this.assignmentsPane)
        // The teacher picker is a TomSelect that no longer preselects Chisom
        // (it opened on Mrs. A. Abdullahi on 28 Oct), so choose her through
        // its API and wait for the matrix to show her existing assignments.
        await browser.execute((id) => {
            const el = document.querySelector('#assign-teacher-select')
            if (el.value === id) return
            if (el.tomselect) el.tomselect.setValue(id)
            else { el.value = id; el.dispatchEvent(new Event('change', { bubbles: true })) }
        }, TEACHER_ID)
        await browser.waitUntil(async () => browser.execute((id) =>
            document.querySelector('#assign-teacher-select').value === id && !!document.querySelector('.assign-cell.assigned'), TEACHER_ID),
        { timeout: 10000, timeoutMsg: 'Assignment matrix did not load Chisom' })
        for (const [key, s] of Object.entries(FIXTURE_SUBJECTS)) {
            for (const cid of s.assignedTo) {
                const cell = this.assignCell(subjectIds[key], cid)
                await cell.waitForExist({ timeout: 5000 })
                if ((await cell.getAttribute('class')).includes('assigned')) continue
                await cell.scrollIntoView({ block: 'center' })
                await cell.click()
                await browser.waitUntil(async () => (await cell.getAttribute('class')).includes('assigned'),
                    { timeout: 10000, timeoutMsg: `Assignment of ${s.name} did not save` })
            }
        }
    }
}

export default new TeacherFixtures()
