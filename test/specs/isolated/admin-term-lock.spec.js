import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import SettingsPage from '../../page objects/adminSettings.page.js'
import AdminApi from '../../page objects/adminApi.page.js'
import { ADMIN_USER, TEACHER_USER } from '../../helpers/testData.js'
import { PREFS } from '../../helpers/adminData.js'
import { randomString } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Term-end grade lock. Moves the LIVE current term into the past
// (day before yesterday → yesterday) and turns "Lock grade entry after term
// ends" on, then checks that neither the teacher nor the admin can change
// grades for that term. Any earlier term in the session that would overlap
// the moved term is shortened to end the day before it (breaks cleared),
// because overlapping terms are rejected. The current term itself is never
// changed, only dates.
//
// ISOLATED: while this runs, every grade sheet on the server is locked.
// It lives outside smoke/regression/e2e so it never runs alongside them —
// run it on its own, with nothing else hitting the server:
//   npx wdio run ./wdio.conf.js --suite termlock --specFileRetries 0
//
// The original dates of every term in the session and the lock setting are
// read first and put back in the after hook (pass or fail). If a run is killed mid-way, the before
// hook of the next run refuses to start while the current term looks
// ended — fix its end date by hand in Academic Management > Terms.
//
// Leaves behind: nothing — the moderation fixture is deleted in the after
// hook once the term is restored.
// ─────────────────────────────────────────────────────────────────────────────

const LOCK = PREFS.lockGradeEntryAfterTerm
const localDay = offsetDays => new Date(Date.now() + offsetDays * 864e5).toLocaleDateString('en-CA')

