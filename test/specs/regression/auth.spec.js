import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import AuthPage from '../../page objects/auth.page.js'
import {
    BASE_URL, STUDENT_USER, STUDENT_DISPLAY_NAME,
} from '../../helpers/testData.js'

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION — Authentication (cross-role)
//
// Login form integrity, credential validation, session guards, logout and
// the password-reset entry point. Uses the Student account as the sample
// logged-in user; nothing here mutates account data.
// ─────────────────────────────────────────────────────────────────────────────

describe('REGRESSION — Authentication', () => {

    describe('Login page', () => {

        beforeEach(async () => {
            await LoginPage.logout()
            await LoginPage.open()
        })

        it('REG-AUTH-001 | Login form renders email, password and submit', async () => {
            addFeature('Authentication'); addSeverity('blocker')
            await expect(LoginPage.emailInput).toBeDisplayed()
            expect(await LoginPage.emailInput.getAttribute('type')).toBe('email')
            await expect(LoginPage.passwordInput).toBeDisplayed()
            await expect(LoginPage.loginBtn).toBeDisplayed()
        })

        it('REG-AUTH-002 | Password field is type=password and the toggle reveals it', async () => {
            addFeature('Authentication'); addSeverity('critical')
            expect(await LoginPage.passwordInput.getAttribute('type')).toBe('password')
            await AuthPage.passwordToggleBtn.click()
            expect(await LoginPage.passwordInput.getAttribute('type')).toBe('text')
            // Toggling back re-hides it.
            await AuthPage.passwordToggleBtn.click()
            expect(await LoginPage.passwordInput.getAttribute('type')).toBe('password')
        })

        it('REG-AUTH-003 | A CSRF _token is present on the login form', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await expect(AuthPage.loginToken).toBeExisting()
            expect((await AuthPage.loginToken.getValue()).length).toBeGreaterThan(10)
        })

        it('REG-AUTH-004 | Forgot-password link points at /password/reset', async () => {
            addFeature('Authentication'); addSeverity('normal')
            await expect(LoginPage.forgotPasswordLink).toBeDisplayed()
            expect(await LoginPage.forgotPasswordLink.getAttribute('href')).toContain('/password/reset')
        })
    })

    describe('Credential validation', () => {

        beforeEach(async () => {
            await LoginPage.logout()
            await LoginPage.open()
        })

        // Confirms the attempt did not open a session: a protected URL still
        // bounces to /login.
        async function assertNoSession() {
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            await browser.waitUntil(async () => !!(await browser.getUrl()),
                { timeout: 10000 })
            expect(await browser.getUrl()).toContain('/login')
        }

        it('REG-AUTH-005 | Wrong password is rejected with an error and no session', async () => {
            addFeature('Authentication'); addSeverity('blocker')
            await LoginPage.submit(STUDENT_USER.email, 'definitely-wrong-password')
            await expect(LoginPage.errorMessage).toBeDisplayed()
            await expect(LoginPage.errorMessage).toHaveText(/do not match|invalid|incorrect|credentials/i)
            expect(await browser.getUrl()).toContain('/login')
            await assertNoSession()
        })

        it('REG-AUTH-006 | Unknown email is rejected with an error and no session', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await LoginPage.submit('no.such.user.autotest@yopmail.com', 'whatever123')
            await expect(LoginPage.errorMessage).toBeDisplayed()
            expect(await browser.getUrl()).toContain('/login')
            await assertNoSession()
        })

        it('REG-AUTH-007 | Empty fields are blocked by required validation', async () => {
            addFeature('Authentication'); addSeverity('normal')
            await LoginPage.loginBtn.click()
            // HTML5 required validation keeps us on /login and flags the field.
            expect(await browser.getUrl()).toContain('/login')
            const msg = await browser.execute(() => document.querySelector('#email').validationMessage)
            expect(msg.length).toBeGreaterThan(0)
        })

        it('REG-AUTH-008 | A SQL-ish string in the email field is rejected safely', async () => {
            addFeature('Authentication'); addSeverity('critical')
            // Bypass HTML5 email validation so the payload actually reaches the server.
            await browser.execute(() => { document.querySelector('form[action$="/login"]').noValidate = true })
            await LoginPage.submit("' OR '1'='1' --", 'x')
            expect(await browser.getUrl()).toContain('/login')
            await expect(LoginPage.errorMessage).toBeDisplayed()
            await assertNoSession()
        })

        it('REG-AUTH-009 | An XSS payload in the email field renders as text, not script', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await browser.execute(() => {
                document.querySelector('form[action$="/login"]').noValidate = true
                window.__xssFired = false
            })
            await LoginPage.submit('"><script>window.__xssFired=true</script>', 'x')
            expect(await browser.getUrl()).toContain('/login')
            // The script must not have executed, and the page is still the login page.
            expect(await browser.execute(() => window.__xssFired === true)).toBe(false)
            await expect(LoginPage.emailInput).toBeDisplayed()
        })
    })

    describe('Password reset entry point', () => {

        it('REG-AUTH-010 | /password/reset loads a reset-request form', async () => {
            addFeature('Authentication'); addSeverity('normal')
            await AuthPage.openResetPage()
            expect(await browser.getUrl()).toContain('/password/reset')
            await expect(AuthPage.resetForm).toBeExisting()
            await expect(AuthPage.resetEmailInput).toBeDisplayed()
            expect(await AuthPage.resetForm.getAttribute('action')).toContain('/password/email')
        })
    })

    describe('Session lifecycle', () => {

        it('REG-AUTH-011 | Protected GradeBook URLs redirect to /login when never logged in', async () => {
            addFeature('Authentication'); addSeverity('blocker')
            await LoginPage.logout()
            for (const path of ['/scola-gradebook2/dashboard', '/dashboard', '/fc/profile']) {
                await browser.url(`${BASE_URL}${path}`)
                expect(await browser.getUrl()).toContain('/login')
            }
        })

        it('REG-AUTH-012 | Logout ends the session and the header name matches the user', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await LoginPage.loginAs(STUDENT_USER)
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            await AuthPage.openProfileMenu()
            await expect(AuthPage.dropdownUserName).toHaveText(new RegExp(STUDENT_DISPLAY_NAME.split(',')[0], 'i'))
            await AuthPage.clickLogout()
            expect(await browser.getUrl()).not.toContain('/scola-gradebook2/')
            // Session is really gone — a protected URL bounces to /login.
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            expect(await browser.getUrl()).toContain('/login')
        })

        it('REG-AUTH-013 | Protected URLs redirect to /login after logout', async () => {
            addFeature('Authentication'); addSeverity('blocker')
            await LoginPage.loginAs(STUDENT_USER)
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            await AuthPage.logoutViaMenu()
            for (const path of ['/scola-gradebook2/dashboard', '/dashboard', '/fc/profile']) {
                await browser.url(`${BASE_URL}${path}`)
                expect(await browser.getUrl()).toContain('/login')
            }
        })

        it('REG-AUTH-014 | Back button after logout does not expose protected data', async () => {
            addFeature('Authentication'); addSeverity('critical')
            await LoginPage.loginAs(STUDENT_USER)
            await browser.url(`${BASE_URL}/scola-gradebook2/dashboard`)
            await AuthPage.logoutViaMenu()
            await browser.back()
            await browser.pause(1500)
            // Either the browser re-requests and is bounced to /login, or a
            // cached shell shows — but the real data endpoints must be gone.
            const url = await browser.getUrl()
            if (url.includes('/scola-gradebook2/')) {
                // A bfcache shell is acceptable only if the app's own API now
                // refuses the session.
                const api = await browser.executeAsync(async (base, done) => {
                    try { const r = await fetch(base + '/api/scola-gradebook2-api/students', { credentials: 'same-origin', redirect: 'manual' }); done({ status: r.status, type: r.type }) } catch (e) { done({ status: 0, type: String(e) }) }
                }, BASE_URL)
                expect([401, 403, 419, 0].includes(api.status) || api.type === 'opaqueredirect').toBe(true)
            } else {
                expect(url).toContain('/login')
            }
        })
    })
})
