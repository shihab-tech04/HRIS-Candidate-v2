import type { CandidateEducation, CandidateExperience, CandidateProfile } from '../types';

export interface CandidateCvExtraction {
  profile: Partial<CandidateProfile>;
  accountEmail: string;
  warnings: string[];
  extractedText: string;
}

const MAX_PDF_PAGES = 100;
const MAX_EXTRACTED_CHARACTERS = 500_000;

const SECTION_NAMES: Record<string, string> = {
  'about me': 'summary',
  'career objective': 'summary',
  'career profile': 'summary',
  'executive summary': 'summary',
  'professional summary': 'summary',
  objective: 'summary',
  'key skills': 'skills',
  'core competencies': 'skills',
  'technical skills': 'skills',
  'professional skills': 'skills',
  'work experience': 'experience',
  'professional experience': 'experience',
  'employment history': 'experience',
  'work history': 'experience',
  'career history': 'experience',
  'education and training': 'education',
  'academic background': 'education',
  'educational background': 'education',
  'certifications and licenses': 'certifications',
  'certificates and training': 'certifications',
};

const STANDARD_SECTIONS = new Set([
  'summary', 'profile', 'skills', 'experience', 'education', 'certifications',
  'certificates', 'projects', 'languages', 'awards', 'references', 'interests',
]);

const cleanLine = (line: string) => line.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();

export function normalizeCandidateCvText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, ' ')
    .split('\n')
    .map(cleanLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARACTERS);
}

