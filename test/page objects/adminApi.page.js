// Fixture plumbing for the admin suites. Every call runs inside the current
// GradeBook page with its own jQuery + CSRF token — the same requests the
// admin screens send — so set-up and clean-up stay fast while the behaviour
// under test is still driven through the UI. Needs any logged-in GradeBook
// page to be open first (all of them carry the csrf-token meta tag).
import ModulePage from './modulePage.page.js'
import { BASE_URL } from '../helpers/testData.js'
import { API, ORG_ID, FIXTURE_LEVEL, FIXTURE_SCHEME_ITEMS, TEACHER_ID } from '../helpers/adminData.js'

class AdminApi extends ModulePage {
    constructor() {
        super('/scola-gradebook2/dashboard')
    }

    // Form-encoded POST (Laravel method spoofing via _method). Returns
    // { status, body } and never throws, so negative cases can assert on it.
    post(url, data = {}) {
        return browser.executeAsync((url, data, orgId, done) => {
            const payload = Object.assign({ _token: $('meta[name="csrf-token"]').attr('content'), organization_id: orgId }, data)
            $.ajax({ url, type: 'POST', data: payload, dataType: 'json' })
                .done((body, s, xhr) => done({ status: xhr.status, body }))
                .fail(xhr => done({ status: xhr.status, body: xhr.responseJSON || (xhr.responseText || '').slice(0, 500) }))
        }, url, data, ORG_ID)
    }

    // Multipart POST — the student/teacher/parent endpoints only accept
    // FormData (the screens send photos alongside the fields).
    postForm(url, fields = {}) {
        return browser.executeAsync((url, fields, orgId, done) => {
            const fd = new FormData()
            fd.append('_token', $('meta[name="csrf-token"]').attr('content'))
            fd.append('organization_id', orgId)
            Object.entries(fields).forEach(([k, v]) => {
                if (Array.isArray(v)) v.forEach(x => fd.append(k, x)); else fd.append(k, v)
            })
            $.ajax({ url, type: 'POST', data: fd, processData: false, contentType: false, dataType: 'json' })
                .done((body, s, xhr) => done({ status: xhr.status, body }))
                .fail(xhr => done({ status: xhr.status, body: xhr.responseJSON || (xhr.responseText || '').slice(0, 500) }))
        }, url, fields, ORG_ID)
    }

    get(url) {
        return browser.executeAsync((url, done) => {
            fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
                .then(async r => { const t = await r.text(); let b = t; try { b = JSON.parse(t) } catch (e) { b = t.slice(0, 500) } done({ status: r.status, body: b }) })
                .catch(e => done({ status: 0, body: e.message }))
        }, url)
    }

    destroy(url) { return this.post(url, { _method: 'DELETE' }) }

    // ── Fixture builders ────────────────────────────────────────────────────

    async createClass({ name, code, level, arms = '', max = '' }) {
        const res = await this.post(`${API}/grade_classes`, { name, code, level, arms, max_students_per_arm: max })
        const data = res.body && res.body.data
        return Array.isArray(data) ? data : (data ? [data] : [])
    }

    async createSubject({ name, code, classIds, type = 'core' }) {
        const res = await this.post(`${API}/subjects`, {
            name, code, type, department: 'general', status: 'active',
            classes_to_assign: JSON.stringify(['select_individually']),
            selected_class_ids: JSON.stringify(classIds),
        })
        return res.body && res.body.data
    }

    async createScheme({ name, appliesTo, items, isDefault = 1 }) {
        const res = await this.post(`${API}/grading_schemes`, {
            name, description: '', applies_to: appliesTo, is_default: isDefault,
            items: JSON.stringify(items.map(i => ({ title: i.title, max_score: 100, weight_pct: i.weight }))),
        })
        return res.body && res.body.data
    }

    // 2026-11-09: the create-student API 500s "Server Error" when any text
    // field is blank, and rejects enum values it doesn't recognise (same
    // dev-side bug as teacher create — see [[student-create-all-fields]]).
    // Mirror the fillTeacher pattern: take defaults from the modal itself
    // so every select gets a value the server actually knows about, no
    // guessing. The modal markup is in the page from load, so we don't
    // need to open it.
    async createStudent({ firstName, lastName, gender = 'male' }) {
        // The create-student modal is rendered lazily — open it so its
        // selects exist in the DOM, harvest their first real option, then
        // dismiss. Cached so the harvest only runs once per session.
        if (!this._studentSelectDefaults) {
            const RegistrationPage = (await import('./adminRegistration.page.js')).default
            await RegistrationPage.openOn('students')
            await RegistrationPage.openCreateStudent()
            this._studentSelectDefaults = await browser.execute(() => {
                const out = {}
                document.querySelectorAll('#mdl-create-student select[name]').forEach(sel => {
                    const opt = [...sel.options].find(o => o.value && !/^none$/i.test(o.textContent.trim()))
                    if (opt) out[sel.name] = opt.value
                })
                return out
            })
            await RegistrationPage.closeModal()
        }
        const selectDefaults = this._studentSelectDefaults
        const textDefaults = {
            middle_name: 'Auto', date_of_birth: '2010-01-01', email: '', telephone: '08000000000',
            national_id_number: '00000000000', nationality: 'Nigerian', state_of_origin: 'Lagos', lga: 'Ikeja',
            medical_conditions: 'none', full_home_address: '1 Auto Street',
            admission_number: `AUTO-${Date.now()}`, admission_date: '2024-09-01', previous_school: '',
        }
        const fields = { ...textDefaults, ...selectDefaults, first_name: firstName, last_name: lastName, gender, status: 'active' }
        const res = await this.postForm(`${API}/students`, fields)
        // 2026-11-09: a rejected create used to return undefined here and the
        // caller blew up on `.id` with no clue which call failed — surface the
        // server's reply so the hook error names the field it hated.
        if (!res.body || !res.body.data) {
            throw new Error(`createStudent(${firstName} ${lastName}) failed: ${res.status} ${JSON.stringify(res.body)}`)
        }
        return res.body.data
    }

