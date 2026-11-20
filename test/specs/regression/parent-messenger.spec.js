import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ParentMessengerPage from '../../page objects/parentMessenger.page.js'
import { PARENT_USER, TEACHER_USER, TEACHER_DISPLAY_NAME } from '../../helpers/testData.js'
import { TEACHER_CHAT_NAME } from '../../helpers/parentData.js'
import { uniqueName } from '../../helpers/random.js'

// Parent Messenger (/fc/communications): open/empty states, sending to the
// teacher, send-guards and the close-chat behaviour. The teacher↔parent
// receive + notification round-trip lives in the e2e spec. Each message is
// uniquely tagged so the concurrent teacher agent's traffic never matches.
//
// Leaves behind: chat messages in the Chinedu↔Chisom thread (no delete path).

describe('REGRESSION — Parent Messenger', () => {

    before(async () => {
        await LoginPage.loginAs(PARENT_USER)
        await ParentMessengerPage.open()
    })

    describe('Open & Empty States', () => {

        it('REG-PAR-MSG-001 | Messenger opens the Chats interface', async () => {
            addFeature('Parent Messenger'); addSeverity('critical')
            await expect(browser).toHaveTitle(/Chats/i)
            await expect(ParentMessengerPage.newChatBtn).toBeDisplayed()
        })

        it('REG-PAR-MSG-002 | With no chat selected the "No Chat Open" placeholder shows', async () => {
            addFeature('Parent Messenger'); addSeverity('minor')
            await ParentMessengerPage.open()
            await expect(ParentMessengerPage.noChatOpen).toBeDisplayed()
        })

        it('REG-PAR-MSG-003 | New Chat opens the Start Conversation modal', async () => {
            addFeature('Parent Messenger'); addSeverity('normal')
            await ParentMessengerPage.newChatBtn.click()
            await expect(ParentMessengerPage.startChatModal).toBeDisplayed()
            await expect(ParentMessengerPage.recipientEmailInput).toBeDisplayed()
            await ParentMessengerPage.closeModal()
        })
    })

    describe('Sending', () => {

        it('REG-PAR-MSG-004 | Parent can send a message to the teacher', async () => {
            addFeature('Parent Messenger'); addSeverity('critical')
            const text = uniqueName('par-to-teacher')
            await ParentMessengerPage.sendTo(TEACHER_CHAT_NAME, TEACHER_USER.email, text)
            // The message shows in the thread with a timestamp.
            await expect(ParentMessengerPage.message(text)).toBeDisplayed()
            await expect(ParentMessengerPage.message(text).$('../..').$('.timestamp')).toBeDisplayed()
        })

        it('REG-PAR-MSG-005 | The teacher thread appears in the Chats list', async () => {
            addFeature('Parent Messenger'); addSeverity('normal')
            await ParentMessengerPage.open()
            await expect(ParentMessengerPage.thread(TEACHER_CHAT_NAME)).toBeDisplayed()
        })
    })

    describe('Send Guards & Navigation', () => {

        it('REG-PAR-MSG-006 | Starting a chat with no email is rejected', async () => {
            addFeature('Parent Messenger'); addSeverity('normal')
            await ParentMessengerPage.open()
            await ParentMessengerPage.startChat('', 'hello')
            await expect(ParentMessengerPage.startChatError).toHaveText(/email field is required/i)
            await ParentMessengerPage.closeModal()
        })

        it('REG-PAR-MSG-007 | Starting a chat with an unknown email is rejected', async () => {
            addFeature('Parent Messenger'); addSeverity('normal')
            await ParentMessengerPage.open()
            await ParentMessengerPage.startChat(`nobody-${uniqueName('x')}@example.com`, 'hello')
            await expect(ParentMessengerPage.startChatError).toHaveText(/does not exist/i)
            await ParentMessengerPage.closeModal()
        })

        it('REG-PAR-MSG-008 | A reply typed as HTML is rendered as text, not markup', async () => {
            addFeature('Parent Messenger'); addSeverity('critical')
            // XSS / HTML-injection guard: the payload must appear verbatim and
            // not become a live element in the DOM.
            const marker = uniqueName('par-xss')
            const [threadId] = await ParentMessengerPage.threadIds(TEACHER_CHAT_NAME)
            await ParentMessengerPage.openThreadById(threadId)
            await ParentMessengerPage.reply(`<b id="${marker}">${marker}</b>`, marker)
            await expect($(`#${marker}`)).not.toBeExisting()
            await expect(ParentMessengerPage.message(marker)).toBeDisplayed()
        })

        it('REG-PAR-MSG-009 | Close Chat returns to the "No Chat Open" empty state', async () => {
            addFeature('Parent Messenger'); addSeverity('minor')
            const [threadId] = await ParentMessengerPage.threadIds(TEACHER_CHAT_NAME)
            await ParentMessengerPage.openThreadById(threadId)
            await expect(ParentMessengerPage.closeChatBtn).toBeDisplayed()
            await ParentMessengerPage.closeChatBtn.click()
            await expect(ParentMessengerPage.noChatOpen).toBeDisplayed()
        })
    })
})
