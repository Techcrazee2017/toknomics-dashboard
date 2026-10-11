import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CAN, PURPOSES, type Purpose } from '@toknomics/shared';
import { useAgency } from '../lib/agency';
import { fetchLedger, useLedger, type LedgerParams } from '../lib/data';
import { useRosterPL } from '../lib/derive';
import { at, money, stamp } from '../lib/format';
import { supabase } from '../lib/supabase';
import { dbError } from '../lib/api';
import { PageHeader } from '../components/Shell';
import { Empty, ErrorLine, Seg } from '../components/ui';
import { useCreatorDrawer } from './CreatorDrawer';

type PurposeFilter = 'all' | Purpose | 'untagged';

export function Ledger() {
  const { agency, rates, prefs, role, toast } = useAgency();
  const qc = useQueryClient();
  const pl = useRosterPL();
  const openCreator = useCreatorDrawer();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [purpose, setPurpose] = useState<PurposeFilter>('all');
  const [limit, setLimit] = useState(40);
  const [openTag, setOpenTag] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const canTag = CAN.tagGifts(role);

  useEffect(() => { const t = setTimeout(() => { setQuery(input.trim()); setLimit(40); }, 250); return () => clearTimeout(t); }, [input]);
  useEffect(() => setLimit(40), [prefs.teamId, prefs.tier, prefs.range, purpose]);

  const params: LedgerParams = { from: pl.window.from, to: pl.window.to, creators: pl.creatorIds, purpose: purpose === 'all' ? null : purpose, query, limit };
  const ledger = useLedger(agency.id, params);
  const rows = ledger.data ?? [];
  const total = Number(rows[0]?.total_count ?? 0), totalCoins = Number(rows[0]?.total_coins ?? 0);
  const F = (v: number) => money(v, prefs.unit, rates);

  const retag = async (giftId: number, p: Purpose | null) => {
    setOpenTag(null);
    const { error } = p
      ? await supabase.from('gift_purposes').upsert({ gift_tx_id: giftId, agency_id: agency.id, purpose: p }, { onConflict: 'gift_tx_id' })
      : await supabase.from('gift_purposes').delete().eq('gift_tx_id', giftId);
    if (error) return toast(dbError(error)!.message);
    void qc.invalidateQueries({ queryKey: ['ledger', agency.id] });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      for (let off = 0; ; off += 5000) {
        const page = await fetchLedger(agency.id, { ...params, limit: 5000 }, off);
        all.push(...page);
        if (page.length < 5000) break;
      }
      const esc = (v: string | number) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
      const lines = all.map(e => [new Date(e.occurred_at).toISOString(), at(e.sender_unique_id), at(e.creator_unique_id), e.gift_name ?? e.gift_id, e.repeat_count, e.coins, (e.coins * rates.coinUsd).toFixed(2), PURPOSES.find(p => p.key === e.purpose)?.label ?? ''].map(esc).join(','));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([['timestamp,sender,recipient,gift,combo,coins,usd,purpose', ...lines].join('\n')], { type: 'text/csv' }));
      a.download = `toknomics-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast(`${lines.length} rows exported`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Gifting ledger" subtitle={`Itemized outgoing gifts from agency-controlled accounts.${canTag ? ' Click a purpose to retag it.' : ''}`} filters unit />
      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
          <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-neutral-500)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search creator, sender or gift" value={input} onChange={e => setInput(e.target.value)} aria-label="Search ledger" />
        </div>
        <Seg<PurposeFilter> wrap label="Purpose" value={purpose} onChange={setPurpose} options={[['all', 'All'], ...PURPOSES.map(p => [p.key, p.short] as const), ['untagged', 'Untagged']]} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <span className="tnum" style={{ color: 'var(--color-neutral-400)' }}>{total.toLocaleString('en-US')} gifts · {F(totalCoins * rates.coinUsd)}</span>
          <button className="btn btn-secondary" onClick={() => void exportCsv()} disabled={exporting || total === 0}><i className={exporting ? 'ph ph-spinner tn-spin' : 'ph ph-download-simple'} />Export CSV</button>
        </div>
      </section>
      <div className="card elev-sm tn-card flush">
        {ledger.error && <ErrorLine error={ledger.error} retry={() => void ledger.refetch()} />}
        <div className="tn-scroll-x">
          <table className="table tnum" style={{ minWidth: 860 }}>
            <thead><tr><th>Time</th><th>Sender</th><th>Recipient</th><th>Gift</th><th style={{ textAlign: 'right' }}>Coins</th><th style={{ textAlign: 'right' }}>Value</th><th style={{ width: 220 }}>Purpose</th></tr></thead>
            <tbody>
              {rows.map(e => {
                const p = PURPOSES.find(x => x.key === e.purpose);
                return (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--color-neutral-400)', whiteSpace: 'nowrap' }}>{stamp(e.occurred_at)}</td>
                    <td style={{ color: 'var(--color-neutral-300)' }}>{at(e.sender_unique_id)}</td>
                    <td><button className="tn-link" onClick={() => openCreator(e.creator_unique_id)}>{at(e.creator_unique_id)}</button></td>
                    <td>{e.gift_name ?? `Gift ${e.gift_id}`} × {e.repeat_count}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-neutral-300)' }}>{e.coins.toLocaleString('en-US')}</td>
                    <td style={{ textAlign: 'right' }}>{F(e.coins * rates.coinUsd)}</td>
                    <td>
                      {openTag === e.id ? (
                        <div className="tn-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {PURPOSES.map(o => <button key={o.key} className="tag tag-outline tn-tagopt" onClick={() => void retag(e.id, o.key)}>{o.label}</button>)}
                          <button className="tag tag-outline tn-tagopt" onClick={() => void retag(e.id, null)}>Clear</button>
                        </div>
                      ) : canTag ? (
                        <button className={p ? 'tag tag-accent tn-tagbtn' : 'tag tag-outline tn-tagbtn'} onClick={() => setOpenTag(e.id)} style={{ borderWidth: p ? 0 : 1 }}>
                          <i className={'ph ' + (p?.icon ?? 'ph-plus')} />{p?.label ?? 'Tag purpose'}
                        </button>
                      ) : (
                        <span className={p ? 'tag tag-accent' : 'tag tag-neutral'}>{p?.label ?? 'Untagged'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {total > rows.length && <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-4)' }}><button className="btn btn-secondary" onClick={() => setLimit(l => l + 40)} disabled={ledger.isFetching}>Show 40 more</button></div>}
        {!ledger.isLoading && rows.length === 0 && <Empty>No gifts match these filters.</Empty>}
      </div>
    </>
  );
}
