import { BASE_URL } from '../helpers/testData.js'

class LoginPage {

    get emailInput() { return $('#email') }
    get passwordInput() { return $('#password') }
    get loginBtn() { return $('button=Log In') }
    get togglePasswordBtn() { return $('button[onclick="togglePassword()"]') }
    get forgotPasswordLink() { return $('a=Reset here') }
    // Laravel renders failed-login feedback as an inline message under the form.
    get errorMessage() { return $('.invalid-feedback, .text-red-500, .text-danger, .alert-danger') }
    get breadcrumb() { return $('.breadcrumb-title') }

    async open() {
        await browser.url(`${BASE_URL}/login`)
    }

    // /login redirects straight to /dashboard while a session is active, so
    // switching roles mid-spec needs the old session dropped first.
    async logout() {
        await browser.deleteAllCookies()
    }

    // Fills and submits the form without waiting for the dashboard — used
    // by the negative login tests.
    async submit(email, password) {
        await this.emailInput.waitForDisplayed({ timeout: 10000 })
        await this.emailInput.setValue(email)
        await this.passwordInput.setValue(password)
        await this.loginBtn.click()
    }

    async login(email, password) {
        await this.submit(email, password)
        await browser.waitUntil(
            async () => (await browser.getUrl()).includes('/dashboard'),
            { timeout: 20000, timeoutMsg: `Login as ${email} did not reach the dashboard` }
        )
        await this.breadcrumb.waitForDisplayed({ timeout: 10000 })
    }

    // Drops any current session and signs in as the given user — the
    // standard way specs switch role.
    async loginAs(user) {
        await this.logout()
        await this.open()
        // 2026-11-09: logging in too quickly after /login renders sometimes
        // lands on /dashboard and then bounces back to /login — the server
        // appears to need a beat to settle the session before accepting the
        // POST. A short pause keeps that from flaking the suite.
        await this.emailInput.waitForDisplayed({ timeout: 10000 })
        await browser.pause(2000)
        await this.login(user.email, user.password)
    }
}

export default new LoginPage()
