import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './lib/api';
import { AgencyProvider } from './lib/agency';
import { useAgencyRealtime, useMemberships } from './lib/data';
import { configError, supabase } from './lib/supabase';
import { Shell } from './components/Shell';
import { CreateAgency, SignIn } from './screens/Auth';
import { Billing } from './screens/Billing';
import { CreatorDrawerProvider } from './screens/CreatorDrawer';
import { DataSource } from './screens/DataSource';
import { Ledger } from './screens/Ledger';
import { LiveTargets } from './screens/LiveTargets';
import { Overview } from './screens/Overview';
import { Rankings } from './screens/Rankings';
import { Roster } from './screens/Roster';
import { Team } from './screens/Team';

const AGENCY_KEY = 'tn.agency';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const qc = useQueryClient();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); if (!s) qc.clear(); });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  if (configError) return <div className="tn-auth"><div className="card"><span className="card-title">Configuration needed</span><p className="card-body">{configError}</p></div></div>;
  if (session === undefined) return null;
  if (!session) return <SignIn />;
  return <Workspace session={session} />;
}

function Workspace({ session }: { session: Session }) {
  const memberships = useMemberships(session.user.id);
  const [current, setCurrent] = useState<string | null>(() => { try { return localStorage.getItem(AGENCY_KEY); } catch { return null; } });
  const switchAgency = useCallback((id: string) => { setCurrent(id); try { localStorage.setItem(AGENCY_KEY, id); } catch { /* in-memory only */ } }, []);

  if (memberships.isLoading) return null;
  if (memberships.error) return <div className="tn-auth"><div className="card"><span className="card-title">Could not load your agencies</span><p className="card-body">{(memberships.error as Error).message}</p><button className="btn btn-secondary" onClick={() => void memberships.refetch()}>Retry</button></div></div>;
  const list = memberships.data ?? [];
  if (!list.length) return <CreateAgency />;
  const m = list.find(x => x.agency_id === current) ?? list[0]!;
  const name = (session.user.user_metadata?.full_name as string | undefined) ?? session.user.email?.split('@')[0] ?? 'you';

  return (
    <AgencyProvider key={m.agency_id} agency={m.agencies} role={m.role} userTeamId={m.team_id} userName={name} agencies={list.map(x => x.agencies)} switchAgency={switchAgency}>
      <AgencyApp agencyId={m.agency_id} />
    </AgencyProvider>
  );
}

function AgencyApp({ agencyId }: { agencyId: string }) {
  useAgencyRealtime(agencyId);
  // Marks an accepted invite active and records last-seen for the Team screen
  useEffect(() => { void api.hello(agencyId).catch(() => {}); }, [agencyId]);
  return (
    <CreatorDrawerProvider>
      <Shell>
        <Routes>
          <Route path="/overview" element={<Overview />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/targets" element={<LiveTargets />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/team" element={<Team />} />
          <Route path="/source" element={<DataSource />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Shell>
    </CreatorDrawerProvider>
  );
}
