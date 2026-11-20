// gradebook.ng is a test server — tests are free to create records there.
export const BASE_URL = process.env.GRADEBOOK_BASE_URL || 'https://gradebook.ng'

export const ADMIN_USER = {
    email: process.env.SMOKE_ADMIN_EMAIL || 'admin@app.com',
    password: process.env.SMOKE_ADMIN_PASSWORD || 'password',
}

export const TEACHER_USER = {
    email: process.env.SMOKE_TEACHER_EMAIL || 'chisom.okafor@yopmail.com',
    password: process.env.SMOKE_TEACHER_PASSWORD || 'M6SwRNGa8D',
}

export const STUDENT_USER = {
    email: process.env.SMOKE_STUDENT_EMAIL || 'emeka.okonkwo@yopmail.com',
    password: process.env.SMOKE_STUDENT_PASSWORD || 'JpsfDBx3w9',
}

export const PARENT_USER = {
    email: process.env.SMOKE_PARENT_EMAIL || 'chinedu.okonkwo@yopmail.com',
    password: process.env.SMOKE_PARENT_PASSWORD || 'wlNBmr7o',
}

// 2026-11-09: teacher created by hand (passwords are emailed, so tests can't
// make login-able users). Must never start or receive a chat and never be
// given a class or subject — REG-TCH-MSG-003 relies on an empty Chats list.
export const EMPTY_TEACHER_USER = {
    email: process.env.EMPTY_TEACHER_EMAIL || 'adewale.bakare@yopmail.com',
    password: process.env.EMPTY_TEACHER_PASSWORD || 'wOm1h4iq',
}

// How each account's name renders in the header / page title ("Last, First").
export const ADMIN_DISPLAY_NAME = 'Admin, Admin'
export const TEACHER_DISPLAY_NAME = 'Okafor, Chisom'
export const STUDENT_DISPLAY_NAME = 'Okonkwo, Emeka'
export const PARENT_DISPLAY_NAME = 'Okonkwo, Chinedu'

// STUDENT_USER's student record id — appears in every student-facing
// results/profile/attendance URL, and is the parent's linked child.
export const STUDENT_ID = '2256a521-2860-422e-acc8-fb08249412e9'
