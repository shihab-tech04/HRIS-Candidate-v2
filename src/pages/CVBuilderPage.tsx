import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CandidateCV, CandidateProfile } from '../types';
import { listCandidateCVs, persistCandidateCV, uploadCandidateCV, getCandidateCVDownloadUrl, updateCandidateProfile } from '../lib/api';
import { extractCandidateProfileFromCvFile } from '../lib/candidateCvParser';
import {
  FileText,
  Upload,
  Download,
  Printer,
  Copy,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Eye,
  Trash2,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface CVBuilderPageProps {
  onNavigate: (tab: string) => void;
}

export const CVBuilderPage: React.FC<CVBuilderPageProps> = ({ onNavigate }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [cvList, setCvList] = useState<CandidateCV[]>([]);
  const [selectedCv, setSelectedCv] = useState<CandidateCV | null>(null);

  // New version modal
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('v1.0');
  const [isDefault, setIsDefault] = useState(false);

  // The file itself is stored privately; parsing runs locally in the browser.
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseNotice, setParseNotice] = useState<string | null>(null);
  const [reviewProfile, setReviewProfile] = useState<Partial<CandidateProfile> | null>(null);
  const [reviewEmail, setReviewEmail] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [parseRequiresManualEntry, setParseRequiresManualEntry] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Editable CV Content
  const [cvData, setCvData] = useState<Partial<CandidateProfile>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadCVs();
    }
  }, [user]);

  const loadCVs = async () => {
    if (!user) return;
    try {
      const list = await listCandidateCVs(user.id);
      setCvList(list);
      if (list.length > 0) {
        const active = list.find(c => c.is_default) || list[0];
        setSelectedCv(active);
        setCvData({ ...(profile || {}), ...(active.structured_content || {}) });
      } else {
        setSelectedCv(null);
      }
      setSaveError(null);
    } catch (error) {
      setCvList([]);
      setSaveError(error instanceof Error ? error.message : 'Unable to load CV records.');
    }
  };

  const handleSelectCv = (cv: CandidateCV) => {
    setSelectedCv(cv);
    setCvData(cv.structured_content || profile || {});
    setParseNotice(null);
    setReviewProfile(null);
    setReviewEmail('');
    setParseWarnings([]);
    setParseRequiresManualEntry(false);
  };

  const handleCreateCv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;
    try {
      const created = await persistCandidateCV(user.id, {
        title: newTitle.trim(),
        version: newVersion.trim() || 'v1.0',
        is_default: isDefault,
        structured_content: { summary: profile?.summary || '' }
      });
      await loadCVs();
      setSelectedCv(created);
      setCvData({ ...(profile || {}), ...(created.structured_content || {}) });
      setNewTitle('');
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'CV was not created.');
    }
  };

  const handleSaveStructuredCV = async () => {
    if (!user || !selectedCv) return;
    try {
      const saved = await persistCandidateCV(user.id, {
        ...selectedCv, structured_content: { summary: cvData.summary || '' }
      });
      setSelectedCv(saved);
      await loadCVs();
      setSaveError(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (error) {
      setSavedSuccess(false);
      setSaveError(error instanceof Error ? error.message : 'CV summary was not saved.');
    }
  };

  const handleParseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedCv) return;
    setUploadFile(file);
    setParsing(true);
    setParseNotice(null);
    setReviewProfile(null);
    setReviewEmail('');
    setParseWarnings([]);
    setParseRequiresManualEntry(false);
    try {
      const stored = await uploadCandidateCV(user.id, selectedCv, file);
      setSelectedCv(stored);
      setCvList(current => current.some(cv => cv.id === stored.id)
        ? current.map(cv => cv.id === stored.id ? stored : cv)
        : [stored, ...current]);
      setParseNotice(`${file.name} is stored in your private candidate documents. Its contents will be read in this browser for review.`);
      setSaveError(null);

      try {
        const extraction = await extractCandidateProfileFromCvFile(file);
        setReviewProfile(extraction.profile);
        setReviewEmail(extraction.accountEmail);
        setParseWarnings(extraction.warnings);
        setParseRequiresManualEntry(false);
        setCvData(current => ({ ...current, ...extraction.profile }));
        setParseNotice(`${file.name} is stored privately. Review the extracted details below; your profile has not been changed.`);
      } catch (parseError) {
        setParseRequiresManualEntry(true);
        setParseNotice(`${file.name} is stored privately. ${parseError instanceof Error ? parseError.message : 'Automatic parsing could not read this file.'}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'CV upload failed.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const updateReviewedProfile = (updates: Partial<CandidateProfile>) => {
    setReviewProfile(current => current ? { ...current, ...updates } : current);
  };

  const handleApplyReviewedProfile = async () => {
    if (!user || !reviewProfile) return;
    setUpdatingProfile(true);
    setSaveError(null);
    try {
      const mergedProfile = {
        ...(profile || {}),
        ...reviewProfile,
        // Keep opaque data used by the existing HRIS profile contract.
        profile_data: {
          ...(profile?.profile_data || {}),
          ...(reviewProfile.profile_data || {}),
        },
      };
      await updateCandidateProfile(user.id, mergedProfile);
      await refreshProfile();
      setCvData(current => ({ ...current, ...reviewProfile }));
      setReviewProfile(null);
      setParseRequiresManualEntry(false);
      setParseNotice('Reviewed CV details were saved to your candidate profile. The original upload remains privately stored.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Reviewed CV details were not saved. Please retry.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleDownload = async () => {
    if (!user || !selectedCv) return;
    try {
      const signedUrl = await getCandidateCVDownloadUrl(user.id, selectedCv);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'CV download unavailable.');
    }
  };

  const handlePrintCV = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
              Documents & Resumes
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Structured CV Builder & Manager
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create tailored CV versions, upload PDF/Word resumes, and export clean printable documents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="min-h-11 py-2 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Edit profile details
            </button>
            <button
              onClick={handlePrintCV}
              className="min-h-11 py-2 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print / Save PDF
            </button>
            <button
              onClick={handleSaveStructuredCV}
              className="min-h-11 py-2 px-4 bg-[#085587] text-white hover:bg-[#074771] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Save CV Version
            </button>
          </div>
        </div>

        {saveError && <p role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{saveError}</p>}
        {savedSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>CV record and custom summary saved to HRMIS.</span>
          </div>
        )}

        {parseNotice && (
          <div role="status" aria-live="polite" className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-[#085587]" />
            <span>{parseNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Col: Versions List & Upload */}
          <div className="space-y-6">
            {/* Version List */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Managed CV Versions
              </h2>
              <div className="space-y-2">
                {cvList.map((cv) => (
                  <div
                    key={cv.id}
                    onClick={() => handleSelectCv(cv)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedCv?.id === cv.id
                        ? 'border-[#085587] bg-sky-50/50 ring-1 ring-[#085587]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{cv.title}</span>
                      {cv.is_default && (
                        <span className="text-[10px] font-semibold text-[#085587] bg-sky-100 px-1.5 py-0.2 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{cv.version}</span>
                      <span>Updated {new Date(cv.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add version form */}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-700 mb-2">Create New Version:</p>
                <form onSubmit={handleCreateCv} className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Version title (e.g. Lead Architect CV)"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="v2.0"
                      className="w-20 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="flex-1 py-1.5 px-3 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Upload PDF/Word Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Upload External File (PDF/DOCX)
              </h2>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Select file to parse</p>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  Extracted details will be editable before saving
                </p>
                <label className="inline-block py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                  {!selectedCv ? 'Create a CV version first' : parsing ? 'Uploading and parsing...' : 'Choose File'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleParseUpload}
                    disabled={parsing || !selectedCv}
                  />
                </label>
                {!selectedCv && <p className="text-[11px] text-slate-500">Create or select a CV version before uploading.</p>}
                {uploadFile && <p className="mt-2 text-[11px] text-slate-500 break-all">Selected: {uploadFile.name}</p>}
                <p className="mt-2 text-[11px] text-slate-500">
                  PDF and DOCX text is parsed in this browser. Legacy DOC files are kept privately for manual review.
                </p>
                {uploadFile && parseRequiresManualEntry && (
                  <button type="button" onClick={() => onNavigate('profile')} className="mt-2 text-xs font-semibold text-[#085587] underline underline-offset-2">
                    Open profile editor
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Structured CV Preview & Live Editor (2 spans) */}
          <div className="lg:col-span-2">
            {reviewProfile && (
              <section aria-labelledby="cv-import-review-heading" className="mb-6 bg-white rounded-2xl border border-sky-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div>
                  <h2 id="cv-import-review-heading" className="text-sm font-bold text-slate-900">Review extracted details</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    These suggestions came from {uploadFile?.name || 'your CV'} and can be corrected before you choose to update your profile.
                  </p>
                  <p className="mt-1 text-xs text-slate-600">Your uploaded file remains private and is not replaced by these details.</p>
                </div>

                {parseWarnings.length > 0 && (
                  <ul role="status" className="space-y-1 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    {parseWarnings.map(warning => <li key={warning}>{warning}</li>)}
                  </ul>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-name">
                    Full name
                    <input id="cv-review-name" aria-label="Review full name" value={reviewProfile.full_name || ''}
                      onChange={e => updateReviewedProfile({ full_name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-phone">
                    Phone
                    <input id="cv-review-phone" aria-label="Review phone" value={reviewProfile.phone || ''}
                      onChange={e => updateReviewedProfile({ phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-location">
                    Location
                    <input id="cv-review-location" aria-label="Review location" value={reviewProfile.location || ''}
                      onChange={e => updateReviewedProfile({ location: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-headline">
                    Professional headline
                    <input id="cv-review-headline" aria-label="Review headline" value={reviewProfile.headline || ''}
                      onChange={e => updateReviewedProfile({ headline: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2" htmlFor="cv-review-email">
                    Email found in CV
                    <input id="cv-review-email" aria-label="Review CV email" type="email" value={reviewEmail}
                      onChange={e => setReviewEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                    <span className="mt-1 block font-normal text-slate-500">This review value does not change your sign-in email.</span>
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2" htmlFor="cv-review-summary">
                    Professional summary
                    <textarea id="cv-review-summary" aria-label="Review summary" rows={3} value={reviewProfile.summary || ''}
                      onChange={e => updateReviewedProfile({ summary: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2" htmlFor="cv-review-skills">
                    Skills (comma-separated)
                    <textarea id="cv-review-skills" aria-label="Review skills" rows={2} value={(reviewProfile.skills || []).join(', ')}
                      onChange={e => updateReviewedProfile({ skills: e.target.value.split(',').map(skill => skill.trim()).filter(Boolean) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2" htmlFor="cv-review-certifications">
                    Certifications (comma-separated)
                    <textarea id="cv-review-certifications" aria-label="Review certifications" rows={2} value={(reviewProfile.certifications || []).join(', ')}
                      onChange={e => updateReviewedProfile({ certifications: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-portfolio">
                    Portfolio URL
                    <input id="cv-review-portfolio" aria-label="Review portfolio URL" type="url" value={reviewProfile.portfolio_url || ''}
                      onChange={e => updateReviewedProfile({ portfolio_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700" htmlFor="cv-review-linkedin">
                    LinkedIn URL
                    <input id="cv-review-linkedin" aria-label="Review LinkedIn URL" type="url" value={reviewProfile.linkedin_url || ''}
                      onChange={e => updateReviewedProfile({ linkedin_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700 sm:col-span-2" htmlFor="cv-review-github">
                    GitHub URL
                    <input id="cv-review-github" aria-label="Review GitHub URL" type="url" value={reviewProfile.github_url || ''}
                      onChange={e => updateReviewedProfile({ github_url: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                  </label>
                </div>

                {(reviewProfile.experiences || []).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Work experience</h3>
                    {(reviewProfile.experiences || []).map((experience, index) => (
                      <div key={experience.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3">
                        <label className="text-xs font-semibold text-slate-700">Role
                          <input aria-label={`Review experience ${index + 1} role`} value={experience.title} onChange={e => {
                            const experiences = [...(reviewProfile.experiences || [])]; experiences[index] = { ...experience, title: e.target.value }; updateReviewedProfile({ experiences });
                          }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Organization
                          <input aria-label={`Review experience ${index + 1} organization`} value={experience.company} onChange={e => {
                            const experiences = [...(reviewProfile.experiences || [])]; experiences[index] = { ...experience, company: e.target.value }; updateReviewedProfile({ experiences });
                          }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Dates
                          <input aria-label={`Review experience ${index + 1} dates`} value={`${experience.start_date || ''}${experience.current ? ' – Present' : experience.end_date ? ` – ${experience.end_date}` : ''}`}
                            onChange={e => {
                              const [start_date = '', endValue = ''] = e.target.value.split(/\s+[–-]\s+/);
                              const current = /^(present|current|now)$/i.test(endValue.trim());
                              const experiences = [...(reviewProfile.experiences || [])]; experiences[index] = { ...experience, start_date, end_date: current ? undefined : endValue, current }; updateReviewedProfile({ experiences });
                            }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Description
                          <textarea aria-label={`Review experience ${index + 1} description`} rows={2} value={experience.description}
                            onChange={e => { const experiences = [...(reviewProfile.experiences || [])]; experiences[index] = { ...experience, description: e.target.value }; updateReviewedProfile({ experiences }); }}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {(reviewProfile.educations || []).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Education</h3>
                    {(reviewProfile.educations || []).map((education, index) => (
                      <div key={education.id} className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-200 p-3">
                        <label className="text-xs font-semibold text-slate-700">Degree and field
                          <input aria-label={`Review education ${index + 1} degree`} value={[education.degree, education.field_of_study].filter(Boolean).join(' in ')} onChange={e => {
                            const [degree = '', ...field] = e.target.value.split(/\s+in\s+/i); const educations = [...(reviewProfile.educations || [])]; educations[index] = { ...education, degree, field_of_study: field.join(' in ') }; updateReviewedProfile({ educations });
                          }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700">Institution
                          <input aria-label={`Review education ${index + 1} institution`} value={education.institution} onChange={e => {
                            const educations = [...(reviewProfile.educations || [])]; educations[index] = { ...education, institution: e.target.value }; updateReviewedProfile({ educations });
                          }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Years
                          <input aria-label={`Review education ${index + 1} years`} value={`${education.start_year || ''}${education.end_year ? ` – ${education.end_year}` : ''}`} onChange={e => {
                            const [start_year = '', end_year = ''] = e.target.value.split(/\s+[–-]\s+/); const educations = [...(reviewProfile.educations || [])]; educations[index] = { ...education, start_year, end_year: end_year || undefined }; updateReviewedProfile({ educations });
                          }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
                  <button type="button" onClick={handleApplyReviewedProfile} disabled={updatingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#085587] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#074771] disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" />
                    {updatingProfile ? 'Saving reviewed details...' : 'Update my profile with reviewed details'}
                  </button>
                  <button type="button" onClick={() => { setReviewProfile(null); setReviewEmail(''); setParseWarnings([]); }}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    Discard review
                  </button>
                </div>
              </section>
            )}

            <div data-candidate-cv-print className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
              {/* Printable Header */}
              <div className="border-b border-slate-200 pb-6 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                    {cvData.full_name || profile?.full_name || 'Candidate'}
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedCv?.version || 'v1.0'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[#085587]">
                  {cvData.headline || profile?.headline || 'Professional headline'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                  <span>{cvData.location || profile?.location || 'Location not entered'}</span>
                  <span>·</span>
                  <span>{cvData.phone || profile?.phone || 'Phone not entered'}</span>
                  <span>·</span>
                  <span>{cvData.email || user?.email}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Professional Summary
                </h3>
                <textarea
                  rows={3}
                  value={cvData.summary || ''}
                  onChange={(e) => setCvData({ ...cvData, summary: e.target.value })}
                  placeholder="Summary statement..."
                  className="w-full p-2 text-xs border border-transparent hover:border-slate-200 focus:border-[#085587] rounded-lg focus:outline-none transition-colors print:hidden"
                />
                <p className="hidden whitespace-pre-wrap text-xs leading-relaxed text-slate-600 print:block">
                  {cvData.summary || ''}
                </p>
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Technical Core Competencies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(cvData.skills || profile?.skills || []).map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experiences */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Work Experience
                </h3>
                {(cvData.experiences || profile?.experiences || []).map((exp, i) => (
                  <div key={i} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{exp.title}</span>
                      <span className="text-slate-500 font-normal">
                        {exp.start_date} – {exp.current ? 'Present' : exp.end_date}
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium">{exp.company}</p>
                    <p className="text-slate-600 leading-relaxed pt-0.5">{exp.description}</p>
                  </div>
                ))}
              </div>

              {/* Education */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Academic Credentials
                </h3>
                {(cvData.educations || profile?.educations || []).map((edu, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>
                        {edu.degree} in {edu.field_of_study}
                      </span>
                      <span className="text-slate-500 font-normal">
                        {edu.start_year} – {edu.end_year || 'Present'}
                      </span>
                    </div>
                    <p className="text-slate-600">{edu.institution}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
