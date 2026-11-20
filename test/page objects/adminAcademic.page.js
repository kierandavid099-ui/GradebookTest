// Academic Management — Sessions, Terms, Classes and Subjects tabs.
// Grading & Weights and Result Moderation live on the same page but have
// their own page objects (adminGrading / adminModeration).
import ModulePage from './modulePage.page.js'

class AdminAcademicPage extends ModulePage {
    constructor() {
        super('/scola-gradebook2/academic-management')
    }

    // The page remembers the last tab in localStorage, and a hash-only URL
    // change doesn't reload the page — so load it plainly, then click the tab.
    async openOn(tab) {
        await this.open()
        await this.openTab(this.tab(tab), this.pane(tab))
    }

    tab(name) { return $(`a[data-bs-toggle="tab"][href="#tab_${name}"]`) }
    pane(name) { return $(`#tab_${name}`) }
    statValue(tab, label) {
        return $(`//div[@id="tab_${tab}"]//div[contains(@class,"stat-lbl")][normalize-space()="${label}"]/preceding-sibling::div[contains(@class,"stat-val")]`)
    }

    // Chrome's date box takes keystrokes in its displayed mm/dd/yyyy order,
    // so set ISO values directly and fire the events the page listens for.
    async setDate(el, iso) {
        el = await el
        await el.waitForExist({ timeout: 5000 })
        await browser.execute((e, v) => {
            e.value = v
            e.dispatchEvent(new Event('input', { bubbles: true }))
            e.dispatchEvent(new Event('change', { bubbles: true }))
        }, el, iso)
    }

    // Bootstrap modals fade in; typing before the fade ends loses keystrokes.
    async openModalVia(btn, modal) {
        await btn.waitForClickable({ timeout: 10000 })
        await btn.click()
        await modal.waitForDisplayed({ timeout: 5000 })
        await browser.waitUntil(async () => (await modal.getAttribute('class')).includes('show'), { timeout: 5000 })
        await browser.pause(400)
    }

    // ── Sessions ────────────────────────────────────────────────────────────
    get newSessionBtn() { return $('#tab_sessions button[data-bs-target="#mdl-create-session"]') }
    get createSessionModal() { return $('#mdl-create-session') }
    get sessionNameInput() { return $('#cs-name') }
    get sessionTermsSelect() { return $('#cs-terms') }
    get sessionStartInput() { return $('#cs-start') }
    get sessionEndInput() { return $('#cs-end') }
    get createSessionBtn() { return $('#btn-create-session') }
    get sessionCreateError() { return $('#session-create-error') }
    get sessionSearch() { return $('#search-sessions') }
    get sessionsTable() { return $('#tbl-sessions') }
    sessionRow(name) { return $(`//table[@id="tbl-sessions"]//tr[contains(@class,"session-row")][.//div[normalize-space()="${name}"]]`) }
    sessionDeleteBtn(name) { return $(`.btn-delete-session[data-name="${name}"]`) }

    async fillSession({ name, terms = '3', start, end }) {
        await this.openModalVia(this.newSessionBtn, this.createSessionModal)
        await this.sessionNameInput.setValue(name)
        await this.sessionTermsSelect.selectByAttribute('value', String(terms))
        if (start) await this.setDate(this.sessionStartInput, start)
        if (end) await this.setDate(this.sessionEndInput, end)
    }

    async createSession(session) {
        await this.fillSession(session)
        await this.createSessionBtn.click()
        // Success shows a SweetAlert whose OK reloads the page.
        await this.readAndConfirmSwal(10000)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
    }

    async sessionIdByName(name) {
        const btn = this.sessionDeleteBtn(name)
        await btn.waitForExist({ timeout: 10000 })
        return btn.getAttribute('data-id')
    }

