import TeacherModulePage from './teacherModule.page.js'

// Class Attendance (/scola-gradebook2/class-attendance/{classId}). The table
// has one column per recorded date (with edit/delete icons in the header),
// then per-pupil Present % / Absent %. "Record Attendance" opens a modal with
// a required date (max = today), a Present/Absent select and a remark per
// pupil, plus All Present / All Absent / Clear bulk buttons.
class TeacherAttendancePage extends TeacherModulePage {
    constructor() {
        super('/scola-gradebook2/class-attendance')
    }

    async openClass(classId) {
        await this.open(`/${classId}`)
    }

    get recordBtn() { return $('.create-class-attendance-btn') }
    get modal() { return $('#classAttendanceModal') }
    get form() { return $('#classAttendanceForm') }
    get dateInput() { return $('#classAttendanceForm input[name="attendance_date"]') }
    get allPresentBtn() { return $('#btn-mark-all-present') }
    get allAbsentBtn() { return $('#btn-mark-all-absent') }
    get clearBtn() { return $('#btn-clear-all') }
    get saveBtn() { return $('#btn-save-attendance') }
    get table() { return $('#tbl-attendance') }
    get emptyState() { return $('//*[contains(., "No attendance records yet")]') }
    statusSelect(studentId) { return $(`select[name="attendance[${studentId}]"]`) }
    remarkInput(studentId) { return $(`input[name="remarks[${studentId}]"]`) }
    editIcon(date) { return $(`.edit-class-attendance[data-date="${date}"]`) }
    deleteIcon(date) { return $(`.delete-class-attendance[data-date="${date}"]`) }

    async openRecordModal() {
        // A success swal from a previous save can linger past the reload if
        // this test's run hits it mid-fade; dismiss it so its overlay clears
        // and the Record button is clickable.
        await this.readAndConfirmSwal(500).catch(() => {})
        await this.recordBtn.waitForClickable({ timeout: 10000 })
        await this.recordBtn.click()
        await this.modal.waitForDisplayed({ timeout: 5000 })
        await browser.pause(600) // modal fade-in; selects set earlier get reset by the open handler
    }

    // Pupils listed in the modal: [{ id, name, status, remark }]
    async modalRows() {
        return browser.execute(() => [...document.querySelectorAll('#classAttendanceModal select.att-status-select')].map(sel => {
            const id = sel.name.replace('attendance[', '').replace(']', '')
            const tr = sel.closest('tr')
            return {
                id, name: tr ? tr.cells[1].innerText.trim() : '', status: sel.value,
                remark: (document.querySelector(`input[name="remarks[${id}]"]`) || {}).value,
            }
        }))
    }

    async modalStudentId(name) {
        const row = (await this.modalRows()).find(r => r.name === name)
        if (!row) throw new Error(`Attendance modal has no row for "${name}"`)
        return row.id
    }

    // The date input is type=date; set it the way a picker would.
    async setDate(yyyyMmDd) {
        await browser.execute((el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })) }, await this.dateInput, yyyyMmDd)
    }

    async setStatus(name, status, remark) {
        const id = await this.modalStudentId(name)
        await this.statusSelect(id).selectByAttribute('value', status)
        if (remark !== undefined) {
            await this.remarkInput(id).clearValue()
            if (remark) await this.remarkInput(id).setValue(remark)
        }
    }

    async save() {
        await this.markPage()
        await this.saveBtn.click()
        // The save flow fires a success SweetAlert that waits for OK before
        // location.reload runs; without this dismiss, waitForReload times out
        // and the swal's overlay blocks the next test's Record button.
        await this.readAndConfirmSwal(8000).catch(() => {})
        await this.waitForReload()
    }

    async recordedDates() {
        return browser.execute(() => [...document.querySelectorAll('#tbl-attendance .edit-class-attendance')].map(a => a.getAttribute('data-date')))
    }

    // Per-pupil row: { name, cells: [status text per date column], present, absent }
    async tableRows() {
        return browser.execute(() => {
            const table = document.querySelector('#tbl-attendance')
            if (!table) return []
            return [...table.querySelectorAll('tbody tr')].filter(tr => tr.cells.length > 2).map(tr => {
                const cells = [...tr.cells]
                return {
                    name: cells[0].innerText.replace(/^\s*\d+\.\s*/, '').trim(),
                    cells: cells.slice(1, -2).map(td => td.innerText.replace(/\s+/g, ' ').trim()),
                    present: cells[cells.length - 2].innerText.trim(),
                    absent: cells[cells.length - 1].innerText.trim(),
                    absentRow: tr.classList.contains('att-row-absent'),
                }
            })
        })
    }

    async tableRow(name) {
        return (await this.tableRows()).find(r => r.name === name)
    }

    // Cell text for one pupil on one recorded date ('' if not recorded).
    async cellFor(name, date) {
        const dates = await this.recordedDates()
        const row = await this.tableRow(name)
        const i = dates.indexOf(date)
        return row && i >= 0 ? row.cells[i] : null
    }

    async deleteDate(date) {
        await this.readAndConfirmSwal(500).catch(() => {})
        const icon = this.deleteIcon(date)
        if (!(await icon.isExisting())) return false
        await icon.scrollIntoView({ block: 'center' })
        await icon.click()
        await this.markPage()
        await this.confirmSwal()
        await this.waitForReload()
        return true
    }

    async openEdit(date) {
        await this.readAndConfirmSwal(500).catch(() => {})
        const icon = this.editIcon(date)
        await icon.waitForExist({ timeout: 10000 })
        await icon.scrollIntoView({ block: 'center' })
        await icon.click()
        await this.modal.waitForDisplayed({ timeout: 5000 })
        // The modal fetches that date's records over AJAX after opening.
        await browser.waitUntil(async () => (await this.modalRows()).some(r => r.status), { timeout: 10000, timeoutMsg: 'Edit modal never loaded the recorded statuses' })
    }
}

export default new TeacherAttendancePage()
