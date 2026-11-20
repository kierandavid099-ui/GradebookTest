import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import ParentDashboardPage from '../../page objects/parentDashboard.page.js'
import ParentChildProfilePage from '../../page objects/parentChildProfile.page.js'
import ParentMessengerPage from '../../page objects/parentMessenger.page.js'
import { PARENT_USER, PARENT_DISPLAY_NAME, STUDENT_ID } from '../../helpers/testData.js'
import { PARENT_MENU } from '../../helpers/parentData.js'

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE — GradeBook Parent portal critical path
//
// One lean, read-only pass as the parent (Chinedu): the dashboard, its two
// tabs, a linked child's profile and the Messenger all load with their key
// elements. No fixtures are created here — it relies on Chinedu being linked
// to Emeka (the regression specs' before hooks repair that link if needed).
// Mutations, RBAC probes and messaging live in regression/ and e2e/.
// ─────────────────────────────────────────────────────────────────────────────

describe('SMOKE — Parent Critical Path', () => {

    before(async () => {
        await LoginPage.loginAs(PARENT_USER)
    })

    describe('Navigation', () => {

        it('SM-PAR-NAV-001 | Parent lands on a dashboard titled with their name', async () => {
            addFeature('Parent Navigation'); addSeverity('blocker')
            await expect(browser).toHaveTitle(new RegExp(PARENT_DISPLAY_NAME))
        })

        it('SM-PAR-NAV-002 | GradeBook menu shows only Dashboard and Messenger', async () => {
            addFeature('Parent Navigation'); addSeverity('critical')
            await ParentDashboardPage.open()
            await Sidebar.openGroup('parent')
            expect(await Sidebar.itemTexts()).toEqual(PARENT_MENU)
        })
    })

    describe('Dashboard', () => {

        before(async () => await ParentDashboardPage.open())

        it('SM-PAR-DSH-001 | GradeBook dashboard loads with the GradeBook breadcrumb', async () => {
            addFeature('Parent Dashboard'); addSeverity('blocker')
            await expect(browser).toHaveTitle(/GradeBook/i)
            await expect(ParentDashboardPage.breadcrumb).toHaveText(/GradeBook/i)
        })

        it('SM-PAR-DSH-002 | My Children, Average Score and Attendance Rate cards are shown', async () => {
            addFeature('Parent Dashboard'); addSeverity('critical')
            for (const label of ['My Children', 'Average Score', 'Attendance Rate']) {
                await expect(ParentDashboardPage.statCard(label)).toBeDisplayed()
            }
        })

        it('SM-PAR-DSH-003 | My Children tab lists the linked child Emeka', async () => {
            addFeature('Parent Dashboard'); addSeverity('blocker')
            await expect(ParentDashboardPage.childRow('Okonkwo, Emeka')).toBeDisplayed()
        })

        it('SM-PAR-DSH-004 | Attendance tab opens and lists Emeka', async () => {
            addFeature('Parent Dashboard'); addSeverity('critical')
            await ParentDashboardPage.openTab(ParentDashboardPage.attendanceTab, ParentDashboardPage.attendancePane)
            await expect(ParentDashboardPage.attendanceRow('Okonkwo, Emeka')).toBeDisplayed()
        })
    })

    describe('Child Profile', () => {

        before(async () => await ParentChildProfilePage.openChild(STUDENT_ID))

        it('SM-PAR-CHD-001 | Emeka\'s profile opens with the Student Profile breadcrumb', async () => {
            addFeature('Parent My Children'); addSeverity('critical')
            await expect(ParentChildProfilePage.breadcrumb).toHaveText(/Student Profile/i)
            await expect(ParentChildProfilePage.headerName).toHaveText(/Okonkwo, Emeka/)
        })
    })

    describe('Messenger', () => {

        before(async () => await ParentMessengerPage.open())

        it('SM-PAR-MSG-001 | Messenger loads the Chats page with a New Chat button', async () => {
            addFeature('Parent Messenger'); addSeverity('critical')
            await expect(browser).toHaveTitle(/Chats/i)
            await expect(ParentMessengerPage.newChatBtn).toBeDisplayed()
        })
    })
})
