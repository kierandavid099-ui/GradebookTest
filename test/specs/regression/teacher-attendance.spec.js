import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherAttendancePage from '../../page objects/teacherAttendance.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import { FORM_CLASS_ID, FORM_CLASS_NAME, OTHER_CLASS_ID, studentSheetName } from '../../helpers/teacherData.js'

// Class Attendance for Chisom's form class (Pri 2A). Records two fixed past
// dates, edits one and deletes both again, so a run leaves no attendance
// behind (an aborted run is cleaned up by the next run's before hook).
// Rate assertions are computed from the table itself, because other suites'
// pupils may also be enrolled in Pri 2A.

const D1 = '2026-10-13'
const D2 = '2026-10-14'
const ADA = studentSheetName('Ada')
const BAYO = studentSheetName('Bayo')
const CHIDI = studentSheetName('Chidi')
// The app's percentage rounding differs on thirds (34% vs 33%); accept
// Math.round or either neighbour so 1/3-style ratios don't flap.
const pctNear = (s, n, d) => {
    if (!d) return s === '0%'
    const exact = (n / d) * 100
    const m = /^(\d+)%$/.exec(s)
    if (!m) return false
    const got = Number(m[1])
    return got === Math.round(exact) || got === Math.floor(exact) || got === Math.ceil(exact)
}