    enroll(classId, studentIds) {
        return this.post(`${API}/bulk_student_enrollments`, {
            bulk_enrollment_grade_class_id: classId,
            'bulk_enrollment_student_ids[]': studentIds,
        })
    }

    assignTeacher({ subjectId, classId, termId, teacherId }) {
        return this.post(`${API}/subject_teachers/assign`, {
            subject_id: subjectId, grade_class_id: classId, grade_term_id: termId, teacher_id: teacherId,
        })
    }

    setCurrentTerm(termId) { return this.post(`${API}/grade_terms/${termId}/set-current`) }

    // ── Moderation fixture ──────────────────────────────────────────────────
    // An Upper Primary class + subject + one enrolled student, with Chisom
    // allocated to it for the current term. Reuses the default Upper Primary
    // scheme when there is one (the teacher suites rely on it staying the
    // default), otherwise creates a 40/60 one. Call from any admin page.
    async moderationFixture(tag, termId) {
        const fx = { tag, termId }
        fx.className = `auto-adm-mod-${tag}`
        fx.classCode = `AM${tag}`
        fx.subjectName = `auto-adm-mod-sub-${tag}`
        fx.classId = (await this.createClass({ name: fx.className, code: fx.classCode, level: FIXTURE_LEVEL, max: 5 }))[0].id
        fx.subjectId = (await this.createSubject({ name: fx.subjectName, code: `AMS${tag}`, classIds: [fx.classId] })).id
        fx.studentFirst = 'Mod'
        fx.studentLast = `Fixture${tag}`
        fx.studentId = (await this.createStudent({ firstName: fx.studentFirst, lastName: fx.studentLast })).id
        await this.enroll(fx.classId, [fx.studentId])
        await this.assignTeacher({ subjectId: fx.subjectId, classId: fx.classId, termId, teacherId: TEACHER_ID })
        await browser.url(`${BASE_URL}/scola-gradebook2/academic-management`)
        await this.breadcrumb.waitForDisplayed({ timeout: 15000 })
        const hasDefault = await browser.execute(level => !!document.querySelector(`.btn-edit-scheme[data-default="1"][data-applies="${level}"]`), FIXTURE_LEVEL)
        if (!hasDefault) fx.schemeId = (await this.createScheme({ name: `auto-adm-mod-sch-${tag}`, appliesTo: FIXTURE_LEVEL, items: FIXTURE_SCHEME_ITEMS })).id
        return fx
    }

    async cleanupModerationFixture(fx) {
        if (!fx || !fx.classId) return
        await this.assignTeacher({ subjectId: fx.subjectId, classId: fx.classId, termId: fx.termId, teacherId: '' })
        await this.deleteSubject(fx.subjectId)
        await this.deleteClass(fx.classId)
        await this.destroy(`${API}/students/${fx.studentId}`)
        if (fx.schemeId) await this.deleteScheme(fx.schemeId)
    }

    deleteClass(id) { return this.destroy(`${API}/grade_classes/${id}`) }
    deleteSubject(id) { return this.destroy(`${API}/subjects/${id}`) }
    deleteScheme(id) { return this.destroy(`${API}/grading_schemes/${id}`) }
    deleteBoundary(id) { return this.destroy(`${API}/grade_boundaries/${id}`) }
    // Starting one of a session's terms marks the session active, and an
    // active session refuses deletion — deactivate it first in that case.
    async deleteSession(id) {
        let res = await this.destroy(`${API}/grade_sessions/${id}`)
        if (res.status === 422 && /active/i.test(JSON.stringify(res.body))) {
            await this.post(`${API}/grade_sessions/${id}/toggle-active`)
            res = await this.destroy(`${API}/grade_sessions/${id}`)
        }
        return res
    }
    deleteTeacher(id) { return this.destroy(`${API}/teachers/${id}`) }
    deleteParent(id) { return this.destroy(`${API}/parents/${id}`) }
}

export default new AdminApi()
