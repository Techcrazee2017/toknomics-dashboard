import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { keys } from '../lib/data';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('Enter a valid email address');
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } });
    if (error) { setErr(error.message); setState('idle'); } else setState('sent');
  };
  return (
    <div className="tn-auth">
      <form className="card elev-md" onSubmit={e => void submit(e)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-kicker">TokNomics</span><span className="card-title" style={{ fontSize: 22 }}>Sign in to your agency</span></div>
        {state === 'sent' ? <p className="card-body" style={{ margin: 0 }}>Check {email.trim()} for a sign-in link. You can close this tab.</p> : <>
          <Field label="Work email" error={err}><input className="input" type="email" autoComplete="email" autoFocus value={email} onChange={e => { setEmail(e.target.value); setErr(''); }} placeholder="you@agency.com" /></Field>
          <button className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => void supabase.auth.signInWithOtp({ email: 'kai@northlight.agency' })}>
            Enter demo workspace (Northlight Agency)
          </button>
        </>}
      </form>
    </div>
  );
}

export function CreateAgency() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr('Enter your agency name');
    setBusy(true);
    try { await api.createAgency(name.trim()); await qc.invalidateQueries({ queryKey: keys.memberships }); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="tn-auth">
      <form className="card elev-md" onSubmit={e => void submit(e)} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span className="card-kicker">Welcome</span><span className="card-title" style={{ fontSize: 22 }}>Create your agency workspace</span></div>
        <p className="card-body" style={{ margin: 0 }}>You'll be its Founder. Invited teammates join from their email instead.</p>
        <Field label="Agency name" error={err}><input className="input" autoFocus value={name} maxLength={80} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="Northlight Agency" /></Field>
        <div className="tn-between">
          <button type="button" className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>Sign out</button>
          <button className="btn btn-primary" disabled={busy}>Create workspace</button>
        </div>
      </form>
    </div>
  );
}
