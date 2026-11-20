// Constants for the Student-role suites. Shared accounts/IDs live in
// testData.js; only student-specific fixtures go here.

// A second student, used as the "other student" in the IDOR tests. The name
// and email are fixed (not uniqueName'd) so every run finds and reuses the
// same record instead of piling up new ones — StudentRegistrationsPage
// .ensureStudent() creates it as admin only if it isn't there yet.
export const FIXTURE_STUDENT = {
    firstName: 'Idor',
    lastName: 'AutoStuFixture',
    email: 'autostu.idor.fixture@yopmail.com',
    gender: 'male',
}

// Chisom's class (Pri 2A) — used as the "someone else's class" for the
// class-results / class page RBAC checks.
export const TEACHER_CLASS_ID = 'd2e27229-7606-4bc6-912d-bfd882b18c0d'
