import { BASE_URL } from '../helpers/testData.js'

// Helpers for the Student RBAC checks: reading the app's error page, and
// fetching pages from inside the logged-in browser (so they carry the
// student's session cookie).
//
// The app answers a forbidden page in one of two ways:
//   • a full-page 403 "Access Denied" / 500 "System Error" screen
//     (big faded <h1> code + caption), or
//   • a redirect back to the previous page with a Lobibox error toast.
class StudentAccessPage {

    get errorCode() { return $('h1.font-black') }
    get errorCaption() { return $('.animate-float span') }
    get breadcrumb() { return $('.breadcrumb-title') }

    async visit(path) {
        await browser.url(`${BASE_URL}${path}`)
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 20000, timeoutMsg: `${path} did not finish loading` }
        )
    }

    // '403', '500', ... when the error screen is showing, otherwise null.
    async shownErrorCode() {
        if (!(await this.errorCode.isExisting())) return null
        return (await this.errorCode.getText()).trim() || null
    }

    async currentPath() {
        return new URL(await browser.getUrl()).pathname
    }

    async bodyText() {
        return $('body').getText()
    }

    // GET from the page's own origin; follows redirects. Returns the final
    // status, final URL path and body text.
    async fetchPage(path) {
        return browser.executeAsync(async (url, done) => {
            try {
                const r = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/html,application/json' } })
                done({ status: r.status, path: new URL(r.url).pathname, redirected: r.redirected, body: await r.text() })
            } catch (e) {
                done({ status: 0, path: '', redirected: false, body: String(e) })
            }
        }, `${BASE_URL}${path}`)
    }

    // The student has been kept off a page if it bounced them elsewhere or
    // showed the 403/404 screen — and in either case none of `secrets`
    // (names/text belonging to someone else) is on screen.
    async assertBlocked(targetPath, secrets = []) {
        const path = await this.currentPath()
        const code = await this.shownErrorCode()
        const bounced = !path.startsWith(targetPath)
        expect(bounced || ['401', '403', '404'].includes(code)).toBe(true)
        const text = await this.bodyText()
        for (const s of secrets) expect(text).not.toContain(s)
    }
}

export default new StudentAccessPage()
