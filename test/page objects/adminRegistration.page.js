// Registration Management — Students, Parents (and child links), the
// Enrollment tab and the three bulk-CSV import modals.
import path from 'path'
import fs from 'fs'
import os from 'os'
import ModulePage from './modulePage.page.js'

class AdminRegistrationPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/registration-management')
    }

    tab(name) { return $(`#reg-mgmt-tabs a[href="#tab_${name}"]`) }
    pane(name) { return $(`#tab_${name}`) }

    // The active tab is restored from localStorage, so click the one we want.
    async openOn(tab) {
        await this.open()
        await this.openTab(this.tab(tab), this.pane(tab))
    }

    statValue(tab, label) {
        return $(`//div[@id="tab_${tab}"]//div[contains(@class,"stat-lbl")][normalize-space()="${label}"]/preceding-sibling::div[contains(@class,"stat-val")]`)
    }

    // Modals here are opened by onclick handlers and fade in; typing before
    // the fade ends loses keystrokes.
    async waitModal(modal) {
        await modal.waitForDisplayed({ timeout: 8000 })
        await browser.waitUntil(async () => (await modal.getAttribute('class')).includes('show'), { timeout: 5000 })
        await browser.pause(400)
    }

    // ── Students ────────────────────────────────────────────────────────────
    get newStudentBtn() { return $('#tab_students button[onclick="openCreateStudent()"]') }
    get createStudentModal() { return $('#mdl-create-student') }
    get firstNameInput() { return $('#cs-first-name') }
    get lastNameInput() { return $('#cs-last-name') }
    get genderSelect() { return $('#cs-gender') }
    get admissionTypeSelect() { return $('#cs-admission-type') }
    get prevSchoolRow() { return $('.cs-prev-school-row') }
    get prevSchoolInput() { return $('#cs-prev-school') }
    get saveStudentBtn() { return $('#btn-cs-save') }
    get studentError() { return $('#cs-error') }
    get studentSearch() { return $('#search-students') }
    get studentsTable() { return $('#tbl-students') }
    get studentEmptyRow() { return $('#tbl-students tr.empty-row') }
    studentRow(text) { return $(`//table[@id="tbl-students"]//tr[@data-student][contains(., "${text}")]`) }
    // Bulk import re-cases names, so match those ignoring case.
    studentRowIgnoreCase(text) {
        const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        return $(`//table[@id="tbl-students"]//tr[@data-student][contains(translate(., "${AZ}", "${AZ.toLowerCase()}"), "${text.toLowerCase()}")]`)
    }

    // The list pages 15 at a time (rows past page 1 are hidden), so search
    // first to bring the student onto the visible page.
    async findStudent(text) {
        await this.studentSearch.setValue(text)
        return this.studentRow(text)
    }
    studentToggleBtn(id) { return $(`.btn-toggle-student-status[data-id="${id}"]`) }

    async openCreateStudent() {
        await this.newStudentBtn.waitForClickable({ timeout: 10000 })
        await this.newStudentBtn.click()
        await this.waitModal(this.createStudentModal)
    }

    async fillStudent({ firstName = '', lastName = '', gender = '', admissionType, prevSchool }) {
        await this.openCreateStudent()
        if (firstName) await this.firstNameInput.setValue(firstName)
        if (lastName) await this.lastNameInput.setValue(lastName)
        if (gender) await this.genderSelect.selectByAttribute('value', gender)
        if (admissionType) await this.admissionTypeSelect.selectByAttribute('value', admissionType)
        if (prevSchool) await this.prevSchoolInput.setValue(prevSchool)
    }

    async createStudent(student) {
        await this.fillStudent(student)
        await this.saveStudentBtn.click()
        const text = await this.readAndConfirmSwal(15000)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        return text
    }

    // ALL_STUDENTS is the page's own [{id, name: "Last, First"}] list.
    async studentId(lastName, firstName) {
        return browser.execute(n => (window.ALL_STUDENTS || []).find(s => s.name === n)?.id || null, `${lastName}, ${firstName}`)
    }

    // ── Parents ─────────────────────────────────────────────────────────────
    get newParentBtn() { return $('#tab_parents button[onclick="openCreateParent()"]') }
    get createParentModal() { return $('#mdl-create-parent') }
    get parentFirstName() { return $('#cp-first-name') }
    get parentLastName() { return $('#cp-last-name') }
    get parentRelationship() { return $('#cp-relationship') }
    get parentGender() { return $('#cp-gender') }
    get parentTelephone() { return $('#cp-telephone') }
    get parentEmail() { return $('#cp-email') }
    get studentPicker() { return $('#cp-student-picker') }
    get linkStudentBtn() { return $('#mdl-create-parent button[onclick="cpLinkStudent()"]') }
    get linkedList() { return $('#cp-linked-list') }
    get saveParentBtn() { return $('#btn-cp-save') }
    get parentError() { return $('#cp-error') }
    get parentSearch() { return $('#search-parents') }
    parentRow(text) { return $(`//table[@id="tbl-parents"]//tr[@data-parent][contains(., "${text}")]`) }
    get viewParentModal() { return $('#mdl-view-parent') }

    async openCreateParent() {
        await this.newParentBtn.waitForClickable({ timeout: 10000 })
        await this.newParentBtn.click()
        await this.waitModal(this.createParentModal)
    }

    // 2026-11-12: portalAccess / channel params dropped — site overhaul
    // removed both selects from Create and Edit Parent modals.
    async fillParent({ firstName = '', lastName = '', email, telephone, relationship = 'guardian', gender = 'female', studentIds = [] }) {
        await this.openCreateParent()
        if (firstName) await this.parentFirstName.setValue(firstName)
        if (lastName) await this.parentLastName.setValue(lastName)
        await this.parentRelationship.selectByAttribute('value', relationship)
        await this.parentGender.selectByAttribute('value', gender)
        if (telephone) await this.parentTelephone.setValue(telephone)
        if (email) await this.parentEmail.setValue(email)
        for (const id of studentIds) {
            await this.studentPicker.selectByAttribute('value', id)
            await this.linkStudentBtn.click()
        }
    }

    async createParent(parent) {
        await this.fillParent(parent)
        await this.saveParentBtn.click()
        const text = await this.readAndConfirmSwal(15000)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        return text
    }

    // The row's data-parent JSON (id, portal_access, notification_channel, students[]).
    async parentData(text) {
        const row = this.parentRow(text)
        await row.waitForExist({ timeout: 10000 })
        return JSON.parse(await row.getAttribute('data-parent'))
    }

    async openViewParent(text) {
        await this.parentRow(text).$('button[data-bs-target="#mdl-view-parent"]').click()
        await this.waitModal(this.viewParentModal)
    }

    // ── Enrollment ──────────────────────────────────────────────────────────
    get classFilter() { return $('#enroll-class-filter') }
    get openEnrollBtn() { return $('#btn-open-enroll') }
    get enrollModal() { return $('#mdl-enroll-students') }
    get enrollSearch() { return $('#enroll-search-students') }
    get enrollSelectedCount() { return $('#enroll-selected-count') }
    get doEnrollBtn() { return $('#btn-do-enroll') }
    get enrollError() { return $('#enroll-error') }
    get enrollStudentList() { return $('#enroll-student-list') }
    get capacityStat() { return $('#es-capacity') }
    get enrolledStat() { return $('#es-total') }
    get unenrolledStat() { return $('#es-unenrolled') }
    get enrollCountLabel() { return $('#enroll-count-label') }
    enrollCheckbox(studentId) { return $(`.enroll-chk[value="${studentId}"]`) }
    // Enrollment rows carry data-enr-class; the unenroll button calls
    // confirmUnenroll('<enrollment id>', '<name>').
    enrollmentRow(text) { return $(`//table[@id="tbl-enrollments"]//tr[@data-enr-class][contains(., "${text}")]`) }
    unenrollBtn(text) { return this.enrollmentRow(text).$('[onclick^="confirmUnenroll"]') }

    async chooseEnrollClass(classId) {
        await this.classFilter.selectByAttribute('value', classId)
        await browser.waitUntil(async () => this.openEnrollBtn.isEnabled(), { timeout: 5000 })
    }

    async fillEnroll(classId, studentIds) {
        await this.chooseEnrollClass(classId)
        await this.openEnrollBtn.click()
        await this.waitModal(this.enrollModal)
        for (const id of studentIds) await this.enrollCheckbox(id).click()
    }

    // The server refuses to enroll into a class that has no subjects.
    async enroll(classId, studentIds) {
        await this.fillEnroll(classId, studentIds)
        await this.doEnrollBtn.click()
        // A refused enroll has no SweetAlert: the server's message goes to
        // the inline #enroll-error, so return that instead.
        await browser.waitUntil(async () => (await this.swal.isDisplayed().catch(() => false))
            || (await this.enrollError.isDisplayed().catch(() => false)), { timeout: 15000 }).catch(() => {})
        if (await this.enrollError.isDisplayed().catch(() => false)) return this.enrollError.getText()
        return this.readAndConfirmSwal(5000)
    }

    // ── Bulk import ─────────────────────────────────────────────────────────
    importOpenBtn(kind) { return $(`button[data-bs-target="#mdl-import-${kind}"]`) }
    importModal(kind) { return $(`#mdl-import-${kind}`) }
    importFile(kind) { return $(`#mdl-import-${kind}-file`) }
    importSubmit(kind) { return $(`#mdl-import-${kind}-submit`) }
    importResult(kind) { return $(`#mdl-import-${kind}-result`) }
    importResultBody(kind) { return $(`#mdl-import-${kind}-result-body`) }

    async openImport(kind) {
        await this.importOpenBtn(kind).waitForClickable({ timeout: 10000 })
        await this.importOpenBtn(kind).click()
        await this.waitModal(this.importModal(kind))
    }

    // Writes `content` to a temp file with the given name and attaches it to
    // the modal's file input (uploaded to the browser first, so this also
    // works against a remote/headless Chrome).
    async attachFile(kind, fileName, content) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adm-import-'))
        const file = path.join(dir, fileName)
        fs.writeFileSync(file, content)
        const remote = await browser.uploadFile(file)
        await this.importFile(kind).setValue(remote)
        return file
    }

    // Uploads and returns the result panel text ('' if none appeared).
    async submitImport(kind) {
        await this.importSubmit(kind).click()
        await this.importResult(kind).waitForDisplayed({ timeout: 30000 }).catch(() => {})
        return this.importResultBody(kind).getText().catch(() => '')
    }
}

export default new AdminRegistrationPage()
