import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import TeacherFixtures from '../../page objects/teacherFixtures.page.js'
import TeacherDashboardPage from '../../page objects/teacherDashboard.page.js'
import { TEACHER_USER, TEACHER_DISPLAY_NAME } from '../../helpers/testData.js'
import {
    FORM_CLASS_ID, FORM_CLASS_NAME, OTHER_CLASS_NAME, UNASSIGNED_CLASS_NAME, FIXTURE_SUBJECTS, TEACHER_ID,
} from '../../helpers/teacherData.js'

// Teacher GradeBook dashboard: header shortcuts, form-class banner, stat
// cards, Pending Tasks and the My Subjects tab. Read-only apart from the
// fixture check. Values that depend on other suites' data (counts, tasks)
// are checked for consistency with what the page itself lists.

// 2026-11-09: green starts at 70%, not 80% — live: 70% green, 61% amber,
// 15.6% red (matches the Simple 4-Band A = 70–100). Amber's 60% floor is
// unconfirmed; nothing has been seen between 15.6% and 61%.
const RED = 'rgb(220, 38, 38)'      // < 60%
const AMBER = 'rgb(161, 98, 7)'     // 60–69%
const GREEN = 'rgb(21, 128, 61)'    // ≥ 70%

describe('REGRESSION — Teacher Dashboard', () => {

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await TeacherFixtures.ensure()
        await TeacherDashboardPage.open()
    })

    describe('Header & Stat Cards', () => {

        it('REG-TCH-DSH-001 | Dashboard loads with the GradeBook breadcrumb and the teacher\'s name in the title', async () => {
            addFeature('Teacher Dashboard'); addSeverity('blocker')
            await expect(TeacherDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
            await expect(browser).toHaveTitle(new RegExp(TEACHER_DISPLAY_NAME))
        })

        it('REG-TCH-DSH-002 | Header names the teacher as the form class teacher', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            await expect(TeacherDashboardPage.headerTeacherLabel).toHaveText(new RegExp(`${TEACHER_DISPLAY_NAME}.*${FORM_CLASS_NAME} Class Teacher`))
        })

        it('REG-TCH-DSH-003 | Form-teacher banner shows the home class and the active term', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            await expect(TeacherDashboardPage.formClassBanner).toHaveText(new RegExp(`Form Teacher — ${FORM_CLASS_NAME}`))
            const term = await TeacherDashboardPage.statValue('Active Term')
            expect(term).toMatch(/^\d{4}-\d{4}-T\d$/)
        })

        it('REG-TCH-DSH-004 | "Subjects Teaching" equals the number of My Subjects rows', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            const rows = await TeacherDashboardPage.subjectRows()
            expect(Number(await TeacherDashboardPage.statValue('Subjects Teaching'))).toBe(rows.length)
        })

        it('REG-TCH-DSH-005 | "My Class Students" equals the number of My Class rows', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            const rows = await TeacherDashboardPage.studentRows()
            expect(Number(await TeacherDashboardPage.statValue('My Class Students'))).toBe(rows.length)
        })

        it('REG-TCH-DSH-006 | "Attendance Rate" is a percentage between 0 and 100', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const v = await TeacherDashboardPage.statValue('Attendance Rate')
            expect(v).toMatch(/^\d{1,3}(\.\d+)?%$/)
            expect(parseFloat(v)).toBeLessThanOrEqual(100)
        })

        it('REG-TCH-DSH-007 | Stat-card quick links point at the form class\'s attendance and conduct screens', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const links = await browser.execute(() => [...document.querySelectorAll('.stat-quick a')].map(a => a.href))
            // 2026-11-09: toContain compares with ===, so it can't take
            // expect.stringContaining — toContainEqual can.
            expect(links).toContainEqual(expect.stringContaining(`/class-attendance/${FORM_CLASS_ID}`))
            expect(links).toContainEqual(expect.stringContaining(`/class-assessment/${FORM_CLASS_ID}`))
        })

        it('REG-TCH-DSH-008 | The sidebar GradeBook menu lists Dashboard, Attendance, Timetable, Conduct and Messenger', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            await Sidebar.openGroup('teacher')
            expect(await Sidebar.itemTexts()).toEqual(['Dashboard', 'Attendance', 'Timetable', 'Conduct', 'Messenger'])
        })
    })

    describe('Pending Tasks', () => {

        let tasks

        before(async () => {
            await TeacherDashboardPage.open()
            tasks = await TeacherDashboardPage.pendingTasks()
        })

        it('REG-TCH-DSH-009 | The Pending Tasks badge matches the number of tasks listed', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const badge = await browser.execute(() => {
                const h = [...document.querySelectorAll('h6')].find(x => x.textContent.includes('Pending Tasks'))
                const b = h && h.closest('.card-header').querySelector('.badge')
                return b ? b.textContent.trim() : '0'
            })
            expect(Number(badge)).toBe(tasks.length)
        })

        it('REG-TCH-DSH-010 | "Subjects with no grades" counts My Subjects rows showing "No grades"', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const ungraded = (await TeacherDashboardPage.subjectRows()).filter(r => /No grades/i.test(r.avg)).length
            const task = tasks.find(t => /with no grades/i.test(t.text))
            if (ungraded === 0) expect(task).toBeUndefined()
            else expect(task.text).toMatch(new RegExp(`^${ungraded} subjects? with no grades`))
        })

        it('REG-TCH-DSH-011 | Every task has an action link that opens a real screen for the form class', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            // 2026-11-09: DEFECT. Chisom is the form teacher of Pri 2A, but the
            // "attendance not recorded this week → Record" link
            // (/class-attendance?class_id=…) flashes a toast
            // "Either you are not a class teacher of a class or the class was
            // not found" and bounces back to the dashboard instead of opening
            // Class Attendance — the href's class_id is wrong or missing.
            const results = []
            for (const t of tasks.filter(x => x.href)) {
                await TeacherDashboardPage.openUrl(t.href)
                results.push({ task: t.title, landedOnDashboard: (await browser.getUrl()).endsWith('/scola-gradebook2/dashboard') })
            }
            expect(results.filter(r => r.landedOnDashboard)).toEqual([])
        })
    })

    describe('Result Shortcuts', () => {

        beforeEach(async () => await TeacherDashboardPage.open())

        it('REG-TCH-DSH-012 | "My Performance" links to this teacher\'s performance report', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            expect(await TeacherDashboardPage.myPerformanceBtn.getAttribute('href')).toContain(`/class-performance/${TEACHER_ID}`)
        })

        it('REG-TCH-DSH-013 | My Performance opens without a server error', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            // KNOWN DEFECT (reported on Plane): /class-performance/{teacherId} returns HTTP 500
            await TeacherDashboardPage.myPerformanceBtn.click()
            await browser.waitUntil(async () => (await browser.execute(() => document.readyState)) === 'complete')
            expect(await TeacherDashboardPage.errorStatus()).toBeNull()
        })

        it('REG-TCH-DSH-014 | Class Term Results asks for a term (current term preselected), then opens the class result', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            await TeacherDashboardPage.classTermResultsBtn.click()
            await TeacherDashboardPage.classTermResultModal.waitForDisplayed({ timeout: 5000 })
            expect(await TeacherDashboardPage.classTermSelect.getValue()).not.toBe('')
            await TeacherDashboardPage.classTermContinueBtn.click()
            await browser.waitUntil(async () => (await browser.getUrl()).includes(`/class-results/${FORM_CLASS_ID}`), { timeout: 15000 })
            // KNOWN DEFECT (reported on Plane): class term results return HTTP 500
            expect(await TeacherDashboardPage.errorStatus()).toBeNull()
        })

        it('REG-TCH-DSH-015 | Class Session Results asks for a session, then opens the class session result', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            await TeacherDashboardPage.classSessionResultsBtn.click()
            await TeacherDashboardPage.classSessionResultModal.waitForDisplayed({ timeout: 5000 })
            await TeacherDashboardPage.classSessionSelect.selectByIndex(1)
            await TeacherDashboardPage.classSessionContinueBtn.click()
            await browser.waitUntil(async () => (await browser.getUrl()).includes(`/class-session-results/${FORM_CLASS_ID}`), { timeout: 15000 })
            // KNOWN DEFECT (reported on Plane): class session results return HTTP 500
            expect(await TeacherDashboardPage.errorStatus()).toBeNull()
        })
    })

    describe('My Subjects', () => {

        let rows

        before(async () => {
            await TeacherDashboardPage.open()
            rows = await TeacherDashboardPage.subjectRows()
        })

        it('REG-TCH-DSH-016 | My Subjects lists the assigned subject × class rows', async () => {
            addFeature('Teacher Dashboard'); addSeverity('blocker')
            expect(await TeacherDashboardPage.findSubjectRow(FIXTURE_SUBJECTS.english.name, FORM_CLASS_NAME)).toBeDefined()
            expect(await TeacherDashboardPage.findSubjectRow(FIXTURE_SUBJECTS.english.name, OTHER_CLASS_NAME)).toBeDefined()
            expect(await TeacherDashboardPage.findSubjectRow(FIXTURE_SUBJECTS.maths.name, FORM_CLASS_NAME)).toBeDefined()
        })

        it('REG-TCH-DSH-017 | A subject × class the teacher is not assigned to is not listed', async () => {
            addFeature('Teacher Dashboard'); addSeverity('blocker')
            // English is taught in Pri 2C, Basic Science everywhere — neither by Chisom.
            expect(await TeacherDashboardPage.findSubjectRow(FIXTURE_SUBJECTS.english.name, UNASSIGNED_CLASS_NAME)).toBeUndefined()
            expect(rows.find(r => r.subject === 'Basic Science')).toBeUndefined()
        })

        it('REG-TCH-DSH-018 | The same subject in two classes shows as two separate rows', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const english = rows.filter(r => r.subject === FIXTURE_SUBJECTS.english.name)
            expect(english.map(r => r.className).sort()).toEqual([FORM_CLASS_NAME, OTHER_CLASS_NAME].sort())
        })

        it('REG-TCH-DSH-019 | Ungraded rows show "No grades" in the Avg Score column', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            // English × Pri 2B has no pupils, so it can never have grades.
            expect((await TeacherDashboardPage.findSubjectRow(FIXTURE_SUBJECTS.english.name, OTHER_CLASS_NAME)).avg).toBe('No grades')
        })

        it('REG-TCH-DSH-020 | Avg Score chips are coloured by band — red < 60%, amber 60–69%, green ≥ 70%', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            const graded = rows.filter(r => /%$/.test(r.avg))
            expect(graded.length).toBeGreaterThan(0)
            for (const r of graded) {
                const v = parseFloat(r.avg)
                // 2026-11-09: avg included so a failure shows the value behind the colour.
                expect({ row: `${r.subject} ${r.className}`, avg: r.avg, color: r.avgColor })
                    .toEqual({ row: `${r.subject} ${r.className}`, avg: r.avg, color: v >= 70 ? GREEN : v >= 60 ? AMBER : RED })
            }
        })

        it('REG-TCH-DSH-021 | Each row\'s Grades / Results / Attendance links carry that row\'s subject and class', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            for (const r of rows.filter(x => x.subject.startsWith('auto-tch'))) {
                const g = new URL(r.grades)
                const res = new URL(r.results)
                expect(g.pathname).toBe('/scola-gradebook2/grade-entry')
                expect(res.pathname).toBe('/scola-gradebook2/grade-entry/completed')
                expect(res.searchParams.get('sj')).toBe(g.searchParams.get('sj'))
                expect(res.searchParams.get('cl')).toBe(g.searchParams.get('cl'))
                expect(r.attendance).toContain(`/subject-attendance/${g.searchParams.get('sj')}?cl=${g.searchParams.get('cl')}`)
            }
        })

        // 2026-11-09: 022–024 each navigate away, so they read the Maths row
        // from the rows captured in before(), not from the current page.
        const mathsRow = () => rows.find(r => r.subject === FIXTURE_SUBJECTS.maths.name && r.className === FORM_CLASS_NAME)

        it('REG-TCH-DSH-022 | The Grades action opens that subject × class grade sheet', async () => {
            addFeature('Teacher Dashboard'); addSeverity('critical')
            const r = mathsRow()
            await TeacherDashboardPage.openUrl(r.grades)
            await expect($('//h6[contains(., "Grade Sheet")]')).toHaveText(new RegExp(FIXTURE_SUBJECTS.maths.name))
        })

        it('REG-TCH-DSH-023 | The Attendance action opens Subject Attendance for that subject and class', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            const r = mathsRow()
            await TeacherDashboardPage.openUrl(r.attendance)
            await expect(TeacherDashboardPage.breadcrumb).toHaveText(/Subject Attendance/i)
            await expect(TeacherDashboardPage.subtitle).toHaveText(new RegExp(`${FIXTURE_SUBJECTS.maths.name}.*${FORM_CLASS_NAME}`))
        })

        it('REG-TCH-DSH-024 | The Results action opens the subject result without a server error', async () => {
            addFeature('Teacher Dashboard'); addSeverity('normal')
            // KNOWN DEFECT (reported on Plane): /grade-entry/completed returns HTTP 500
            const r = mathsRow()
            await TeacherDashboardPage.openPath(new URL(r.results).pathname + new URL(r.results).search)
            expect(await TeacherDashboardPage.errorStatus()).toBeNull()
        })

        it('REG-TCH-DSH-025 | Searching My Subjects filters rows by subject or class', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            await TeacherDashboardPage.open()
            await TeacherDashboardPage.search(TeacherDashboardPage.subjectSearchInput, 'maths')
            const visible = (await TeacherDashboardPage.subjectRows()).filter(r => r.visible)
            expect(visible.length).toBeGreaterThan(0)
            visible.forEach(r => expect(r.subject.toLowerCase()).toContain('maths'))
            await TeacherDashboardPage.search(TeacherDashboardPage.subjectSearchInput, OTHER_CLASS_NAME)
            ;(await TeacherDashboardPage.subjectRows()).filter(r => r.visible).forEach(r => expect(r.className).toBe(OTHER_CLASS_NAME))
        })
    })

    describe('Activity & Notifications Tabs', () => {

        before(async () => await TeacherDashboardPage.open())

        it('REG-TCH-DSH-026 | The Activity tab lists recent grade activity', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            await TeacherDashboardPage.openTab(TeacherDashboardPage.activityTab, TeacherDashboardPage.activityPane)
            await expect(TeacherDashboardPage.activityPane).toHaveText(/Grades updated|No recent activity/i)
        })

        it('REG-TCH-DSH-027 | The Notifications tab shows the Grade Submission Feedback panel', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            await TeacherDashboardPage.openTab(TeacherDashboardPage.notificationsTab, TeacherDashboardPage.notificationsPane)
            await expect(TeacherDashboardPage.notificationsPane).toHaveText(/Grade Submission Feedback/i)
        })

        it('REG-TCH-DSH-028 | "View All Notifications" opens a real notifications page', async () => {
            addFeature('Teacher Dashboard'); addSeverity('minor')
            // 2026-11-09: The bell icon's href="#" opens a dropdown; the
            // dropdown's "View All Notifications" footer link goes to
            // /fc/notifications. The old assertion against
            // /scola-gradebook2/notifications was wrong.
            await TeacherDashboardPage.open()
            const href = await browser.execute(() => {
                const a = [...document.querySelectorAll('a')]
                    .find(x => /view all notifications/i.test(x.textContent))
                return a ? a.getAttribute('href') : null
            })
            expect(href).toMatch(/\/notifications$/)
            await TeacherDashboardPage.openPath(new URL(href, 'https://gradebook.ng').pathname)
            expect(await browser.getUrl()).toContain('/notifications')
        })
    })
})
