import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {adaptLiveRecruitmentContext, adaptLiveOffer,adaptLiveInterview} from '../src/lib/recruitmentAdapters';

test('candidate offer maps SQL-issued terms to the existing actionable UI model',()=>{
 const offer=adaptLiveOffer({
  id:'offer-1', application_id:'app-1', job_title:'Engineer', department_name:'Development',
  status:'issued', salary_amount:180000,salary_currency:'BDT',pay_period:'Monthly',
  proposed_joining_date:'2026-11-15',response_deadline:'2026-10-25',
  terms:'Signed offer terms',issued_at:'2026-10-10T07:00:00Z'
 });
 expect(offer.status).toBe('extended');
 expect(offer.salary).toBe(180000);
 expect(offer.currency).toBe('BDT');
 expect(offer.salary_period).toBe('monthly');
 expect(offer.start_date).toBe('2026-11-15');
 expect(offer.expiry_date).toBe('2026-10-25');
 expect(offer.benefits_summary).toEqual([]);
 expect(offer.candidate_signature).toBeUndefined();
});

test('candidate interview respects SQL response and does not invent in-person venue',()=>{
 const invited=adaptLiveInterview({
  id:'int-1',status:'scheduled',candidate_response:'invited',interview_type:'Technical interview',
  scheduled_at:'2026-10-20T10:00:00Z',panel_members:['Hiring Manager']
 });
 expect(invited.status).toBe('pending');
 expect(invited.format).toBe('To be confirmed');
 expect(invited.meeting_link).toBeUndefined();
 expect(invited.interviewers).toEqual(['Hiring Manager']);
 const accepted=adaptLiveInterview({status:'scheduled',candidate_response:'confirmed',interview_type:'Video Call',location_or_link:'https://meet.example/safe'});
 expect(accepted.status).toBe('accepted');
 expect(accepted.format).toBe('Video Call');
 expect(accepted.meeting_link).toBe('https://meet.example/safe');
 expect(adaptLiveInterview({status:'cancelled',candidate_response:'invited'}).status).toBe('cancelled');
});

test('candidate context preserves server identities and maps document states',()=>{
 const dto=adaptLiveRecruitmentContext({
   applications:[{id:'app-1',stage:'screening'}],
   offers:[{id:'offer-1',status:'issued',salary_amount:10}],
   interviews:[{id:'interview-1',status:'scheduled',candidate_response:'confirmed'}],
   document_requests:[{id:'req-1',status:'submitted',submitted_file_name:'degree.pdf'}]
 });
 expect(dto.applications[0].id).toBe('app-1');
 expect(dto.offers[0].status).toBe('extended');
 expect(dto.interviews[0].status).toBe('accepted');
 expect(dto.document_requests[0].submitted_file_name).toBe('degree.pdf');
});

test('all three production Candidate RPC calls match live argument names',()=>{
 const api=readFileSync('src/lib/api.ts','utf8');
 const tasks=readFileSync('src/pages/TasksPage.tsx','utf8');
 const interviews=readFileSync('src/pages/InterviewsPage.tsx','utf8');
 for(const name of ['p_offer_id','p_response','p_note','p_signature',
  'p_interview_id','p_reason','p_proposed_times','p_request_id','p_file_name','p_file_path']){
    expect(api).toContain(name+':');
  }
 expect(api).not.toContain('p_notes:');
 expect(api).toContain("storage.from('candidate-documents')");
 expect(api).toContain("supabase.auth.getUser()");
 expect(api).toContain('if (!DEMO_MODE) {');
 expect(tasks).not.toContain('https://synesis-candidate-storage/doc-');
 expect(tasks).not.toContain('URL.createObjectURL');
 expect(tasks).toContain('uploadedDocFile');
 expect(interviews).toContain('proposedAvailability');
});
