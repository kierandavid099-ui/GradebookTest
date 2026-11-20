import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { LIVE_SESSION_ID } from '../../helpers/adminData.js'
import { uniqueName, randomDigits } from '../../helpers/random.js'

// Sessions and Term Dates. Everything that saves works on a fixture session
// far in the future (random year 2060–2098) so it can never collide with the
// live 2026/2027 session. Fixture sessions are deleted in the after hook.
//
// The "set current term" cases necessarily move the school's live current
// term (there is only one per school); the original is restored straight
// after, in the same describe's after hook.

describe('REGRESSION — Admin Sessions & Terms', () => {

    const year = 2060 + Number(randomDigits(2)) % 38
    const session = {
        name: uniqueName(`auto-adm-${year}`),
        terms: 3,
        start: `${year}-09-01`,
        end: `${year + 1}-07-31`,
    }
    let sessionId

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('sessions')
    })

    after(async () => {
        await AcademicPage.openOn('sessions')
        const ids = await browser.execute(() => [...document.querySelectorAll('.btn-delete-session')]
            .filter(b => b.dataset.name.startsWith('auto-adm-')).map(b => b.dataset.id))
        for (const id of ids) {
            if (id !== LIVE_SESSION_ID) await AdminApi.deleteSession(id)
        }
    })

    describe('Sessions', () => {

        it('REG-ADM-SES-001 | Sessions tab shows the sessions table and a New Session button', async () => {
            addFeature('Sessions'); addSeverity('blocker')
            await expect(AcademicPage.sessionsTable).toBeDisplayed()
            await expect(AcademicPage.newSessionBtn).toBeDisplayed()
        })

        it('REG-ADM-SES-002 | The live 2026/2027 session is listed as Active', async () => {
            addFeature('Sessions'); addSeverity('critical')
            await expect($(`#session-status-${LIVE_SESSION_ID}`)).toHaveText(/Active/i)
            const active = Number(await AcademicPage.statValue('sessions', 'Active').getText())
            expect(active).toBeGreaterThanOrEqual(1)
        })

        it('REG-ADM-SES-003 | Session name, start and end date are required', async () => {
            addFeature('Sessions'); addSeverity('critical')
            await AcademicPage.fillSession({ name: '' })
            await AcademicPage.createSessionBtn.click()
            await expect(AcademicPage.sessionCreateError).toBeDisplayed()
            await expect(AcademicPage.sessionCreateError).toHaveText(/required/i)
            await AcademicPage.closeModal()
        })

        it('REG-ADM-SES-004 | A start date after the end date is rejected', async () => {
            addFeature('Sessions'); addSeverity('normal')
            await AcademicPage.fillSession({ name: session.name, start: session.end, end: session.start })
            await AcademicPage.createSessionBtn.click()
            await expect(AcademicPage.sessionCreateError).toHaveText(/before end date/i)
            await AcademicPage.closeModal()
        })

        it('REG-ADM-SES-005 | A session longer than one year (366 days) is rejected', async () => {
            addFeature('Sessions'); addSeverity('normal')
            await AcademicPage.fillSession({ name: session.name, start: session.start, end: `${year + 2}-07-31` })
            await AcademicPage.createSessionBtn.click()
            await expect(AcademicPage.sessionCreateError).toHaveText(/more than one year/i)
            await AcademicPage.closeModal()
        })

        it('REG-ADM-SES-006 | Cancelling the New Session modal creates nothing', async () => {
            addFeature('Sessions'); addSeverity('minor')
            await AcademicPage.fillSession({ name: `${session.name}-cancel`, start: session.start, end: session.end })
            await AcademicPage.closeModal()
            await expect(AcademicPage.sessionRow(`${session.name}-cancel`)).not.toBeExisting()
        })

        it('REG-ADM-SES-007 | A session with name, start and end dates is created and listed', async () => {
            addFeature('Sessions'); addSeverity('blocker')
            await AcademicPage.createSession(session)
            await AcademicPage.openOn('sessions')
            await expect(AcademicPage.sessionRow(session.name)).toBeExisting()
            sessionId = await AcademicPage.sessionIdByName(session.name)
            expect(sessionId).toBeTruthy()
        })

        it('REG-ADM-SES-008 | A duplicate session name is rejected', async () => {
            addFeature('Sessions'); addSeverity('normal')
            await AcademicPage.fillSession({ name: session.name, start: session.start, end: session.end })
            await AcademicPage.createSessionBtn.click()
            // A rejection keeps the modal open with the server's message.
            await expect(AcademicPage.sessionCreateError).toBeDisplayed({ wait: 10000 })
            await AcademicPage.closeModal()
            await AcademicPage.openOn('sessions')
            const rows = await $$(`//table[@id="tbl-sessions"]//div[normalize-space()="${session.name}"]`)
            expect(rows.length).toBe(1)
        })

        it('REG-ADM-SES-009 | Searching sessions filters the table and shows "No results" for no match', async () => {
            addFeature('Sessions'); addSeverity('minor')
            await AcademicPage.sessionSearch.setValue(session.name)
            await expect(AcademicPage.sessionRow(session.name)).toBeDisplayed()
            await expect(AcademicPage.sessionRow('2026/2027')).not.toBeDisplayed()
            await AcademicPage.sessionSearch.setValue('zz-no-such-session-zz')
            await expect($('#tbl-sessions .no-results-row')).toHaveText(/No results/i)
            await AcademicPage.sessionSearch.clearValue()
            await browser.keys('Backspace')
        })
    })

    describe('Term Dates', () => {

        let originalTermId

        before(async () => {
            await AcademicPage.openOn('terms')
            originalTermId = await AcademicPage.currentTermId()
        })

        // Put the school's live current term back however the tests ended.
        after(async () => {
            await AcademicPage.openOn('terms')
            if (await AcademicPage.currentTermId().catch(() => null) !== originalTermId) {
                await AdminApi.setCurrentTerm(originalTermId)
            }
        })

        it('REG-ADM-TRM-001 | Choosing the live session reveals its three term blocks', async () => {
            addFeature('Terms'); addSeverity('critical')
            await AcademicPage.chooseTermSession(LIVE_SESSION_ID)
            expect(await AcademicPage.termBlocks(LIVE_SESSION_ID).length).toBe(3)
            await expect(AcademicPage.termPlaceholder).not.toBeDisplayed()
        })

        it('REG-ADM-TRM-002 | Exactly one term in the school is marked current', async () => {
            addFeature('Terms'); addSeverity('critical')
            expect(await $$('.term-block[data-is-current="1"]').length).toBe(1)
        })

        it('REG-ADM-TRM-003 | A term starting before the session start is rejected', async () => {
            addFeature('Terms'); addSeverity('critical')
            await AcademicPage.chooseTermSession(sessionId)
            await AcademicPage.setTermDates(sessionId, 1, { start: `${year}-08-01`, end: `${year}-12-10` })
            await AcademicPage.saveTermsBtn(sessionId).click()
            const msg = await AcademicPage.readAndConfirmSwal()
            expect(msg).toMatch(/Invalid Dates/i)
            expect(msg).toMatch(/before session start/i)
        })

        it('REG-ADM-TRM-004 | A term ending after the session end is rejected', async () => {
            addFeature('Terms'); addSeverity('critical')
            await AcademicPage.setTermDates(sessionId, 1, { start: `${year}-09-02`, end: `${year + 1}-09-30` })
            await AcademicPage.saveTermsBtn(sessionId).click()
            expect(await AcademicPage.readAndConfirmSwal()).toMatch(/after session end/i)
        })

        it('REG-ADM-TRM-005 | Overlapping term date ranges are rejected', async () => {
            addFeature('Terms'); addSeverity('normal')
            await AcademicPage.setTermDates(sessionId, 1, { start: `${year}-09-02`, end: `${year}-12-15` })
            await AcademicPage.setTermDates(sessionId, 2, { start: `${year}-12-01`, end: `${year + 1}-03-20` })
            await AcademicPage.saveTermsBtn(sessionId).click()
            expect(await AcademicPage.readAndConfirmSwal()).toMatch(/overlaps/i)
        })

        it('REG-ADM-TRM-006 | A mid-term break outside its term is rejected', async () => {
            addFeature('Terms'); addSeverity('normal')
            await AcademicPage.setTermDates(sessionId, 2, { start: `${year + 1}-01-05`, end: `${year + 1}-03-20`, breakStart: `${year}-12-20`, breakEnd: `${year + 1}-01-10` })
            await AcademicPage.saveTermsBtn(sessionId).click()
            expect(await AcademicPage.readAndConfirmSwal()).toMatch(/break start is before the term start/i)
        })

        it('REG-ADM-TRM-007 | Three terms with valid date ranges are saved to the session', async () => {
            addFeature('Terms'); addSeverity('blocker')
            await AcademicPage.setTermDates(sessionId, 1, { start: `${year}-09-02`, end: `${year}-12-15`, breakStart: '', breakEnd: '' })
            await AcademicPage.setTermDates(sessionId, 2, { start: `${year + 1}-01-05`, end: `${year + 1}-03-31`, breakStart: '', breakEnd: '' })
            await AcademicPage.setTermDates(sessionId, 3, { start: `${year + 1}-04-20`, end: `${year + 1}-07-25`, breakStart: '', breakEnd: '' })
            await AcademicPage.saveTermsBtn(sessionId).click()
            expect(await AcademicPage.readAndConfirmSwal(15000)).toMatch(/saved/i)
            await AcademicPage.openOn('terms')
            await AcademicPage.chooseTermSession(sessionId)
            const ids = await browser.execute(id => [...document.querySelectorAll(`#terms-block-${id} .term-block`)]
                .map(b => b.dataset.termId).filter(Boolean), sessionId)
            expect(ids.length).toBe(3)
        })

        it('REG-ADM-TRM-008 | Starting a term makes it the current term', async () => {
            addFeature('Terms'); addSeverity('blocker')
            const termId = await AcademicPage.termBlock(sessionId, 1).getAttribute('data-term-id')
            // Record the set-current reply so a refusal or a request that never
            // went out fails here with a clear message, not as a missing alert.
            await browser.execute(() => {
                window.__setCurrent = null
                $(document).on('ajaxComplete', (_, xhr, opts) => {
                    if (/set-current/.test(opts.url)) window.__setCurrent = { status: xhr.status, body: (xhr.responseText || '').slice(0, 300) }
                })
            })
            await AcademicPage.activateTermBtn(termId).click()
            expect(await AcademicPage.readAndConfirmSwal()).toMatch(/Set as Current Term/i)
            const reply = await browser.waitUntil(() => browser.execute(() => window.__setCurrent),
                { timeout: 30000, timeoutMsg: 'The set-current request did not complete within 30s' })
            expect(`${reply.status} ${reply.body}`).toMatch(/^200 /)
            expect(await AcademicPage.readAndConfirmSwal(10000)).toMatch(/Activated/i)
            await AcademicPage.openOn('terms')
            expect(await AcademicPage.currentTermId()).toBe(termId)
        })

        it('REG-ADM-TRM-009 | Only one term stays active — the previous current term is deactivated', async () => {
            addFeature('Terms'); addSeverity('critical')
            try {
                await AcademicPage.openOn('terms') // read the server's state, not the page TRM-008 left
                expect(await $$('.term-block[data-is-current="1"]').length).toBe(1)
                expect(await $(`.term-block[data-term-id="${originalTermId}"]`).getAttribute('data-is-current')).toBe('0')
            } finally {
                // Hand the school its live current term back right away.
                await AdminApi.setCurrentTerm(originalTermId)
            }
            await AcademicPage.openOn('terms')
            expect(await AcademicPage.currentTermId()).toBe(originalTermId)
        })
    })
})
