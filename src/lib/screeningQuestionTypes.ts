import type { ScreeningQuestionType } from '../types';

/**
 * Align candidate question widgets with the seven persisted screening types
 * accepted by public.admin_save_job. Unknown legacy types stay text-only;
 * this adapter does not change the server-owned question IDs or answers.
 */
export function mapSqlScreeningQuestionType(type: unknown): ScreeningQuestionType {
  switch (type) {
    case 'short_text': return 'text';
    case 'long_text': return 'long_text';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'yes_no': return 'yes_no';
    case 'single_select': return 'select';
    case 'multi_select': return 'multiselect';
    default: return 'text';
  }
}

/** An empty numeric answer is unanswered, not zero. Zero is a valid answer. */
export function parseScreeningNumberInput(value: string): number | '' {
  return value === '' ? '' : Number(value);
}
