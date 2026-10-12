import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { OnboardingHandoff, JobOffer } from '../types';
import { getRecruitmentContext, updateOnboardingHandoff } from '../lib/api';
import {
  UserCheck,
  ShieldCheck,
  FileText,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Save,
  Lock,
  Info
} from 'lucide-react';

interface PreboardingPageProps {
  onNavigate: (tab: string) => void;
}

export const PreboardingPage: React.FC<PreboardingPageProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [handoff, setHandoff] = useState<OnboardingHandoff | null>(null);
  const [activeOffer, setActiveOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stepper: 1: Legal Identity, 2: Emergency Contact, 3: Banking & Tax, 4: Policy Acknowledgment
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form Fields
  const [formData, setFormData] = useState({
    national_id: '',
    passport_number: '',
    date_of_birth: '',
    nationality: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    bank_name: '',
    bank_account_number: '',
    tax_identification_number: '',
    policies_accepted: false
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) { setActiveOffer(null); setHandoff(null); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      const acceptedOffer = ctx.offers?.find((o: any) => o.status === 'accepted') || null; setActiveOffer(acceptedOffer); if (ctx.onboarding) { setHandoff(ctx.onboarding); if (ctx.onboarding.personal_data) setFormData(prev => ({ ...prev, ...ctx.onboarding.personal_data })); } else setHandoff(null);
    } catch (cause) {
      setActiveOffer(null); setHandoff(null);
      setLoadError(cause instanceof Error ? cause.message : 'Unable to load records. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStep = async (stepKey: string) => {
    if (!handoff) return;
    setSaving(true);
    setError(null);

    const res = await updateOnboardingHandoff(handoff.id, stepKey, formData);
    setSaving(false);

    if (!res.success) {
      setError(res.error || 'Failed to update preboarding information.');
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      if (res.handoff) setHandoff(res.handoff);
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
        <div className="h-60 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
      </div>
    );
  }

  const isSubmittedToHr =
    handoff?.status === 'submitted_for_verification' ||
    handoff?.status === 'verified_by_hr' ||
    handoff?.status === 'joining_confirmed';

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            Post-Offer Transition
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Preboarding & Employee Transition
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single-identity candidate-to-employee onboarding pipeline connected to Synesis HRIS Main.
          </p>
        </div>

        {/* Integration Contract Architecture Callout */}
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#085587]">
            <Info className="w-4 h-4" />
            <span>Architecture Contract: Single Identity Preservation</span>
          </div>
          <p className="leading-relaxed text-slate-700">
            <strong>Preserving Identity:</strong> Candidate maintains the <strong>same Supabase Auth user ID ({user?.id})</strong> during the transition from candidate to permanent employee. No second login is created. Recruitment history, submitted CVs, and signed contracts remain permanently linked.
          </p>
          <p className="leading-relaxed text-slate-600">
            <strong>Access Authority:</strong> Synesis HR administrators in Main HRIS control final employee activation and role provisioning. The Candidate Platform never self-grants HR or administrative privileges.
          </p>
        </div>

        {/* Overall Progress Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Target Role</p>
              <h2 className="text-lg font-bold text-slate-900">
                {activeOffer?.job_title || 'Position pending HR confirmation'}
              </h2>
              <p className="text-xs text-slate-500">
                Proposed Start Date: <strong>{activeOffer?.start_date || 'Not yet confirmed'}</strong>
              </p>
            </div>

            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border self-start sm:self-auto ${
                handoff?.status === 'joining_confirmed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : isSubmittedToHr
                  ? 'bg-sky-50 text-[#085587] border-sky-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {handoff?.status === 'joining_confirmed'
                ? 'Joining Confirmed · Ready for Employee Activation'
                : isSubmittedToHr
                ? 'Submitted to HR · Under Credential Verification'
                : 'Pending Candidate Preboarding Details'}
            </span>
          </div>

          {/* Stepper tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {[
              { num: 1, key: 'step_identity', label: '1. National ID & Passport' },
              { num: 2, key: 'step_emergency', label: '2. Emergency Contact' },
              { num: 3, key: 'step_payroll', label: '3. Banking & Tax Info' },
              { num: 4, key: 'step_policies', label: '4. Policies & Security' }
            ].map((s) => {
              const isCompleted = handoff?.completed_steps.includes(s.key);
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setActiveStep(s.num)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    activeStep === s.num
                      ? 'border-[#085587] bg-sky-50/50 ring-1 ring-[#085587]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 truncate">{s.label}</span>
                    {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Form Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Preboarding step successfully saved & synced to HRMIS handoff record.</span>
            </div>
          )}

          {/* Step 1: Legal Identity */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Legal Identity & Address Verification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    National ID (NID) Number *
                  </label>
                  <input
                    type="text"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder="e.g. 19951234567890"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Passport Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.passport_number}
                    onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                    placeholder="e.g. A01234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nationality *</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Permanent Residential Address *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep('step_identity')}
                  disabled={saving}
                  className="py-2 px-5 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Identity Details'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Emergency Contact */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Emergency Contact Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Emergency Contact Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.emergency_contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_name: e.target.value })
                    }
                    placeholder="e.g. Nasreen Rahman"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Emergency Contact Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_phone: e.target.value })
                    }
                    placeholder="+880 17..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Relationship *</label>
                  <select
                    value={formData.emergency_contact_relation}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_relation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep('step_emergency')}
                  disabled={saving}
                  className="py-2 px-5 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Emergency Contact'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Banking & Tax */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Payroll Banking & Tax Identification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Designated Bank PLC *
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bank Account Number *
                  </label>
                  <input
                    type="text"
                    value={formData.bank_account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_number: e.target.value })
                    }
                    placeholder="e.g. 115.120.000000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Taxpayer Identification Number (e-TIN) *
                  </label>
                  <input
                    type="text"
                    value={formData.tax_identification_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_identification_number: e.target.value })
                    }
                    placeholder="12-digit e-TIN number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep('step_payroll')}
                  disabled={saving}
                  className="py-2 px-5 bg-[#085587] text-white text-xs font-semibold rounded-lg hover:bg-[#074771] transition-colors shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Payroll Details'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Policy Acknowledgment */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                Synesis IT Corporate Governance & Information Security Policies
              </h3>
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  As an incoming team member, you are required to review and adhere to the following policies upon joining:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Synesis IT Code of Conduct and Workplace Ethics standard.</li>
                  <li>Information Security Management System (ISO 27001) Guidelines & Data Protection.</li>
                  <li>Intellectual Property Assignment and Non-Disclosure Agreement (NDA).</li>
                </ul>
              </div>

              <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.policies_accepted}
                  onChange={(e) =>
                    setFormData({ ...formData, policies_accepted: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 text-[#085587] rounded border-slate-300 focus:ring-[#085587]"
                />
                <span className="text-xs text-slate-800 leading-relaxed font-semibold">
                  I acknowledge that I have read and agree to comply with the Synesis IT Corporate Policies and Information Security standards.
                </span>
              </label>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep('step_policies')}
                  disabled={saving || !formData.policies_accepted}
                  className="py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-40"
                >
                  {saving ? 'Submitting to HR...' : 'Complete & Submit Preboarding Packet'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
