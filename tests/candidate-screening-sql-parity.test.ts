import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { mapSqlScreeningQuestionType, parseScreeningNumberInput } from '../src/lib/screeningQuestionTypes';

const types = readFileSync(new URL('../src/types/index.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
const apply = readFileSync(new URL('../src/pages/VerifiedApplyPage.tsx', import.meta.url), 'utf8');

test('all seven hosted HR screening question types render in Candidate with matching semantic control', () => {
  const cases = [
    ['short_text', 'text'],
    ['long_text', 'long_text'],
    ['number', 'number'],
    ['date', 'date'],
    ['yes_no', 'yes_no'],
    ['single_select', 'select'],
    ['multi_select', 'multiselect'],
  ] as const;
  for (const [sql, candidate] of cases) expect(mapSqlScreeningQuestionType(sql)).toBe(candidate);
  expect(mapSqlScreeningQuestionType('unknown_legacy_type')).toBe('text');
  expect(api).toContain('type: mapSqlScreeningQuestionType(q.type)');
  expect(api).toContain("question: String(q.questionText || q.question || '')");
  expect(api).toContain("required: q.required === true");
  expect(types).toContain("| 'long_text' | 'date'");
  expect(apply).toContain("q.type === 'long_text'");
  expect(apply).toContain("q.type === 'date' ? 'date' : 'text'");
  expect(apply).toContain('<textarea rows={4}');
});

test('required number answer can be cleared without inventing numeric zero', () => {
  expect(parseScreeningNumberInput('')).toBe('');
  expect(parseScreeningNumberInput('0')).toBe(0);
  expect(parseScreeningNumberInput('5')).toBe(5);
  expect(apply).toContain('parseScreeningNumberInput(e.target.value)');
  expect(apply).toContain("value={answers[q.id] ?? ''}");
  expect(apply).toContain("v === ''");
});

test('application remains server-owned and the public-only privacy barrier is untouched', () => {
  expect(api).toContain("supabase.rpc('candidate_apply_to_job'");
  expect(api).toContain("questionId, answer");
  const appRoot = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  expect(appRoot).toContain("import.meta.env.VITE_CANDIDATE_PUBLIC_ONLY === 'true'");
});
