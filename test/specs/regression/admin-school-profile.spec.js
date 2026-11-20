import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import SettingsPage from '../../page objects/adminSettings.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { randomString } from '../../helpers/random.js'

// Manage Settings > School Profile. The profile is the school's only one,
// so the save test changes just the optional Short Name and puts the whole
// profile back to its original values in the after hook.

describe('REGRESSION — Admin School Profile', () => {

    let original

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await SettingsPage.openOn('tab_school_profile')
        original = await SettingsPage.profileValues()
    })

    after(async () => {
        await SettingsPage.openOn('tab_school_profile')
        const now = await SettingsPage.profileValues()
        if (JSON.stringify(now) !== JSON.stringify(original)) await SettingsPage.restoreProfile(original)
    })

    describe('Form', () => {

        it('REG-ADM-PRF-001 | School Profile shows the required name, type and ownership fields', async () => {
            addFeature('School Profile'); addSeverity('blocker')
            for (const el of [SettingsPage.fullNameInput, SettingsPage.schoolTypeSelect, SettingsPage.ownershipSelect]) {
                await expect(el).toBeDisplayed()
                expect(await el.getAttribute('required')).not.toBeNull()
            }
        })

        it('REG-ADM-PRF-002 | The header preview follows the name and type as they are typed', async () => {
            addFeature('School Profile'); addSeverity('normal')
            await SettingsPage.fullNameInput.setValue('Preview Check Academy')
            await expect(SettingsPage.previewName).toHaveText('Preview Check Academy')
            // 2026-11-11: #preview-type is server-rendered with just the word
            // (e.g. "Combined") and only refreshes on a real change event — so
            // re-selecting the saved value is a no-op. Bounce through a
            // different value first to guarantee the handler fires (probed).
            const other = await SettingsPage.schoolTypeSelect.getValue() === 'primary' ? 'secondary' : 'primary'
            await SettingsPage.schoolTypeSelect.selectByAttribute('value', other)
            await SettingsPage.schoolTypeSelect.selectByAttribute('value', 'combined')
            await expect(SettingsPage.previewType).toHaveText(/Combined School/i)
        })

        it('REG-ADM-PRF-003 | Reset puts unsaved edits back to the saved values', async () => {
            addFeature('School Profile'); addSeverity('normal')
            await SettingsPage.resetProfileBtn.click()
            expect(await SettingsPage.fullNameInput.getValue()).toBe(original['sp-full-name'])
            expect(await SettingsPage.schoolTypeSelect.getValue()).toBe(original['sp-school-type'])
            await expect(SettingsPage.saveStatus).toHaveText(/Reset to saved values/i)
        })

        it('REG-ADM-PRF-004 | Saving with a blank School Full Name is blocked and the field is flagged', async () => {
            addFeature('School Profile'); addSeverity('critical')
            await SettingsPage.fullNameInput.clearValue()
            await SettingsPage.saveProfileBtn.click()
            expect(await SettingsPage.readAndConfirmSwal(3000)).toBeNull()
            await expect(SettingsPage.form).toHaveElementClass('was-validated')
            await expect(SettingsPage.invalidFeedbackFor(SettingsPage.fullNameInput)).toBeDisplayed()
            await SettingsPage.resetProfileBtn.click()
        })

        it('REG-ADM-PRF-005 | Saving with no School Type selected is blocked', async () => {
            addFeature('School Profile'); addSeverity('critical')
            await SettingsPage.schoolTypeSelect.selectByAttribute('value', '')
            await SettingsPage.saveProfileBtn.click()
            expect(await SettingsPage.readAndConfirmSwal(3000)).toBeNull()
            await expect(SettingsPage.invalidFeedbackFor(SettingsPage.schoolTypeSelect)).toBeDisplayed()
            await SettingsPage.resetProfileBtn.click()
        })

        it('REG-ADM-PRF-006 | Saving with no Ownership selected is blocked', async () => {
            addFeature('School Profile'); addSeverity('normal')
            await SettingsPage.ownershipSelect.selectByAttribute('value', '')
            await SettingsPage.saveProfileBtn.click()
            expect(await SettingsPage.readAndConfirmSwal(3000)).toBeNull()
            await expect(SettingsPage.invalidFeedbackFor(SettingsPage.ownershipSelect)).toBeDisplayed()
            await SettingsPage.resetProfileBtn.click()
        })

        it('REG-ADM-PRF-007 | A malformed official email is blocked by validation', async () => {
            addFeature('School Profile'); addSeverity('minor')
            await SettingsPage.emailInput.setValue('not-an-email')
            await SettingsPage.saveProfileBtn.click()
            expect(await SettingsPage.readAndConfirmSwal(3000)).toBeNull()
            expect(await browser.execute(() => document.getElementById('sp-email').checkValidity())).toBe(false)
            await SettingsPage.resetProfileBtn.click()
        })

        it('REG-ADM-PRF-008 | A year of establishment in the future is blocked', async () => {
            addFeature('School Profile'); addSeverity('minor')
            await SettingsPage.yearInput.setValue('2999')
            await SettingsPage.saveProfileBtn.click()
            expect(await SettingsPage.readAndConfirmSwal(3000)).toBeNull()
            await SettingsPage.resetProfileBtn.click()
        })
    })

    describe('Save', () => {

        const shortName = `AutoAdm ${randomString(4)}`

        it('REG-ADM-PRF-009 | Saving a complete profile succeeds and the header reflects it after reload', async () => {
            addFeature('School Profile'); addSeverity('blocker')
            await SettingsPage.openOn('tab_school_profile')
            await SettingsPage.shortNameInput.setValue(shortName)
            expect(await SettingsPage.saveProfile()).toMatch(/School profile saved successfully/i)
            await SettingsPage.openOn('tab_school_profile')
            expect(await SettingsPage.shortNameInput.getValue()).toBe(shortName)
            await expect(SettingsPage.previewShortName).toHaveText(shortName)
            await expect(SettingsPage.previewName).toHaveText(original['sp-full-name'])
        })

        it('REG-ADM-PRF-010 | HTML in the school name is shown as text in the preview', async () => {
            addFeature('School Profile'); addSeverity('normal')
            await SettingsPage.fullNameInput.setValue('<img src=x onerror=window.__xss=1>School')
            expect(await browser.execute(() => window.__xss)).toBeFalsy()
            await expect(SettingsPage.previewName).toHaveText('<img src=x onerror=window.__xss=1>School')
            await SettingsPage.resetProfileBtn.click()
        })
    })
})
