import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherConductPage from '../../page objects/teacherConduct.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import { FORM_CLASS_ID, FORM_CLASS_NAME, OTHER_CLASS_ID, studentSheetName } from '../../helpers/teacherData.js'
import { uniqueName } from '../../helpers/random.js'

// Conduct items for Chisom's form class (Pri 2A). Every item this suite
// creates is titled "auto-tch …" and deleted again in the after hook (plus a
// sweep in the before hook for anything an aborted run left behind).

const ADA = studentSheetName('Ada')
const BAYO = studentSheetName('Bayo')
const CHIDI = studentSheetName('Chidi')

describe('REGRESSION — Teacher Conduct', () => {

    const item = uniqueName('auto-tch Neatness')
    const defaultItem = uniqueName('auto-tch Punctuality')
    const renamed = `${item} (edited)`
    const htmlItem = `auto-tch <b>Bold</b> ${uniqueName('x')}`
    const openClass = () => TeacherConductPage.openClass(FORM_CLASS_ID)

    async function sweep() {
        await openClass()
        for (const i of await TeacherConductPage.items()) {
            if (i.title.startsWith('auto-tch')) { await TeacherConductPage.deleteItem(i.title); await openClass() }
        }
    }

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await TeacherFixtures.ensure()
        await sweep()
    })

    after(async () => await sweep())

    describe('Page & Add Modal', () => {

        it('REG-TCH-CON-001 | Conduct opens for the form class with its stat cards', async () => {
            addFeature('Teacher Conduct'); addSeverity('blocker')
            await expect(TeacherConductPage.breadcrumb).toHaveText(/Conduct/i)
            await expect(TeacherConductPage.subtitle).toHaveText(new RegExp(FORM_CLASS_NAME))
            for (const l of ['Conduct Items', 'Students', 'Average Score', 'Highest Score']) {
                expect(await TeacherConductPage.statValue(l)).not.toBeNull()
            }
        })

        it('REG-TCH-CON-002 | Add Conduct Item has a required Title and a Max Score that defaults to 10', async () => {
            addFeature('Teacher Conduct'); addSeverity('critical')
            await TeacherConductPage.openAddModal()
            expect(await TeacherConductPage.addTitleInput.getAttribute('required')).not.toBeNull()
            expect(await TeacherConductPage.addMaxInput.getValue()).toBe('10')
        })

        it('REG-TCH-CON-003 | Saving with a blank Title is blocked', async () => {
            addFeature('Teacher Conduct'); addSeverity('critical')
            await TeacherConductPage.addSaveBtn.click()
            await expect(TeacherConductPage.addModal).toBeDisplayed()
            expect(await browser.execute(el => el.validity.valueMissing, await TeacherConductPage.addTitleInput)).toBe(true)
        })

        it('REG-TCH-CON-004 | A Max Score of 0 is rejected (minimum 1)', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            await TeacherConductPage.addMaxInput.clearValue()
            await TeacherConductPage.addMaxInput.setValue('0')
            expect(await browser.execute(el => el.validity.rangeUnderflow, await TeacherConductPage.addMaxInput)).toBe(true)
            await TeacherConductPage.closeModal()
        })
    })

    describe('Create Items', () => {

        let itemsBefore

        before(async () => {
            await openClass()
            itemsBefore = Number(await TeacherConductPage.statValue('Conduct Items'))
            await TeacherConductPage.addItem(item, 5)
            await openClass()
            await TeacherConductPage.addItem(defaultItem)
            await openClass()
        })

        it('REG-TCH-CON-005 | A titled item with Max 5 saves and its column reads "Max: 5 pts"', async () => {
            addFeature('Teacher Conduct'); addSeverity('blocker')
            expect((await TeacherConductPage.item(item)).max).toBe('5')
            expect(await TeacherConductPage.headerFor(item)).toMatch(/Max: 5 pts/)
        })

        it('REG-TCH-CON-006 | An item saved without changing Max is scored out of the default 10', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            expect((await TeacherConductPage.item(defaultItem)).max).toBe('10')
        })

        it('REG-TCH-CON-007 | Conduct Items stat counts the new items', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            expect(Number(await TeacherConductPage.statValue('Conduct Items'))).toBe(itemsBefore + 2)
        })

        it('REG-TCH-CON-008 | Each pupil gets a score input capped at the item\'s Max', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            for (const n of [ADA, BAYO, CHIDI]) {
                expect(await (await TeacherConductPage.scoreInput(item, n)).getAttribute('max')).toBe('5')
            }
        })
    })

    describe('Score Validation', () => {

        it('REG-TCH-CON-009 | A score above the item Max (6 / 5) is rejected with a clear message', async () => {
            addFeature('Teacher Conduct'); addSeverity('blocker')
            await openClass()
            await TeacherConductPage.setScore(item, ADA, 6)
            const msg = await TeacherConductPage.saveAll()
            expect(msg).toMatch(/cannot be greater than the max score \(5\)/i)
        })

        it('REG-TCH-CON-010 | The rejected over-max score is not stored', async () => {
            addFeature('Teacher Conduct'); addSeverity('critical')
            await openClass()
            expect(await TeacherConductPage.getScore(item, ADA)).not.toBe('6')
        })

        // DEFECT (2026-11-12): a negative conduct score (e.g. -1) is accepted
        // and persisted — no error swal, value stored as "-1". Scores should
        // be refused below 0.
        it('REG-TCH-CON-011 | A negative conduct score is rejected', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            await TeacherConductPage.setScore(item, BAYO, -1)
            const msg = await TeacherConductPage.saveAll()
            await openClass()
            const stored = await TeacherConductPage.getScore(item, BAYO)
            expect({ msg: /error/i.test(msg || ''), stored }).toEqual({ msg: true, stored: '' })
        })
    })

    describe('Save All Scores & Stats', () => {

        before(async () => {
            await openClass()
            await TeacherConductPage.setScore(item, ADA, 5)
            await TeacherConductPage.setScore(item, BAYO, 3)
            await TeacherConductPage.setScore(item, CHIDI, 4)
            await TeacherConductPage.setScore(defaultItem, ADA, 8)
            await TeacherConductPage.saveAll()
            await openClass()
        })

        it('REG-TCH-CON-012 | Save All Scores stores every pupil\'s score in one go', async () => {
            addFeature('Teacher Conduct'); addSeverity('blocker')
            expect(Number(await TeacherConductPage.getScore(item, ADA))).toBe(5)
            expect(Number(await TeacherConductPage.getScore(item, BAYO))).toBe(3)
            expect(Number(await TeacherConductPage.getScore(item, CHIDI))).toBe(4)
            expect(Number(await TeacherConductPage.getScore(defaultItem, ADA))).toBe(8)
        })

        it('REG-TCH-CON-013 | Highest Score reflects the best score entered', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            const all = await browser.execute(() => [...document.querySelectorAll('.score-entry')].map(i => i.value).filter(v => v !== '').map(Number))
            expect(Number(await TeacherConductPage.statValue('Highest Score'))).toBe(Math.max(...all))
        })

        it('REG-TCH-CON-014 | Average Score reflects the entered scores', async () => {
            addFeature('Teacher Conduct'); addSeverity('minor')
            const all = await browser.execute(() => [...document.querySelectorAll('.score-entry')].map(i => i.value).filter(v => v !== '').map(Number))
            const avg = all.reduce((a, b) => a + b, 0) / all.length
            expect(Number(await TeacherConductPage.statValue('Average Score'))).toBeCloseTo(avg, 1)
        })
    })

    describe('Edit & Delete', () => {

        it('REG-TCH-CON-015 | Editing an item\'s title and max persists', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            await openClass()
            await TeacherConductPage.editItem(item, { newTitle: renamed, newMax: 6 })
            await openClass()
            const i = await TeacherConductPage.item(renamed)
            expect(i).toBeDefined()
            expect(i.max).toBe('6')
            expect(await TeacherConductPage.headerFor(renamed)).toMatch(/Max: 6 pts/)
        })

        it('REG-TCH-CON-016 | HTML in an item title is shown as plain text', async () => {
            addFeature('Teacher Conduct'); addSeverity('normal')
            await TeacherConductPage.addItem(htmlItem, 3)
            await openClass()
            expect(await TeacherConductPage.headerFor(htmlItem)).toContain('<b>Bold</b>')
        })

        it('REG-TCH-CON-017 | Deleting an item removes its column (and its scores)', async () => {
            addFeature('Teacher Conduct'); addSeverity('critical')
            const before = Number(await TeacherConductPage.statValue('Conduct Items'))
            await TeacherConductPage.deleteItem(renamed)
            await openClass()
            expect(await TeacherConductPage.item(renamed)).toBeUndefined()
            expect(await TeacherConductPage.headerFor(renamed)).toBeNull()
            expect(Number(await TeacherConductPage.statValue('Conduct Items'))).toBe(before - 1)
        })
    })

    describe('Class With No Pupils', () => {

        // Proxy for "form class with 0 enrolled": Pri 2B has no pupils (and
        // isn't Chisom's form class — see teacher-rbac.spec.js).
        before(async () => await TeacherConductPage.openClass(OTHER_CLASS_ID))

        it('REG-TCH-CON-018 | A class with no pupils shows 0 students and no score inputs', async () => {
            addFeature('Teacher Conduct'); addSeverity('minor')
            expect(await TeacherConductPage.statValue('Students')).toBe('0')
            expect((await $$('.score-entry')).length).toBe(0)
        })
    })
})
