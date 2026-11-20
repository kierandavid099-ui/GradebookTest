// Manage Settings — School Profile, Graphics, Accreditation and the
// Preferences toggles (results publishing, grade locking, notifications).
import ModulePage from './modulePage.page.js'

class AdminSettingsPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/manage-settings')
    }

    tab(name) { return $(`a[data-bs-toggle="tab"][href="#${name}"]`) }
    pane(name) { return $(`#${name}`) }

    async openOn(tab) {
        await this.open()
        await this.openTab(this.tab(tab), this.pane(tab))
    }

    // ── School Profile ──────────────────────────────────────────────────────
    get form() { return $('#frm-school-profile') }
    get fullNameInput() { return $('#sp-full-name') }
    get shortNameInput() { return $('#sp-short-name') }
    get schoolTypeSelect() { return $('#sp-school-type') }
    get ownershipSelect() { return $('#sp-ownership') }
    get mottoInput() { return $('#sp-motto') }
    get emailInput() { return $('#sp-email') }
    get yearInput() { return $('#sp-year') }
    get saveProfileBtn() { return $('#btn-save-profile') }
    get resetProfileBtn() { return $('#btn-reset-profile') }
    get saveStatus() { return $('#save-status') }
    get previewName() { return $('#preview-name') }
    get previewShortName() { return $('#preview-short-name') }
    get previewType() { return $('#preview-type') }
    get previewOwnership() { return $('#preview-ownership') }
    invalidFeedbackFor(input) { return input.$('./following-sibling::div[contains(@class,"invalid-feedback")]') }

    // Every profile field's current value, keyed by input id, so a test can
    // put the profile back exactly as it found it.
    profileValues() {
        // 2026-11-11: skip file inputs too — #sp-signature-file is a hidden
        // .d-none file picker and clearValue()/setValue() on it isn't
        // interactable, which blew up the after hook's restoreProfile.
        return browser.execute(() => Object.fromEntries([...document.querySelectorAll('#frm-school-profile input:not([type=hidden]):not([type=file]), #frm-school-profile select, #frm-school-profile textarea')]
            .map(e => [e.id, e.value])))
    }

    async fillProfile(values) {
        for (const [id, value] of Object.entries(values)) {
            const el = await $(`#${id}`)
            if ((await el.getTagName()) === 'select') await el.selectByAttribute('value', value)
            else { await el.clearValue(); if (value !== '') await el.setValue(value) }
        }
    }

    // A good save shows "Saved" and reloads the page.
    async saveProfile() {
        await this.saveProfileBtn.click()
        const text = await this.readAndConfirmSwal(10000)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        return text
    }

    async restoreProfile(values) {
        await this.openOn('tab_school_profile')
        await this.fillProfile(values)
        return this.saveProfile()
    }

    // ── Preferences ─────────────────────────────────────────────────────────
    toggle(key) { return $(`#pref-${key}`) }
    get toast() { return $('#pref-toast-inner') }
    get toastMsg() { return $('#pref-toast-msg') }

    async isOn(key) { return this.toggle(key).isSelected() }

    // Flips a switch and waits for the auto-save round trip (the switch is
    // disabled while the request is in flight).
    async flip(key) {
        const sw = this.toggle(key)
        await sw.scrollIntoView({ block: 'center' })
        await sw.click()
        await browser.waitUntil(async () => !(await sw.getAttribute('disabled')), { timeout: 10000, timeoutMsg: `${key} save never finished` })
        await this.toastMsg.waitForDisplayed({ timeout: 5000 }).catch(() => {})
        return this.toastMsg.getText().catch(() => '')
    }

    async setPref(key, on) {
        if ((await this.isOn(key)) !== on) await this.flip(key)
    }

    settingId(key) { return this.toggle(key).getAttribute('data-setting-id') }
}

export default new AdminSettingsPage()
