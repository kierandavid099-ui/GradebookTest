import ModulePage from './modulePage.page.js'
import LoginPage from './login.page.js'
import { ADMIN_USER, PARENT_USER, STUDENT_ID } from '../helpers/testData.js'
import { PARENT_ID, LINKED_FIXTURE, UNLINKED_FIXTURE } from '../helpers/parentData.js'

// Admin → Registration Management, used by the parent suite only to set up
// its fixtures: create the fixture students and link them to Chinedu. Every
// helper here is idempotent (look first, create/link only if missing), so
// the parent specs can be re-run without piling up duplicate students.
class ParentRegistrationsPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/registration-management')
    }

    get studentsTab() { return $('a[href="#tab_students"]') }
    get parentsTab() { return $('a[href="#tab_parents"]') }
    get parentsPane() { return $('#tab_parents') }

    // Create Student modal
    get newStudentBtn() { return $('button[onclick="openCreateStudent()"]') }
    get createStudentModal() { return $('#mdl-create-student') }
    get csFirstName() { return $('#cs-first-name') }
    get csLastName() { return $('#cs-last-name') }
    get csGender() { return $('#cs-gender') }
    get csSaveBtn() { return $('#btn-cs-save') }
    get csError() { return $('#cs-error') }

    // Link Students modal
    get linkModal() { return $('#mdl-link-students') }
    get linkStudentSelect() { return $('#ls-student-select') }
    get linkAddBtn() { return $('button[onclick="lsLinkStudent()"]') }
    get linkSaveBtn() { return $('#btn-ls-save') }
    get linkedList() { return $('#ls-linked-list') }

    parentRow(email) { return $(`#tbl-parents tbody tr[data-search*="${email.toLowerCase()}"]`) }

    // The Link Students <select> lists every student in the school as
    // "Last, First" with data-name="First Last" — the cheapest place to map a
    // name to a student id without paging the Students table.
    async studentIdByName(firstName, lastName) {
        return browser.execute((name) => {
            const opt = [...document.querySelectorAll('#ls-student-select option')]
                .find(o => o.getAttribute('data-name') === name)
            return opt ? opt.value : null
        }, `${firstName} ${lastName}`)
    }

    // The parent row carries its full record (incl. linked students) as JSON.
    async linkedStudentIds(email) {
        const row = this.parentRow(email)
        await row.waitForExist({ timeout: 10000 })
        const data = JSON.parse(await row.getAttribute('data-parent'))
        return (data.students || []).map(s => s.id)
    }

    async createStudent({ firstName, lastName, gender }) {
        await this.studentsTab.click()
        await this.newStudentBtn.waitForClickable({ timeout: 10000 })
        await this.newStudentBtn.click()
        await this.createStudentModal.waitForDisplayed({ timeout: 5000 })
        // Inputs are reset by openCreateStudent() during the fade-in, so let
        // it finish before typing or the first characters get wiped.
        await browser.pause(1000)
        await this.csFirstName.setValue(firstName)
        await this.csLastName.setValue(lastName)
        await this.csGender.selectByAttribute('value', gender)
        await this.csSaveBtn.click()
        // Success swal's OK handler reloads the page.
        const msg = await this.readAndConfirmSwal(15000)
        if (!msg || !/created|success/i.test(msg)) {
            throw new Error(`Creating fixture student failed: ${msg || await this.csError.getText()}`)
        }
        await this.breadcrumb.waitForDisplayed({ timeout: 20000 })
    }

    // Returns the student's id, creating the student first if it doesn't exist.
    async ensureStudent(student) {
        await this.open()
        let id = await this.studentIdByName(student.firstName, student.lastName)
        if (!id) {
            await this.createStudent(student)
            await this.open()
            id = await this.studentIdByName(student.firstName, student.lastName)
        }
        if (!id) throw new Error(`Fixture student ${student.firstName} ${student.lastName} not found after create`)
        return id
    }

    // Adds any of `studentIds` the parent isn't linked to yet. Never removes a
    // link — the modal saves the full list, and we only ever append to it.
    async ensureLinked(email, studentIds) {
        await this.open()
        const current = await this.linkedStudentIds(email)
        const missing = studentIds.filter(id => !current.includes(id))
        if (!missing.length) return

        await this.openTab(this.parentsTab, this.parentsPane)
        const row = this.parentRow(email)
        await row.$('button[onclick="openLinkStudents(this)"]').click()
        await this.linkModal.waitForDisplayed({ timeout: 5000 })
        for (const id of missing) {
            await this.linkStudentSelect.selectByAttribute('value', id)
            await this.linkAddBtn.click()
        }
        await this.linkSaveBtn.click()
        const msg = await this.readAndConfirmSwal(15000)
        if (!msg || !/saved|updated/i.test(msg)) throw new Error(`Linking students failed: ${msg}`)
        await this.breadcrumb.waitForDisplayed({ timeout: 20000 })
    }

    // Replaces the parent's linked-student list in one call. Used only to
    // *repair* fixtures (the Link modal can't remove a link without fiddly
    // chip clicks), so it posts exactly what the page's own Save handler
    // posts, from the page's own CSRF/ORG_ID/PARENT_UPDATE_URL globals.
    async setLinkedStudents(parentId, studentIds) {
        const res = await browser.executeAsync((parentId, ids, done) => {
            const row = [...document.querySelectorAll('#tbl-parents tbody tr[data-parent]')]
                .find(r => JSON.parse(r.getAttribute('data-parent')).id === parentId)
            const p = JSON.parse(row.getAttribute('data-parent'))
            const fd = new FormData()
            fd.append('_token', CSRF)
            fd.append('_method', 'PUT')
            fd.append('organization_id', ORG_ID)
            fd.append('first_name', p.first_name)
            fd.append('last_name', p.last_name)
            ids.forEach(id => fd.append('student_ids[]', id))
            fetch(PARENT_UPDATE_URL.replace('__ID__', parentId), { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
                .then(r => done(r.status)).catch(e => done(String(e)))
        }, parentId, studentIds)
        if (res !== 200) throw new Error(`Restoring parent links failed: ${res}`)
    }

    // One call for every parent spec's `before`: makes sure both fixture
    // students exist, that Chinedu is linked to Emeka + LINKED, and that
    // UNLINKED is *not* linked (a previous run of the write-authz test can
    // leave it linked if the app lets the parent link himself).
    // Returns { linkedId, unlinkedId }.
    async ensureParentFixtures({ parentId, parentEmail, emekaId, linked, unlinked }) {
        const linkedId = await this.ensureStudent(linked)
        const unlinkedId = await this.ensureStudent(unlinked)
        await this.ensureLinked(parentEmail, [emekaId, linkedId])
        await this.open()
        const current = await this.linkedStudentIds(parentEmail)
        if (current.includes(unlinkedId)) {
            await this.setLinkedStudents(parentId, current.filter(id => id !== unlinkedId))
        }
        return { linkedId, unlinkedId }
    }

    // Logs in as admin and runs ensureParentFixtures for Chinedu. Leaves the
    // browser signed in as admin — callers switch to the parent afterwards.
    async setUpFixtures() {
        await LoginPage.loginAs(ADMIN_USER)
        return this.ensureParentFixtures({
            parentId: PARENT_ID,
            parentEmail: PARENT_USER.email,
            emekaId: STUDENT_ID,
            linked: LINKED_FIXTURE,
            unlinked: UNLINKED_FIXTURE,
        })
    }
}

export default new ParentRegistrationsPage()
