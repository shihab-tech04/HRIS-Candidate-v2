import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const workflow=readFileSync('.github/workflows/release-preview.yml','utf8');
const index=readFileSync('index.html','utf8');
const fallback=readFileSync('404.html','utf8');
test('Candidate Pages build has the correct repository base and compiled index',()=>{
 expect(workflow).toContain('vite build --base=/HRIS-Candidate-v2/');
 expect(workflow).toContain('test -s dist/index.html');
 expect(workflow).toContain('cp dist/index.html dist/404.html');
 expect(workflow).toContain('path: dist');
 expect(workflow).not.toContain('mv dist/app.html dist/index.html');
});
test('Production release does not push generated files into the source branch',()=>{
 expect(workflow).not.toContain('git push origin HEAD:main');
 expect(workflow).not.toContain('git add -A');
 expect(workflow).not.toContain('contents: write');
 expect(workflow).toContain('actions/deploy-pages@v4');
});
test('Deployment workflow checks served compiled assets',()=>{
 expect(workflow).toContain('Verify served HTML, compiled JavaScript and CSS');
 expect(workflow).toContain('test -s live.js && test -s live.css');
});
test('Canonical entry HTML and static fallback have valid repository paths',()=>{
 expect(index).toContain('</head>');
 expect(index).toContain('src="/src/main.tsx"');
 expect(index).toContain('id="root"');
 expect(fallback).toContain('/HRIS-Candidate-v2/');
 expect(fallback).not.toContain('/HRIS-Candidate/assets/');
});
