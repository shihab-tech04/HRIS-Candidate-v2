import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCandidateLocale } from '../context/CandidateLocaleContext';
import { OnboardingHandoff, JobOffer } from '../types';
import { getMyPreboardingHandoff, getRecruitmentContext, updateOnboardingHandoff } from '../lib/api';
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

const EMPTY_PREBOARDING_FORM = {
  national_id: '', passport_number: '', date_of_birth: '', nationality: '', address: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
  bank_name: '', bank_account_number: '', tax_identification_number: '', policies_accepted: false,
};

export const PreboardingPage: React.FC<PreboardingPageProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const { locale, t } = useCandidateLocale();
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const [handoff, setHandoff] = useState<OnboardingHandoff | null>(null);
  const [activeOffer, setActiveOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  // Stepper: 1: Legal Identity, 2: Emergency Contact, 3: Banking & Tax, 4: Policy Acknowledgment
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form Fields
  const [formData, setFormData] = useState(EMPTY_PREBOARDING_FORM);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<{ key: string; values?: Record<string, string> } | null>(null);

  const errorCopy = (cause: unknown, fallback: string) => {
    const message = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
    const requiredFields = message.match(/^Complete each required field:\s*(.+)$/i)?.[1];
    return requiredFields ? { key: 'Complete each required field: {fields}', values: { fields: requiredFields } } : { key: fallback };
  };

  const displayDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  useEffect(() => {
    setFormData(EMPTY_PREBOARDING_FORM);
    void loadData();
  }, [user?.id]);

  const loadData = async () => {
    const request = ++loadSequence.current;
    if (!user) { setActiveOffer(null); setHandoff(null); setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const ctx = await getRecruitmentContext(user.id);
      if (request !== loadSequence.current) return;
      const acceptedOffer = ctx.offers?.find((offer: JobOffer) => offer.status === 'accepted') || null;
      setActiveOffer(acceptedOffer);
      const nextHandoff = acceptedOffer ? await getMyPreboardingHandoff(acceptedOffer.application_id) : null;
      if (request !== loadSequence.current) return;
      setHandoff(nextHandoff);
      if (nextHandoff?.candidate_personal_data) {
        setFormData(prev => ({ ...prev, ...nextHandoff.candidate_personal_data }));
      }
    } catch (cause) {
      if (request !== loadSequence.current) return;
      setActiveOffer(null); setHandoff(null);
      setLoadError('Unable to load preboarding information. Please retry.');
    } finally {
      if (request === loadSequence.current) setLoading(false);
    }
  };

  const handleSaveStep = async (stepKey: string) => {
    if (!handoff) return;
    const savingUserId = userIdRef.current;
    setSaving(true);
    setError(null);

    try {
      const res = await updateOnboardingHandoff(handoff.application_id, stepKey, formData);
      if (savingUserId !== userIdRef.current) return;
      if (!res.success) setError(errorCopy(res.error, 'Unable to save preboarding information. Please retry.'));
      else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        if (res.handoff) setHandoff(res.handoff);
      }
    } catch (cause) {
      if (savingUserId !== userIdRef.current) return;
      setError(errorCopy(cause, 'Preboarding changes were not saved. Please retry.'));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <main className="max-w-4xl mx-auto px-4 py-16">
    <h1 className="text-xl font-semibold">{t('Unable to load records')}</h1>
    <p role="alert" className="mt-3 text-sm text-red-700">{t(loadError)}</p>
    <button type="button" className="min-h-11 mt-4 px-4 rounded-lg border" onClick={() => void loadData()}>{t('Retry')}</button>
  </main>;
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-60 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
      </div>
    );
  }

  const isSubmittedToHr = Boolean(handoff?.candidate_submitted_at);
  const packetLocked = isSubmittedToHr || handoff?.status === 'completed' || handoff?.status === 'cancelled';

  if (!activeOffer || !handoff) return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#085587]">{t('Post-Offer Transition')}</span>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('Preboarding is not available yet')}</h1>
        <p className="mt-3 text-sm text-slate-600">{t('An accepted offer is required before you can submit preboarding details. Your existing candidate and application records remain available.')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => onNavigate('offers')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#085587] px-4 text-sm font-semibold text-white">{t('View offers')} <ArrowRight className="h-4 w-4" /></button>
          <button type="button" onClick={() => void loadData()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">{t('Retry')}</button>
        </div>
      </section>
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
            {t('Post-Offer Transition')}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {t('Preboarding & Employee Transition')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('Single-identity candidate-to-employee onboarding pipeline connected to Synesis HRIS Main.')}
          </p>
        </div>

        {/* Integration Contract Architecture Callout */}
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-[#085587]">
            <Info className="w-4 h-4" />
            <span>{t('Architecture Contract: Single Identity Preservation')}</span>
          </div>
          <p className="leading-relaxed text-slate-700">
            <strong>{t('Preserving Identity:')}</strong> {t('Candidate maintains the same Supabase Auth user ID ({userId}) during the transition from candidate to permanent employee. No second login is created. Recruitment history, submitted CVs, and signed contracts remain permanently linked.', { userId: user?.id || '' })}
          </p>
          <p className="leading-relaxed text-slate-600">
            <strong>{t('Access Authority:')}</strong> {t('Synesis HR administrators in Main HRIS control final employee activation and role provisioning. The Candidate Platform never self-grants HR or administrative privileges.')}
          </p>
        </div>

        {/* Overall Progress Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">{t('Target Role')}</p>
              <h2 className="text-lg font-bold text-slate-900">
                {activeOffer?.job_title || t('Position pending HR confirmation')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('Proposed Start Date:')} <strong>{activeOffer?.start_date ? displayDate(activeOffer.start_date) : t('Not yet confirmed')}</strong>
              </p>
            </div>

            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border self-start sm:self-auto ${
                isSubmittedToHr
                  ? 'bg-sky-50 text-[#085587] border-sky-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isSubmittedToHr
                ? t('Submitted to HR · Review Pending')
                : t('Pending Candidate Preboarding Details')}
            </span>
          </div>

          {/* Stepper tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {[
              { num: 1, key: 'step_identity', label: t('1. National ID & Passport') },
              { num: 2, key: 'step_emergency', label: t('2. Emergency Contact') },
              { num: 3, key: 'step_payroll', label: t('3. Banking & Tax Info') },
              { num: 4, key: 'step_policies', label: t('4. Policies & Security') }
            ].map((s) => {
              const isCompleted = handoff?.candidate_completed_steps.includes(s.key);
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
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              {t(error.key, error.values)}
            </div>
          )}

          {saveSuccess && (
            <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{t('Preboarding step successfully saved & synced to HRMIS handoff record.')}</span>
            </div>
          )}

          {isSubmittedToHr && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">{t('Your packet was submitted to HR on {date}. You can review it here; edits are locked while HR processes the handoff.', { date: new Date(handoff.candidate_submitted_at!).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-US') })}</p>}
          <fieldset disabled={packetLocked} className="space-y-6 disabled:opacity-80">
          {/* Step 1: Legal Identity */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                {t('Legal Identity & Address Verification')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="preboarding-national-id" className="block font-semibold text-slate-700 mb-1">
                    {t('National ID (NID) Number *')}
                  </label>
                  <input
                    id="preboarding-national-id"
                    type="text"
                    required
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder={t('e.g. 19951234567890')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-passport-number" className="block font-semibold text-slate-700 mb-1">
                    {t('Passport Number (Optional)')}
                  </label>
                  <input
                    id="preboarding-passport-number"
                    type="text"
                    value={formData.passport_number}
                    onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                    placeholder={t('e.g. A01234567')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-date-of-birth" className="block font-semibold text-slate-700 mb-1">
                    {t('Date of Birth *')}
                  </label>
                  <input
                    id="preboarding-date-of-birth"
                    type="date"
                    required
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-nationality" className="block font-semibold text-slate-700 mb-1">{t('Nationality *')}</label>
                  <input
                    id="preboarding-nationality"
                    type="text"
                    required
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="preboarding-address" className="block font-semibold text-slate-700 mb-1">
                    {t('Permanent Residential Address *')}
                  </label>
                  <input
                    id="preboarding-address"
                    type="text"
                    required
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
                  {saving ? t('Saving...') : t('Save Identity Details')}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Emergency Contact */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                {t('Emergency Contact Information')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="preboarding-emergency-name" className="block font-semibold text-slate-700 mb-1">
                    {t('Emergency Contact Full Name *')}
                  </label>
                  <input
                    id="preboarding-emergency-name"
                    type="text"
                    required
                    value={formData.emergency_contact_name}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_name: e.target.value })
                    }
                    placeholder={t('e.g. Nasreen Rahman')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-emergency-phone" className="block font-semibold text-slate-700 mb-1">
                    {t('Emergency Contact Phone *')}
                  </label>
                  <input
                    id="preboarding-emergency-phone"
                    type="tel"
                    required
                    value={formData.emergency_contact_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_phone: e.target.value })
                    }
                    placeholder={t('+880 17...')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-emergency-relation" className="block font-semibold text-slate-700 mb-1">{t('Relationship *')}</label>
                  <select
                    id="preboarding-emergency-relation"
                    value={formData.emergency_contact_relation}
                    onChange={(e) =>
                      setFormData({ ...formData, emergency_contact_relation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  >
                    <option value="" disabled>{t('Select a relationship')}</option>
                    <option value="Spouse">{t('Spouse')}</option>
                    <option value="Parent">{t('Parent')}</option>
                    <option value="Sibling">{t('Sibling')}</option>
                    <option value="Guardian">{t('Guardian')}</option>
                    <option value="Other">{t('Other')}</option>
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
                  {saving ? t('Saving...') : t('Save Emergency Contact')}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Banking & Tax */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                {t('Payroll Banking & Tax Identification')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label htmlFor="preboarding-bank-name" className="block font-semibold text-slate-700 mb-1">
                    {t('Designated Bank PLC *')}
                  </label>
                  <input
                    id="preboarding-bank-name"
                    type="text"
                    required
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-bank-account" className="block font-semibold text-slate-700 mb-1">
                    {t('Bank Account Number *')}
                  </label>
                  <input
                    id="preboarding-bank-account"
                    type="text"
                    required
                    value={formData.bank_account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_account_number: e.target.value })
                    }
                    placeholder={t('e.g. 115.120.000000')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                  />
                </div>

                <div>
                  <label htmlFor="preboarding-tax-id" className="block font-semibold text-slate-700 mb-1">
                    {t('Taxpayer Identification Number (e-TIN) *')}
                  </label>
                  <input
                    id="preboarding-tax-id"
                    type="text"
                    required
                    value={formData.tax_identification_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_identification_number: e.target.value })
                    }
                    placeholder={t('12-digit e-TIN number')}
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
                  {saving ? t('Saving...') : t('Save Payroll Details')}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Policy Acknowledgment */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                {t('Synesis IT Corporate Governance & Information Security Policies')}
              </h3>
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  {t('As an incoming team member, you are required to review and adhere to the following policies upon joining:')}
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('Synesis IT Code of Conduct and Workplace Ethics standard.')}</li>
                  <li>{t('Information Security Management System (ISO 27001) Guidelines & Data Protection.')}</li>
                  <li>{t('Intellectual Property Assignment and Non-Disclosure Agreement (NDA).')}</li>
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
                  {t('I acknowledge that I have read and agree to comply with the Synesis IT Corporate Policies and Information Security standards.')}
                </span>
              </label>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveStep('step_policies')}
                  disabled={saving || !formData.policies_accepted}
                  className="py-2 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-40"
                >
                  {saving ? t('Submitting to HR...') : t('Complete & Submit Preboarding Packet')}
                </button>
              </div>
            </div>
          )}
          </fieldset>
        </div>
      </div>
    </div>
  );
};
