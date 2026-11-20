import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import { TEACHER_USER, STUDENT_USER, BASE_URL } from '../../helpers/testData.js'

// Admin-only screens must refuse other roles.
// 2026-10-30: the direct-API write tests (RBAC-006/007/009) were dropped — out
// of scope; only what each role can do through the web app's own UI is tested.

const ADMIN_PAGES = ['/academic-management', '/teacher-management', '/registration-management', '/manage-settings', '/school-setup']

describe('REGRESSION — Admin RBAC', () => {

    describe('Teacher', () => {

        before(async () => { await LoginPage.loginAs(TEACHER_USER) })

        ADMIN_PAGES.forEach((p, i) => {
            it(`REG-ADM-RBAC-${String(i + 1).padStart(3, '0')} | A teacher opening ${p} gets 403 and no admin UI`, async () => {
                addFeature('RBAC'); addSeverity('critical')
                await browser.url(`${BASE_URL}/scola-gradebook2${p}`)
                await expect($('body')).toHaveText(/403|forbidden|unauthori/i)
                await expect($('#sp-full-name, #tbl-sessions, #tbl-teachers, #tbl-students')).not.toBeExisting()
            })
        })
    })

    describe('Student', () => {

        before(async () => { await LoginPage.loginAs(STUDENT_USER) })

        it('REG-ADM-RBAC-008 | A student opening Manage Settings is refused', async () => {
            addFeature('RBAC'); addSeverity('critical')
            await browser.url(`${BASE_URL}/scola-gradebook2/manage-settings`)
            await expect($('body')).toHaveText(/403|forbidden|unauthori/i)
            await expect($('#sp-full-name')).not.toBeExisting()
        })
    })

    describe('Anonymous', () => {

        it('REG-ADM-RBAC-010 | Logged-out access to an admin page redirects to login', async () => {
            addFeature('RBAC'); addSeverity('blocker')
            await LoginPage.logout()
            await browser.url(`${BASE_URL}/scola-gradebook2/academic-management`)
            await browser.waitUntil(async () => (await browser.getUrl()).includes('/login'), { timeout: 15000 })
        })
    })

    // Sheet TC-053 (BLOCKED): needs a second organisation on the test server
    // to prove cross-org ids are refused; gradebook.ng has only one school.
    it.skip('REG-ADM-RBAC-011 | Records of another organisation cannot be read or changed by id', async () => {
        addFeature('RBAC'); addSeverity('critical')
    })
})
