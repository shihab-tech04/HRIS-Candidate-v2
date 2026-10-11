import React, { useState, useEffect } from 'react';
import { PublishedJob, CandidateCV, JobApplication } from '../types';
import {
  getPublishedJobById,
  getCandidateCVs,
  saveCandidateCV,
  applyToJob,
  saveApplicationDraft,
  getApplicationDraft,
  deleteApplicationDraft,
  DEMO_MODE
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  User,
  ShieldCheck,
  Save,
  ArrowRight,
  Send,
  Plus,
  Paperclip,
  Check,
  ChevronRight
} from 'lucide-react';

interface ApplyPageProps {
  jobId: string;
  onBack: () => void;
  onApplicationSuccess: (applicationId: string) => void;
}

export const ApplyPage: React.FC<ApplyPageProps> = ({ jobId, onBack, onApplicationSuccess }) => {
  const { user, profile } = useAuth();
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [cvs, setCvs] = useState<CandidateCV[]>([]);
  const [loading, setLoading] = useState(true);

  // Steps: 1: Candidate Info, 2: Select CV, 3: Screening Questions, 4: Documents & Cover Letter, 5: Review & Consent
  const [step, setStep] = useState<number>(1);

  // Form State
  const [selectedCvId, setSelectedCvId] = useState<string>('');
  const [candidateInfo, setCandidateInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    portfolioUrl: '',
    linkedinUrl: ''
  });
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, any>>({});
  const [coverLetter, setCoverLetter] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; type: string }[]>(
    []
  );
  const [consentGiven, setConsentGiven] = useState(false);
  const [truthfulnessDeclaration, setTruthfulnessDeclaration] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSavedNotice, setDraftSavedNotice] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<JobApplication | null>(null);

  // Upload CV modal/inline state
  const [newCvTitle, setNewCvTitle] = useState('');
  const [uploadingCv, setUploadingCv] = useState(false);

  useEffect(() => {
    loadData();
  }, [jobId, user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    let j: PublishedJob | null = null;
    try {
      j = await getPublishedJobById(jobId);
    } catch {
      setError('Unable to verify this vacancy with HRMIS. Please retry.');
    }
    setJob(j);

    const userCVs = getCandidateCVs(user.id);
    setCvs(userCVs);
    if (userCVs.length > 0) {
      const def = userCVs.find((c) => c.is_default) || userCVs[0];
      setSelectedCvId(def.id);
    }

    // Prefill candidate info from profile
    if (profile) {
      setCandidateInfo({
        fullName: profile.full_name || user.user_metadata?.full_name || '',
        email: profile.email || user.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        portfolioUrl: profile.portfolio_url || '',
        linkedinUrl: profile.linkedin_url || ''
      });
    } else {
      setCandidateInfo({
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
        phone: '',
        location: '',
        portfolioUrl: '',
        linkedinUrl: ''
      });
    }

    // Load draft if available
    const draft = getApplicationDraft(jobId, user.id);
    if (draft) {
      if (draft.candidateInfo) setCandidateInfo(draft.candidateInfo);
      if (draft.selectedCvId) setSelectedCvId(draft.selectedCvId);
      if (draft.screeningAnswers) setScreeningAnswers(draft.screeningAnswers);
      if (draft.coverLetter) setCoverLetter(draft.coverLetter);
      if (draft.attachedFiles) setAttachedFiles(draft.attachedFiles);
    }

    setLoading(false);
  };

  const handleSaveDraft = () => {
    if (!user || !job) return;
    saveApplicationDraft(job.id, user.id, {
      candidateInfo,
      selectedCvId,
      screeningAnswers,
      coverLetter,
      attachedFiles
    });
    setDraftSavedNotice(true);
    setTimeout(() => setDraftSavedNotice(false), 3000);
  };

  const handleCreateNewCv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCvTitle.trim()) return;
    if (!DEMO_MODE) {
      setError('CV storage is not connected yet. A local CV template cannot be submitted as an official CV.');
      return;
    }
    setUploadingCv(true);
    setTimeout(() => {
      const newCV = saveCandidateCV(user.id, {
        title: newCvTitle.trim(),
        version: 'v1.0',
        file_name: `${newCvTitle.replace(/\s+/g, '_')}_Resume.pdf`,
        file_size: 1024 * 280,
        is_default: cvs.length === 0
      });
      setCvs(getCandidateCVs(user.id));
      setSelectedCvId(newCV.id);
      setNewCvTitle('');
      setUploadingCv(false);
    }, 400);
  };

  const handleSimulateFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!DEMO_MODE) {
      setError('Document upload to secure HRMIS storage is not available yet. No file was submitted.');
      e.target.value = '';
      return;
    }
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setAttachedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type || 'application/pdf'
        }
      ]);
    }
  };

  // Step validations
  const validateStep1 = () => {
    if (!candidateInfo.fullName.trim()) {
      setError('Please provide your full legal name.');
      return false;
    }
    if (!candidateInfo.email.trim() || !candidateInfo.email.includes('@')) {
      setError('Please provide a valid email address.');
      return false;
    }
    if (!candidateInfo.phone.trim()) {
      setError('Contact phone number is required.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = () => {
    if (!selectedCvId) {
      setError('Please select or upload a CV to attach to your application.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep3 = () => {
    if (!job?.screening_questions) return true;
    for (const q of job.screening_questions) {
      if (q.required) {
        const val = screeningAnswers[q.id];
        if (val === undefined || val === null || val === '') {
          setError(`Please answer the required question: "${q.question}"`);
          return false;
        }
      }
    }
    setError(null);
    return true;
  };

  const validateStep4 = () => {
    setError(null);
    return true;
  };

  const handleNextStep = () => {
    let isValid = false;
    if (step === 1) isValid = validateStep1();
    if (step === 2) isValid = validateStep2();
    if (step === 3) isValid = validateStep3();
    if (step === 4) isValid = validateStep4();

    if (isValid) {
      setError(null);
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitApplication = async () => {
    if (!consentGiven || !truthfulnessDeclaration) {
      setError('You must accept the recruitment consent declaration and confirm truthfulness.');
      return;
    }

    if (!user || !job) return;

    setSubmitting(true);
    setError(null);

    const selectedCv = cvs.find((c) => c.id === selectedCvId);

    const res = await applyToJob(job.id, {
      user_id: user.id,
      cv_id: selectedCvId,
      cv_title: selectedCv?.file_name || selectedCv?.title,
      screening_answers: screeningAnswers,
      cover_letter: coverLetter,
      documents: attachedFiles,
      consent_given: consentGiven,
      accuracy_certified: truthfulnessDeclaration
    });

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to submit application. Please review your answers.');
      return;
    }

    if (res.application) {
      setSubmittedApp(res.application);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-10 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900 mb-1">Vacancy unavailable</h2>
        {error && <p role="alert" className="text-sm text-rose-700 mt-3">{error}</p>}
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#085587] text-white text-xs font-semibold rounded-lg"
        >
          Return to Open Roles
        </button>
      </div>
    );
  }

  // Confirmation Success View
  if (submittedApp) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-6">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Application Successfully Logged
            </h1>
            <p className="text-xs text-slate-600">
              Your application for <strong>{job.title}</strong> has been registered in the shared Synesis HRMIS recruitment database.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Application Reference:</span>
              <span className="font-mono font-bold text-slate-900">{submittedApp.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold text-[#085587]">
                {submittedApp.candidate_visible_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted At:</span>
              <span className="text-slate-700">
                {new Date(submittedApp.submitted_at).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Attached CV:</span>
              <span className="text-slate-700 truncate max-w-[200px]">
                {submittedApp.cv_title}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed text-left p-3 bg-sky-50 border border-sky-100 rounded-lg">
            <p className="font-semibold text-slate-800 mb-1">What happens next?</p>
            <p>
              Our talent team and engineering managers in Main HRIS review all verified applications. You will receive notifications for screening updates, interview scheduling, or stage progressions directly on your Candidate Dashboard.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onApplicationSuccess(submittedApp.id)}
              className="py-2.5 px-6 bg-[#085587] text-white text-xs font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-sm"
            >
              Go to Application Tracking
            </button>
            <button
              onClick={onBack}
              className="py-2.5 px-4 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Browse Other Roles
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepsList = [
    { num: 1, label: 'Candidate Info' },
    { num: 2, label: 'Resume & CV' },
    { num: 3, label: 'Screening Questions' },
    { num: 4, label: 'Cover & Documents' },
    { num: 5, label: 'Review & Submit' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Back & Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#085587] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Details
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Save className="w-3.5 h-3.5 text-[#085587]" />
            {draftSavedNotice ? 'Draft Saved!' : 'Save Draft'}
          </button>
        </div>

        {/* Application Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#085587]">
            Job Application Form
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            {job.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{job.department}</span>
            <span aria-hidden="true">·</span>
            <span>{job.location}</span>
            <span aria-hidden="true">·</span>
            <span>{job.workplace_type}</span>
          </div>

          {/* Stepper Progress */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              {stepsList.map((s, idx) => (
                <div key={s.num} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step === s.num
                          ? 'bg-[#085587] text-white ring-4 ring-sky-100'
                          : step > s.num
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                    </div>
                    <span
                      className={`text-[10px] mt-1 hidden sm:block font-medium whitespace-nowrap ${
                        step === s.num ? 'text-[#085587] font-bold' : 'text-slate-500'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        step > s.num ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    ></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Application requirement notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          {/* STEP 1: CANDIDATE INFO */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Step 1: Candidate Contact Information</h2>
                <p className="text-xs text-slate-500">
                  Pre-filled from your candidate profile. Information can be edited specifically for this submission.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={candidateInfo.fullName}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, fullName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={candidateInfo.email}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, email: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={candidateInfo.phone}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, phone: e.target.value })
                    }
                    placeholder="+880 1711..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Location / City *
                  </label>
                  <input
                    type="text"
                    required
                    value={candidateInfo.location}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, location: e.target.value })
                    }
                    placeholder="Dhaka, Bangladesh"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    value={candidateInfo.linkedinUrl}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, linkedinUrl: e.target.value })
                    }
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Portfolio or GitHub URL
                  </label>
                  <input
                    type="url"
                    value={candidateInfo.portfolioUrl}
                    onChange={(e) =>
                      setCandidateInfo({ ...candidateInfo, portfolioUrl: e.target.value })
                    }
                    placeholder="https://github.com/..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CV SELECTION & ATTACHMENT */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Step 2: Attach Candidate CV / Resume</h2>
                <p className="text-xs text-slate-500">
                  Select an existing CV from your profile or upload a tailored version for this application.
                </p>
              </div>

              <div className="space-y-3">
                {cvs.map((cv) => (
                  <label
                    key={cv.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedCvId === cv.id
                        ? 'border-[#085587] bg-sky-50/40 ring-2 ring-[#085587]/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="selectedCv"
                          checked={selectedCvId === cv.id}
                          onChange={() => setSelectedCvId(cv.id)}
                          className="w-4 h-4 text-[#085587] focus:ring-[#085587]"
                        />
                        <FileText className="w-5 h-5 text-[#085587]" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{cv.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {cv.file_name} · {cv.version} · Updated {new Date(cv.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {cv.is_default && (
                        <span className="text-[11px] font-semibold text-[#085587] bg-sky-100/70 px-2 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Add / Upload new CV */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-800 mb-2">Upload or Create New Version:</p>
                <form onSubmit={handleCreateNewCv} className="flex gap-2">
                  <input
                    type="text"
                    value={newCvTitle}
                    onChange={(e) => setNewCvTitle(e.target.value)}
                    placeholder="e.g. Senior FullStack Tailored Resume"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={uploadingCv || !newCvTitle.trim()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {uploadingCv ? 'Processing...' : 'Add Version'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 3: SCREENING QUESTIONS */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Step 3: Role Screening Questions</h2>
                <p className="text-xs text-slate-500">
                  Please answer the following qualifications required by the hiring committee in Synesis HRIS Main.
                </p>
              </div>

              {!job.screening_questions || job.screening_questions.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
                  No additional screening questions configured for this position. Click Next to proceed.
                </div>
              ) : (
                <div className="space-y-4">
                  {job.screening_questions.map((q) => (
                    <div key={q.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        {q.question} {q.required && <span className="text-rose-500">*</span>}
                      </label>

                      {q.type === 'select' && (
                        <select
                          value={screeningAnswers[q.id] || ''}
                          onChange={(e) =>
                            setScreeningAnswers({ ...screeningAnswers, [q.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                        >
                          <option value="">Select an option...</option>
                          {q.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.type === 'yes_no' && (
                        <div className="flex items-center gap-4 pt-1">
                          {['Yes', 'No'].map((choice) => (
                            <label key={choice} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                value={choice}
                                checked={screeningAnswers[q.id] === choice}
                                onChange={() =>
                                  setScreeningAnswers({ ...screeningAnswers, [q.id]: choice })
                                }
                                className="w-3.5 h-3.5 text-[#085587] focus:ring-[#085587]"
                              />
                              {choice}
                            </label>
                          ))}
                        </div>
                      )}

                      {q.type === 'text' && (
                        <input
                          type="text"
                          value={screeningAnswers[q.id] || ''}
                          onChange={(e) =>
                            setScreeningAnswers({ ...screeningAnswers, [q.id]: e.target.value })
                          }
                          placeholder={q.placeholder || 'Your answer...'}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: COVER LETTER & DOCUMENTS */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Step 4: Supporting Notes & Documents</h2>
                <p className="text-xs text-slate-500">
                  Optional cover letter and supplemental certificates or portfolio files.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cover Letter / Introduction to the Hiring Team
                </label>
                <textarea
                  rows={4}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Share why you are interested in this position, relevant architectural achievements, and what excites you about Synesis IT..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Attach Additional Documents (Portfolio, Certifications, Transcripts)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-slate-300 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-slate-700">Upload additional files</p>
                  <p className="text-[11px] text-slate-400 mb-3">PDF, DOCX, PNG up to 10MB</p>
                  <label className="inline-block py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleSimulateFileUpload}
                    />
                  </label>
                </div>

                {attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <span className="text-[11px] font-semibold text-slate-600">Attached:</span>
                    {attachedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="text-rose-600 hover:underline text-[11px] ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONSENT */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-slate-900">Step 5: Final Review & Legal Consent</h2>
                <p className="text-xs text-slate-500">
                  Please review your submission summary and provide mandatory recruitment consent.
                </p>
              </div>

              {/* Review Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                <div className="flex justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Candidate:</span>
                  <span className="font-semibold text-slate-900">
                    {candidateInfo.fullName} ({candidateInfo.email})
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Position Applied:</span>
                  <span className="font-semibold text-slate-900">{job.title}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Selected CV:</span>
                  <span className="font-semibold text-slate-900">
                    {cvs.find((c) => c.id === selectedCvId)?.title || 'Selected Resume'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Screening Questions:</span>
                  <span className="font-semibold text-emerald-700">
                    {Object.keys(screeningAnswers).length} Answers Provided
                  </span>
                </div>
              </div>

              {/* Consent Checkboxes */}
              <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-xl space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#085587] rounded border-slate-300 focus:ring-[#085587]"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong>Recruitment Data Processing Consent:</strong> I authorize Synesis IT recruitment staff and hiring managers to process my application data, CV, and credentials across the Synesis HRMIS platform for hiring purposes.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={truthfulnessDeclaration}
                    onChange={(e) => setTruthfulnessDeclaration(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-[#085587] rounded border-slate-300 focus:ring-[#085587]"
                  />
                  <span className="text-xs text-slate-700 leading-relaxed">
                    <strong>Declaration of Truthfulness:</strong> I certify that all information provided in this application and attached documents is authentic, accurate, and complete to the best of my knowledge.
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Stepper Buttons */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
              >
                Previous Step
              </button>
            ) : (
              <div></div>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="py-2.5 px-6 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors shadow-sm flex items-center gap-1.5"
              >
                Proceed to Step {step + 1}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={submitting || !consentGiven || !truthfulnessDeclaration}
                className="py-2.5 px-8 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting to HRMIS...' : 'Submit Application to Synesis HR'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