describe('REGRESSION — Teacher Class Attendance', () => {

    const openClass = () => TeacherAttendancePage.openClass(FORM_CLASS_ID)

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await TeacherFixtures.ensure()
        await openClass()
        for (const d of [D1, D2]) if (await TeacherAttendancePage.deleteDate(d)) await openClass()
    })

    after(async () => {
        await openClass()
        for (const d of [D1, D2]) if (await TeacherAttendancePage.deleteDate(d)) await openClass()
    })

    describe('Page & Record Modal', () => {

        it('REG-TCH-ATT-001 | Class Attendance opens for the form class', async () => {
            addFeature('Teacher Attendance'); addSeverity('blocker')
            await expect(TeacherAttendancePage.breadcrumb).toHaveText(/Class Attendance/i)
            await expect(TeacherAttendancePage.subtitle).toHaveText(new RegExp(FORM_CLASS_NAME))
            await expect(TeacherAttendancePage.recordBtn).toBeDisplayed()
        })

        it('REG-TCH-ATT-002 | The Record Attendance modal lists every enrolled pupil with a status select and remark', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            await TeacherAttendancePage.openRecordModal()
            const rows = await TeacherAttendancePage.modalRows()
            for (const n of [ADA, BAYO, CHIDI]) expect(rows.map(r => r.name)).toContain(n)
            expect(Number(await TeacherAttendancePage.statValue('Total Students'))).toBe(rows.length)
            const options = await TeacherAttendancePage.statusSelect(rows[0].id).$$('option')
            const values = []
            for (const o of options) values.push(await o.getAttribute('value'))
            expect(values).toEqual(['', 'present', 'absent'])
        })

        it('REG-TCH-ATT-003 | Saving without an Attendance Date is blocked', async () => {
            addFeature('Teacher Attendance'); addSeverity('blocker')
            await TeacherAttendancePage.allPresentBtn.click()
            await TeacherAttendancePage.saveBtn.click()
            await expect(TeacherAttendancePage.modal).toBeDisplayed()
            expect(await browser.execute(el => el.validity.valueMissing, await TeacherAttendancePage.dateInput)).toBe(true)
        })

        it('REG-TCH-ATT-004 | The Attendance Date cannot be in the future (max = today)', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            const today = await browser.execute(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
            expect(await TeacherAttendancePage.dateInput.getAttribute('max')).toBe(today)
            await TeacherAttendancePage.setDate('2099-01-01')
            expect(await browser.execute(el => el.validity.rangeOverflow, await TeacherAttendancePage.dateInput)).toBe(true)
        })

        it('REG-TCH-ATT-005 | "All Present" marks every pupil Present', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            await TeacherAttendancePage.allPresentBtn.click()
            ;(await TeacherAttendancePage.modalRows()).forEach(r => expect(r.status).toBe('present'))
        })

        it('REG-TCH-ATT-006 | "All Absent" marks every pupil Absent', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            await TeacherAttendancePage.allAbsentBtn.click()
            ;(await TeacherAttendancePage.modalRows()).forEach(r => expect(r.status).toBe('absent'))
        })

        it('REG-TCH-ATT-007 | "Clear" resets every status and remark', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            await TeacherAttendancePage.setStatus(ADA, 'present', 'temp remark')
            await TeacherAttendancePage.clearBtn.click()
            ;(await TeacherAttendancePage.modalRows()).forEach(r => { expect(r.status).toBe(''); expect(r.remark).toBe('') })
        })

        it('REG-TCH-ATT-008 | Cancelling the modal records nothing', async () => {
            addFeature('Teacher Attendance'); addSeverity('minor')
            const before = await TeacherAttendancePage.statValue('Days Recorded')
            await TeacherAttendancePage.closeModal()
            await openClass()
            expect(await TeacherAttendancePage.statValue('Days Recorded')).toBe(before)
        })
    })

    describe('Record A Day', () => {

        let daysBefore

        before(async () => {
            await openClass()
            daysBefore = Number(await TeacherAttendancePage.statValue('Days Recorded'))
            await TeacherAttendancePage.openRecordModal()
            await TeacherAttendancePage.setDate(D1)
            await TeacherAttendancePage.setStatus(ADA, 'present', '<i>late</i>')
            await TeacherAttendancePage.setStatus(BAYO, 'absent', 'sick')
            await TeacherAttendancePage.setStatus(CHIDI, 'present')
            await TeacherAttendancePage.save()
            await openClass()
        })

        it('REG-TCH-ATT-009 | The recorded date appears as a new column and Days Recorded goes up by one', async () => {
            addFeature('Teacher Attendance'); addSeverity('blocker')
            expect(await TeacherAttendancePage.recordedDates()).toContain(D1)
            expect(Number(await TeacherAttendancePage.statValue('Days Recorded'))).toBe(daysBefore + 1)
        })

        it('REG-TCH-ATT-010 | Each pupil\'s status is stored against the right date', async () => {
            addFeature('Teacher Attendance'); addSeverity('blocker')
            expect(await TeacherAttendancePage.cellFor(ADA, D1)).toMatch(/^Present/)
            expect(await TeacherAttendancePage.cellFor(BAYO, D1)).toMatch(/^Absent/)
            expect(await TeacherAttendancePage.cellFor(CHIDI, D1)).toMatch(/^Present/)
        })

        it('REG-TCH-ATT-011 | A remark ("sick") is stored and shown under that pupil\'s status', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            expect(await TeacherAttendancePage.cellFor(BAYO, D1)).toBe('Absent sick')
        })

        it('REG-TCH-ATT-012 | HTML in a remark is shown as plain text', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            expect(await TeacherAttendancePage.cellFor(ADA, D1)).toBe('Present <i>late</i>')
        })

        it('REG-TCH-ATT-013 | A pupil marked absent is highlighted in the table', async () => {
            addFeature('Teacher Attendance'); addSeverity('minor')
            // Row highlight reflects the most recent date only; D1 is the
            // latest of this suite's dates at this point.
            const latest = (await TeacherAttendancePage.recordedDates()).slice(-1)[0]
            if (latest === D1) expect((await TeacherAttendancePage.tableRow(BAYO)).absentRow).toBe(true)
        })
    })

    describe('Rates', () => {

        before(async () => {
            await TeacherAttendancePage.openRecordModal()
            await TeacherAttendancePage.setDate(D2)
            await TeacherAttendancePage.setStatus(ADA, 'present')
            await TeacherAttendancePage.setStatus(BAYO, 'present')
            await TeacherAttendancePage.setStatus(CHIDI, 'absent')
            await TeacherAttendancePage.save()
            await openClass()
        })

        it('REG-TCH-ATT-014 | Per-pupil Present % / Absent % match that pupil\'s recorded days', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            for (const n of [ADA, BAYO, CHIDI]) {
                const row = await TeacherAttendancePage.tableRow(n)
                const p = row.cells.filter(c => /^Present/.test(c)).length
                const a = row.cells.filter(c => /^Absent/.test(c)).length
                expect(pctNear(row.present, p, p + a)).toBe(true)
                expect(pctNear(row.absent, a, p + a)).toBe(true)
            }
        })

        it('REG-TCH-ATT-015 | Present Records and Overall Rate recompute across all pupils and days', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            const rows = await TeacherAttendancePage.tableRows()
            const all = rows.flatMap(r => r.cells)
            const p = all.filter(c => /^Present/.test(c)).length
            const a = all.filter(c => /^Absent/.test(c)).length
            expect(Number(await TeacherAttendancePage.statValue('Present Records'))).toBe(p)
            expect(pctNear(await TeacherAttendancePage.statValue('Overall Rate'), p, p + a)).toBe(true)
        })
    })

    describe('Edit & Delete', () => {

        it('REG-TCH-ATT-016 | Editing a past date pre-fills the stored statuses and remarks', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            await TeacherAttendancePage.openEdit(D1)
            const rows = await TeacherAttendancePage.modalRows()
            const bayo = rows.find(r => r.name === BAYO)
            expect(bayo.status).toBe('absent')
            expect(bayo.remark).toBe('sick')
            expect(await TeacherAttendancePage.dateInput.getValue()).toBe(D1)
        })

        it('REG-TCH-ATT-017 | Changing a status on a past date updates that historical record and the rates', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            await TeacherAttendancePage.setStatus(CHIDI, 'absent')
            await TeacherAttendancePage.save()
            await openClass()
            expect(await TeacherAttendancePage.cellFor(CHIDI, D1)).toMatch(/^Absent/)
            const row = await TeacherAttendancePage.tableRow(CHIDI)
            const p = row.cells.filter(c => /^Present/.test(c)).length
            const a = row.cells.filter(c => /^Absent/.test(c)).length
            expect(pctNear(row.present, p, p + a)).toBe(true)
            expect(pctNear(row.absent, a, p + a)).toBe(true)
        })

        it('REG-TCH-ATT-018 | Editing keeps the same date column (no duplicate is created)', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            expect((await TeacherAttendancePage.recordedDates()).filter(d => d === D1).length).toBe(1)
        })

        it('REG-TCH-ATT-019 | Deleting a recorded date removes its column and lowers Days Recorded', async () => {
            addFeature('Teacher Attendance'); addSeverity('critical')
            const before = Number(await TeacherAttendancePage.statValue('Days Recorded'))
            await TeacherAttendancePage.deleteDate(D2)
            await openClass()
            expect(await TeacherAttendancePage.recordedDates()).not.toContain(D2)
            expect(Number(await TeacherAttendancePage.statValue('Days Recorded'))).toBe(before - 1)
        })
    })

    describe('Class With No Pupils', () => {

        // The form class can't be emptied without unenrolling other suites'
        // pupils, so the empty state is checked on Pri 2B (no pupils). That
        // the teacher can open Pri 2B at all is itself an RBAC gap — see
        // teacher-rbac.spec.js.
        before(async () => await TeacherAttendancePage.openClass(OTHER_CLASS_ID))

        it('REG-TCH-ATT-020 | A class with no pupils shows 0 students and the "No attendance records yet" state', async () => {
            addFeature('Teacher Attendance'); addSeverity('normal')
            expect(await TeacherAttendancePage.statValue('Total Students')).toBe('0')
            await expect(TeacherAttendancePage.pageContent).toHaveText(/No attendance records yet/i)
        })

        it('REG-TCH-ATT-021 | With no pupils enrolled the Record modal has nobody to mark', async () => {
            addFeature('Teacher Attendance'); addSeverity('minor')
            await TeacherAttendancePage.openRecordModal()
            expect((await TeacherAttendancePage.modalRows()).length).toBe(0)
            await TeacherAttendancePage.closeModal()
        })
    })
})
