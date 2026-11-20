// Teacher Management — Teachers list, Subject Allocation matrix and the
// performance-report tabs.
import ModulePage from './modulePage.page.js'
import { randomEmail } from '../helpers/random.js'

class AdminTeachersPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/teacher-management')
    }

    tab(name) { return $(`#teacher-mgmt-tabs a[href="#tab_${name}"]`) }
    pane(name) { return $(`#tab_${name}`) }

    // The last tab is restored from localStorage, so click the one we want.
    async openOn(tab) {
        await this.open()
        await this.openTab(this.tab(tab), this.pane(tab))
    }

    statValue(label) {
        return $(`//div[@id="tab_teachers"]//div[contains(@class,"stat-lbl")][normalize-space()="${label}"]/preceding-sibling::div[contains(@class,"stat-val")]`)
    }

    // ── Teachers ────────────────────────────────────────────────────────────
    get newTeacherBtn() { return $('#tab_teachers button[data-bs-target="#mdl-create-teacher"]') }
    get createModal() { return $('#mdl-create-teacher') }
    get firstNameInput() { return $('#ct-first-name') }
    get lastNameInput() { return $('#ct-last-name') }
    get designationSelect() { return $('#ct-designation') }
    get genderSelect() { return $('#ct-gender') }
    get emailInput() { return $('#ct-email') }
    get telephoneInput() { return $('#ct-telephone') }
    get employmentSelect() { return $('#ct-employment-type') }
    get departmentSelect() { return $('#ct-department') }
    get staffNumberPlaceholder() { return $('//div[@id="mdl-create-teacher"]//label[normalize-space()="Staff Number"]/following-sibling::div') }
    get createBtn() { return $('#btn-create-teacher') }
    get createError() { return $('#teacher-create-error') }
    get searchInput() { return $('#search-teachers') }
    get teachersTable() { return $('#tbl-teachers') }
    row(text) { return $(`//table[@id="tbl-teachers"]//tr[.//div[contains(@class,"teacher-name")][contains(., "${text}")]]`) }
    editBtnByEmail(email) { return $(`.btn-edit-teacher[data-email="${email}"]`) }
    // Names can overlap ("X" vs "XBad"), so pin a row by its unique email.
    rowByEmail(email) { return $(`//table[@id="tbl-teachers"]//tr[.//*[contains(@class,"btn-edit-teacher")][@data-email="${email}"]]`) }

    async openCreateModal() {
        await this.newTeacherBtn.waitForClickable({ timeout: 10000 })
        await this.newTeacherBtn.click()
        await this.createModal.waitForDisplayed({ timeout: 5000 })
        // Fields ignore typing until the fade-in finishes.
        await browser.pause(500)
    }

    // 2026-11-09: until the devs' fix lands, leaving any field blank makes
    // the save fail with "Server Error", so every optional field gets a
    // default (selects take their first real option). Pass '' for a field to
    // leave it blank on purpose. Form Class Teacher is never set — it would
    // take a real class (possibly Chisom's) away from its form teacher.
    async fillTeacher({
        firstName, lastName, email, telephone, gender = 'female', designation = 'ms', employment = 'full_time',
        middleName = 'Auto', workEmail = randomEmail('auto-adm-work'), dateOfBirth = '1990-01-15',
        dateOfEmployment = '2020-01-15', qualification, yearsOfExperience = '5', department,
    }) {
        await this.openCreateModal()
        if (firstName) await this.firstNameInput.setValue(firstName)
        if (lastName) await this.lastNameInput.setValue(lastName)
        await this.designationSelect.selectByAttribute('value', designation)
        await this.genderSelect.selectByAttribute('value', gender)
        if (email) await this.emailInput.setValue(email)
        if (telephone) await this.telephoneInput.setValue(telephone)
        await this.employmentSelect.selectByAttribute('value', employment)
        // Fields without a known id are found by label. Dates are set as
        // yyyy-mm-dd rather than typed, as the typed format follows the locale.
        await this.setByLabel({
            'Middle Name': middleName, 'Work Email': workEmail, 'Date of Birth': dateOfBirth,
            'Date of Employment': dateOfEmployment, 'Qualification': qualification,
            'Years of Experience': yearsOfExperience, 'Department': department,
        })
    }

    // label → value; undefined (sent as null — undefined doesn't survive
    // browser.execute) on a select picks its first real option,
    // '' leaves the field alone. Fails loudly if a label isn't found.
    async setByLabel(values) {
        const missing = await browser.execute(values => {
            const modal = document.querySelector('#mdl-create-teacher')
            const missing = []
            for (const [label, value] of Object.entries(values)) {
                if (value === '') continue
                const lbl = [...modal.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(label))
                const el = lbl && (document.getElementById(lbl.htmlFor) ||
                    document.evaluate('following::*[self::input or self::select or self::textarea][1]', lbl, null, 9, null).singleNodeValue)
                if (!el) { missing.push(label); continue }
                el.value = value !== null ? value
                    : ([...(el.options || [])].find(o => o.value && !/^none$/i.test(o.textContent.trim())) || {}).value || ''
                el.dispatchEvent(new Event('input', { bubbles: true }))
                el.dispatchEvent(new Event('change', { bubbles: true }))
            }
            return missing
        }, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === undefined ? null : v])))
        if (missing.length) throw new Error(`Create Teacher form has no field labelled: ${missing.join(', ')}`)
    }

    // A refused or failed save has no alert: the server's message goes to
    // the inline #teacher-create-error, so return that instead.
    async createTeacher(teacher) {
        await this.fillTeacher(teacher)
        await this.createBtn.click()
        const text = await this.readAndConfirmSwal(15000)
        if (text !== null) return text
        return (await this.createError.isDisplayed().catch(() => false)) ? this.createError.getText() : null
    }

    async teacherIdByEmail(email) {
        const btn = this.editBtnByEmail(email)
        await btn.waitForExist({ timeout: 10000 })
        return btn.getAttribute('data-id')
    }

    // ── Subject Allocation matrix ───────────────────────────────────────────
    get teacherSelect() { return $('#assign-teacher-select') }
    get teacherMeta() { return $('#assign-teacher-meta') }
    get summaryChips() { return $('#summary-chips') }
    get matrixEmptyState() { return $('//div[@id="tab_assignments"]//*[contains(., "Academic Management first")]') }
    assignCell(subjectId, classId) { return $(`.assign-cell[data-subject-id="${subjectId}"][data-class-id="${classId}"]`) }

    // The teacher picker is a TomSelect; use its API so its onChange
    // (which repaints the matrix) fires.
    async selectTeacher(teacherId) {
        await this.teacherSelect.waitForExist({ timeout: 10000 })
        await browser.execute(id => document.querySelector('#assign-teacher-select').tomselect.setValue(id), teacherId)
    }

    async isAssigned(subjectId, classId) {
        return (await this.assignCell(subjectId, classId).getAttribute('class')).includes('assigned')
    }

    // Clicks a matrix cell and waits for the save round-trip (the cell
    // carries .saving while the request is in flight).
    async toggleCell(subjectId, classId) {
        const cell = this.assignCell(subjectId, classId)
        const before = await this.isAssigned(subjectId, classId)
        await cell.scrollIntoView({ block: 'center', inline: 'center' })
        await cell.click()
        await browser.waitUntil(async () => {
            const cls = await cell.getAttribute('class')
            return !cls.includes('saving') && cls.includes('assigned') !== before
        }, { timeout: 15000, timeoutMsg: 'Allocation cell did not toggle' })
    }
}

export default new AdminTeachersPage()
