import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import Sidebar from '../../page objects/sidebar.js'
import TeacherMessengerPage from '../../page objects/teacherMessenger.page.js'
import { TEACHER_USER, EMPTY_TEACHER_USER } from '../../helpers/testData.js'
import { CHAT_COUNTERPART_EMAIL, CHAT_COUNTERPART_NAME } from '../../helpers/teacherData.js'
import { uniqueName } from '../../helpers/random.js'

// Messenger (Chats) as the teacher. The parent account (Chinedu) is the
// agreed counterpart; the Parent suite messages Chisom at the same time, so
// every message here carries a unique "auto-tch" token and assertions only
// look for those tokens, never at message counts or order.
//
// Leaves behind: a few "auto-tch …" chat messages to Chinedu Okonkwo (chat
// messages have no delete action).

describe('REGRESSION — Teacher Messenger', () => {

    const opener = `auto-tch hello ${uniqueName('m')}`
    const reply = `auto-tch reply ${uniqueName('m')}`
    const htmlMsg = `auto-tch <b>bold</b> ${uniqueName('m')}`

    before(async () => {
        await LoginPage.loginAs(TEACHER_USER)
        await TeacherMessengerPage.open()
    })

    describe('Chats Page', () => {

        it('REG-TCH-MSG-001 | Messenger in the sidebar opens the Chats page', async () => {
            addFeature('Teacher Messenger'); addSeverity('blocker')
            await Sidebar.goToTeacherMessenger()
            await TeacherMessengerPage.breadcrumb.waitForDisplayed({ timeout: 15000 })
            await expect(TeacherMessengerPage.breadcrumb).toHaveText(/Chats/i)
            await expect(TeacherMessengerPage.newChatBtn).toBeDisplayed()
        })

        it('REG-TCH-MSG-002 | With no conversation open the page prompts to pick a chat or start a new one', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await expect(TeacherMessengerPage.noChatOpen).toBeDisplayed()
            await expect($('//button[contains(., "Start a New Chat") or contains(., "New Chat")]')).toBeDisplayed()
        })

        // 2026-11-09: REG-TCH-MSG-003 moved to "Empty Chats" at the end —
        // Chisom always has chats, so it signs in as EMPTY_TEACHER_USER.

        it('REG-TCH-MSG-004 | New Chat asks for the recipient\'s email and a first message', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await TeacherMessengerPage.openNewChat()
            expect(await TeacherMessengerPage.emailInput.getAttribute('type')).toBe('email')
            await expect(TeacherMessengerPage.messageInput).toBeDisplayed()
            await expect(TeacherMessengerPage.startChatBtn).toBeDisplayed()
            await TeacherMessengerPage.closeModal()
        })
    })

    describe('Start Conversation — Negative', () => {

        let chatsBefore

        before(async () => {
            await TeacherMessengerPage.open()
            chatsBefore = (await TeacherMessengerPage.chatEntries()).length
        })

        it('REG-TCH-MSG-005 | An unregistered email is refused with "User with this email does not exist"', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await TeacherMessengerPage.startChat(`nobody.${uniqueName('x')}@example.com`, `auto-tch unknown ${uniqueName('m')}`)
            await expect(TeacherMessengerPage.startChatError).toBeDisplayed()
            await expect(TeacherMessengerPage.startChatError).toHaveText(/does not exist/i)
        })

        it('REG-TCH-MSG-006 | No broken conversation is created for the unknown email', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await TeacherMessengerPage.open()
            expect((await TeacherMessengerPage.chatEntries()).length).toBe(chatsBefore)
        })

        it('REG-TCH-MSG-007 | A malformed email is refused', async () => {
            addFeature('Teacher Messenger'); addSeverity('minor')
            await TeacherMessengerPage.startChat('not-an-email', `auto-tch bad ${uniqueName('m')}`)
            await expect(TeacherMessengerPage.startChatError).toBeDisplayed()
            await TeacherMessengerPage.open()
            expect((await TeacherMessengerPage.chatEntries()).length).toBe(chatsBefore)
        })

        it('REG-TCH-MSG-008 | An empty first message is refused', async () => {
            addFeature('Teacher Messenger'); addSeverity('minor')
            await TeacherMessengerPage.startChat(CHAT_COUNTERPART_EMAIL, '')
            await expect(TeacherMessengerPage.startChatError).toBeDisplayed()
        })
    })

    describe('Start Conversation & Reply', () => {

        let started

        before(async () => {
            await TeacherMessengerPage.open()
            started = await TeacherMessengerPage.startChat(CHAT_COUNTERPART_EMAIL, opener)
            // 2026-11-02: only one chat per pair is allowed — after the first
            // run New Chat answers "Chat with this user already exists", so
            // the opener goes into the existing chat instead.
            if (!started.sent && /already exists/i.test(started.error)) {
                await TeacherMessengerPage.open()
                await TeacherMessengerPage.openChatWith(CHAT_COUNTERPART_NAME)
                await TeacherMessengerPage.reply(opener)
            }
            await TeacherMessengerPage.open()
        })

        it('REG-TCH-MSG-009 | Starting a chat with a registered email lists that user in Chats', async () => {
            addFeature('Teacher Messenger'); addSeverity('critical')
            await expect(TeacherMessengerPage.chatLink(CHAT_COUNTERPART_NAME)).toBeDisplayed()
        })

        it('REG-TCH-MSG-010 | Opening the chat shows the counterpart and the message just sent', async () => {
            addFeature('Teacher Messenger'); addSeverity('critical')
            // 2026-11-02: New Chat must either send or refuse only because the
            // chat already exists; any other error shows up here as its text.
            if (!started.sent) expect(started.error).toMatch(/already exists/i)
            await TeacherMessengerPage.openChatWith(CHAT_COUNTERPART_NAME)
            await expect($('.chat-container')).toHaveText(new RegExp(CHAT_COUNTERPART_EMAIL))
            // When a chat with this user already exists the opener may be
            // appended to it; match on the unique token, not exact text.
            const msgs = await TeacherMessengerPage.messageTexts()
            const mine = msgs.find(m => m.text.includes(opener))
            expect(mine).toBeDefined()
            expect(mine.sent).toBe(true)
        })

        it('REG-TCH-MSG-011 | A reply in the open chat is appended as a sent message', async () => {
            addFeature('Teacher Messenger'); addSeverity('critical')
            await TeacherMessengerPage.ensureChatOpen(CHAT_COUNTERPART_NAME)
            await TeacherMessengerPage.reply(reply)
            await TeacherMessengerPage.replyInput.waitForDisplayed({ timeout: 10000 })
            const mine = (await TeacherMessengerPage.messageTexts()).find(m => m.text === reply)
            expect(mine).toBeDefined()
            expect(mine.sent).toBe(true)
        })

        it('REG-TCH-MSG-012 | HTML in a message is shown as plain text', async () => {
            addFeature('Teacher Messenger'); addSeverity('normal')
            await TeacherMessengerPage.ensureChatOpen(CHAT_COUNTERPART_NAME)
            await TeacherMessengerPage.reply(htmlMsg)
            await TeacherMessengerPage.replyInput.waitForDisplayed({ timeout: 10000 })
            expect((await TeacherMessengerPage.messageTexts()).some(m => m.text === htmlMsg)).toBe(true)
        })

        it('REG-TCH-MSG-013 | Close Chat returns to the "No Chat Open" view', async () => {
            addFeature('Teacher Messenger'); addSeverity('minor')
            await TeacherMessengerPage.ensureChatOpen(CHAT_COUNTERPART_NAME)
            await TeacherMessengerPage.closeChatLink.click()
            await TeacherMessengerPage.noChatOpen.waitForDisplayed({ timeout: 10000 })
            expect(await browser.getUrl()).not.toContain('chat=')
        })

        // 2026-11-02: REG-TCH-MSG-014 (parent receives the teacher's message)
        // deleted — E2E-PAR-MSG-003 in e2e/parent-teacher-message.spec.js
        // already signs in as the parent and checks the teacher's reply.
    })

    // 2026-11-09: read-only. Runs last because it switches account; the
    // after() signs Chisom back in so nothing appended later is affected.
    describe('Empty Chats', () => {

        before(async () => {
            await LoginPage.loginAs(EMPTY_TEACHER_USER)
            await TeacherMessengerPage.open()
        })

        after(async () => {
            await LoginPage.loginAs(TEACHER_USER)
        })

        it('REG-TCH-MSG-003 | A teacher with no conversations sees the "No Chats Yet" empty state', async () => {
            addFeature('Teacher Messenger'); addSeverity('minor')
            await TeacherMessengerPage.newChatBtn.waitForDisplayed({ timeout: 15000 })
            // If this fails, first check nobody has chatted with Adewale.
            expect(await TeacherMessengerPage.chatEntries()).toHaveLength(0)
            await expect(TeacherMessengerPage.noChatsYet).toBeDisplayed()
        })
    })
})
