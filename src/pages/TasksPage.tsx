import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CandidateAssessment, CandidateDocumentRequest } from '../types';
import {
  getRecruitmentContext,
  submitAssessment,
  submitRequestedDocument
} from '../lib/api';
import {
  CheckSquare,
  FileCheck,
  Upload,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Send
} from 'lucide-react';

interface TasksPageProps {
  onNavigate: (tab: string) => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<CandidateAssessment[]>([]);
  const [docRequests, setDocRequests] = useState<CandidateDocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active submission modals
  const [activeAssessment, setActiveAssessment] = useState<CandidateAssessment | null>(null);
  const [assessmentText, setAssessmentText] = useState('');
  const [assessmentFileLink, setAssessmentFileLink] = useState('');

  const [activeDocRequest, setActiveDocRequest] = useState<CandidateDocumentRequest | null>(null);
  const [uploadedDocFile, setUploadedDocFile] = useState<File | null>(null);
  const uploadedDocName = uploadedDocFile?.name || '';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) { setAssessments([]); setDocRequests([]); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      setAssessments(ctx.assessments || []); setDocRequests(ctx.document_requests || []);
    } catch (cause) {
      setAssessments([]); setDocRequests([]);
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load records. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssessmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssessment) return;
    if (!assessmentText.trim() && !assessmentFileLink.trim()) {
      setError('Please provide written submission notes or a valid repository/file link.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await submitAssessment(activeAssessment.id, {
      submission_text: assessmentText.trim(),
      file_url: assessmentFileLink.trim(),
      file_name: assessmentFileLink.split('/').pop() || 'Assessment_Submission'
    });

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to submit assessment response.');
    } else {
      setActiveAssessment(null);
      setAssessmentText('');
      setAssessmentFileLink('');
      await loadData();
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDocRequest) return;
    if (!uploadedDocFile) {
      setError('Please select a PDF or Word document.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await submitRequestedDocument(activeDocRequest.id, uploadedDocFile);

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || 'Failed to upload document.');
    } else {
      setActiveDocRequest(null);
      setUploadedDocFile(null);
      await loadData();
    }
  };

  if (loadError) return <main className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-xl font-semibold">Unable to load records</h1>
    <p role="alert" className="mt-3 text-sm text-red-700">{loadError}</p>
    <button type="button" className="min-h-11 mt-4 px-4 rounded-lg border" onClick={() => void loadData()}>Retry</button>
  </main>;
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="space-y-4 animate-pulse">
          <div className="h-40 bg-white rounded-2xl border border-slate-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            Qualification Actions
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Assessments & Document Requests
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Technical assignments, system audits, and verified credential requests issued by Synesis recruitment.
          </p>
        </div>

        {/* Section 1: Candidate Assessments */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#085587]" />
            Technical & Practical Assessments
          </h2>

          {assessments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No pending technical assessments assigned to your profile.
            </div>
          ) : (
            <div className="space-y-4">
              {assessments.map((asm) => {
                const isPending = asm.status === 'pending';
                const isSubmitted = asm.status === 'submitted';
                const isReviewed = asm.status === 'reviewed';

                return (
                  <div
                    key={asm.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase">
                          {asm.job_title}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{asm.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{asm.description}</p>
                      </div>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border self-start ${
                          isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isReviewed ? 'Review Complete' : isSubmitted ? 'Submitted for Review' : 'Submission Pending'}
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
                      <div className="flex items-center gap-4 text-slate-600 font-medium pb-2 border-b border-slate-200/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Due: {new Date(asm.due_date).toLocaleDateString()}
                        </span>
                        {asm.time_estimate && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Estimated Time: {asm.time_estimate}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 pt-1 leading-relaxed">
                        <strong className="text-slate-900">Brief:</strong> {asm.instructions}
                      </p>
                    </div>

                    {(isSubmitted || isReviewed) && asm.candidate_response && (
                      <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-emerald-900 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {isReviewed ? 'Your submission was reviewed on ' : 'Your submission was received on '}
                          {new Date((isReviewed ? asm.reviewed_at : asm.candidate_response.submitted_at) || asm.candidate_response.submitted_at).toLocaleDateString()}
                        </p>
                        {isReviewed && <p className="text-slate-700">Recruitment has completed its review.</p>}
                        {asm.candidate_response.submission_text && (
                          <p className="text-slate-700 italic">
                            "{asm.candidate_response.submission_text}"
                          </p>
                        )}
                        {asm.candidate_response.file_url && (
                          <a
                            href={asm.candidate_response.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#085587] font-semibold hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            View Submission Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {isPending && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAssessment(asm);
                            setError(null);
                          }}
                          className="py-2 px-4 bg-[#085587] hover:bg-[#074771] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit Assessment Work
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Document Verification Requests */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-700" />
            Requested Verification Documents
          </h2>

          {docRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No outstanding document requests from HR.
            </div>
          ) : (
            <div className="space-y-4">
              {docRequests.map((doc) => {
                const isPending = doc.status === 'pending';
                const isSubmitted = doc.status === 'submitted';

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <span className="text-[11px] text-slate-500 font-semibold uppercase">
                          {doc.document_type}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">{doc.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{doc.instructions}</p>
                      </div>

                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-lg border self-start ${
                          isSubmitted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isSubmitted ? 'Document Uploaded' : 'Upload Required'}
                      </span>
                    </div>

                    {isSubmitted ? (
                      <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>
                            File submitted: <strong>{doc.submitted_file_name}</strong>
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">Under verification</span>
                      </div>
                    ) : (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDocRequest(doc);
                            setError(null);
                          }}
                          className="py-2 px-4 bg-[#085587] hover:bg-[#074771] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Document File
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Submit Assessment */}
        {activeAssessment && (
          <div role="dialog" aria-modal="true" aria-labelledby="assessment-submission-heading" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 id="assessment-submission-heading" className="text-base font-bold text-slate-900">
                Submit Assessment: {activeAssessment.title}
              </h3>
              <p className="text-xs text-slate-600">{activeAssessment.instructions}</p>

              {error && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleAssessmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Repository or Document Link (GitHub / Google Drive / Figma)
                  </label>
                  <input
                    type="url"
                    value={assessmentFileLink}
                    onChange={(e) => setAssessmentFileLink(e.target.value)}
                    placeholder="https://github.com/your-username/assessment-solution"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Candidate Execution Notes & Summary
                  </label>
                  <textarea
                    rows={4}
                    value={assessmentText}
                    onChange={(e) => setAssessmentText(e.target.value)}
                    placeholder="Provide architecture choices, instructions for running the code, and trade-offs considered..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveAssessment(null)}
                    className="py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="py-2 px-4 bg-[#085587] hover:bg-[#074771] text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Submit to Synesis Committee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Upload Document */}
        {activeDocRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="text-base font-bold text-slate-900">
                Upload: {activeDocRequest.title}
              </h3>
              <p className="text-xs text-slate-600">{activeDocRequest.instructions}</p>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleDocSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center">
                  <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800">
                    {uploadedDocName || 'Select File to Upload'}
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3">PDF, DOC or DOCX up to 10 MB</p>
                  <label className="inline-block py-1.5 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                    <p>Choose Local File</p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      aria-label="Choose a requested document"
                      className="sr-only"
                      onChange={(e) => setUploadedDocFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveDocRequest(null)}
                    className="py-2 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !uploadedDocName}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submitting ? 'Uploading...' : 'Confirm & Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