function sectionKey(line: string): string | null {
  const heading = cleanLine(line)
    .replace(/^[\s#*•–—-]+|[\s:：]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!heading || heading.length > 54) return null;
  return SECTION_NAMES[heading] || (STANDARD_SECTIONS.has(heading) ? heading : null);
}

function readSections(lines: string[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of lines) {
    const heading = sectionKey(line);
    if (heading) {
      current = heading;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current && line) sections.get(current)?.push(line);
  }
  return sections;
}

const distinct = (items: string[]) => [...new Set(items.map(cleanLine).filter(Boolean))];
const findPhone = (text: string) => [...text.matchAll(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g)]
  .find(match => (match[0].match(/\d/g) || []).length >= 9 && (match[0].match(/\d/g) || []).length <= 15)?.[0]
  ?.replace(/\s+/g, ' ').trim() || '';

function listItems(lines: string[]): string[] {
  return distinct(lines.flatMap(line => line
    .split(/\s*(?:,|;|\||•|·)\s*/)
    .map(item => item.replace(/^[-*]\s*/, '').trim())
    .filter(item => item.length > 1 && item.length <= 72)));
}

function extractDateRange(value: string) {
  const match = value.match(/\b((?:19|20)\d{2}(?:\s*[-/]\s*(?:0?[1-9]|1[0-2]))?)\s*(?:–|—|-|\bto\b|\buntil\b)\s*((?:(?:19|20)\d{2}(?:\s*[-/]\s*(?:0?[1-9]|1[0-2]))?)|present|current|now)\b/i);
  if (!match) return null;
  const current = /^(present|current|now)$/i.test(match[2].trim());
  return {
    start: match[1].replace(/\s/g, ''),
    end: current ? '' : match[2].replace(/\s/g, ''),
    current,
    index: match.index ?? 0,
    endIndex: (match.index ?? 0) + match[0].length,
  };
}

function splitRoleAndOrganization(header: string): [string, string] {
  const cleanHeader = header.replace(/[|•·,;:–—-]+\s*$/, '').trim();
  const split = cleanHeader.split(/\s+(?:at|@)\s+|\s+[|•·]\s+/i);
  if (split.length > 1) return [cleanLine(split[0]), cleanLine(split.slice(1).join(' '))];
  return [cleanHeader, ''];
}

function parseExperiences(lines: string[]): CandidateExperience[] {
  const records: CandidateExperience[] = [];
  let pending: string[] = [];

  const flush = () => {
    if (!pending.length) return;
    const first = pending[0];
    const dates = extractDateRange(first);
    const header = dates
      ? `${first.slice(0, dates.index)} ${first.slice(dates.endIndex)}`.trim()
      : first;
    const [title, company] = splitRoleAndOrganization(header);
    const descriptionLines = pending.slice(1);
    const description = distinct(descriptionLines).join('\n');
    records.push({
      id: `imported-experience-${records.length + 1}`,
      title,
      company,
      start_date: dates?.start || '',
      end_date: dates?.end || undefined,
      current: dates?.current || false,
      description,
    });
    pending = [];
  };

  for (const original of lines) {
    const line = cleanLine(original.replace(/^[-*•]\s*/, ''));
    if (!line) {
      flush();
      continue;
    }
    const dates = extractDateRange(line);
    if (dates && pending.length && !extractDateRange(pending[0])) {
      pending[0] = `${pending[0]} | ${line}`;
      continue;
    }
    if (dates && pending.length) flush();
    pending.push(line);
  }
  flush();
  return records.filter(record => record.title || record.company || record.description);
}

function parseEducations(lines: string[]): CandidateEducation[] {
  const records: CandidateEducation[] = [];
  let pending: string[] = [];
  const flush = () => {
    if (!pending.length) return;
    const first = pending[0];
    const dates = extractDateRange(first);
    const header = dates
      ? `${first.slice(0, dates.index)} ${first.slice(dates.endIndex)}`.trim()
      : first;
    const parts = header.replace(/\s*[|•·]+\s*$/, '').split(/\s+[|•·]\s+|\s+at\s+/i).map(cleanLine).filter(Boolean);
    const credential = parts[0] || header;
    const institution = parts[1] || '';
    const degreeParts = credential.split(/\s+(?:in|of)\s+/i);
    const endYear = dates?.current ? undefined : dates?.end.slice(0, 4);
    records.push({
      id: `imported-education-${records.length + 1}`,
      degree: degreeParts[0] || '',
      field_of_study: degreeParts.slice(1).join(' in '),
      institution,
      start_year: dates?.start.slice(0, 4) || '',
      end_year: endYear,
    });
    pending = [];
  };

  for (const original of lines) {
    const line = cleanLine(original.replace(/^[-*•]\s*/, ''));
    if (!line) {
      flush();
      continue;
    }
    const dates = extractDateRange(line);
    if (dates && pending.length && !extractDateRange(pending[0])) {
      pending[0] = `${pending[0]} | ${line}`;
      continue;
    }
    if (dates && pending.length) flush();
    pending.push(line);
  }
  flush();
  return records.filter(record => record.degree || record.institution);
}

function guessNameAndHeadline(lines: string[]) {
  const contactLines = lines.filter(Boolean).slice(0, 8);
  const emailLine = (line: string) => /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(line);
  const phoneLine = (line: string) => Boolean(findPhone(line));
  const urlLine = (line: string) => /(?:https?:\/\/|www\.)/i.test(line);
  const candidates = contactLines.filter(line => !emailLine(line) && !phoneLine(line) && !urlLine(line));
  const fullName = candidates.find(line =>
    /^[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){1,4}$/u.test(line)
  ) || '';
  const nameIndex = fullName ? contactLines.indexOf(fullName) : -1;
  const headline = nameIndex >= 0
    ? candidates.slice(nameIndex + 1).find(line => line.length <= 100) || ''
    : '';
  return { fullName, headline };
}

export function extractCandidateProfileFromCvText(input: string): CandidateCvExtraction {
  const extractedText = normalizeCandidateCvText(input);
  const lines = extractedText.split('\n');
  const sections = readSections(lines);
  const { fullName, headline } = guessNameAndHeadline(lines);
  const email = extractedText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || '';
  const phone = findPhone(extractedText);
  const profile: Partial<CandidateProfile> = {};
  const warnings: string[] = [];

  if (fullName) profile.full_name = fullName;
  if (headline) profile.headline = headline;
  if (phone) profile.phone = phone;
  if (email) profile.email = email;

  const summary = sections.get('summary')?.join(' ').trim();
  if (summary) profile.summary = summary;
  const skills = listItems(sections.get('skills') || []);
  if (skills.length) profile.skills = skills;
  const certifications = listItems(sections.get('certifications') || sections.get('certificates') || []);
  if (certifications.length) profile.certifications = certifications;
  const experiences = parseExperiences(sections.get('experience') || []);
  if (experiences.length) profile.experiences = experiences;
  const educations = parseEducations(sections.get('education') || []);
  if (educations.length) profile.educations = educations;

  const linkedin = extractedText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s)>]+/i)?.[0];
  const github = extractedText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)>]+/i)?.[0];
  if (linkedin) profile.linkedin_url = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`;
  if (github) profile.github_url = github.startsWith('http') ? github : `https://${github}`;

  if (!extractedText) warnings.push('No selectable text was found. Scanned-image CVs need OCR and were not sent to an external service.');
  if (!fullName) warnings.push('A candidate name was not detected. Add or correct it in the review form.');
  if (!email) warnings.push('An email address was not detected. Your account email is shown separately and is not changed by this import.');
  if (!sections.has('experience') && !sections.has('education')) warnings.push('Work and education sections were not recognized. Add or correct entries in the review form if needed.');

  return { profile, accountEmail: email, warnings, extractedText };
}

export async function extractCandidateProfileFromCvFile(file: File): Promise<CandidateCvExtraction> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf' && extension !== 'docx') {
    throw new Error('This file was uploaded privately, but automatic parsing supports PDF and DOCX. You can still update your profile manually.');
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error('CV must be between 1 byte and 10 MB.');
  }

  let text = '';
  if (extension === 'pdf') {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const document = await loadingTask.promise;
    try {
      if (document.numPages > MAX_PDF_PAGES) throw new Error(`CVs with more than ${MAX_PDF_PAGES} pages are not supported for parsing.`);
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join(''));
        if (pages.join('\n').length > MAX_EXTRACTED_CHARACTERS) break;
      }
      text = pages.join('\n');
    } finally {
      await loadingTask.destroy();
    }
  } else {
    const mammoth = await import('mammoth/mammoth.browser.js');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  }

  return extractCandidateProfileFromCvText(text);
}

