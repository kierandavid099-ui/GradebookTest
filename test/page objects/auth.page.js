import { BASE_URL } from '../helpers/testData.js'

// Cross-role authentication surface that LoginPage doesn't cover: the header
// profile dropdown + Logout (which submits the hidden #logout-form), and the
// forgot-password request page at /password/reset.
class AuthPage {

    // Header (post-login) — profile dropdown.
    get profileToggle() { return $('.dropdown-user-setting > a') }
    get dropdownMenu() { return $('.dropdown-user-setting .dropdown-menu') }
    get dropdownUserName() { return $('.dropdown-user-name') }
    get profileLink() { return $('.dropdown-user-setting a[href$="/fc/profile"]') }
    get logoutLink() { return $('//a[contains(@class,"dropdown-item")][.//span[normalize-space()="Logout"]]') }
    get logoutForm() { return $('#logout-form') }

    // Login page controls (kept here too so auth specs read in one place).
    get loginForm() { return $('form[action$="/login"]') }
    get loginToken() { return $('form[action$="/login"] input[name="_token"]') }
    get passwordInput() { return $('#password') }
    get passwordToggleBtn() { return $('button[onclick="togglePassword()"]') }
    get eyeIcon() { return $('#eyeIcon') }

    // Password-reset request page.
    get resetForm() { return $('form[action$="/password/email"]') }
    get resetEmailInput() { return $('form[action$="/password/email"] #email') }
    get resetSubmitBtn() { return $('form[action$="/password/email"] button') }

    async openResetPage() {
        await browser.url(`${BASE_URL}/password/reset`)
        await this.resetForm.waitForExist({ timeout: 10000 })
    }

    // Opens the profile dropdown (no-op if the Logout item is already shown,
    // so callers can open it to read the name and not toggle it shut).
    async openProfileMenu() {
        if (await this.logoutLink.isDisplayed().catch(() => false)) return
        await this.profileToggle.waitForClickable({ timeout: 10000 })
        await this.profileToggle.click()
        await this.logoutLink.waitForDisplayed({ timeout: 5000 })
    }

    // Clicks Logout (submits #logout-form via POST) and waits for the session
    // area to be left behind.
    async clickLogout() {
        await this.logoutLink.waitForDisplayed({ timeout: 5000 })
        await this.logoutLink.click()
        await browser.waitUntil(
            async () => !(await browser.getUrl()).includes('/scola-gradebook2/'),
            { timeout: 15000, timeoutMsg: 'Logout did not leave the GradeBook area' }
        )
    }

    async logoutViaMenu() {
        await this.openProfileMenu()
        await this.clickLogout()
    }
}

export default new AuthPage()
