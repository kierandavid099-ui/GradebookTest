import TeacherModulePage from './teacherModule.page.js'

// Messenger / Chats (/fc/communications). Left: chat list (one link per
// conversation, ?chat=<groupId>). Right: either the "No Chat Open" prompt or
// the open conversation with Close Chat, the message history and a reply box.
// "New Chat" opens #searchStudentModal (recipient email + first message).
class TeacherMessengerPage extends TeacherModulePage {
    constructor() {
        super('/fc/communications')
    }

    get newChatBtn() { return $('.chat-container [data-bs-target="#searchStudentModal"]') }
    get newChatModal() { return $('#searchStudentModal') }
    get emailInput() { return $('#user_email') }
    get messageInput() { return $('#chat_group_message') }
    get startChatBtn() { return $('#btn-start-chat') }
    get startChatError() { return $('#div-chat-group-error') }
    get chatList() { return $('.chat-list') }
    get noChatOpen() { return $('//h4[contains(., "No Chat Open")]') }
    // Shown in place of the chat list only for a user with no chats at all.
    get noChatsYet() { return $('//*[text()[contains(., "No Chats Yet")]]') }
    get closeChatLink() { return $('//a[contains(normalize-space(.), "Close Chat")]') }
    get replyInput() { return $('#messageText') }
    get replyBtn() { return $('#reply-text-message') }
    get messages() { return $$('.chat-messages .chat-message') }

    async chatEntries() {
        return browser.execute(() => [...document.querySelectorAll('.chat-list a')].map(a => ({
            href: a.href, name: (a.querySelector('strong') || {}).textContent?.trim(), preview: a.innerText.replace(/\s+/g, ' ').trim(),
        })))
    }

    chatLink(name) { return $(`//div[contains(@class,"chat-list")]//a[.//strong[normalize-space(.)="${name}"]]`) }

    async openChatWith(name) {
        const link = this.chatLink(name)
        await link.waitForDisplayed({ timeout: 10000 })
        await link.click()
        await this.replyInput.waitForDisplayed({ timeout: 10000 })
    }

    // 2026-11-02: lets each test stand alone instead of relying on an
    // earlier test having left the conversation open.
    async ensureChatOpen(name) {
        if (!(await this.replyInput.isDisplayed().catch(() => false))) await this.openChatWith(name)
    }

    // 2026-11-02: one New Chat click was lost in a full run (MSG-008) although
    // the modal opens on every click by hand — retry until it shows.
    async openNewChat() {
        await this.newChatBtn.waitForClickable({ timeout: 5000 })
        await browser.waitUntil(async () => {
            if (await this.newChatModal.isDisplayed()) return true
            await this.newChatBtn.click().catch(() => {})
            return this.newChatModal.waitForDisplayed({ timeout: 3000 }).then(() => true).catch(() => false)
        }, { timeout: 15000, interval: 500, timeoutMsg: 'New Chat modal never opened' })
        await browser.pause(600) // modal fade-in
    }

    async messageTexts() {
        return browser.execute(() => [...document.querySelectorAll('.chat-messages .chat-message')].map(m => ({
            text: (m.querySelector('.message-text') || m).innerText.trim(),
            sent: m.classList.contains('sent'),
        })))
    }

    // Both "start chat" and "reply" end in location.reload(true) on success.
    // 2026-11-02: returns { sent, error } — the inline error text when the
    // form refused, so callers can tell a refusal from a send.
    async startChat(email, message) {
        await this.openNewChat()
        await this.emailInput.setValue(email)
        await this.messageInput.setValue(message)
        await this.markPage()
        await this.startChatBtn.click()
        // Either the page reloads (sent) or the inline error appears.
        await browser.waitUntil(async () => {
            const marked = await browser.execute(() => window.__tchMarker === true).catch(() => false)
            return !marked || (await this.startChatError.isDisplayed().catch(() => false))
        }, { timeout: 15000, timeoutMsg: 'New chat neither sent nor showed an error' })
        const error = (await this.startChatError.isDisplayed().catch(() => false))
            ? (await this.startChatError.getText()).trim() : null
        return { sent: !error, error }
    }

    async reply(text) {
        await this.replyInput.setValue(text)
        await this.markPage()
        await this.replyBtn.click()
        await this.waitForReload()
    }
}

export default new TeacherMessengerPage()
