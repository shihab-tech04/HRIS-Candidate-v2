import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {PublishedJob} from '../types';
import {getPublishedJobById,listVerifiedSavedJobIds,toggleVerifiedSavedJob} from '../lib/api';
type Props={jobId:string;onBack:()=>void;onApply:(id:string)=>void;onOpenAuth:(reason?:string)=>void;publicOnly?:boolean};
export default function VerifiedJobDetails({jobId,onBack,onApply,onOpenAuth,publicOnly=false}:Props){
 const {user}=useAuth();
 const [job,setJob]=useState<PublishedJob|null>(null);
 const [saved,setSaved]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let alive=true;
  void (async()=>{
   try{
    const x=await getPublishedJobById(jobId);
    if(!alive)return;
    setJob(x);
    if(user&&!publicOnly&&x){const ids=await listVerifiedSavedJobIds(user.id);if(alive)setSaved(ids.includes(x.id));}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Could not load job.');}
  })();
  return()=>{alive=false;};
 },[jobId,user?.id]);
 async function toggle(){
  if(!job)return;
  if(publicOnly||!user){onOpenAuth('Saved jobs are not available during the public preview.');return;}
  setBusy(true);setError('');
  try{setSaved(await toggleVerifiedSavedJob(user.id,job.id,job));}
  catch(e){setError(e instanceof Error?e.message:'Could not save job.');}
  finally{setBusy(false);}
 }
 const btn='rounded-lg px-4 py-2.5 text-sm font-semibold border focus-visible:outline-[#085587]';
 return <main className="min-h-screen bg-slate-50 px-4 py-8">
  <article className="max-w-4xl mx-auto bg-white border rounded-xl p-6 space-y-5">
   <button onClick={onBack} className={btn}>Back to jobs</button>
   {error&&<p role="alert" className="p-3 bg-rose-50 text-rose-700 text-sm">{error}</p>}
   {!job?<p className="text-sm text-slate-500">Vacancy not available or cannot be verified.</p>:<>
    <h1 className="text-2xl font-bold">{job.title}</h1>
    <p className="text-sm">{job.department} · {job.location} · {job.employment_type}</p>
    <p className="text-sm">Application deadline: {job.application_deadline}</p>
    {job.salary_is_public&&job.published_salary_min!=null&&<p className="text-sm">
      Published salary: {job.salary_currency||'BDT'} {job.published_salary_min.toLocaleString()}
      {job.published_salary_max!=null?' – '+job.published_salary_max.toLocaleString():''}</p>}
    <p className="text-sm whitespace-pre-line">{job.summary}</p>
    {([['Responsibilities',job.responsibilities],['Requirements',job.requirements],
      ['Benefits',job.benefits||[]]] as [string,string[]][]).map(([label,rows])=>
       <section key={label}><h2 className="font-semibold">{label}</h2>
        {rows.length?<ul className="list-disc ml-6 text-sm space-y-1">
         {rows.map((v,i)=><li key={i}>{v}</li>)}</ul>:<p className="text-sm text-slate-500">Refer to circular.</p>}
       </section>)}
    <div className="flex gap-3 flex-wrap border-t pt-4">
      <button onClick={()=>onApply(job.id)} className={btn+' bg-[#085587] text-white'}>Apply</button>
      <button disabled={busy} onClick={()=>void toggle()} className={btn}>
       {saved?'Remove saved job':'Save job'}</button>
    </div>
   </>}
  </article>
 </main>;
}
