import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import DashboardPage from '../../page objects/adminDashboard.page.js'
import Sidebar from '../../page objects/sidebar.js'
import { ADMIN_USER } from '../../helpers/testData.js'

// Admin Dashboard: headline stats, the Gradebook Setup Guide and the
// classes/subjects tables. Read-only.

describe('REGRESSION — Admin Dashboard', () => {

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
        await DashboardPage.open()
    })

    describe('Stats', () => {

        it('REG-ADM-DSH-001 | Stat cards show Students, Teachers, Subjects, Classes and Parents counts', async () => {
            addFeature('Dashboard'); addSeverity('critical')
            for (const label of ['Students', 'Teachers', 'Subjects', 'Classes', 'Parents']) {
                await expect(DashboardPage.stat(label)).toHaveText(/^\d+$/)
            }
        })

        it('REG-ADM-DSH-002 | The Classes count matches the rows in the classes table', async () => {
            addFeature('Dashboard'); addSeverity('normal')
            const count = Number(await DashboardPage.stat('Classes').getText())
            expect(await $$('#tbl-admin-classes tbody tr[data-search]').length).toBe(count)
        })
    })

    describe('Setup guide', () => {

        // Once every step is done the header switches to "Setup Complete — All 10 steps done".
        it('REG-ADM-DSH-003 | The setup guide reports progress out of ten steps and lists all ten', async () => {
            addFeature('Setup Guide'); addSeverity('critical')
            await expect(DashboardPage.setupChecklist).toHaveText(/\d+ of 10 steps complete|All 10 steps done/i)
            expect(await DashboardPage.setupSteps.length).toBe(10)
        })

        it('REG-ADM-DSH-004 | Profile, session, terms, current term and classes steps are complete', async () => {
            addFeature('Setup Guide'); addSeverity('normal')
            for (const step of ['Complete School Profile', 'Create an Academic Session', 'Add Terms to the Session', 'Set a Current Term', 'Add Classes']) {
                await expect(DashboardPage.setupStep(step)).toBeExisting()
            }
        })

        it('REG-ADM-DSH-005 | Every step links to the screen where it is done', async () => {
            addFeature('Setup Guide'); addSeverity('minor')
            const hrefs = await browser.execute(() => [...document.querySelectorAll('#sgb2-setup-body a')].map(a => a.getAttribute('href')))
            expect(hrefs.length).toBe(10)
            expect(hrefs.every(h => /\/scola-gradebook2\//.test(h))).toBe(true)
        })

        // The no-current-term gate (old DSH-006) leaves the school without a
        // current term, so it runs on its own:
        // test/specs/isolated/admin-no-current-term.spec.js (--suite noterm).
    })

    describe('Tables', () => {

        it('REG-ADM-DSH-007 | The class search filters the classes table', async () => {
            addFeature('Dashboard'); addSeverity('minor')
            await DashboardPage.classSearch.setValue('Pri 2A')
            await expect(DashboardPage.classRow('Pri 2A')).toBeDisplayed()
            await expect(DashboardPage.classRow('Pri 1')).not.toBeDisplayed()
            await DashboardPage.classSearch.clearValue()
        })

        it('REG-ADM-DSH-008 | The Subjects tab lists Basic Science', async () => {
            addFeature('Dashboard'); addSeverity('normal')
            await DashboardPage.openTab(DashboardPage.subjectsTab, DashboardPage.subjectsPane)
            await expect(DashboardPage.subjectRow('Basic Science')).toBeDisplayed()
        })

        // The menu holds the five top-level modules only. Result Moderation is a
        // tab of Academic Management, Students/Parents/Enrollment are tabs of
        // Registrations, and School Profile/Preferences are tabs of Manage Settings.
        it('REG-ADM-DSH-009 | The sidebar GradeBook menu has every admin module', async () => {
            addFeature('Dashboard'); addSeverity('normal')
            await Sidebar.openGroup('admin')
            const items = (await Sidebar.itemTexts()).join('|')
            for (const text of ['Dashboard', 'Academic Management', 'Teacher Management', 'Registrations', 'Manage Settings']) {
                expect(items).toContain(text)
            }
        })
    })
})
