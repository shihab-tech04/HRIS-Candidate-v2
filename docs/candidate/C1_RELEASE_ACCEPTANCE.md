# C1 RELEASE ACCEPTANCE — independent audit checkpoint

Candidate source f41562d43888388ca9143398077a13634ebcdeb5; expected Pages URL https://shihab-tech04.github.io/HRIS-Candidate-v2/; shared production SQL oslgwxaqfbteqtwqvdzs unchanged.

## Original failure: proved by GitHub Actions logs

Run 38162508915: 9/9 Bun tests passed, TypeScript passed, Vite produced dist/index.html + compiled JS/CSS; shell then tested nonexistent dist/app.html and exited 1. Workflow built assets under wrong /HRIS-Candidate/ base, and would have committed bundles into main in addition to Pages deployment. Another successful Jekyll “pages build and deployment” run 38162572568 did not prove compiled Candidate-v2 was online. Public website HTTP fetch was not available from inspection runtime.

## Prepared minimal fix (feature source unchanged)

- Replace malformed index.html with the existing valid app.html entry structure.
- Build canonical dist/index.html with --base=/HRIS-Candidate-v2/.
- Copy compiled index to compiled 404 fallback and validate hashed JS/CSS asset paths.
- Replace redundant generated-file Git commits with official upload-pages-artifact and deploy-pages, and add served HTML/JS/CSS HTTP checks.
- Stale source-branch 404 redirects to correct project root without loading the obsolete bundle.
- No app pages, auth behavior, production SQL, storage rules, or Main HRIS source changed.

## Release gates and result

| Gate | Evidence / result |
|---|---|
| Old 9 unit checks | PASS historical (not a production journey) |
| New release source-contract checks | Pending new PR GitHub CI |
| TypeScript, production Vite | Historical PASS; new PR CI pending |
| Correct Pages compiled artifacts | Pending CI |
| GitHub Pages publication source | NOT VERIFIED; must be GitHub Actions not competing branch/Jekyll publisher |
| Served HTML, hashed JS/CSS over HTTPS | NOT VERIFIED; new deploy workflow includes HTTP smoke |
| Deep-link / hard refresh | BLOCKED by state-only App.tsx routing |
| Real anonymous vacancy and full candidate submit | NOT TESTED |
| A/B SQL/RLS isolation, private documents and salary confidentiality | BLOCKED |
| 9 viewports, EN/BN, WCAG 2.2 AA | NOT TESTED |

**Acceptance decision: NO-GO** for merging/deploying candidate-facing functionality until security review and authenticated gates pass. The release pipeline fix can pass CI independently but is not an authorization certification. Preserve PR until permitted to merge by verified gates. No further candidate-feature expansion under this C1 task.

External dependency: HR-side acceptance, joining verification and preservation of original Auth ID in employee activation remain unverified in Main HRIS.

## Verified PR CI gate — first run

- Pull request: https://github.com/shihab-tech04/HRIS-Candidate-v2/pull/1
- GitHub Actions: https://github.com/shihab-tech04/HRIS-Candidate-v2/actions/runs/38163682170
- Result: PASS — 13 Bun tests / 0 failures across 4 files, TypeScript PASS, compiled Vite output has correct Candidate-v2 JS/CSS paths.
- This was a PR-only build, not a deployment. Served HTTPS application and the candidate SQL end-to-end tests remain NOT TESTED.
