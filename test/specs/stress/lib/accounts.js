import { SharedArray } from 'k6/data'

// Credentials are read once per role from CSV at init time and shared across
// every VU, so a 100-VU run doesn't hold 100 copies of the same list.
//
// Each VU picks a row with pickFor(role, vuId) — modulo the list length, so
// every account gets reused evenly when VUs outnumber rows (we have 15
// students / 5 teachers / 5 parents / 1 admin).

function readCsv(path) {
  const txt = open(path)
  const rows = []
  const lines = txt.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim()
    if (!raw) continue
    if (raw.startsWith('#')) continue
    if (i === 0 && /^email\s*,/i.test(raw)) continue
    const [email, password] = raw.split(',').map(s => s && s.trim())
    if (email && password) rows.push({ email, password })
  }
  return rows
}

const STUDENTS = new SharedArray('students', () => readCsv('../accounts/students.csv'))
const TEACHERS = new SharedArray('teachers', () => readCsv('../accounts/teachers.csv'))
const PARENTS  = new SharedArray('parents',  () => readCsv('../accounts/parents.csv'))
const ADMINS   = new SharedArray('admins',   () => readCsv('../accounts/admins.csv'))

export function countFor(role) {
  if (role === 'student') return STUDENTS.length
  if (role === 'teacher') return TEACHERS.length
  if (role === 'parent')  return PARENTS.length
  if (role === 'admin')   return ADMINS.length
  throw new Error(`unknown role: ${role}`)
}

export function pickFor(role, vuId) {
  const list =
    role === 'student' ? STUDENTS :
    role === 'teacher' ? TEACHERS :
    role === 'parent'  ? PARENTS  :
    role === 'admin'   ? ADMINS   : null
  if (!list) throw new Error(`unknown role: ${role}`)
  if (list.length === 0) throw new Error(`no ${role} accounts in CSV`)
  return list[(vuId - 1) % list.length]
}
