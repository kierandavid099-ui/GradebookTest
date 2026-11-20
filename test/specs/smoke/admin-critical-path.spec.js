import { addFeature, addSeverity } from '../../helpers/allureHelper.js'
import LoginPage from '../../page objects/login.page.js'
import DashboardPage from '../../page objects/adminDashboard.page.js'
import AcademicPage from '../../page objects/adminAcademic.page.js'
import GradingPage from '../../page objects/adminGrading.page.js'
import ModerationPage from '../../page objects/adminModeration.page.js'
import TeachersPage from '../../page objects/adminTeachers.page.js'
import RegistrationPage from '../../page objects/adminRegistration.page.js'
import SettingsPage from '../../page objects/adminSettings.page.js'
import GradeEntryPage from '../../page objects/adminGradeEntry.page.js'
import { ADMIN_USER, ADMIN_DISPLAY_NAME } from '../../helpers/testData.js'
import { PREFS } from '../../helpers/adminData.js'

// ─────────────────────────────────────────────────────────────────────────────
// SMOKE — GradeBook Admin critical path
//
// One lean pass through every admin screen: does it load, with its key
// controls present. No mutations — those live in test/specs/regression and
// test/specs/e2e.
// ─────────────────────────────────────────────────────────────────────────────

describe('SMOKE — Admin Critical Path', () => {

    before(async () => {
        await LoginPage.loginAs(ADMIN_USER)
    })

    describe('Dashboard', () => {

        before(async () => await DashboardPage.open())

        it('SM-ADM-DSH-001 | Admin login lands on the GradeBook dashboard', async () => {
            addFeature('Dashboard'); addSeverity('blocker')
            expect(await browser.getUrl()).toContain('/scola-gradebook2/dashboard')
            await expect($('body')).toHaveText(new RegExp(ADMIN_DISPLAY_NAME))
        })

        it('SM-ADM-DSH-002 | Stat cards and the setup guide are shown', async () => {
            addFeature('Dashboard'); addSeverity('critical')
            await expect(DashboardPage.stat('Students')).toBeDisplayed()
            await expect(DashboardPage.setupChecklist).toBeDisplayed()
        })
    })

    describe('Academic Management', () => {

        it('SM-ADM-SES-001 | Sessions tab lists the live session', async () => {
            addFeature('Sessions'); addSeverity('blocker')
            await AcademicPage.openOn('sessions')
            await expect(AcademicPage.sessionRow('2026/2027')).toBeDisplayed()
        })

        it('SM-ADM-TRM-001 | Terms tab has the session picker', async () => {
            addFeature('Terms'); addSeverity('critical')
            await AcademicPage.openOn('terms')
            await expect(AcademicPage.termSessionSelect).toBeExisting()
        })

        it('SM-ADM-CLS-001 | Classes tab shows the class cards and Add Class', async () => {
            addFeature('Classes'); addSeverity('critical')
            await AcademicPage.openOn('classes')
            await expect(AcademicPage.newClassBtn).toBeDisplayed()
            await expect(await AcademicPage.findClass('Primary 1')).toBeDisplayed()
        })

        it('SM-ADM-SUB-001 | Subjects tab lists Basic Science', async () => {
            addFeature('Subjects'); addSeverity('critical')
            await AcademicPage.openOn('subjects')
            await expect(await AcademicPage.findSubject('Basic Science')).toBeDisplayed()
        })

        it('SM-ADM-GRS-001 | Grading & Weights shows Add Grade, Load Preset and Add Scheme', async () => {
            addFeature('Grade Scale'); addSeverity('critical')
            await GradingPage.openGrading()
            await expect(GradingPage.addGradeBtn).toBeDisplayed()
            await expect(GradingPage.loadPresetToggle).toBeDisplayed()
            await expect(GradingPage.addSchemeBtn).toBeDisplayed()
        })

        it('SM-ADM-MOD-001 | Result Moderation tab shows its status filters', async () => {
            addFeature('Result Moderation'); addSeverity('critical')
            await ModerationPage.openModeration()
            await expect(ModerationPage.filterBtn('submitted')).toBeDisplayed()
            await expect(ModerationPage.tableBody).toBeExisting()
        })
    })

    describe('Teacher Management', () => {

        it('SM-ADM-TCR-001 | Teachers tab lists teachers with Add Teacher', async () => {
            addFeature('Teachers'); addSeverity('blocker')
            await TeachersPage.openOn('teachers')
            await expect(TeachersPage.newTeacherBtn).toBeDisplayed()
            await expect(TeachersPage.row('Okafor, Chisom')).toBeDisplayed()
        })

        it('SM-ADM-ALC-001 | Subject Allocation shows the teacher picker and matrix', async () => {
            addFeature('Subject Allocation'); addSeverity('critical')
            await TeachersPage.openOn('assignments')
            await expect(TeachersPage.teacherSelect).toBeExisting()
            await expect($('.assign-cell')).toBeExisting()
        })
    })

    describe('Registrations', () => {

        it('SM-ADM-STU-001 | Students tab lists students with Add and Import', async () => {
            addFeature('Students'); addSeverity('blocker')
            await RegistrationPage.openOn('students')
            await expect(RegistrationPage.newStudentBtn).toBeDisplayed()
            await expect(RegistrationPage.importOpenBtn('students')).toBeDisplayed()
            await expect(await RegistrationPage.findStudent('Okonkwo')).toBeDisplayed()
        })

        it('SM-ADM-PAR-001 | Parents tab lists parents', async () => {
            addFeature('Parents'); addSeverity('critical')
            await RegistrationPage.openOn('parents')
            await expect(RegistrationPage.newParentBtn).toBeDisplayed()
            await expect(RegistrationPage.parentRow('Chinedu')).toBeDisplayed()
        })

        it('SM-ADM-ENR-001 | Enrollment tab shows the class filter and capacity stats', async () => {
            addFeature('Enrollments'); addSeverity('critical')
            await RegistrationPage.openOn('enrollment')
            await expect(RegistrationPage.classFilter).toBeDisplayed()
            await expect(RegistrationPage.capacityStat).toBeDisplayed()
        })
    })

    describe('Settings & Grade Entry', () => {

        it('SM-ADM-PRF-001 | School Profile form shows the school name', async () => {
            addFeature('School Profile'); addSeverity('critical')
            await SettingsPage.openOn('tab_school_profile')
            await expect(SettingsPage.fullNameInput).toBeDisplayed()
            expect(await SettingsPage.fullNameInput.getValue()).not.toBe('')
        })

        it('SM-ADM-SET-001 | Preferences shows the five switches', async () => {
            addFeature('Preferences'); addSeverity('critical')
            await SettingsPage.openOn('preferences')
            for (const key of Object.values(PREFS)) await expect(SettingsPage.toggle(key)).toBeExisting()
        })

        it('SM-ADM-GRD-001 | Admin Grade Entry shows the class and subject pickers', async () => {
            addFeature('Grade Entry'); addSeverity('critical')
            await GradeEntryPage.open()
            await expect(GradeEntryPage.adminClassSelect).toBeDisplayed()
            await expect(GradeEntryPage.adminSubjectSelect).toBeDisplayed()
        })
    })
})
