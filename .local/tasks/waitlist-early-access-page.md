# Waitlist Early Access Front Page

## What & Why
Replace the current home page with a waitlist/early access landing page. The page targets experienced traders who can prove $10k+ payouts from other prop firms, positioning early access as exclusive and merit-based.

## Done looks like
- The front page shows an early access waitlist hero with a bold headline (e.g. "Early Access. Prove You Belong.")
- A clear call-to-action prompts visitors to apply for early access by proving their funding status
- A waitlist submission form captures: name, email, payout amount (must be $10k+), and an upload field for proof of payout (screenshot or document)
- Submissions under $10k are gently rejected with a message explaining the minimum requirement
- Valid submissions are saved to the database and the user sees a confirmation ("You're on the list") screen
- The existing Get Started / Login flow is still accessible but secondary (e.g. small link at bottom or in navbar)
- The page keeps the existing dark gold visual theme

## Out of scope
- Admin view for managing waitlist entries (future work)
- Email confirmation to the applicant after joining the waitlist
- Changes to the dashboard, login, or apply pages

## Tasks
1. **Add waitlist database table** — Add a `waitlist` table to the schema with fields: id, name, email, stated payout amount, proof file URL, status (pending/approved/rejected), and created date. Update the storage interface with a `createWaitlistEntry` method.

2. **Add waitlist API route** — Create a `POST /api/waitlist` endpoint that validates the submission (email format, payout >= 10000), saves it via the storage interface, and returns a success response. Add a file upload handler for the proof document.

3. **Redesign the home page** — Replace the current `home.tsx` content with the waitlist landing page: hero section with early access messaging, a stat bar highlighting $10k+ payout requirement, a multi-step or single form for name/email/payout amount/proof upload, inline validation that rejects sub-$10k submissions, and a success state after submission.

## Relevant files
- `client/src/pages/home.tsx`
- `client/src/App.tsx`
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/lib/constants.ts`
