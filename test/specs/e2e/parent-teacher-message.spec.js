import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import ParentMessengerPage from '../../page objects/parentMessenger.page.js'
import { PARENT_USER, TEACHER_USER } from '../../helpers/testData.js'
import { TEACHER_CHAT_NAME, PARENT_CHAT_NAME } from '../../helpers/parentData.js'
import { uniqueName } from '../../helpers/random.js'

// ─────────────────────────────────────────────────────────────────────────────
// E2E — Teacher ↔ Parent message round trip.
//
// A parent sends the teacher a uniquely-tagged message; logged in as the
// teacher it arrives in the thread; the teacher replies with another unique
// tag; back as the parent that reply shows in the thread AND a "New Chat
// Message" notification from the teacher appears in the header bell.
//
// Both tags are unique per run so the concurrently-running teacher agent's
// own traffic is never mistaken for ours.
//
// Leaves behind: two chat messages in the Chinedu↔Chisom thread (no delete
// path). Uses only the existing shared accounts.
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E — Parent ↔ Teacher Messaging', () => {

    const parentMsg = uniqueName('e2e-par-ping')
    const teacherMsg = uniqueName('e2e-tch-pong')

    it('E2E-PAR-MSG-001 | Parent sends the teacher a message', async () => {
        addFeature('Parent Messaging'); addSeverity('blocker')
        await LoginPage.loginAs(PARENT_USER)
        await ParentMessengerPage.sendTo(TEACHER_CHAT_NAME, TEACHER_USER.email, parentMsg)
        await expect(ParentMessengerPage.message(parentMsg)).toBeDisplayed()
    })

    it('E2E-PAR-MSG-002 | The teacher sees the parent\'s message and replies', async () => {
        addFeature('Parent Messaging'); addSeverity('critical')
        await LoginPage.loginAs(TEACHER_USER)
        // Find the thread with the parent carrying our ping, then reply.
        const threadId = await ParentMessengerPage.findThreadWithMessage(PARENT_CHAT_NAME, parentMsg)
        expect(threadId).not.toBe(null)
        await ParentMessengerPage.openThreadById(threadId)
        await ParentMessengerPage.reply(teacherMsg)
        await expect(ParentMessengerPage.message(teacherMsg)).toBeDisplayed()
    })

    it('E2E-PAR-MSG-003 | Parent receives the teacher\'s reply in the thread', async () => {
        addFeature('Parent Messaging'); addSeverity('critical')
        await LoginPage.loginAs(PARENT_USER)
        const threadId = await ParentMessengerPage.findThreadWithMessage(TEACHER_CHAT_NAME, teacherMsg)
        expect(threadId).not.toBe(null)
        await expect(ParentMessengerPage.message(teacherMsg)).toBeDisplayed()
    })

    it('E2E-PAR-MSG-004 | A "New Chat Message" notification from the teacher is listed', async () => {
        addFeature('Parent Messaging'); addSeverity('normal')
        // Still logged in as the parent from the previous step.
        await ParentMessengerPage.open()
        await ParentMessengerPage.openNotifications()
        const texts = await ParentMessengerPage.notificationTexts()
        expect(texts.some(t => /New Chat Message/i.test(t) && /Okafor|Chisom/i.test(t))).toBe(true)
    })
})
