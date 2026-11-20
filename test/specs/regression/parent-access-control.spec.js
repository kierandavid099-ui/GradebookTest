import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import ParentDashboardPage from '../../page objects/parentDashboard.page.js'
import ParentRegistrationsPage from '../../page objects/parentRegistrations.page.js'
import { PARENT_USER, STUDENT_ID, BASE_URL } from '../../helpers/testData.js'
import {
    PARENT_MENU, UNLINKED_FIXTURE, TEACHER_ONLY_ROUTES, ADMIN_ONLY_ROUTES, CHILD_ROUTES, fetchPage,
} from '../../helpers/parentData.js'

// Parent RBAC: menu scoping, other roles' routes, and access control on
// another child's pages. The ID-swap target is the UNLINKED fixture student.
// These assert the *correct* (secure) behaviour.
// 2026-10-30: the direct-API write tests (RBAC-050/051) were dropped — out of
// scope; only what a parent can do through the web app's own UI is tested.
//
// Leaves behind: fixture students "Autotest, ParFixLinked" (linked to
// Chinedu) and "Autotest, ParFixUnlinked" — created once, reused on re-runs.

describe('REGRESSION — Parent Access Control', () => {

    let unlinkedId
    let termId
    let session

    before(async () => {
        ({ unlinkedId } = await ParentRegistrationsPage.setUpFixtures())
        await LoginPage.loginAs(PARENT_USER)
        await ParentDashboardPage.open()
        termId = await ParentDashboardPage.firstSelectableValue(ParentDashboardPage.termSelect)
        session = await ParentDashboardPage.firstSelectableValue(ParentDashboardPage.sessionSelect)
    })

    // A response counts as "denied" when the server refused (4xx/5xx) or
    // bounced the request elsewhere — and, either way, the body must not
    // carry the other child's name.
    const expectDenied = (res, path, childName) => {
        const stayed = res.url.startsWith(`${BASE_URL}${path.split('?')[0]}`)
        expect(res.status !== 200 || !stayed).toBe(true)
        expect(res.body).not.toContain(childName)
    }

    describe('Navigation Scoping', () => {

        it('REG-PAR-RBAC-001 | GradeBook menu shows only Dashboard and Messenger', async () => {
            addFeature('Parent Access Control'); addSeverity('normal')
            await ParentDashboardPage.open()
            await Sidebar.openGroup('parent')
            expect(await Sidebar.itemTexts()).toEqual(PARENT_MENU)
        })

        it('REG-PAR-RBAC-002 | No admin or teacher menu group is rendered for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('normal')
            for (const role of ['admin', 'teacher', 'student']) {
                await expect(Sidebar.group(role)).not.toBeExisting()
            }
        })
    })

    describe('Other Roles\' Routes', () => {

        it('REG-PAR-RBAC-010 | Teacher grade-entry route is blocked for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            const res = await fetchPage(TEACHER_ONLY_ROUTES.gradeEntry)
            // The app answers teacher routes with a redirect to the parent's
            // own dashboard rather than a 403.
            expect(res.redirected).toBe(true)
            expect(res.url).not.toContain('/grade-entry')
        })

        it('REG-PAR-RBAC-011 | Teacher class-assessment route is blocked for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            const res = await fetchPage(TEACHER_ONLY_ROUTES.classAssessment)
            expect(res.redirected).toBe(true)
            expect(res.url).not.toContain('/class-assessment')
        })

        it('REG-PAR-RBAC-012 | Teacher class-attendance route is blocked for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            const res = await fetchPage(TEACHER_ONLY_ROUTES.classAttendance)
            expect(res.redirected).toBe(true)
            expect(res.url).not.toContain('/class-attendance')
        })

        it('REG-PAR-RBAC-013 | Teacher class-timetable route is blocked for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            const res = await fetchPage(TEACHER_ONLY_ROUTES.classTimetable)
            expect(res.redirected).toBe(true)
            expect(res.url).not.toContain('/class-timetable')
        })

        it('REG-PAR-RBAC-020 | Admin academic-management route returns 403 for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            expect((await fetchPage(ADMIN_ONLY_ROUTES.academicManagement)).status).toBe(403)
        })

        it('REG-PAR-RBAC-021 | Admin result-moderation route returns 403 for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            expect((await fetchPage(ADMIN_ONLY_ROUTES.resultModeration)).status).toBe(403)
        })

        it('REG-PAR-RBAC-022 | Admin registration-management route returns 403 for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            expect((await fetchPage(ADMIN_ONLY_ROUTES.registrationManagement)).status).toBe(403)
        })

        it('REG-PAR-RBAC-023 | Admin teacher-management route returns 403 for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            expect((await fetchPage(ADMIN_ONLY_ROUTES.teacherManagement)).status).toBe(403)
        })

        it('REG-PAR-RBAC-024 | Admin manage-settings route returns 403 for a parent', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            expect((await fetchPage(ADMIN_ONLY_ROUTES.manageSettings)).status).toBe(403)
        })

        it('REG-PAR-RBAC-030 | Loading the academic-management URL shows no admin page', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            await browser.url(`${BASE_URL}${ADMIN_ONLY_ROUTES.academicManagement}`)
            await expect($('body')).not.toHaveText(/Academic Management/i)
        })

        it('REG-PAR-RBAC-031 | Loading the teacher grade-entry URL lands back on the parent dashboard', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            await browser.url(`${BASE_URL}${TEACHER_ONLY_ROUTES.gradeEntry}`)
            // The app bounces the parent to the role router at /dashboard.
            await browser.waitUntil(async () => !(await browser.getUrl()).includes('/grade-entry'),
                { timeout: 15000, timeoutMsg: 'Grade-entry URL was not redirected away' })
            await expect(browser).not.toHaveTitle(/Grade Entry/i)
            // And the grade-entry screen itself never renders.
            await expect($('body')).not.toHaveText(/Grade Entry/i)
        })
    })

    describe('Another Child\'s Pages — ID Swap', () => {

        const unlinkedName = `${UNLINKED_FIXTURE.lastName}, ${UNLINKED_FIXTURE.firstName}`

        // The ID-swap tests are only meaningful if the target really is
        // unlinked and the same URLs work for the parent's own child.
        it('REG-PAR-RBAC-040 | The unlinked fixture child is not on the parent\'s My Children tab', async () => {
            addFeature('Parent Access Control'); addSeverity('critical')
            await ParentDashboardPage.open()
            expect(await ParentDashboardPage.childIds()).not.toContain(unlinkedId)
        })

        it('REG-PAR-RBAC-041 | An unlinked child\'s profile cannot be opened by ID swap', async () => {
            addFeature('Parent Access Control'); addSeverity('blocker')
            const own = await fetchPage(CHILD_ROUTES.profile(STUDENT_ID))
            expect(own.status).toBe(200)
            const path = CHILD_ROUTES.profile(unlinkedId)
            expectDenied(await fetchPage(path), path, unlinkedName)
        })

        it('REG-PAR-RBAC-042 | An unlinked child\'s attendance cannot be opened by ID swap', async () => {
            addFeature('Parent Access Control'); addSeverity('blocker')
            const path = CHILD_ROUTES.attendance(unlinkedId)
            expectDenied(await fetchPage(path), path, unlinkedName)
        })

        it('REG-PAR-RBAC-043 | An unlinked child\'s term result cannot be retrieved by ID swap', async () => {
            addFeature('Parent Access Control'); addSeverity('blocker')
            const path = CHILD_ROUTES.termResults(unlinkedId, termId)
            expectDenied(await fetchPage(path), path, unlinkedName)
        })

        it('REG-PAR-RBAC-044 | An unlinked child\'s session result cannot be retrieved by ID swap', async () => {
            addFeature('Parent Access Control'); addSeverity('blocker')
            const path = CHILD_ROUTES.sessionResults(unlinkedId, session)
            expectDenied(await fetchPage(path), path, unlinkedName)
        })
    })
})