    // ── Terms ───────────────────────────────────────────────────────────────
    get termSessionSelect() { return $('#term-session-select') }
    get termPlaceholder() { return $('#term-placeholder') }
    termsBlock(sessionId) { return $(`#terms-block-${sessionId}`) }
    termBlocks(sessionId) { return $$(`#terms-block-${sessionId} .term-block`) }
    termBlock(sessionId, ordinal) { return $(`#terms-block-${sessionId} .term-block[data-ordinal="${ordinal}"]`) }
    saveTermsBtn(sessionId) { return $(`.btn-save-terms[data-session-id="${sessionId}"]`) }
    activateTermBtn(termId) { return $(`.btn-activate-term[data-term-id="${termId}"]`) }
    get currentTermBlock() { return $('.term-block[data-is-current="1"]') }

    // The session picker is a TomSelect; drive its own API so the onChange
    // that reveals the term block fires.
    async chooseTermSession(sessionId) {
        await this.termSessionSelect.waitForExist({ timeout: 10000 })
        await browser.execute(id => document.querySelector('#term-session-select').tomselect.setValue(id), sessionId)
        await this.termsBlock(sessionId).waitForDisplayed({ timeout: 5000 })
    }

    async setTermDates(sessionId, ordinal, { start, end, breakStart, breakEnd }) {
        const block = this.termBlock(sessionId, ordinal)
        if (start !== undefined) await this.setDate(block.$('.term-start-date'), start)
        if (end !== undefined) await this.setDate(block.$('.term-end-date'), end)
        if (breakStart !== undefined) await this.setDate(block.$('.term-break-start'), breakStart)
        if (breakEnd !== undefined) await this.setDate(block.$('.term-break-end'), breakEnd)
    }

    async currentTermId() {
        const block = this.currentTermBlock
        await block.waitForExist({ timeout: 10000 })
        return block.getAttribute('data-term-id')
    }

    // Every term in the current term's session (ordinal, id, current flag and
    // date inputs), so a test can move them and put each one back afterwards.
    async currentSessionTerms() {
        await this.currentTermBlock.waitForExist({ timeout: 10000 })
        return browser.execute(() => {
            const container = document.querySelector('.term-block[data-is-current="1"]').closest('[id^="terms-block-"]')
            return {
                sessionId: container.id.replace('terms-block-', ''),
                terms: [...container.querySelectorAll('.term-block')].map(b => ({
                    ordinal: b.dataset.ordinal,
                    termId: b.dataset.termId,
                    current: b.dataset.isCurrent === '1',
                    start: b.querySelector('.term-start-date').value,
                    end: b.querySelector('.term-end-date').value,
                    breakStart: b.querySelector('.term-break-start').value,
                    breakEnd: b.querySelector('.term-break-end').value,
                })),
            }
        })
    }

    // Save shows a SweetAlert ("saved" or the validation error).
    async saveTerms(sessionId) {
        await this.saveTermsBtn(sessionId).click()
        return this.readAndConfirmSwal(15000)
    }

    // ── Classes ─────────────────────────────────────────────────────────────
    get newClassBtn() { return $('#tab_classes button[data-bs-target="#mdl-create-class"]') }
    get createClassModal() { return $('#mdl-create-class') }
    get classNameInput() { return $('#cc-name') }
    get classCodeInput() { return $('#cc-code') }
    get classLevelSelect() { return $('#cc-level') }
    get classArmsInput() { return $('#cc-arms') }
    get classMaxInput() { return $('#cc-max') }
    get classPreview() { return $('#cc-preview') }
    get classPreviewChips() { return $$('#cc-preview-chips span') }
    get createClassBtn() { return $('#btn-create-class') }
    get classCreateError() { return $('#class-create-error') }
    get classSearch() { return $('#search-classes') }
    classCard(name) { return $(`//div[contains(@class,"class-group-item")][.//div[contains(@class,"class-name")][normalize-space()="${name}"]]`) }
    // Arm chips on a class group card ("—" when the class has no arms).
    // textContent, not getText(): the card may sit on another page (see classCap).
    armChips(name) {
        return this.classCard(name).$$('a .flex-wrap span')
            .map(async c => (await c.getProperty('textContent')).trim())
    }
    // Cards are paged 12 at a time, so read textContent: getText() is ''
    // for a card sitting on another page.
    async classCap(name) {
        const text = await this.classCard(name).$('.fw-bold.text-primary').getProperty('textContent')
        return Number((text.match(/\d+/) || [])[0])
    }
    classGroupEditBtn(name) { return $(`.btn-edit-group[data-name="${name}"]`) }
    // Searching filters every card, not just the current page, so this
    // brings a card on a later page into view.
    async findClass(name) {
        await this.classSearch.setValue(name)
        return this.classCard(name)
    }
    get editGroupModal() { return $('#mdl-edit-group') }
    get editGroupMaxInput() { return $('#eg-max') }
    get updateGroupBtn() { return $('#btn-update-group') }

