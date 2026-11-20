import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { FIXTURE_LEVEL } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// Classes tab: batch-creating arm classes, blank arms, duplicate codes and
// arm normalisation. Every class is an Upper Primary fixture named
// auto-adm-cls-*, and every class this spec creates is deleted in the
// after hook (the pre-existing Primary 1–5 classes are never touched).

describe('REGRESSION — Admin Classes', () => {

    const tag = randomString(5).toUpperCase()
    const armed = { name: `auto-adm-cls-${tag}`, code: `AQ${tag}`, level: FIXTURE_LEVEL, arms: 'A, B, C', max: 10 }
    const single = { name: `auto-adm-cls1-${tag}`, code: `AS${tag}`, level: FIXTURE_LEVEL, max: 7 }
    const messy = { name: `auto-adm-clsn-${tag}`, code: `AN${tag}`, level: FIXTURE_LEVEL, arms: ' a , B ,c , ', max: 5 }
    const xss = { name: `auto-adm-clsx-${tag}<img src=x onerror=window.__xss=1>`, code: `AX${tag}`, level: FIXTURE_LEVEL }
    const created = []

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('classes')
    })

    // A failed step can leave the Create Class modal open over the page,
    // which would block every later click.
    afterEach(async () => { await AcademicPage.closeModal() })

    after(async () => {
        await AcademicPage.openOn('classes')
        const ids = await browser.execute(t => [...document.querySelectorAll('.btn-delete-group')]
            .filter(b => b.dataset.name.startsWith('auto-adm-cls') && b.dataset.name.includes(t))
            .flatMap(b => JSON.parse(b.dataset.ids)), tag)
        for (const id of ids) await AdminApi.deleteClass(id)
    })

    describe('Create Class modal', () => {

        it('REG-ADM-CLS-001 | Classes tab shows capacity stats and the Add Class button', async () => {
            addFeature('Classes'); addSeverity('blocker')
            await expect(AcademicPage.newClassBtn).toBeDisplayed()
            await expect(AcademicPage.statValue('classes', 'Total Capacity')).toBeDisplayed()
            await expect(AcademicPage.statValue('classes', 'Available Spots')).toBeDisplayed()
        })

        it('REG-ADM-CLS-002 | The Level list offers this Combined school\'s four tiers', async () => {
            addFeature('Classes'); addSeverity('normal')
            const values = await browser.execute(() => [...document.querySelectorAll('#cc-level option')].map(o => o.value).filter(Boolean))
            expect(values).toEqual(['lower_primary', 'upper_primary', 'junior_secondary', 'senior_secondary'])
        })

        it('REG-ADM-CLS-003 | Name, code and level are required', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.fillClass({ name: armed.name, code: '' })
            await AcademicPage.createClassBtn.click()
            await expect(AcademicPage.classCreateError).toHaveText(/Name, code prefix and level are required/i)
            await AcademicPage.closeModal()
        })

        it('REG-ADM-CLS-004 | Typing arms previews one chip per arm-class (code + arm)', async () => {
            addFeature('Classes'); addSeverity('normal')
            await AcademicPage.fillClass(armed)
            await expect(AcademicPage.classPreview).toBeDisplayed()
            const chips = await AcademicPage.classPreviewChips.map(c => c.getText())
            expect(chips).toEqual([`${armed.code}A`, `${armed.code}B`, `${armed.code}C`])
        })

        it('REG-ADM-CLS-005 | Batch-create a class with arms A, B, C at 10 per arm', async () => {
            addFeature('Classes'); addSeverity('blocker')
            await AcademicPage.fillClass(armed)
            expect(await AcademicPage.submitClass()).toMatch(/3 arm classes created/i)
            await AcademicPage.openOn('classes')
            created.push(armed.name)
            // 2026-10-30: the card lists arms in no fixed order (seen C,A,B),
            // so compare the set, not the order.
            expect((await AcademicPage.armChips(armed.name)).sort()).toEqual(['A', 'B', 'C'])
            expect((await AcademicPage.classGroupIds(armed.name)).length).toBe(3)
        })

        it('REG-ADM-CLS-006 | Each arm is seeded with the per-arm capacity (card Cap = 3 × 10)', async () => {
            addFeature('Classes'); addSeverity('critical')
            expect(await AcademicPage.classCap(armed.name)).toBe(30)
        })

        it('REG-ADM-CLS-007 | A class with blank arms is created as a single class with no arm suffix', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.fillClass(single)
            await expect(AcademicPage.classPreview).not.toBeDisplayed()
            expect(await AcademicPage.submitClass()).toMatch(/saved successfully/i)
            await AcademicPage.openOn('classes')
            expect((await AcademicPage.classGroupIds(single.name)).length).toBe(1)
            expect(await AcademicPage.armChips(single.name)).toEqual(['—'])
        })

        it('REG-ADM-CLS-008 | A duplicate class code is rejected', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.fillClass({ ...single, name: `${single.name}-dup` })
            await AcademicPage.createClassBtn.click()
            await expect(AcademicPage.classCreateError).toBeDisplayed({ wait: 10000 })
            await AcademicPage.closeModal()
            await AcademicPage.openOn('classes')
            await expect(AcademicPage.classCard(`${single.name}-dup`)).not.toBeExisting()
        })

        it('REG-ADM-CLS-009 | Arms with stray spaces / mixed case are trimmed and normalised (no blank arm)', async () => {
            addFeature('Classes'); addSeverity('minor')
            await AcademicPage.fillClass(messy)
            const chips = await AcademicPage.classPreviewChips.map(c => c.getText())
            expect(chips).toEqual([`${messy.code}A`, `${messy.code}B`, `${messy.code}C`])
            await AcademicPage.submitClass()
            await AcademicPage.openOn('classes')
            expect((await AcademicPage.classGroupIds(messy.name)).length).toBe(3)
            // The preview upper-cases arms; the stored arms should match it.
            // Sorted: card arm order isn't fixed (see CLS-005).
            expect((await AcademicPage.armChips(messy.name)).sort()).toEqual(['A', 'B', 'C'])
        })

        it('REG-ADM-CLS-010 | HTML in a class name is shown as text, not executed', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.fillClass(xss)
            await AcademicPage.submitClass()
            await AcademicPage.openOn('classes')
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect(AcademicPage.classCard(xss.name)).toBeExisting()
            expect(await AcademicPage.classCard(xss.name).$('img').isExisting()).toBe(false)
        })
    })

    describe('Search & edit', () => {

        it('REG-ADM-CLS-011 | Searching classes narrows the cards; an unknown term shows "No results"', async () => {
            addFeature('Classes'); addSeverity('minor')
            await AcademicPage.classSearch.setValue(armed.name)
            await expect(AcademicPage.classCard(armed.name)).toBeDisplayed()
            await expect(AcademicPage.classCard('Primary 1')).not.toBeDisplayed()
            await AcademicPage.classSearch.setValue('zz-no-such-class-zz')
            await expect($('#classes-no-results')).toHaveText(/No results/i)
        })

        it('REG-ADM-CLS-012 | Editing a class group\'s per-arm capacity recomputes its total capacity', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.openOn('classes')
            await AcademicPage.findClass(armed.name)
            await AcademicPage.openModalVia(AcademicPage.classGroupEditBtn(armed.name), AcademicPage.editGroupModal)
            await AcademicPage.editGroupMaxInput.setValue('12')
            await AcademicPage.updateGroupBtn.click()
            expect(await AcademicPage.readAndConfirmSwal(15000)).toMatch(/updated/i)
            await AcademicPage.openOn('classes')
            expect(await AcademicPage.classCap(armed.name)).toBe(36)
        })
    })
})
