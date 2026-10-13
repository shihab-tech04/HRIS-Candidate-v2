import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dashboard = readFileSync(path.join(root, 'src/pages/DashboardPage.tsx'), 'utf8');
const navbar = readFileSync(path.join(root, 'src/components/common/Navbar.tsx'), 'utf8');

test('candidate dashboard authorization failures end loading with accessible retry recovery', () => {
  assert.match(dashboard, /const \[loadError, setLoadError\] = useState<string \| null>\(null\)/);
  assert.match(dashboard, /catch \(cause\)[\s\S]*?setData\(null\)[\s\S]*?setLoadError\(cause instanceof Error/);
  assert.match(dashboard, /finally\s*\{\s*setLoading\(false\)/);
  assert.match(dashboard, /<p role="alert"[^>]*>\{loadError\}<\/p>/);
  assert.match(dashboard, /onClick=\{\(\) => void loadContext\(\)\}[\s\S]*?>\s*Retry\s*</);
});

test('candidate account navigation keeps its accessible controls within a mobile header', () => {
  assert.match(navbar, /gap-2 sm:gap-8/);
  assert.match(navbar, /hidden sm:inline text-xs font-medium/);
  assert.match(navbar, /aria-label=\{`Open account menu for/);
});
