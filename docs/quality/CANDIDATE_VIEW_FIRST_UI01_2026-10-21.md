# Candidate UI-06 first responsive packet — 21 October 2026

Current source: `development/hris-checkpoints` at `e3cb9c1`. Candidate main `38174c7`, production gates restrict UI to `PublicOnlyCareers`, `PublicJobsPage`, `VerifiedJobDetails` with `?job=` navigation. 13 route IDs exist, but authenticated Candidate UX is not released.

## WS03 next packet CAND-PUBLIC-UI01
Compare actual live public jobs against approved Figma **only if a matching Candidate frame is verified**. Otherwise mark `NO_APPROVED_FRAME` and request accepted source-based visual spec; do not claim Figma 1:1. Browser-check 1920/1280/768/375: hero, navbar, vacancy cards, filters/search, loading/error/empty, job→detail→back, URL refresh, EN/BN, keyboard/focus. Record exact deployed SHA, captures, error cases and actual visible data. Any code change must be scoped to a screenshot-backed discrepancy.

## Subsequent independent Candidate packets
- CAND-PRIVATE-UI02: isolated candidate sign-in→apply→application status and anonymous/foreign-owner rejection. Production public-only gate remains.
- CAND-PRIVATE-UI03: interviews→offers→preboarding UI with actual source-approved roles/fields. Separate missing hosted RPCs.
- Candidate frames cannot be inferred from employee Self-Service `265:48972`. Preserve privacy, EN/BN, approved logo/shell, API contracts.

**This initial commit is an execution-ready QA/evidence packet only, not a UI fix or certification.** WS03 owns Candidate code, WS04 independent parity, WS02 API/RLS, WS05 sole release.
