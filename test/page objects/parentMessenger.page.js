import ModulePage from './modulePage.page.js'

// /fc/communications — the platform chat every role shares (the parent suite
// also drives it as the teacher for the round-trip tests). Left column lists
// threads as <a href="?chat=<groupId>">, each showing the other person's
// "First Last" and the last message; the right column is either the "No
// Chat Open" placeholder or the open thread with a reply box. Starting a chat
// and sending a reply both reload the page on success.
class ParentMessengerPage extends ModulePage {
    constructor() {
        super('/fc/communications')
    }

    get newChatBtn() { return $('//div[contains(@class,"border-bottom")]/button[contains(normalize-space(),"New Chat")]') }
    get startChatModal() { return $('#searchStudentModal') }
    get recipientEmailInput() { return $('#user_email') }
    get firstMessageInput() { return $('#chat_group_message') }
    get startChatSendBtn() { return $('#btn-start-chat') }
    get startChatError() { return $('#div-chat-group-error') }

    get threadLinks() { return $$('.chat-list a[href*="?chat="]') }
    get noChatsYet() { return $('h6=No Chats Yet') }
    get noChatOpen() { return $('h4=No Chat Open') }

    // Open thread
    get messageInput() { return $('#messageText') }
    get sendBtn() { return $('#reply-text-message') }
    get chatGroupId() { return $('#chatGroupId') }
    get closeChatBtn() { return $('a*=Close Chat') }
    get messages() { return $$('.chat-messages .chat-message') }

    // Header bell dropdown
    get notificationsToggle() { return $('a.dropdown-toggle[title="Notifications"]') }
    get notificationItems() { return $$('.header-notifications-list a[href*="/fc/notifications/"]') }

    thread(name) { return $(`//div[contains(@class,"chat-list")]//a[contains(@href,"?chat=")][.//strong[normalize-space()="${name}"]]`) }

    // A message bubble (sent or received) whose text contains `text`.
    message(text) { return $(`//div[contains(@class,"chat-messages")]//div[contains(@class,"chat-message")][.//div[contains(@class,"message-text")][contains(normalize-space(),"${text}")]]`) }

    async openThreadById(groupId) {
        await this.open(`?chat=${groupId}`)
        await this.messageInput.waitForDisplayed({ timeout: 10000 })
    }

    // Every ?chat= id in the left column whose contact name matches.
    async threadIds(name) {
        return browser.execute((n) => [...document.querySelectorAll('.chat-list a[href*="?chat="]')]
            .filter(a => (a.querySelector('strong')?.textContent || '').trim() === n)
            .map(a => a.getAttribute('href').split('?chat=')[1]), name)
    }

    // Another agent may also chat between these two accounts and may have
    // opened a second thread, so search every thread with that contact.
    // Returns the thread id holding `text`, or null.
    async findThreadWithMessage(name, text) {
        await this.open()
        for (const id of await this.threadIds(name)) {
            await this.openThreadById(id)
            if (await this.message(text).isExisting()) return id
        }
        return null
    }

    async startChat(email, text) {
        await this.newChatBtn.waitForClickable({ timeout: 10000 })
        await this.newChatBtn.click()
        await this.startChatModal.waitForDisplayed({ timeout: 5000 })
        // Modal is moved to <body> and fades in — let it settle before typing.
        await browser.pause(500)
        await this.recipientEmailInput.setValue(email)
        await this.firstMessageInput.setValue(text)
        await this.startChatSendBtn.click()
    }

    // `waitFor` defaults to the full text; pass a plain marker when `text`
    // itself contains quotes/angle brackets that would break the XPath.
    async reply(text, waitFor = text) {
        await this.messageInput.waitForDisplayed({ timeout: 10000 })
        await this.messageInput.setValue(text)
        await this.sendBtn.click()
        // Success reloads the page with the thread still open.
        await this.message(waitFor).waitForDisplayed({ timeout: 20000, timeoutMsg: `Sent message "${waitFor}" never appeared in the thread` })
    }

    // Sends `text` to `name`: replies in the existing thread if there is one,
    // otherwise starts a new chat by email. Returns the thread id.
    async sendTo(name, email, text) {
        await this.open()
        const [existing] = await this.threadIds(name)
        if (existing) {
            await this.openThreadById(existing)
            await this.reply(text)
            return existing
        }
        await this.startChat(email, text)
        await this.thread(name).waitForDisplayed({ timeout: 20000 })
        return this.findThreadWithMessage(name, text)
    }

    async openNotifications() {
        await this.notificationsToggle.waitForClickable({ timeout: 10000 })
        await this.notificationsToggle.click()
        await $('.header-notifications-list').waitForDisplayed({ timeout: 5000 })
    }

    async notificationTexts() {
        return browser.execute(() => [...document.querySelectorAll('.header-notifications-list a[href*="/fc/notifications/"]')]
            .map(a => a.innerText.replace(/\s+/g, ' ').trim()))
    }
}

export default new ParentMessengerPage()
