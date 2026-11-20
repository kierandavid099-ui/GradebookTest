import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherTimetablePage from '../../page objects/teacherTimetable.page.js'
import { TEACHER_USER, TEACHER_DISPLAY_NAME } from '../../helpers/testData.js'
import { FORM_CLASS_ID, FORM_CLASS_NAME, FIXTURE_SUBJECTS } from '../../helpers/teacherData.js'
import { uniqueName } from '../../helpers/random.js'

// Timetable for Chisom's form class (Pri 2A). All periods this suite adds
// go on Saturday and use the auto-tch subjects / an "auto-tch" break title,
// and are deleted again in the after hook (the before hook sweeps anything an
// aborted run left behind).

const DAY = 'Saturday'
const TAG = 'auto-tch'

describe('REGRESSION — Teacher Timetable', () => {

    let ids
    const breakTitle = `${TAG} Break <b>x</b> ${uniqueName('b')}`
    const openClass = () => TeacherTimetablePage.openClass(FORM_CLASS_ID)

    async function sweep() {
        await openClass()
        for (const day of [DAY, 'Monday']) await TeacherTimetablePage.deleteMatching(day, TAG)
    }

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
        await sweep()
        await openClass()
    })

    after(async () => await sweep())

    describe('Page & Add Period Modal', () => {

        it('REG-TCH-TTB-001 | Timetable opens for the form class with its stat cards', async () => {
            addFeature('Teacher Timetable'); addSeverity('blocker')
            await expect(TeacherTimetablePage.breadcrumb).toHaveText(/Timetable/i)
            await expect(TeacherTimetablePage.subtitle).toHaveText(new RegExp(FORM_CLASS_NAME))
            for (const l of ['Total Slots', 'Teaching Hrs/Week', 'Breaks', 'Periods / Day']) {
                expect(await TeacherTimetablePage.statValue(l)).not.toBeNull()
            }
        })

        it('REG-TCH-TTB-002 | Add Period offers Monday–Saturday and Break plus the class\'s subjects', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            await TeacherTimetablePage.openAddModal()
            const days = await browser.execute(() => [...document.querySelectorAll('#buildTimetableForm [name="day_of_week"] option')].map(o => o.value).filter(Boolean))
            expect(days).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
            const subjects = await browser.execute(() => [...document.querySelectorAll('#build-subject-select option')].map(o => o.textContent.trim()))
            expect(subjects).toEqual(expect.arrayContaining(['Non-Teaching / Break', FIXTURE_SUBJECTS.maths.name, FIXTURE_SUBJECTS.english.name]))
        })

        it('REG-TCH-TTB-003 | Saving an empty period is blocked, starting with Day', async () => {
            addFeature('Teacher Timetable'); addSeverity('critical')
            const { saved } = await TeacherTimetablePage.save()
            expect(saved).toBe(false)
            await expect(TeacherTimetablePage.modal).toBeDisplayed()
            expect(await TeacherTimetablePage.firstInvalidField()).toBe('day_of_week')
        })

        it('REG-TCH-TTB-004 | Period No, Subject, Start and End are each required in turn', async () => {
            addFeature('Teacher Timetable'); addSeverity('critical')
            await TeacherTimetablePage.fill({ day: DAY })
            expect(await TeacherTimetablePage.firstInvalidField()).toBe('period_number')
            await TeacherTimetablePage.fill({ period: 1 })
            expect(await TeacherTimetablePage.firstInvalidField()).toBe('subject_id')
            await TeacherTimetablePage.fill({ subject: ids.maths })
            expect(await TeacherTimetablePage.firstInvalidField()).toBe('start_time')
            await TeacherTimetablePage.fill({ start: '08:00' })
            expect(await TeacherTimetablePage.firstInvalidField()).toBe('end_time')
        })

        it('REG-TCH-TTB-005 | Choosing a subject loads the teachers assigned to it for this class', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            const teachers = await browser.execute(() => [...document.querySelectorAll('#build-teacher-select option')].map(o => o.textContent.trim()))
            expect(teachers).toContain(TEACHER_DISPLAY_NAME)
        })
    })

    describe('Subject & Break Periods', () => {

        let baseline

        before(async () => {
            // Start from a fresh page and a freshly filled modal rather than
            // reusing the half-filled one from the previous section.
            await TeacherTimetablePage.closeModal().catch(() => {})
            await openClass()
            baseline = {
                slots: Number(await TeacherTimetablePage.statValue('Total Slots')),
                breaks: Number(await TeacherTimetablePage.statValue('Breaks')),
                hours: Number(await TeacherTimetablePage.statValue('Teaching Hrs/Week')),
            }
            // Every test below depends on these two periods existing, so a
            // refused save fails here with the server's message instead of
            // surfacing later as "cell undefined" / "count 0".
            for (const period of [
                { day: DAY, period: 1, subject: ids.maths, start: '08:00', end: '08:40' },
                { day: DAY, period: 2, title: breakTitle, subject: 'break', start: '08:40', end: '09:00' },
            ]) {
                await TeacherTimetablePage.openAddModal()
                await TeacherTimetablePage.fill(period)
                const { saved, message } = await TeacherTimetablePage.save()
                if (!saved) throw new Error(`Period ${period.period} was not saved: ${message || 'no swal, page did not reload'}`)
                await openClass()
            }
        })

        it('REG-TCH-TTB-006 | A subject period saves into its Day × Period slot with time range and duration', async () => {
            addFeature('Teacher Timetable'); addSeverity('blocker')
            const [cell] = await TeacherTimetablePage.cellsFor(FIXTURE_SUBJECTS.maths.name).then(c => c.filter(x => x.day === DAY))
            expect(cell).toBeDefined()
            expect(cell.period).toMatch(/1st/)
            expect(cell.text).toMatch(/08:00 AM – 08:40 AM \(40m\)/)
            expect(cell.isBreak).toBe(false)
        })

        it('REG-TCH-TTB-007 | A Break period saves and renders distinctly from subject periods', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            const [cell] = (await TeacherTimetablePage.cellsFor(`${TAG} Break`)).filter(x => x.day === DAY)
            expect(cell).toBeDefined()
            expect(cell.isBreak).toBe(true)
        })

        it('REG-TCH-TTB-008 | HTML in a period title is shown as plain text', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            const [cell] = (await TeacherTimetablePage.cellsFor(`${TAG} Break`)).filter(x => x.day === DAY)
            expect(cell.text).toContain('<b>x</b>')
        })

        it('REG-TCH-TTB-009 | Total Slots and Breaks count the new periods; teaching hours only the subject one', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            expect(Number(await TeacherTimetablePage.statValue('Total Slots'))).toBe(baseline.slots + 2)
            expect(Number(await TeacherTimetablePage.statValue('Breaks'))).toBe(baseline.breaks + 1)
            expect(Number(await TeacherTimetablePage.statValue('Teaching Hrs/Week'))).toBeCloseTo(baseline.hours + 40 / 60, 1)
        })
    })

    describe('Time Validation', () => {

        beforeEach(async () => {
            await openClass()
            await TeacherTimetablePage.openAddModal()
        })

        afterEach(async () => await TeacherTimetablePage.closeModal().catch(() => {}))

        it('REG-TCH-TTB-010 | An End Time earlier than the Start Time is rejected and nothing is saved', async () => {
            addFeature('Teacher Timetable'); addSeverity('critical')
            await TeacherTimetablePage.fill({ day: DAY, period: 3, subject: ids.english, start: '10:00', end: '09:00' })
            const { saved, message } = await TeacherTimetablePage.save()
            expect(saved).toBe(false)
            expect(message).toMatch(/end time must be .*after start time/i)
            await openClass()
            expect((await TeacherTimetablePage.cells()).find(c => c.day === DAY && /3rd/.test(c.period) && c.text !== '—')).toBeUndefined()
        })

        it('REG-TCH-TTB-011 | An End Time equal to the Start Time is rejected', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            await TeacherTimetablePage.fill({ day: DAY, period: 3, subject: ids.english, start: '10:00', end: '10:00' })
            const { saved } = await TeacherTimetablePage.save()
            expect(saved).toBe(false)
        })

        it('REG-TCH-TTB-012 | A second period in an already-used Day × Period slot does not create a duplicate', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            await TeacherTimetablePage.fill({ day: DAY, period: 1, subject: ids.english, start: '11:00', end: '11:40' })
            await TeacherTimetablePage.save()
            await openClass()
            const slot = (await TeacherTimetablePage.cells()).filter(c => c.day === DAY && /1st/.test(c.period))
            expect(slot.length).toBe(1)
            // Whichever one the app keeps, the cell must hold a single period.
            const subjectsInCell = [FIXTURE_SUBJECTS.maths.name, FIXTURE_SUBJECTS.english.name].filter(s => slot[0].text.includes(s))
            expect(subjectsInCell.length).toBe(1)
        })
    })

    describe('Edit & Delete', () => {

        it('REG-TCH-TTB-013 | Editing a period updates it in place (no extra slot is created)', async () => {
            addFeature('Teacher Timetable'); addSeverity('normal')
            // Break cells only show their title (no times), so edit the title.
            await openClass()
            await TeacherTimetablePage.openEdit(DAY, `${TAG} Break`)
            await TeacherTimetablePage.fill({ title: `${breakTitle} edited`, start: '09:00', end: '09:20' })
            await TeacherTimetablePage.save()
            await openClass()
            const cells = (await TeacherTimetablePage.cellsFor(`${TAG} Break`)).filter(x => x.day === DAY)
            expect(cells.length).toBe(1)
            expect(cells[0].text).toContain('edited')
        })

        it('REG-TCH-TTB-014 | Deleting a period removes it from the grid', async () => {
            addFeature('Teacher Timetable'); addSeverity('critical')
            const before = Number(await TeacherTimetablePage.statValue('Total Slots'))
            expect(await TeacherTimetablePage.deleteMatching(DAY, `${TAG} Break`)).toBe(1)
            await openClass()
            expect((await TeacherTimetablePage.cellsFor(`${TAG} Break`)).length).toBe(0)
            expect(Number(await TeacherTimetablePage.statValue('Total Slots'))).toBe(before - 1)
        })
    })
})