    async fillClass({ name, code, level, arms = '', max = '' }) {
        await this.openModalVia(this.newClassBtn, this.createClassModal)
        await this.classNameInput.setValue(name)
        await this.classCodeInput.setValue(code)
        if (level) await this.classLevelSelect.selectByAttribute('value', level)
        if (arms) await this.classArmsInput.setValue(arms)
        if (max !== '') await this.classMaxInput.setValue(String(max))
    }

    async submitClass() {
        await this.createClassBtn.click()
        return this.readAndConfirmSwal(10000)
    }

    // Arm ids for a class group, read off its Edit button.
    async classGroupIds(name) {
        const btn = this.classGroupEditBtn(name)
        await btn.waitForExist({ timeout: 10000 })
        return JSON.parse(await btn.getAttribute('data-ids'))
    }

    // ── Subjects ────────────────────────────────────────────────────────────
    get newSubjectBtn() { return $('#tab_subjects button[data-bs-target="#mdl-create-subject"]') }
    get createSubjectModal() { return $('#mdl-create-subject') }
    get subjectNameInput() { return $('#csub-name') }
    get subjectCodeInput() { return $('#csub-code') }
    get subjectTypeSelect() { return $('#csub-type') }
    get subjectDeptSelect() { return $('#csub-dept') }
    get subjectClassPicker() { return $('#csub-class-picker') }
    get createSubjectBtn() { return $('#btn-create-subject') }
    get subjectCreateError() { return $('#subject-create-error') }
    get subjectSearch() { return $('#search-subjects') }
    assignRadio(value) { return $(`#csub-assign-${value}`) }
    // Radios/checkboxes are Bootstrap form-checks: click the label like a user.
    assignRadioLabel(value) { return $(`label[for="csub-assign-${value}"]`) }
    classCheckbox(classId) { return $(`#csub-class-${classId}`) }
    classCheckboxLabel(classId) { return $(`label[for="csub-class-${classId}"]`) }
    get checkedClassBoxes() { return $$('.csub-class-id:checked') }
    subjectRow(name) { return $(`//table[@id="tbl-subjects"]//tr[td[1][normalize-space()="${name}"]]`) }
    // Rows are paged 10 at a time; searching filters every row, so this
    // brings a row on a later page into view.
    async findSubject(name) {
        await this.subjectSearch.setValue(name)
        return this.subjectRow(name)
    }
    subjectDeleteBtn(name) { return $(`.btn-delete-subject[data-name="${name}"]`) }

    async fillSubject({ name, code, type = 'core', assign, classIds = [] }) {
        await this.openModalVia(this.newSubjectBtn, this.createSubjectModal)
        await this.subjectNameInput.setValue(name)
        await this.subjectCodeInput.setValue(code)
        await this.subjectTypeSelect.selectByAttribute('value', type)
        if (assign) await this.assignRadioLabel(assign).click()
        for (const id of classIds) {
            await this.classCheckboxLabel(id).scrollIntoView()
            await this.classCheckboxLabel(id).click()
        }
    }

    async submitSubject() {
        await this.createSubjectBtn.click()
        return this.readAndConfirmSwal(10000)
    }

    async subjectIdByName(name) {
        const btn = this.subjectDeleteBtn(name)
        await btn.waitForExist({ timeout: 10000 })
        return btn.getAttribute('data-id')
    }
}

export default new AdminAcademicPage()
