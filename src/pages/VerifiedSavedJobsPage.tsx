import React,{useEffect,useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {PublishedJob} from '../types';
import {getPublishedJobs,listVerifiedSavedJobIds,toggleVerifiedSavedJob} from '../lib/api';

interface Props {onSelectJob:(id:string)=>void;onApplyJob:(id:string)=>void;onOpenAuth:()=>void;}
export default function VerifiedSavedJobsPage({onSelectJob,onApplyJob,onOpenAuth}:Props){
  const {user}=useAuth();
  const [jobs,setJobs]=useState<PublishedJob[]>([]);
  const [unavailable,setUnavailable]=useState<string[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{
    if(!user){setLoading(false);return;}
    setLoading(true);setError('');
    try{
      const [ids,published]=await Promise.all([listVerifiedSavedJobIds(user.id),getPublishedJobs()]);
      setJobs(published.filter(job=>ids.includes(job.id)));
      setUnavailable(ids.filter(id=>!published.some(job=>job.id===id)));
    }catch(e){setError(e instanceof Error?e.message:'Saved jobs unavailable.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[user?.id]);
  async function remove(id:string){
    if(!user)return;
    try{await toggleVerifiedSavedJob(user.id,id);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Unable to remove saved job.');}
  }
  const action='border rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-[#085587]';
  if(!user)return <main className="max-w-4xl mx-auto p-8 space-y-3">
    <h1 className="text-2xl font-bold">Saved jobs</h1>
    <p className="text-sm">Please sign in to view saved vacancies.</p>
    <button className={action} onClick={onOpenAuth}>Sign in</button></main>;
  return <main className="min-h-screen bg-slate-50 p-5 md:p-8">
    <div className="max-w-5xl mx-auto space-y-4">
      <div><h1 className="text-2xl font-bold">My saved jobs</h1>
      <p className="text-sm text-slate-600">Saved to your candidate account and synchronized across devices.</p></div>
      {error&&<p role="alert" className="bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 rounded-lg">{error}</p>}
      {loading&&<p role="status">Loading saved jobs…</p>}
      {!loading&&jobs.length===0&&unavailable.length===0&&<p className="text-sm text-slate-500">No saved jobs yet.</p>}
      {jobs.map(job=><article className="bg-white rounded-xl border p-5 space-y-3" key={job.id}>
        <h2 className="font-semibold text-lg">{job.title}</h2>
        <p className="text-sm text-slate-600">{job.department} · {job.location} · Apply by {job.application_deadline}</p>
        <div className="flex flex-wrap gap-2">
          <button className={action+' bg-[#085587] text-white'} onClick={()=>onApplyJob(job.id)}>Apply</button>
          <button className={action} onClick={()=>onSelectJob(job.id)}>Details</button>
          <button className={action} onClick={()=>void remove(job.id)}>Remove</button>
        </div>
      </article>)}
      {unavailable.map(id=><article className="bg-white rounded-xl border p-5 flex flex-wrap items-center justify-between gap-3" key={id}>
        <p className="text-sm">This saved vacancy is no longer published.</p>
        <button className={action} onClick={()=>void remove(id)}>Remove from saved jobs</button>
      </article>)}
    </div>
  </main>;
}
