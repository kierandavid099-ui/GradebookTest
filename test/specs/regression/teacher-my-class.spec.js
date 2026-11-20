import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import TeacherGradeEntryPage from '../../page objects/teacherGradeEntry.page.js'
import TeacherStudentProfilePage from '../../page objects/teacherStudentProfile.page.js'
import { TEACHER_USER } from '../../helpers/testData.js'
import {
    FORM_CLASS_ID, FORM_CLASS_NAME, FIXTURE_SUBJECTS, PASS_MARK, studentSheetName, studentListName, scoresFor,
} from '../../helpers/teacherData.js'

// My Class tab (dashboard) and the Student Profile a teacher opens from it.
// The profile sets English scores for the Tchfixture pupils to put them on
// either side of the pass mark and then into a tie; everything else (Maths
// state, other suites' pupils in Pri 2A) is read from the page, not assumed.
//
// Leaves behind: draft English scores for Ada / Bayo / Chidi.

const ADA = 'Ada'
const BAYO = 'Bayo'
const CHIDI = 'Chidi'

describe('REGRESSION — Teacher My Class & Student Profile', () => {

    let ids
    const profileIds = {}
    // Every component at v% of its max, so the Final is v (2026-10-30: the
    // sheet now scores in points, CA 40 pt + Exam 60 pt).
    const same = async (v) => scoresFor(v, await TeacherGradeEntryPage.components())

    async function setEnglish(values) {
        await TeacherGradeEntryPage.openSheet(FORM_CLASS_ID, ids.english)
        for (const [first, v] of Object.entries(values)) await TeacherGradeEntryPage.enterScores(studentSheetName(first), await same(v))
        await TeacherGradeEntryPage.saveAndReopen(FORM_CLASS_ID, ids.english)
    }

    async function openProfile(first) {
        await TeacherStudentProfilePage.openFor(profileIds[first])
    }

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        ids = await TeacherFixtures.ensure()
        await TeacherDashboardPage.open()
        for (const first of [ADA, BAYO, CHIDI]) {
            const row = await TeacherDashboardPage.findStudentRow(studentListName(first))
            profileIds[first] = row.profile.split('/students/')[1]
        }
    })

    describe('My Class Tab', () => {

        before(async () => {
            await TeacherDashboardPage.open()
            await TeacherDashboardPage.openTab(TeacherDashboardPage.studentsTab, TeacherDashboardPage.studentsPane)
        })

        it('REG-TCH-MCL-001 | My Class lists the form-class pupils with Admission No, Gender, Status and Attendance', async () => {
            addFeature('Teacher My Class'); addSeverity('critical')
            const ada = await TeacherDashboardPage.findStudentRow(studentListName(ADA))
            expect(ada).toBeDefined()
            expect(ada.gender).toBe('Female')
            expect(ada.status).toBe('Active')
            expect(ada.regNo).not.toBe('')
            expect(ada.attendance).toMatch(/(\d+%|No data)/)
        })

        it('REG-TCH-MCL-002 | Each pupil\'s attendance shows "<present>/<recorded> days" consistent with the %', async () => {
            addFeature('Teacher My Class'); addSeverity('normal')
            for (const r of await TeacherDashboardPage.studentRows()) {
                const m = r.attendance.match(/(\d+)% (\d+)\/(\d+) days/)
                if (!m) continue // "No data" — nothing recorded yet
                expect(Number(m[1])).toBe(Math.round((Number(m[2]) / Number(m[3])) * 100))
            }
        })

        it('REG-TCH-MCL-003 | Pupils below 60% attendance are flagged as at risk, the rest are not', async () => {
            addFeature('Teacher My Class'); addSeverity('critical')
            for (const r of await TeacherDashboardPage.studentRows()) {
                const m = r.attendance.match(/^(\d+)%/)
                if (!m) continue
                expect({ pupil: r.name, atRisk: r.atRisk }).toEqual({ pupil: r.name, atRisk: Number(m[1]) < 60 })
            }
        })

        it('REG-TCH-MCL-004 | Searching by name filters the list to matching pupils', async () => {
            addFeature('Teacher My Class'); addSeverity('minor')
            await TeacherDashboardPage.search(TeacherDashboardPage.studentSearchInput, 'bayo')
            const visible = (await TeacherDashboardPage.studentRows()).filter(r => r.visible)
            expect(visible.map(r => r.name)).toEqual([studentListName(BAYO)])
        })

        it('REG-TCH-MCL-005 | Searching by admission number filters the list', async () => {
            addFeature('Teacher My Class'); addSeverity('minor')
            await TeacherDashboardPage.search(TeacherDashboardPage.studentSearchInput, '')
            const withRegNo = (await TeacherDashboardPage.studentRows()).find(r => r.regNo && r.regNo !== 'N/A')
            // The fixture pupils have no admission numbers; only run the check
            // when some pupil in the class has one.
            if (!withRegNo) return
            await TeacherDashboardPage.search(TeacherDashboardPage.studentSearchInput, withRegNo.regNo)
            const visible = (await TeacherDashboardPage.studentRows()).filter(r => r.visible)
            expect(visible.map(r => r.name)).toContain(withRegNo.name)
            visible.forEach(r => expect(r.regNo).toBe(withRegNo.regNo))
        })

        it('REG-TCH-MCL-006 | A search with no match hides every row', async () => {
            addFeature('Teacher My Class'); addSeverity('minor')
            await TeacherDashboardPage.search(TeacherDashboardPage.studentSearchInput, 'zzz-no-such-pupil')
            expect((await TeacherDashboardPage.studentRows()).filter(r => r.visible).length).toBe(0)
        })

        it('REG-TCH-MCL-007 | The Profile button opens that pupil\'s Student Profile', async () => {
            addFeature('Teacher My Class'); addSeverity('critical')
            await openProfile(ADA)
            await expect(TeacherStudentProfilePage.breadcrumb).toHaveText(/Student Profile/i)
            await expect(TeacherStudentProfilePage.studentName).toHaveText(new RegExp(studentSheetName(ADA)))
            await expect(TeacherStudentProfilePage.pageContent).toHaveText(new RegExp(FORM_CLASS_NAME))
        })
    })

    describe('Profile — Pass Mark', () => {

        before(async () => {
            await setEnglish({ [ADA]: 88.2, [BAYO]: PASS_MARK, [CHIDI]: PASS_MARK - 1 })
        })

        it('REG-TCH-PRF-001 | Headline stats show Attendance, Avg Score, Subjects Scored and Class Rank', async () => {
            addFeature('Teacher Student Profile'); addSeverity('critical')
            await openProfile(ADA)
            for (const l of ['Attendance', 'Avg Score', 'Subjects Scored', 'Class Rank']) {
                expect(await TeacherStudentProfilePage.stat(l)).not.toBeNull()
            }
            expect((await TeacherStudentProfilePage.stat('Class Rank')).value).toMatch(/^#\d+$/)
        })

        it('REG-TCH-PRF-002 | Avg Score is the mean of the pupil\'s subject scores on the Grades tab', async () => {
            addFeature('Teacher Student Profile'); addSeverity('critical')
            await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
            const scores = (await TeacherStudentProfilePage.gradeRows()).map(r => Number(r.score))
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length
            expect(Number((await TeacherStudentProfilePage.stat('Avg Score')).value)).toBeCloseTo(avg, 1)
            expect((await TeacherStudentProfilePage.stat('Avg Score')).sub).toBe(`${scores.length} subject${scores.length === 1 ? '' : 's'}`)
        })

        it('REG-TCH-PRF-003 | Grades tab shows the English score with a performance bar of the same width', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            const g = await TeacherStudentProfilePage.gradeFor(FIXTURE_SUBJECTS.english.name)
            expect(Number(g.score)).toBeCloseTo(88.2, 1)
            expect(g.bar).toBe(`${Number(g.score)}%`)
        })

        it('REG-TCH-PRF-004 | Grades summary Average / Highest / Lowest / Passed match the rows', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            const scores = (await TeacherStudentProfilePage.gradeRows()).map(r => Number(r.score))
            const s = await TeacherStudentProfilePage.gradesSummary()
            expect(Number(s.Highest)).toBeCloseTo(Math.max(...scores), 1)
            expect(Number(s.Lowest)).toBeCloseTo(Math.min(...scores), 1)
            expect(s.Passed).toBe(`${scores.filter(x => x >= PASS_MARK).length}/${scores.length}`)
        })

        it('REG-TCH-PRF-005 | A Final of exactly 40 counts as passed (≥ 40)', async () => {
            addFeature('Teacher Student Profile'); addSeverity('blocker')
            await openProfile(BAYO)
            await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
            const rows = await TeacherStudentProfilePage.gradeRows()
            expect(Number((await TeacherStudentProfilePage.gradeFor(FIXTURE_SUBJECTS.english.name)).score)).toBe(40)
            const passed = rows.filter(r => Number(r.score) >= PASS_MARK).length
            expect((await TeacherStudentProfilePage.stat('Subjects Scored')).sub).toBe(`${passed} passed (≥40)`)
        })

        it('REG-TCH-PRF-006 | A Final of 39 does not count as passed', async () => {
            addFeature('Teacher Student Profile'); addSeverity('blocker')
            await openProfile(CHIDI)
            await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
            const rows = await TeacherStudentProfilePage.gradeRows()
            expect(Number((await TeacherStudentProfilePage.gradeFor(FIXTURE_SUBJECTS.english.name)).score)).toBe(39)
            const passed = rows.filter(r => Number(r.score) >= PASS_MARK).length
            expect((await TeacherStudentProfilePage.stat('Subjects Scored')).sub).toBe(`${passed} passed (≥40)`)
            expect(Number((await TeacherStudentProfilePage.stat('Subjects Scored')).value)).toBe(rows.length)
        })

        it('REG-TCH-PRF-007 | Each subject row shows a grade band (WAEC: 88.2 → A1, 40 → E8, 39 → F9)', async function () {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            // Bands come from the admin-owned grade scale. Like the Grade Bands
            // suite, this only runs when the live scale is WAEC: on 28 Oct the
            // school (Primary) had no scale at all and every band showed "-".
            const bands = {}
            for (const first of [ADA, BAYO, CHIDI]) {
                await openProfile(first)
                await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
                bands[first] = (await TeacherStudentProfilePage.gradeFor(FIXTURE_SUBJECTS.english.name)).grade
            }
            if (!/^[A-F]\d$/.test(bands[ADA])) {
                console.log(`[teacher-my-class] PRF-007 skipped: live grade scale is not WAEC (88.2 → "${bands[ADA]}")`)
                return this.skip()
            }
            expect(bands).toEqual({ [ADA]: 'A1', [BAYO]: 'E8', [CHIDI]: 'F9' })
        })
    })

    describe('Profile — Class Rank', () => {

        const avgs = {}

        before(async () => {
            // Put Bayo and Chidi on the same overall average: read their
            // other subject scores, then pick English values that equalise.
            const other = {}
            for (const first of [BAYO, CHIDI]) {
                await openProfile(first)
                await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.gradesTab, TeacherStudentProfilePage.gradesPane)
                other[first] = (await TeacherStudentProfilePage.gradeRows())
                    .filter(r => r.subject !== FIXTURE_SUBJECTS.english.name).reduce((a, r) => a + Number(r.score), 0)
            }
            const bayoEnglish = 50
            const chidiEnglish = bayoEnglish + other[BAYO] - other[CHIDI]
            await setEnglish({ [ADA]: 95, [BAYO]: bayoEnglish, [CHIDI]: Math.min(100, Math.max(0, chidiEnglish)) })

            // Collect every class member's average and rank from their profile.
            await TeacherDashboardPage.open()
            for (const r of await TeacherDashboardPage.studentRows()) {
                await TeacherStudentProfilePage.openUrl(r.profile)
                await TeacherStudentProfilePage.breadcrumb.waitForDisplayed({ timeout: 15000 })
                avgs[r.name] = {
                    avg: (await TeacherStudentProfilePage.stat('Avg Score')).value,
                    rank: (await TeacherStudentProfilePage.stat('Class Rank')).value,
                }
            }
        })

        it('REG-TCH-PRF-008 | Class Rank orders pupils by average score (highest = #1)', async () => {
            addFeature('Teacher Student Profile'); addSeverity('critical')
            const scored = Object.entries(avgs).filter(([, v]) => !isNaN(Number(v.avg)))
            for (const [name, v] of scored) {
                const expected = 1 + scored.filter(([, o]) => Number(o.avg) > Number(v.avg)).length
                expect({ name, rank: v.rank }).toEqual({ name, rank: `#${expected}` })
            }
        })

        it('REG-TCH-PRF-009 | Pupils with tied averages share the same rank', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            const b = avgs[studentListName(BAYO)]
            const c = avgs[studentListName(CHIDI)]
            expect(b.avg).toBe(c.avg)
            expect(b.rank).toBe(c.rank)
        })

        it('REG-TCH-PRF-010 | Pupils with no scores get no position ("—")', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            for (const [name, v] of Object.entries(avgs).filter(([, x]) => isNaN(Number(x.avg)))) {
                expect({ name, rank: v.rank }).toEqual({ name, rank: '—' })
            }
        })
    })

    describe('Profile — Attendance & History Tabs', () => {

        before(async () => await openProfile(ADA))

        it('REG-TCH-PRF-011 | Attendance tab Present / Absent / Rate agree with the monthly breakdown', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.attendanceTab, TeacherStudentProfilePage.attendancePane)
            const months = await TeacherStudentProfilePage.monthlyAttendance()
            const p = months.reduce((a, m) => a + Number(m.present), 0)
            const ab = months.reduce((a, m) => a + Number(m.absent), 0)
            const text = await TeacherStudentProfilePage.paneText(TeacherStudentProfilePage.attendancePane)
            // The labels render upper-cased ("1\nPRESENT")
            expect(text).toMatch(new RegExp(`${p}\\s*Present`, 'i'))
            expect(text).toMatch(new RegExp(`${ab}\\s*Absent`, 'i'))
            months.forEach(m => expect(Number(m.total)).toBe(Number(m.present) + Number(m.absent)))
        })

        it('REG-TCH-PRF-012 | The profile attendance % matches the My Class list', async () => {
            addFeature('Teacher Student Profile'); addSeverity('normal')
            const profilePct = (await TeacherStudentProfilePage.stat('Attendance')).value
            await TeacherDashboardPage.open()
            const row = await TeacherDashboardPage.findStudentRow(studentListName(ADA))
            if (/^\d+%/.test(row.attendance)) expect(row.attendance).toContain(profilePct)
        })

        it('REG-TCH-PRF-013 | History tab lists the current enrolment with class and rank', async () => {
            addFeature('Teacher Student Profile'); addSeverity('minor')
            await openProfile(ADA)
            await TeacherStudentProfilePage.openTab(TeacherStudentProfilePage.historyTab, TeacherStudentProfilePage.historyPane)
            const text = await TeacherStudentProfilePage.paneText(TeacherStudentProfilePage.historyPane)
            expect(text).toMatch(new RegExp(`${FORM_CLASS_NAME}[\\s\\S]*Current`))
            expect(text).toMatch(/Class rank: #\d+/)
        })
    })
})
