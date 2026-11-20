import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import GradingPage from '../../page objects/adminGrading.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { API, FIXTURE_LEVEL } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// Assessment Schemes: the 100% weight rule, the live counter, component
// rows, level scoping and the one-default-per-level rule.
//
// A school's grade sheets take their columns from the scheme for the class
// level, so saved schemes are kept on Upper Primary (Chisom's live class is
// Lower Primary). The one scoping test that has to create Lower Primary and
// All Classes schemes deletes them again inside the same test. Every scheme
// is named auto-adm-sch-<tag> and removed in the after hook.

describe('REGRESSION — Admin Assessment Schemes', () => {

    const tag = randomString(5)
    const name = (s) => `auto-adm-sch-${tag}-${s}`
    const valid = [{ title: 'CA1', weight: 20 }, { title: 'CA2', weight: 20 }, { title: 'Exam', weight: 60 }]

    const deleteMine = async () => {
        await GradingPage.openGrading()
        const ids = await browser.execute(t => [...document.querySelectorAll('.btn-delete-scheme')]
            .filter(b => b.dataset.name.includes(t)).map(b => b.dataset.id), tag)
        for (const id of ids) await AdminApi.deleteScheme(id)
    }

    // A 3s pause after every modal opens and before every save/close, so a
    // run can be followed by eye.
    const MODAL_PAUSE = 3000
    const pause = () => browser.pause(MODAL_PAUSE)
    const save = async () => { await pause(); await GradingPage.saveSchemeBtn.click() }
    const close = async () => {
        if (await browser.execute(() => !!document.querySelector('.modal.show'))) await pause()
        await GradingPage.closeModal()
    }
    const createScheme = async (scheme) => {
        await GradingPage.fillScheme(scheme)
        await save()
        return GradingPage.readAndConfirmSwal(10000)
    }

    // Schemes that were default before the run. The default tests demote
    // them (e.g. the 40/60 Upper Primary scheme the teacher suites grade
    // against), so they are promoted back in the after hook.
    let originalDefaults = []

    before(async () => {
        // fillScheme opens its modal internally, so the open-side pause has to
        // ride on openModalVia; the instance override is dropped in after().
        const openModalVia = GradingPage.openModalVia.bind(GradingPage)
        GradingPage.openModalVia = async (...args) => { await openModalVia(...args); await pause() }
        await LoginPage.loginAs(ADMIN_USER)
        await GradingPage.openGrading()
        originalDefaults = await browser.execute(() => [...document.querySelectorAll('.btn-edit-scheme[data-default="1"]')].map(b => b.dataset.id))
    })

    afterEach(async () => { await close() })

    after(async () => {
        await deleteMine()
        for (const id of originalDefaults) await AdminApi.post(`${API}/grading_schemes/${id}/set-default`)
        delete GradingPage.openModalVia
    })

    describe('Weight rules', () => {

        it('REG-ADM-ASM-001 | The scheme modal opens with two component rows and a 0% counter', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            await GradingPage.openModalVia(GradingPage.addSchemeBtn, GradingPage.createSchemeModal)
            expect(await GradingPage.itemRows.length).toBe(2)
            await expect(GradingPage.weightTotal).toHaveText('0%')
        })

        it('REG-ADM-ASM-002 | The live counter shows 90% as invalid and turns valid at exactly 100%', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            await GradingPage.fillScheme({ name: name('live'), appliesTo: FIXTURE_LEVEL, items: [{ title: 'CA', weight: 30 }, { title: 'Exam', weight: 60 }] })
            await expect(GradingPage.weightTotal).toHaveText('90%')
            await expect(GradingPage.weightTotal).toHaveElementClass('weight-bad')
            const rows = await GradingPage.itemRows
            await rows[0].$('.si-weight').setValue('40')
            await expect(GradingPage.weightTotal).toHaveText('100%')
            await expect(GradingPage.weightTotal).toHaveElementClass('weight-ok')
        })

        it('REG-ADM-ASM-003 | Saving a scheme that totals less than 100% is blocked', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            await GradingPage.fillScheme({ name: name('under'), appliesTo: FIXTURE_LEVEL, items: [{ title: 'CA', weight: 30 }, { title: 'Exam', weight: 60 }] })
            await save()
            await expect(GradingPage.schemeError).toHaveText(/Weights must total 100%. Current total: 90%/i)
        })

        it('REG-ADM-ASM-004 | Saving a scheme that totals more than 100% is blocked', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            await GradingPage.fillScheme({ name: name('over'), appliesTo: FIXTURE_LEVEL, items: [{ title: 'CA', weight: 50 }, { title: 'Exam', weight: 60 }] })
            await save()
            await expect(GradingPage.schemeError).toHaveText(/Current total: 110%/i)
        })

        it('REG-ADM-ASM-005 | A non-numeric weight cannot be typed into a component', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            await GradingPage.fillScheme({ name: name('abc'), appliesTo: FIXTURE_LEVEL })
            const weight = (await GradingPage.itemRows)[0].$('.si-weight')
            await weight.setValue('abc')
            expect(await weight.getValue()).toBe('')
            await expect(GradingPage.weightTotal).toHaveText('0%')
        })

        // A -10 and a 110 still "total 100" — only non-negative weights that
        // add up to 100 should be accepted.
        it('REG-ADM-ASM-006 | A negative component weight is rejected even when the total is 100', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            await GradingPage.fillScheme({ name: name('neg'), appliesTo: FIXTURE_LEVEL, items: [{ title: 'CA', weight: -10 }, { title: 'Exam', weight: 110 }] })
            await save()
            // The client lets it through; the server answers with an error alert.
            const alert = await GradingPage.readAndConfirmSwal(5000)
            const inline = await GradingPage.schemeError.isDisplayed()
            expect(inline || /invalid|error/i.test(alert || '')).toBe(true)
            await close()
            await GradingPage.openGrading()
            await expect(GradingPage.schemeCard(name('neg'))).not.toBeExisting()
        })

        it('REG-ADM-ASM-007 | Scheme name is required', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            await GradingPage.fillScheme({ appliesTo: FIXTURE_LEVEL, items: valid })
            await save()
            await expect(GradingPage.schemeError).toHaveText(/Scheme name is required/i)
        })

        it('REG-ADM-ASM-008 | Every component needs a title', async () => {
            addFeature('Assessment Schemes'); addSeverity('minor')
            await GradingPage.fillScheme({ name: name('notitle'), appliesTo: FIXTURE_LEVEL, items: [{ title: 'CA', weight: 40 }, { title: 'Exam', weight: 60 }] })
            await (await GradingPage.itemRows)[1].$('.si-title').clearValue()
            await save()
            await expect(GradingPage.schemeError).toHaveText(/All component titles are required/i)
        })

        // By design, removing a row leaves the counter alone; Save Scheme is
        // what recalculates it.
        it('REG-ADM-ASM-009 | Component rows can be added and removed and the total recalculates on save', async () => {
            addFeature('Assessment Schemes'); addSeverity('minor')
            await GradingPage.fillScheme({ name: name('rows'), appliesTo: FIXTURE_LEVEL, items: valid })
            expect(await GradingPage.itemRows.length).toBe(3)
            await expect(GradingPage.weightTotal).toHaveText('100%')
            await (await GradingPage.itemRows)[1].$('.btn-remove-item').click()
            expect(await GradingPage.itemRows.length).toBe(2)
            await save()
            await expect(GradingPage.weightTotal).toHaveText('80%')
        })

        // The counter still reads 100% when Save is clicked, so the save-time
        // check must not trust it or an 80% scheme would be saved.
        it('REG-ADM-ASM-016 | Saving after removing a row is blocked when the remaining weights total less than 100%', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            await GradingPage.fillScheme({ name: name('removed'), appliesTo: FIXTURE_LEVEL, items: valid })
            await (await GradingPage.itemRows)[1].$('.btn-remove-item').click()
            expect(await GradingPage.itemRows.length).toBe(2)
            await save()
            await expect(GradingPage.schemeError).toHaveText(/Weights must total 100%. Current total: 80%/i)
            await close()
            await GradingPage.openGrading()
            await expect(GradingPage.schemeCard(name('removed'))).not.toBeExisting()
        })
    })

    describe('Saving & defaults', () => {

        it('REG-ADM-ASM-010 | A scheme of CA1 20 + CA2 20 + Exam 60 saves and shows a ✓ 100% card', async () => {
            addFeature('Assessment Schemes'); addSeverity('blocker')
            expect(await createScheme({ name: name('main'), appliesTo: FIXTURE_LEVEL, items: valid })).toMatch(/Scheme created/i)
            await GradingPage.openGrading()
            await expect(GradingPage.schemeCard(name('main'))).toBeExisting()
            await expect(GradingPage.schemeCard(name('main'))).toHaveText(/100%/)
            await expect(GradingPage.schemeAppliesChip(name('main'))).toHaveText(/Upper Primary/i)
        })

        it('REG-ADM-ASM-011 | Each scheme is scoped to the level chosen in Applies To', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            const scopes = { lower_primary: /Lower Primary/i, all: /All Classes/i }
            try {
                for (const level of Object.keys(scopes)) {
                    await createScheme({ name: name(`scope-${level}`), appliesTo: level, items: valid })
                    await GradingPage.openGrading()
                }
                for (const [level, label] of Object.entries(scopes)) {
                    await expect(GradingPage.schemeAppliesChip(name(`scope-${level}`))).toHaveText(label)
                }
            } finally {
                // These two scopes would reach Chisom's live class; remove at once.
                for (const level of Object.keys(scopes)) {
                    const card = GradingPage.schemeCard(name(`scope-${level}`))
                    if (await card.isExisting()) await AdminApi.deleteScheme(await card.getAttribute('data-scheme-id'))
                }
                await GradingPage.openGrading()
            }
        })

        it('REG-ADM-ASM-012 | Marking a new scheme default for a level auto-demotes the previous default', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            await createScheme({ name: name('def1'), appliesTo: FIXTURE_LEVEL, isDefault: true, items: valid })
            await GradingPage.openGrading()
            expect(await GradingPage.isDefault(name('def1'))).toBe(true)
            await createScheme({ name: name('def2'), appliesTo: FIXTURE_LEVEL, isDefault: true, items: valid })
            await GradingPage.openGrading()
            expect(await GradingPage.isDefault(name('def2'))).toBe(true)
            expect(await GradingPage.isDefault(name('def1'))).toBe(false)
        })

        it('REG-ADM-ASM-013 | A level never holds two default schemes at once', async () => {
            addFeature('Assessment Schemes'); addSeverity('critical')
            const defaults = await browser.execute(() => [...document.querySelectorAll('.scheme-card.is-default-scheme')]
                .map(c => c.querySelector('.btn-edit-scheme').dataset.applies))
            expect(new Set(defaults).size).toBe(defaults.length)
        })

        it('REG-ADM-ASM-014 | The star button promotes a scheme to default and demotes the old one', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            const id = await GradingPage.schemeIdByName(name('def1'))
            await $(`.btn-set-default-scheme[data-id="${id}"]`).click()
            await GradingPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
            await GradingPage.openGrading()
            expect(await GradingPage.isDefault(name('def1'))).toBe(true)
            expect(await GradingPage.isDefault(name('def2'))).toBe(false)
        })

        it('REG-ADM-ASM-015 | HTML in a scheme or component name is shown as text', async () => {
            addFeature('Assessment Schemes'); addSeverity('normal')
            await createScheme({ name: name('<img src=x onerror=window.__xss=1>'), appliesTo: FIXTURE_LEVEL, items: [{ title: '<b>CA</b>', weight: 40 }, { title: 'Exam', weight: 60 }] })
            await GradingPage.openGrading()
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect(GradingPage.schemeCard(name('<img src=x onerror=window.__xss=1>'))).toBeExisting()
        })
    })
})
