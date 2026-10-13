import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CandidateProfile, CandidateExperience, CandidateEducation } from '../types';
import { updateCandidateProfile } from '../lib/api';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Sparkles,
  Link as LinkIcon,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock
} from 'lucide-react';

interface ProfilePageProps {
  onNavigate: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, profile, refreshProfile, loading: authLoading, profileLoading, profileError } = useAuth();
  const [formData, setFormData] = useState<Partial<CandidateProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New experience / education input state
  const [newSkill, setNewSkill] = useState('');
  const [newCert, setNewCert] = useState('');

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      await updateCandidateProfile(user.id, formData);
      await refreshProfile();
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaving(false);
      setError(err?.message || 'Failed to save profile changes.');
    }
  };

  const addExperience = () => {
    const exps = [...(formData.experiences || [])];
    exps.unshift({
      id: 'exp-' + Date.now(),
      title: 'Senior Software Engineer',
      company: 'Tech Enterprise Ltd.',
      start_date: '2023-01',
      current: true,
      description: 'Architecting high-scale frontend systems and scalable backend microservices.'
    });
    setFormData({ ...formData, experiences: exps });
  };

  const removeExperience = (id: string) => {
    setFormData({
      ...formData,
      experiences: (formData.experiences || []).filter((e) => e.id !== id)
    });
  };

  const updateExperience = (id: string, updates: Partial<CandidateExperience>) => {
    setFormData({
      ...formData,
      experiences: (formData.experiences || []).map((e) => (e.id === id ? { ...e, ...updates } : e))
    });
  };

  const addEducation = () => {
    const edus = [...(formData.educations || [])];
    edus.unshift({
      id: 'edu-' + Date.now(),
      institution: 'University of Engineering and Technology',
      degree: 'B.Sc. in Computer Science',
      field_of_study: 'Computer Science',
      start_year: '2016',
      end_year: '2020'
    });
    setFormData({ ...formData, educations: edus });
  };

  const removeEducation = (id: string) => {
    setFormData({
      ...formData,
      educations: (formData.educations || []).filter((e) => e.id !== id)
    });
  };

  const updateEducation = (id: string, updates: Partial<CandidateEducation>) => {
    setFormData({
      ...formData,
      educations: (formData.educations || []).map((e) => (e.id === id ? { ...e, ...updates } : e))
    });
  };

  const addSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    const skills = Array.from(new Set([...(formData.skills || []), newSkill.trim()]));
    setFormData({ ...formData, skills });
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      skills: (formData.skills || []).filter((s) => s !== skill)
    });
  };

  const addCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCert.trim()) return;
    const certifications = Array.from(new Set([...(formData.certifications || []), newCert.trim()]));
    setFormData({ ...formData, certifications });
    setNewCert('');
  };

  const removeCert = (cert: string) => {
    setFormData({
      ...formData,
      certifications: (formData.certifications || []).filter((c) => c !== cert)
    });
  };

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12" aria-busy="true" aria-live="polite">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-sm text-slate-600">
          Loading your HRMIS profile…
        </div>
      </main>
    );
  }

  if (!user || !profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-200 bg-white p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-slate-900">Unable to load your candidate profile</h1>
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {profileError || 'Sign in with an active candidate account to view your profile.'}
          </p>
          {user && (
            <button
              type="button"
              className="min-h-11 mt-4 rounded-lg border border-slate-300 px-4 font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => void refreshProfile()}
            >
              Retry
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#085587]">
              Candidate Profile
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Reusable Candidate Profile
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Information saved here automatically pre-fills your applications across Synesis Careers.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="py-2.5 px-6 bg-[#085587] text-white text-xs font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-xs flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div role="status" aria-live="polite" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile successfully updated in Synesis HRMIS.</span>
          </div>
        )}

        {/* Form sections */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              Personal & Contact Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="candidate-full-name" className="block font-semibold text-slate-700 mb-1">Full Legal Name *</label>
                <input
                  id="candidate-full-name"
                  type="text"
                  required
                  value={formData.full_name || ''}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div>
                <label htmlFor="candidate-email" className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  id="candidate-email"
                  type="email"
                  disabled
                  value={formData.email || user?.email || ''}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="candidate-phone" className="block font-semibold text-slate-700 mb-1">Mobile Phone *</label>
                <input
                  id="candidate-phone"
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+880 1711..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div>
                <label htmlFor="candidate-location" className="block font-semibold text-slate-700 mb-1">Current Location *</label>
                <input
                  id="candidate-location"
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Dhaka, Bangladesh"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="candidate-headline" className="block font-semibold text-slate-700 mb-1">
                  Professional Headline *
                </label>
                <input
                  id="candidate-headline"
                  type="text"
                  value={formData.headline || ''}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  placeholder="e.g. Senior Full-Stack Engineer | React & Cloud Architect"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="candidate-summary" className="block font-semibold text-slate-700 mb-1">
                  Professional Bio & Executive Summary
                </label>
                <textarea
                  id="candidate-summary"
                  rows={3}
                  value={formData.summary || ''}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Brief narrative of your engineering focus, achievements, and technical philosophy..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Work Experience */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Work Experience
              </h2>
              <button
                type="button"
                onClick={addExperience}
                className="text-xs font-semibold text-[#085587] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Role
              </button>
            </div>

            {(!formData.experiences || formData.experiences.length === 0) ? (
              <p className="text-xs text-slate-500 py-3">No work experiences added yet.</p>
            ) : (
              <div className="space-y-4">
                {formData.experiences.map((exp) => (
                  <div key={exp.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Experience Record</span>
                      <button
                        type="button"
                        onClick={() => removeExperience(exp.id)}
                        aria-label={`Remove experience ${exp.title || ''}`.trim()}
                        className="text-rose-600 hover:text-rose-700 p-1"
                        title="Remove experience"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label htmlFor={`experience-title-${exp.id}`} className="block text-slate-600 font-medium mb-1">Job Title</label>
                        <input
                          id={`experience-title-${exp.id}`}
                          type="text"
                          value={exp.title}
                          onChange={(e) => updateExperience(exp.id, { title: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor={`experience-company-${exp.id}`} className="block text-slate-600 font-medium mb-1">Company / Organization</label>
                        <input
                          id={`experience-company-${exp.id}`}
                          type="text"
                          value={exp.company}
                          onChange={(e) => updateExperience(exp.id, { company: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor={`experience-start-${exp.id}`} className="block text-slate-600 font-medium mb-1">Start Date</label>
                        <input
                          id={`experience-start-${exp.id}`}
                          type="text"
                          value={exp.start_date}
                          onChange={(e) => updateExperience(exp.id, { start_date: e.target.value })}
                          placeholder="YYYY-MM"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor={`experience-end-${exp.id}`} className="block text-slate-600 font-medium mb-1">End Date</label>
                        <input
                          id={`experience-end-${exp.id}`}
                          type="text"
                          disabled={exp.current}
                          value={exp.current ? 'Present' : exp.end_date || ''}
                          onChange={(e) => updateExperience(exp.id, { end_date: e.target.value })}
                          placeholder="YYYY-MM"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`experience-description-${exp.id}`} className="block text-slate-600 font-medium mb-1">Key Responsibilities & Tech Stack</label>
                        <textarea
                          id={`experience-description-${exp.id}`}
                          rows={2}
                          value={exp.description}
                          onChange={(e) => updateExperience(exp.id, { description: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Education */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                Education & Qualifications
              </h2>
              <button
                type="button"
                onClick={addEducation}
                className="text-xs font-semibold text-[#085587] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Degree
              </button>
            </div>

            {(!formData.educations || formData.educations.length === 0) ? (
              <p className="text-xs text-slate-500 py-3">No education entries added yet.</p>
            ) : (
              <div className="space-y-4">
                {formData.educations.map((edu) => (
                  <div key={edu.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Academic Entry</span>
                      <button
                        type="button"
                        onClick={() => removeEducation(edu.id)}
                        aria-label={`Remove education ${edu.institution || ''}`.trim()}
                        className="text-rose-600 hover:text-rose-700 p-1"
                        title="Remove education"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label htmlFor={`education-institution-${edu.id}`} className="block text-slate-600 font-medium mb-1">Institution</label>
                        <input
                          id={`education-institution-${edu.id}`}
                          type="text"
                          value={edu.institution}
                          onChange={(e) => updateEducation(edu.id, { institution: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor={`education-degree-${edu.id}`} className="block text-slate-600 font-medium mb-1">Degree</label>
                        <input
                          id={`education-degree-${edu.id}`}
                          type="text"
                          value={edu.degree}
                          onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label htmlFor={`education-field-${edu.id}`} className="block text-slate-600 font-medium mb-1">Field of Study</label>
                        <input
                          id={`education-field-${edu.id}`}
                          type="text"
                          value={edu.field_of_study}
                          onChange={(e) => updateEducation(edu.id, { field_of_study: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">Years (Start - End)</label>
                        <div className="flex gap-2">
                          <input
                            aria-label={`Start year for ${edu.institution || 'education'}`}
                            type="text"
                            placeholder="Start"
                            value={edu.start_year}
                            onChange={(e) => updateEducation(edu.id, { start_year: e.target.value })}
                            className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                          />
                          <input
                            aria-label={`End year for ${edu.institution || 'education'}`}
                            type="text"
                            placeholder="End"
                            value={edu.end_year || ''}
                            onChange={(e) => updateEducation(edu.id, { end_year: e.target.value })}
                            className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Skills & Certifications */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 mb-3">
                Core Competencies & Skills
              </h2>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(formData.skills || []).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 py-1 px-3 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      aria-label={`Remove skill ${skill}`}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <input
                  aria-label="Add a skill"
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="e.g. Kubernetes, PostgreSQL, Figma"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
                >
                  Add Skill
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2 mb-3">
                Certifications & Accreditations
              </h2>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {(formData.certifications || []).map((cert) => (
                  <span
                    key={cert}
                    className="inline-flex items-center gap-1.5 py-1 px-3 bg-sky-50 text-[#085587] border border-sky-100 rounded-lg text-xs font-medium"
                  >
                    {cert}
                    <button
                      type="button"
                      onClick={() => removeCert(cert)}
                      aria-label={`Remove certification ${cert}`}
                      className="text-sky-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <input
                  aria-label="Add a certification"
                  type="text"
                  value={newCert}
                  onChange={(e) => setNewCert(e.target.value)}
                  placeholder="e.g. AWS Solutions Architect"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
                <button
                  type="button"
                  onClick={addCert}
                  className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
                >
                  Add Certification
                </button>
              </div>
            </div>
          </div>

          {/* Section 5: Professional Links */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              Professional Links
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label htmlFor="candidate-linkedin" className="block font-semibold text-slate-700 mb-1">LinkedIn Profile</label>
                <input
                  id="candidate-linkedin"
                  type="url"
                  value={formData.linkedin_url || ''}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div>
                <label htmlFor="candidate-github" className="block font-semibold text-slate-700 mb-1">GitHub Profile</label>
                <input
                  id="candidate-github"
                  type="url"
                  value={formData.github_url || ''}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                  placeholder="https://github.com/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>

              <div>
                <label htmlFor="candidate-portfolio" className="block font-semibold text-slate-700 mb-1">Portfolio Website</label>
                <input
                  id="candidate-portfolio"
                  type="url"
                  value={formData.portfolio_url || ''}
                  onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                  placeholder="https://yoursite.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#085587]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-8 bg-[#085587] text-white text-xs font-semibold rounded-xl hover:bg-[#074771] transition-colors shadow-xs flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Profile to HRMIS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
