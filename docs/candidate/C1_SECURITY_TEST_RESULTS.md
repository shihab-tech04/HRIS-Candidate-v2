# C1 SECURITY TEST RESULTS — do not confuse contracts with authorization tests

Source checkpoint f41562d; SQL metadata read from production project oslgwxaqfbteqtwqvdzs. No test users, auth sessions, writes, SQL migrations, private documents or offers were created or modified.

| Case | Observed evidence | Verdict |
|---|---|---|
| Anonymous published job projection | security_invoker view + anonymously executable publication RPC | PARTIAL; actual HTTP not run |
| Confidential salary fields | salary_min/max nullified when hidden, salary_currency still returned | PARTIAL, projection review required |
| Candidate profile ownership | candidate_profiles own SELECT policy, update_profile live-session check | PARTIAL |
| CV and private documents | RLS own-user and storage candidate-documents private bucket | PARTIAL |
| Candidate application ownership | candidate_apply_to_job checks live session, CV and open job | PARTIAL |
| SQL duplicate prevention | UNIQUE(job_id,candidate_user_id) found | PASS for schema existence ONLY |
| Stage notes and actor metadata containment | Raw candidate_application_stage_history own-row SELECT includes note and actor_user_id; safe RPC hides most | FAIL as design-security gate pending tested remediation |
| Interviews / offers actor decisions | RPC predicates check owner and allowed state | PARTIAL, unexecuted |
| Pending requested document and file path | RPC checks user prefix and stored object | PARTIAL, unexecuted |
| Two-candidate record isolation | Never exercised real A/B sessions | NOT TESTED |
| Revoked/expired authentication | is_live_session appears in sensitive RPCs but no runtime negative test | NOT TESTED |
| Email verification / account recovery | AuthContext implementation, no real email roundtrip | NOT TESTED |
| Candidate→employee handoff | HR-only activation not executed; frontend production preboarding writes blocked | BLOCKED |

Production metadata confirms candidate_application_stage_history has column note and actor_user_id; authenticated users have table SELECT grant and own-application RLS SELECT. Database projection RPC strips these fields for standard context, but cannot prevent authorized direct table SELECT *. It is a **structural confidentiality risk**; no real leaked row was observed. It must be remediated and verified in isolated staging before release certification.

Published vacancy function exposes currency for hidden salary, while numeric amounts are null. Review approved data visibility before changing SQL; do not silently reinterpret employer policy.

Historical controlled workflow run 38162508915: 9 Bun unit/source tests PASS, 0 FAIL; tsc PASS; Vite build PASS; distribution assertion FAIL. Real authenticated SQL negative tests: **0**. Real browser end-to-end tests: **0**.

Mandatory future two-identity tests: anonymous submission, candidate A→B profile/CV/stage notes/offers; self direct stage-history SELECT; forged identity/tenant; signed URL storage path; duplicate concurrent apply; expired/revoked session; offer repeat, employee-role escalation. These cannot be replaced by source-string checks.

Security result: NOT CERTIFIED. Production database intentionally unchanged.

## Verified PR source validation

GitHub Actions run 38163682170: 13 Bun source/unit/release-contract tests PASS, 0 FAIL, TypeScript PASS, correct production bundle path PASS. Real authenticated SQL/RLS tests 0. This validates neither row confidentiality nor candidate E2E runtime.
