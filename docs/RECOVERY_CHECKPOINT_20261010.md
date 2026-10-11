# Candidate recovery checkpoint — 10 October 2026
Status: PARTIAL. Source retained in draft PR #1. No production deployment or Supabase schema/data changes.

Verified recovery branch features: published-only salary-filtered job list; verified Supabase candidate Auth; private CV storage; application draft persistence; confirmed application UUID; server-based saved jobs; demo data restricted to local development.

Pending: offer/preboarding end-to-end, candidate-to-employee identity activation, role-based acceptance, CV parsing, authorized document generation, reminder dispatch, Figma parity and recovery of original inaccessible GitHub commits.

At the last consolidated run Bun tests, TypeScript checks and Vite build passed. Do not equate build success with end-to-end certification. GitHub CI is manually triggered at significant checkpoints only.

Related recovery branch: https://github.com/shihab2-tech/HRIS-Main-software/pull/1

Original account suspension reason is not verified. Keep new repositories reversible, no speculative production writes or unnecessary deployment.
