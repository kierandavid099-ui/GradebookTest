// Academic Management > Grading & Weights: the grade scale (boundaries +
// presets) and the assessment schemes.
import ModulePage from './modulePage.page.js'

class AdminGradingPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/academic-management')
    }

    get tab() { return $('a[data-bs-toggle="tab"][href="#tab_grading"]') }
    get pane() { return $('#tab_grading') }

    async openGrading() {
        await this.open()
        await this.openTab(this.tab, this.pane)
    }

    async openModalVia(btn, modal) {
        await btn.waitForClickable({ timeout: 10000 })
        await btn.click()
        await modal.waitForDisplayed({ timeout: 5000 })
        await browser.waitUntil(async () => (await modal.getAttribute('class')).includes('show'), { timeout: 5000 })
        // Inputs drop keystrokes until the fade-in has finished.
        await browser.pause(400)
    }

    // ── Grade scale ─────────────────────────────────────────────────────────
    get addGradeBtn() { return $('#tab_grading button[data-bs-target="#mdl-create-boundary"]') }
    get loadPresetToggle() { return $('//div[@id="tab_grading"]//button[contains(@class,"dropdown-toggle")][contains(., "Load Preset")]') }
    presetItem(preset) { return $(`.btn-load-preset[data-preset="${preset}"]`) }
    get presetItems() { return $$('.btn-load-preset') }
    get boundaryTable() { return $('#tbl-boundaries') }
    get boundaryEmptyState() { return $('#boundary-empty-state') }

    get createBoundaryModal() { return $('#mdl-create-boundary') }
    get letterInput() { return $('#cb-letter') }
    get minInput() { return $('#cb-min') }
    get maxInput() { return $('#cb-max') }
    get remarkInput() { return $('#cb-remark') }
    get colorSelect() { return $('#cb-color') }
    get saveBoundaryBtn() { return $('#btn-create-boundary') }
    get boundaryError() { return $('#boundary-create-error') }

    get editBoundaryModal() { return $('#mdl-edit-boundary') }
    get editMinInput() { return $('#eb-min') }
    get editMaxInput() { return $('#eb-max') }
    get updateBoundaryBtn() { return $('#btn-update-boundary') }
    get editBoundaryError() { return $('#eb-error') }

    boundaryRow(letter) { return $(`//tbody[@id="boundary-tbody"]//tr[@data-boundary-id][.//td[1][normalize-space()="${letter}"]]`) }
    editBoundaryBtn(letter) { return $(`.btn-edit-boundary[data-letter="${letter}"]`) }
    deleteBoundaryBtn(letter) { return $(`.btn-delete-boundary[data-letter="${letter}"]`) }

    // Current scale as the edit buttons carry it: [{ id, letter, min, max, remark, color, applies }].
    boundaries() {
        return browser.execute(() => [...document.querySelectorAll('#boundary-tbody .btn-edit-boundary')].map(b => ({
            id: b.dataset.id, letter: b.dataset.letter, min: Number(b.dataset.min), max: Number(b.dataset.max),
            remark: b.dataset.remark, color: b.dataset.color, applies: b.dataset.applies,
        })))
    }

    async addBoundary({ letter = '', min = '', max = '', remark = '', color }) {
        await this.openModalVia(this.addGradeBtn, this.createBoundaryModal)
        if (letter !== '') await this.letterInput.setValue(letter)
        if (min !== '') await this.minInput.setValue(String(min))
        if (max !== '') await this.maxInput.setValue(String(max))
        if (remark) await this.remarkInput.setValue(remark)
        if (color) await this.colorSelect.selectByAttribute('value', color)
        await this.saveBoundaryBtn.click()
    }

    // A good save closes the modal and appends the row without a reload.
    async addBoundaryOk(band) {
        await this.addBoundary(band)
        await this.createBoundaryModal.waitForDisplayed({ reverse: true, timeout: 10000 })
        await this.boundaryRow(band.letter).waitForExist({ timeout: 5000 })
    }

    // Load Preset asks "Load …?" and then swaps the same alert to "Loaded".
    // A click on Confirm during SweetAlert's pop-in animation is ignored, so
    // keep clicking until the title changes.
    async loadPreset(preset) {
        await this.loadPresetToggle.click()
        await this.presetItem(preset).waitForDisplayed({ timeout: 5000 })
        await this.presetItem(preset).click()
        await this.swal.waitForDisplayed({ timeout: 5000 })
        const confirmText = await browser.execute(() => document.querySelector('.sweet-alert.showSweetAlert').innerText)
        const loaded = async () => /^Loaded/i.test(await this.swalTitle.getText().catch(() => ''))
        for (let attempt = 0; attempt < 3 && !(await loaded()); attempt++) {
            await browser.pause(500)
            await this.swalConfirmBtn.click().catch(() => {})
            await browser.waitUntil(loaded, { timeout: 5000, interval: 300 }).catch(() => {})
        }
        if (!(await loaded())) throw new Error('Preset never reported Loaded')
        const loadedText = await this.readAndConfirmSwal()
        return { confirmText, loadedText }
    }

    // ── Assessment schemes ──────────────────────────────────────────────────
    get addSchemeBtn() { return $('#tab_grading button[data-bs-target="#mdl-create-scheme"]') }
    get createSchemeModal() { return $('#mdl-create-scheme') }
    get schemeNameInput() { return $('#cs-sname') }
    get schemeAppliesSelect() { return $('#cs-sapplies') }
    get schemeDefaultBox() { return $('#cs-sdefault') }
    get schemeDefaultLabel() { return $('label[for="cs-sdefault"]') }
    get addItemBtn() { return $('#cs-add-item') }
    get itemRows() { return $$('#cs-items-container .scheme-item-row') }
    get weightTotal() { return $('#cs-weight-total') }
    get saveSchemeBtn() { return $('#btn-create-scheme') }
    get schemeError() { return $('#scheme-create-error') }
    get schemeEmptyState() { return $('#scheme-empty-state') }

    schemeCard(name) { return $(`//div[contains(@class,"scheme-card")][.//div[contains(@class,"scheme-card-title")][starts-with(normalize-space(), "${name}")]]`) }
    schemeIdByName(name) { return this.schemeCard(name).getAttribute('data-scheme-id') }
    async isDefault(name) { return this.schemeCard(name).$('.scheme-default-badge').isExisting() }
    schemeAppliesChip(name) { return this.schemeCard(name).$('.scheme-applies-chip') }

    // The modal opens with two blank component rows; add rows as needed.
    async fillScheme({ name = '', appliesTo = 'all', isDefault = false, items = [] }) {
        await this.openModalVia(this.addSchemeBtn, this.createSchemeModal)
        if (name) await this.schemeNameInput.setValue(name)
        await this.schemeAppliesSelect.selectByAttribute('value', appliesTo)
        if (isDefault) await this.schemeDefaultLabel.click()
        while ((await this.itemRows.length) < items.length) await this.addItemBtn.click()
        const rows = await this.itemRows
        for (let i = 0; i < items.length; i++) {
            await rows[i].$('.si-title').setValue(items[i].title)
            await rows[i].$('.si-weight').setValue(String(items[i].weight))
        }
    }

    async createScheme(scheme) {
        await this.fillScheme(scheme)
        await this.saveSchemeBtn.click()
        return this.readAndConfirmSwal(10000)
    }
}

export default new AdminGradingPage()
