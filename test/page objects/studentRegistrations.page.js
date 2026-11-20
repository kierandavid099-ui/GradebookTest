import ModulePage from './modulePage.page.js'

// Admin → Registrations, Students tab — used by the Student suites only to
// find or create the second student the IDOR tests need. Search is a
// client-side filter over <tr data-search="last first middle adm-no">, and
// every row's action buttons carry the student id in data-id.
class StudentRegistrationsPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/registration-management')
    }

    get studentsTab() { return $('#reg-mgmt-tabs a[href="#tab_students"]') }
    get studentsPane() { return $('#tab_students') }
    get addStudentBtn() { return $('button[onclick="openCreateStudent()"]') }
    get searchInput() { return $('#search-students') }

    get createModal() { return $('#mdl-create-student') }
    get firstNameInput() { return $('#cs-first-name') }
    get lastNameInput() { return $('#cs-last-name') }
    get emailInput() { return $('#cs-email') }
    get genderSelect() { return $('#cs-gender') }
    get saveBtn() { return $('#btn-cs-save') }
    get createError() { return $('#cs-error') }

    row(text) { return $(`#tbl-students tbody tr[data-search*="${text.toLowerCase()}"]`) }

    async openStudentsTab() {
        await this.open()
        // The page remembers the last tab in localStorage, so pick it explicitly.
        await this.openTab(this.studentsTab, this.studentsPane)
    }

    async search(text) {
        await this.searchInput.waitForDisplayed({ timeout: 10000 })
        await this.searchInput.clearValue()
        await this.searchInput.setValue(text)
    }

    // Student id for the first row matching `text`, or null if none.
    async findStudentId(text) {
        await this.search(text)
        const row = this.row(text)
        if (!(await row.waitForDisplayed({ timeout: 3000 }).catch(() => false))) return null
        return row.$('[data-id]').getAttribute('data-id')
    }

    async create({ firstName, lastName, email, gender }) {
        await this.addStudentBtn.waitForClickable({ timeout: 10000 })
        await this.addStudentBtn.click()
        await this.createModal.waitForDisplayed({ timeout: 5000 })
        // openCreateStudent() clears every field as the modal fades in.
        await browser.pause(800)
        await this.firstNameInput.setValue(firstName)
        await this.lastNameInput.setValue(lastName)
        await this.emailInput.setValue(email)
        await this.genderSelect.selectByAttribute('value', gender)
        await this.saveBtn.click()
        // Success swal → OK reloads the page.
        const msg = await this.readAndConfirmSwal(15000)
        if (!msg || !/created|success/i.test(msg)) {
            throw new Error(`Creating ${firstName} ${lastName} failed: ${msg || await this.createError.getText()}`)
        }
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
    }

    // Finds the fixture student (by its fixed last name) or creates it.
    // Must be called while logged in as admin. Returns the student id.
    async ensureStudent(fixture) {
        await this.openStudentsTab()
        let id = await this.findStudentId(fixture.lastName)
        if (!id) {
            await this.create(fixture)
            await this.openStudentsTab()
            id = await this.findStudentId(fixture.lastName)
        }
        if (!id) throw new Error(`Fixture student ${fixture.lastName} could not be found or created`)
        return id
    }
}

export default new StudentRegistrationsPage()
