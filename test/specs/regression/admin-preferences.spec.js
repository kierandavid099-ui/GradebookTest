import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import SettingsPage from '../../page objects/adminSettings.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import { ADMIN_USER, STUDENT_USER, TEACHER_USER, BASE_URL } from '../../helpers/testData.js'
import { ORG_ID, PREFS, TEACHER_CLASS_ID, LIVE_SUBJECT_ID } from '../../helpers/adminData.js'

// Manage Settings > Preferences. These five switches are school-wide and
// the student/parent/teacher suites run against them at the same time, so
// the original state of every switch is recorded first and each test puts
// its switch back before it ends (the after hook re-checks all of them).

describe('REGRESSION — Admin Preferences', () => {

    const original = {}

    const restoreAll = async () => {
        await SettingsPage.openOn('preferences')
        for (const [key, on] of Object.entries(original)) await SettingsPage.setPref(key, on)
    }

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await SettingsPage.openOn('preferences')
        for (const key of Object.values(PREFS)) original[key] = await SettingsPage.isOn(key)
    })

    after(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await restoreAll()
    })

    // Flip a switch, confirm the auto-save, reload and confirm it stuck,
    // then flip it back.
    const assertAutoSaves = async (key) => {
        const before = await SettingsPage.isOn(key)
        try {
            expect(await SettingsPage.flip(key)).toMatch(/Preference saved/i)
            await SettingsPage.openOn('preferences')
            expect(await SettingsPage.isOn(key)).toBe(!before)
        } finally {
            await SettingsPage.openOn('preferences')
            await SettingsPage.setPref(key, before)
        }
        await SettingsPage.openOn('preferences')
        expect(await SettingsPage.isOn(key)).toBe(before)
    }

    describe('Toggles', () => {

        it('REG-ADM-SET-001 | Preferences lists the five grade-book switches', async () => {
            addFeature('Preferences'); addSeverity('blocker')
            for (const key of Object.values(PREFS)) await expect(SettingsPage.toggle(key)).toBeExisting()
        })

        it('REG-ADM-SET-002 | "Publish results" auto-saves with a "Preference saved" toast and persists on reload', async () => {
            addFeature('Preferences'); addSeverity('critical')
            await assertAutoSaves(PREFS.resultsPublished)
        })

        it('REG-ADM-SET-003 | "Lock grade entry after term ends" turns on and off and persists', async () => {
            addFeature('Preferences'); addSeverity('critical')
            await assertAutoSaves(PREFS.lockGradeEntryAfterTerm)
        })

        it('REG-ADM-SET-004 | "Allow teachers to view other subjects\' grades" auto-saves and persists', async () => {
            addFeature('Preferences'); addSeverity('critical')
            await assertAutoSaves(PREFS.allowTeacherViewOtherGrades)
        })

        it('REG-ADM-SET-005 | "Email alert when a teacher submits grades" auto-saves and persists', async () => {
            addFeature('Preferences'); addSeverity('normal')
            await assertAutoSaves(PREFS.notifyGradeSubmission)
        })

        it('REG-ADM-SET-006 | "Notify parents when results are published" auto-saves and persists', async () => {
            addFeature('Preferences'); addSeverity('normal')
            await assertAutoSaves(PREFS.notifyResultsPublished)
        })

        it('REG-ADM-SET-007 | A preference write carries this school\'s organization_id', async () => {
            addFeature('Preferences'); addSeverity('normal')
            const key = PREFS.notifyGradeSubmission
            const before = await SettingsPage.isOn(key)
            // Record the FormData of the next settings request the page sends.
            await browser.execute(() => {
                const orig = $.ajax
                window.__prefPayload = null
                $.ajax = function (opts) {
                    if (opts && /fc-api\/settings/.test(opts.url) && opts.data instanceof FormData) {
                        window.__prefPayload = Object.fromEntries(opts.data.entries())
                    }
                    return orig.apply(this, arguments)
                }
            })
            try {
                await SettingsPage.flip(key)
                const payload = await browser.execute(() => window.__prefPayload)
                expect(payload.organization_id).toBe(ORG_ID)
                expect(payload._method).toBe('PUT')
            } finally {
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, before)
            }
        })
    })

    describe('Effect on other portals', () => {

        // The student's term-result picker labels the current term
        // "— Not yet published" while results are withheld.
        const studentTermLabel = async (termId) => {
            await LoginPage.loginAs(STUDENT_USER)
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            const option = $(`option[value="${termId}"]`)
            await option.waitForExist({ timeout: 15000 })
            return option.getProperty('textContent')
        }

        it('REG-ADM-SET-008 | Publish results ON shows the current term as published to students; OFF withholds it', async () => {
            addFeature('Preferences'); addSeverity('critical')
            await AcademicPage.openOn('terms')
            const termId = await AcademicPage.currentTermId()
            const key = PREFS.resultsPublished
            try {
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, true)
                expect(await studentTermLabel(termId)).not.toMatch(/Not yet published/i)
                await LoginPage.loginAs(ADMIN_USER)
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, false)
                expect(await studentTermLabel(termId)).toMatch(/Not yet published/i)
            } finally {
                await LoginPage.loginAs(ADMIN_USER)
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, original[key])
            }
        })

        it('REG-ADM-SET-009 | Publishing is one global switch — there is no per-class publish control', async () => {
            addFeature('Preferences'); addSeverity('normal')
            await SettingsPage.openOn('preferences')
            const publishSwitches = await browser.execute(() => [...document.querySelectorAll('.pref-toggle')]
                .filter(t => /publish results/i.test(document.querySelector(`label[for="${t.id}"]`).textContent)).length)
            expect(publishSwitches).toBe(1)
            await browser.url(`${BASE_URL}/scola-gradebook2/gradeClasses/${TEACHER_CLASS_ID}`)
            await SettingsPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
            expect(await $$('//*[contains(translate(., "PUBLISH", "publish"), "publish result")][self::button or self::a or self::label]').length).toBe(0)
        })

        // 2026-10-30, confirmed by the owners: viewing other teachers'
        // classes/subjects/pupils is open whatever this switch says; the
        // switch governs writing. ON lets a teacher edit/create scores on an
        // unallocated subject on another teacher's behalf (OFF refuses it —
        // REG-TCH-RBAC-009/010). The changed score is saved back afterwards;
        // a blank original can't be restored (blanking never clears a score).
        it('REG-ADM-SET-010 | With "view other grades" ON a teacher can save scores on an unallocated subject', async () => {
            addFeature('Preferences'); addSeverity('critical')
            const key = PREFS.allowTeacherViewOtherGrades
            try {
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, true)
                await LoginPage.loginAs(TEACHER_USER)
                await TeacherGradeEntryPage.openSheet(TEACHER_CLASS_ID, LIVE_SUBJECT_ID)
                await TeacherGradeEntryPage.table.waitForDisplayed({ timeout: 10000 })
                const [before] = await TeacherGradeEntryPage.rows()
                const score = Number(before.scores[0]) === 7 ? 8 : 7
                await TeacherGradeEntryPage.enterScores(before.name, [score, ...before.scores.slice(1)])
                expect(await TeacherGradeEntryPage.save()).not.toMatch(/not assigned to teach this subject|error/i)
                await TeacherGradeEntryPage.openSheet(TEACHER_CLASS_ID, LIVE_SUBJECT_ID)
                await TeacherGradeEntryPage.table.waitForDisplayed({ timeout: 10000 })
                // Saved scores come back zero-padded ("7.00"), so compare numerically.
                expect(Number((await TeacherGradeEntryPage.row(before.name)).scores[0])).toBe(score)
                if (before.scores[0] !== '') {
                    await TeacherGradeEntryPage.enterScores(before.name, before.scores)
                    await TeacherGradeEntryPage.save()
                }
            } finally {
                await LoginPage.loginAs(ADMIN_USER)
                await SettingsPage.openOn('preferences')
                await SettingsPage.setPref(key, original[key])
            }
        })
    })
})
