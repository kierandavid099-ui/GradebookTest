import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER } from '../../helpers/testData.js'
import { API, LIVE_SESSION_ID } from '../../helpers/adminData.js'
import { uniqueName, randomDigits } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Running-term session guard (replaces old REG-ADM-DSH-006). The app
// cannot be left with no current term: there is no end-term action, and a
// session whose term is current refuses to be deleted (422). These tests
// make a throwaway session's term current, check the delete is refused, then
// hand the current term back to the live 2026/2027 session and check the
// throwaway session deletes normally. The live session is never edited.
//
// ISOLATED: while the throwaway term is current every grade sheet, allocation
// and moderation screen on the server points at it. Run it on its own:
//   npx wdio run ./wdio.conf.js --suite noterm --specFileRetries 0
//
// If a run is killed mid-way: start the live session's term again in
// Academic Management > Terms, then delete any auto-nt- session.
//
// Session names are cut to 20 characters — keep the fixture base short so
// the stored name still matches.
//
// Leaves behind: nothing — the after hook restores the live term and deletes
// every auto-nt- / auto-noterm- session, including leftovers of older runs.
// ─────────────────────────────────────────────────────────────────────────────

const year = 2060 + Number(randomDigits(2)) % 38
const fixture = {
    name: uniqueName(`auto-nt-${year}`),
    terms: 3,
    start: `${year}-09-01`,
    end: `${year + 1}-07-31`,
}

// Deletes every throwaway session this spec (or an older version of it) made.
const sweepFixtures = async () => {
    await AcademicPage.openOn('sessions')
    const stale = await browser.execute(() => [...document.querySelectorAll('.btn-delete-session')]
        .filter(b => /^auto-(nt|noterm)-/.test(b.dataset.name)).map(b => b.dataset.id))
    await AdminApi.open()
    for (const id of stale) await AdminApi.deleteSession(id)
}

describe('E2E — Admin Running-Term Session Guard', () => {

    let originalTermId, sessionId
    let moved = false

    const restore = async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AdminApi.open()
        if (moved) {
            const res = await AdminApi.setCurrentTerm(originalTermId)
            if (res.status >= 400) throw new Error(`Current term NOT restored (HTTP ${res.status}) — start term ${originalTermId} again by hand in Academic Management > Terms`)
            moved = false
        }
    }

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        originalTermId = await AcademicPage.currentTermId().catch(() => null)
        if (!originalTermId) throw new Error('The school has no current term — a previous run may not have restored it. Start the live term by hand first.')
        await sweepFixtures()
    })

    after(async () => {
        try {
            await restore()
        } finally {
            await sweepFixtures()
        }
    })

    it('E2E-ADM-NOT-001 | A throwaway session with three dated terms is created', async () => {
        addFeature('Running-Term Guard'); addSeverity('critical')
        await AcademicPage.openOn('sessions')
        await AcademicPage.createSession(fixture)
        await AcademicPage.openOn('sessions')
        sessionId = await AcademicPage.sessionIdByName(fixture.name)
        await AcademicPage.openOn('terms')
        await AcademicPage.chooseTermSession(sessionId)
        await AcademicPage.setTermDates(sessionId, 1, { start: `${year}-09-02`, end: `${year}-12-15`, breakStart: '', breakEnd: '' })
        await AcademicPage.setTermDates(sessionId, 2, { start: `${year + 1}-01-05`, end: `${year + 1}-03-31`, breakStart: '', breakEnd: '' })
        await AcademicPage.setTermDates(sessionId, 3, { start: `${year + 1}-04-20`, end: `${year + 1}-07-25`, breakStart: '', breakEnd: '' })
        expect(await AcademicPage.saveTerms(sessionId)).toMatch(/saved/i)
    })

    it('E2E-ADM-NOT-002 | A session whose term is current cannot be deleted', async () => {
        addFeature('Running-Term Guard'); addSeverity('critical')
        await AcademicPage.openOn('terms')
        await AcademicPage.chooseTermSession(sessionId)
        const termId = await AcademicPage.termBlock(sessionId, 1).getAttribute('data-term-id')
        await AdminApi.open()
        moved = true
        expect((await AdminApi.setCurrentTerm(termId)).status).toBeLessThan(400)
        // Starting the term also marks the session active, and that guard runs
        // first — deactivate it to reach the running-term guard.
        let res = await AdminApi.destroy(`${API}/grade_sessions/${sessionId}`)
        expect(res.status).toBe(422)
        expect(JSON.stringify(res.body)).toMatch(/active session/i)
        expect((await AdminApi.post(`${API}/grade_sessions/${sessionId}/toggle-active`)).status).toBeLessThan(400)
        res = await AdminApi.destroy(`${API}/grade_sessions/${sessionId}`)
        expect(res.status).toBe(422)
        expect(JSON.stringify(res.body)).toMatch(/running term/i)
        await AcademicPage.openOn('sessions')
        await expect(AcademicPage.sessionDeleteBtn(fixture.name)).toBeExisting()
    })

    it('E2E-ADM-NOT-003 | Once the live term is current again the throwaway session deletes', async () => {
        addFeature('Running-Term Guard'); addSeverity('critical')
        await restore()
        expect((await AdminApi.deleteSession(sessionId)).status).toBeLessThan(400)
        await AcademicPage.openOn('sessions')
        await expect(AcademicPage.sessionDeleteBtn(fixture.name)).not.toBeExisting()
    })

    it('E2E-ADM-NOT-004 | The live term is current and the live session stays Active', async () => {
        addFeature('Running-Term Guard'); addSeverity('critical')
        await AcademicPage.openOn('terms')
        expect(await AcademicPage.currentTermId()).toBe(originalTermId)
        await AcademicPage.openOn('sessions')
        await expect($(`#session-status-${LIVE_SESSION_ID}`)).toHaveText(/Active/i)
    })
})