describe('E2E — Admin Term-End Grade Lock', () => {

    const tag = randomString(5).toUpperCase()
    const yesterday = localDay(-1)
    let fx, session, term, lockWasOn
    let changed = false

    const enabledInputs = () => browser.execute(id => [...document.querySelectorAll(`.grade-entry[data-val-student-id="${id}"]`)].filter(i => !i.disabled).length, fx.studentId)

    const restore = async () => {
        if (!changed) return
        await LoginPage.loginAs(ADMIN_USER)
        try {
            await AcademicPage.openOn('terms')
            await AcademicPage.chooseTermSession(session.sessionId)
            // 2026-11-12: restore the later-starting term first so the earlier
            // one's original end date no longer overlaps the shortened later
            // term when saveTerms validates the batch.
            const ordered = [...session.terms].sort((a, b) => b.start.localeCompare(a.start))
            for (const t of ordered) {
                await AcademicPage.setTermDates(session.sessionId, t.ordinal, { start: t.start, end: t.end, breakStart: t.breakStart, breakEnd: t.breakEnd })
            }
            const msg = await AcademicPage.saveTerms(session.sessionId)
            if (!/saved/i.test(msg)) {
                const was = session.terms.map(t => `term ${t.ordinal}: ${t.start} → ${t.end} (break ${t.breakStart || '-'} → ${t.breakEnd || '-'})`).join('; ')
                throw new Error(`Term dates NOT restored (${msg}) — put them back by hand: ${was}`)
            }
            changed = false
            return msg
        } finally {
            // 2026-11-12: gradebook.ng has flaked on the manage-settings nav
            // mid-run — retry once so a transient timeout doesn't leave the
            // lock pref flipped.
            for (let i = 0; i < 2; i++) {
                try {
                    await SettingsPage.openOn('preferences')
                    await SettingsPage.setPref(LOCK, lockWasOn)
                    break
                } catch (e) {
                    if (i === 1) throw e
                    await browser.pause(2000)
                }
            }
        }
    }

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        session = await AcademicPage.currentSessionTerms()
        term = session.terms.find(t => t.current)
        if (term.end < localDay(0)) throw new Error(`Current term already ended (${term.end}) — a previous run may not have restored it. Fix it by hand first.`)
        await SettingsPage.openOn('preferences')
        lockWasOn = await SettingsPage.isOn(LOCK)
        await AdminApi.open()
        fx = await AdminApi.moderationFixture(tag, term.termId)
    })

    after(async () => {
        await restore()
        await LoginPage.loginAs(ADMIN_USER)
        await AdminApi.open()
        await AdminApi.cleanupModerationFixture(fx)
    })

    // 2026-11-12: final score column now shows the raw CA + Exam total
    // (30 + 50 = 80) rather than a scaled value — by design, confirmed.
    it('E2E-ADM-LOCK-001 | While the term is open the teacher can enter grades (CA 30 / Exam 50 → 80)', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        await LoginPage.loginAs(TEACHER_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await GradeEntryPage.enterScores(fx.studentId, [30, 50])
        expect(await GradeEntryPage.save()).toMatch(/Saved/i)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(80)
    })

    it('E2E-ADM-LOCK-002 | The admin moves the current term to end yesterday and turns the term-end lock on', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        await LoginPage.loginAs(ADMIN_USER)
        await AcademicPage.openOn('terms')
        await AcademicPage.chooseTermSession(session.sessionId)
        const start = localDay(-2)
        changed = true
        // Breaks would fall outside the shortened terms, so they are cleared.
        await AcademicPage.setTermDates(session.sessionId, term.ordinal, { start, end: yesterday, breakStart: '', breakEnd: '' })
        for (const t of session.terms.filter(t => !t.current && t.start < start && t.end >= start)) {
            await AcademicPage.setTermDates(session.sessionId, t.ordinal, { end: localDay(-3), breakStart: '', breakEnd: '' })
        }
        expect(await AcademicPage.saveTerms(session.sessionId)).toMatch(/saved/i)
        await AcademicPage.openOn('terms')
        const now = await AcademicPage.currentSessionTerms()
        expect(now.terms.find(t => t.current).termId).toBe(term.termId)
        expect(now.terms.find(t => t.current).end).toBe(yesterday)
        await SettingsPage.openOn('preferences')
        await SettingsPage.setPref(LOCK, true)
        await SettingsPage.openOn('preferences')
        expect(await SettingsPage.isOn(LOCK)).toBe(true)
    })

    // 2026-11-12: by design the sheet is served editable even for an ended
    // locked term; the block surfaces when the teacher tries to save. The
    // test asserts that save attempt is refused with the expired-term error.
    it('E2E-ADM-LOCK-003 | The teacher save on the ended term is refused with an expired-term error', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        await LoginPage.loginAs(TEACHER_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await GradeEntryPage.enterScores(fx.studentId, [20, 40])
        expect(await GradeEntryPage.save()).toMatch(/expired term|cannot be saved/i)
    })

    it('E2E-ADM-LOCK-004 | A direct score update from the teacher is refused server-side', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        const res = await GradeEntryPage.forceScoreUpdate(fx.classId, fx.subjectId, 99)
        expect(res.status).toBeGreaterThanOrEqual(400)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(80)
    })

    // 2026-11-12: same as LOCK-003 — the admin's sheet is served editable
    // and the server refuses the save with the expired-term error.
    it('E2E-ADM-LOCK-005 | The admin save on the ended term is refused with an expired-term error', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        await LoginPage.loginAs(ADMIN_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        await GradeEntryPage.enterScores(fx.studentId, [15, 35])
        expect(await GradeEntryPage.save()).toMatch(/expired term|cannot be saved/i)
    })

    it('E2E-ADM-LOCK-006 | A direct score update from the admin is refused server-side', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        const res = await GradeEntryPage.forceScoreUpdate(fx.classId, fx.subjectId, 99)
        expect(res.status).toBeGreaterThanOrEqual(400)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        expect(Number(await GradeEntryPage.finalScore(fx.studentId).getValue())).toBe(80)
    })

    it('E2E-ADM-LOCK-007 | Restoring the original term dates reopens the term for the teacher', async () => {
        addFeature('Term-End Lock'); addSeverity('critical')
        expect(await restore()).toMatch(/saved/i)
        await AcademicPage.openOn('terms')
        expect(await AcademicPage.currentSessionTerms()).toEqual(session)
        await LoginPage.loginAs(TEACHER_USER)
        await GradeEntryPage.openSheet(fx.classId, fx.subjectId)
        expect(await enabledInputs()).toBe(2)
    })
})
