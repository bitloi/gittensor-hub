'use client';

import React, { useEffect } from 'react';
import styles from '../page.module.css';
import Avatar from './Avatar';
import { LABEL_COLORS, LANG_COLORS, LANG_NAME_ICONS, formatLangPct } from '../_lib/colors';
import LangIcon from './LangIcon';
import {
  formatTAO,
  repoDailyTAO,
  repoIssueTAO,
  repoMaintainerTAO,
  repoPerMaintainerTAO,
  repoPRTAO,
  type RepoRow,
} from '../_lib/incentives';

interface DrawerProps {
  open: boolean;
  row: RepoRow | null;
  subnetTAO: number;
  isInCompare: boolean;
  /** Whether /api/repos/metadata has resolved (regardless of whether this
   *  specific repo has a description / languages on GitHub). Lets the drawer
   *  distinguish "still loading" from "loaded but empty". */
  metadataLoaded: boolean;
  onClose: () => void;
  onToggleCompare: (full: string) => void;
}

export default function Drawer({
  open,
  row,
  subnetTAO,
  isInCompare,
  metadataLoaded,
  onClose,
  onToggleCompare,
}: DrawerProps) {
  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!row) {
    return (
      <>
        <div className={`${styles.backdrop} ${open ? styles.open : ''}`} onClick={onClose} />
        <aside className={`${styles.drawer} ${open ? styles.open : ''}`} aria-hidden />
      </>
    );
  }

  const r = row;
  const cred =
    r.activity.merged30d + r.activity.closed30d > 0
      ? r.activity.merged30d / (r.activity.merged30d + r.activity.closed30d)
      : 0;
  const credColor =
    cred >= 0.85 ? 'var(--color-moss-400)' :
    cred >= 0.7  ? 'var(--color-enh)' :
    'var(--color-refact)';

  const labelsContent = r.labels
    ? Object.entries(r.labels)
        .sort((a, b) => b[1] - a[1])
        .map(([l, v]) => {
          const c = LABEL_COLORS[l] ?? { fg: 'var(--fg-muted)', soft: '' };
          const isPenalty = v < 1.0;
          return (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, padding: '4px 0' }}>
              <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: c.fg }} />
                <span style={{ color: v >= 1.3 ? c.fg : v >= 1.0 ? 'var(--fg-default)' : 'var(--fg-muted)' }}>{l}</span>
              </span>
              <span className="mono tnum" style={{ color: v >= 1.3 ? c.fg : isPenalty ? 'var(--color-refact)' : 'var(--fg-default)' }}>×{v.toFixed(2)}</span>
            </div>
          );
        })
    : null;

  const eligibilityContent = r.eligibility ? (
    <>
      {Object.entries(r.eligibility).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '2px 0' }}>
          <span className={`mono ${styles.textFgMute}`}>{k}</span>
          <span className={`mono tnum ${styles.textFg}`}>{v}</span>
        </div>
      ))}
    </>
  ) : (
    <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
      Uses global defaults: <span className={`mono ${styles.textFgDim}`}>3 valid PRs · cred ≥ 0.80 · token_score ≥ 5</span>
    </div>
  );

  return (
    <>
      <div className={`${styles.backdrop} ${open ? styles.open : ''}`} onClick={onClose} />
      <aside className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Header */}
          <div
            style={{
              borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))',
              padding: '16px 20px',
              position: 'sticky',
              top: 0,
              background: 'var(--bg-subtle)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: 1 }}>
                <Avatar fullName={r.fullName} size="xl" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {r.isSelf ? <span className={`${styles.badge} ${styles.badgeSelf}`}>your repository</span> : null}
                    {r.trusted ? <span className={`${styles.badge} ${styles.badgeTrusted}`}>trusted pipeline</span> : null}
                    {r.share === 0 ? <span className={`${styles.badge} ${styles.badgeZero}`}>benchmark · no emissions</span> : null}
                    {r.eligibility ? <span className={`${styles.badge} ${styles.badgeOverrides}`}>eligibility override</span> : null}
                    {(r.maintCut || 0) > 0 ? (
                      <span className={`${styles.badge} ${styles.badgeMaint}`}>
                        {(r.maintCut * 100).toFixed(0)}% maintainer cut
                        {r.demoMaint ? <span style={{ opacity: 0.6, marginLeft: 2 }}>·demo</span> : null}
                      </span>
                    ) : null}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 500 }}>
                    <span className={styles.textFgDim}>{r.owner}/</span>{r.name}
                  </h3>
                </div>
              </div>
              <button type="button" className={styles.ghostBtn} style={{ margin: -6, padding: 6 }} onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Description is populated by /api/repos/metadata. Three cases:
              *  - has description → render normally
              *  - metadata still loading → italic placeholder
              *  - metadata loaded but repo has no GitHub description → omit */}
            {r.description ? (
              <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{r.description}</p>
            ) : !metadataLoaded ? (
              <p style={{ fontSize: 12.5, color: 'var(--fg-subtle)', lineHeight: 1.5, fontStyle: 'italic' }}>
                Loading description from GitHub…
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <a className={styles.priBtn} href={`https://github.com/${r.fullName}`} target="_blank" rel="noreferrer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57 0-.28-.01-1.03-.02-2.03-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.1-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48 1 .1-.78.42-1.3.76-1.6-2.66-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.24-3.24-.13-.3-.54-1.53.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.24 0 4.63-2.81 5.65-5.49 5.95.43.37.82 1.1.82 2.22 0 1.6-.02 2.9-.02 3.3 0 .31.22.7.83.57A12 12 0 0 0 12 .3" />
                </svg>
                View on GitHub
              </a>
              <a
                className={styles.secBtn}
                href={`https://github.com/${r.fullName}/issues?q=is:open+label:%22good+first+issue%22`}
                target="_blank"
                rel="noreferrer"
              >
                good-first-issues ↗
              </a>
              <button type="button" className={styles.secBtn} onClick={() => onToggleCompare(r.fullName)}>
                {isInCompare ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>{' '}
                    In compare
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>{' '}
                    Add to compare
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TAO emission */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Daily emission
            </div>
            <div className={`${styles.num2xl} tnum ${r.share === 0 ? styles.textFgFaint : styles.textTao}`} style={{ marginBottom: 4 }}>
              {formatTAO(repoDailyTAO(r, subnetTAO))}
              <span className={styles.textFgMute} style={{ fontSize: 16, marginLeft: 8 }}>TAO/day</span>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 12 }}>
              = {subnetTAO} subnet × {(r.share * 100).toFixed(3)}% share × 90% OSS pool
            </div>

            {r.share > 0 && (r.maintCut || 0) > 0 ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--softer-border, rgba(255,255,255,0.04))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--color-moss-400)' }} />
                    <span style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Maintainer cut
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className={styles.badge}
                      style={{
                        background: 'rgba(158,184,114,0.10)',
                        color: 'var(--color-moss-400)',
                        borderColor: 'rgba(158,184,114,0.25)',
                        fontSize: 9.5,
                        padding: '0 5px',
                        lineHeight: 1.5,
                      }}
                    >
                      off the top
                    </span>
                    {r.demoMaint ? <span className={styles.demoTag} title="Placeholder value">demo</span> : null}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span className={`mono ${styles.numM} tnum ${styles.textMoss}`}>{formatTAO(repoMaintainerTAO(r, subnetTAO))}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>τ/d total · {(r.maintCut * 100).toFixed(0)}% of slice</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                  Split evenly among <span className={`mono ${styles.textFg}`}>{r.maintainerCount}</span> registered maintainer
                  {r.maintainerCount === 1 ? '' : 's'} ·{' '}
                  <span className={`mono ${styles.textMoss}`}>{formatTAO(repoPerMaintainerTAO(r, subnetTAO))} τ/d</span> each
                </div>
                {r.demoMaint ? (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 8,
                      borderRadius: 4,
                      fontSize: 10.5,
                      color: 'var(--fg-subtle)',
                      lineHeight: 1.5,
                      background: 'var(--softer-fill, rgba(255,255,255,0.025))',
                      border: '1px dashed var(--soft-border, rgba(255,255,255,0.08))',
                    }}
                  >
                    <span className={styles.textFgDim}>Note:</span> the <span className="mono">maintainer_cut</span> mechanic is new
                    (announced in the recent Discord update). No repos have validator-set values yet — this card shows a plausible
                    placeholder so the UI can be reviewed.
                  </div>
                ) : null}
              </div>
            ) : null}

            {r.share > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--softer-border, rgba(255,255,255,0.04))',
                }}
              >
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    PR slice
                  </div>
                  <div className={`mono ${styles.numM} tnum ${styles.textPr}`}>{formatTAO(repoPRTAO(r, subnetTAO))} τ/d</div>
                  <div style={{ fontSize: 10, color: 'var(--border-strong)', marginTop: 2 }}>
                    {(r.maintCut || 0) > 0
                      ? `${((1 - r.maintCut) * (1 - r.issue) * 100).toFixed(0)}% of slice (after the cut)`
                      : `${((1 - r.issue) * 100).toFixed(0)}% of slice`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    Issue discovery slice
                  </div>
                  <div className={`mono ${styles.numM} tnum ${styles.textIssue}`}>{formatTAO(repoIssueTAO(r, subnetTAO))} τ/d</div>
                  <div style={{ fontSize: 10, color: 'var(--border-strong)', marginTop: 2 }}>
                    {(r.maintCut || 0) > 0
                      ? `${((1 - r.maintCut) * r.issue * 100).toFixed(0)}% of slice (after the cut)`
                      : `${(r.issue * 100).toFixed(0)}% of slice`}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Activity */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Activity · 30d{' '}
              <span className={`mono ${styles.textFgFaint}`} style={{ textTransform: 'none', letterSpacing: 0 }}>PRs created in the last 30 days · open count live from GitHub</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <ActivityStat value={r.activity.merged30d} label="merged PRs" tone="strong" />
              <ActivityStat value={r.activity.openPRs} label="open PRs" tone="dim" />
              <ActivityStat value={r.activity.closed30d} label="closed PRs" tone="dim" />
              <ActivityStat value={r.activity.contribs} label="contributors" tone="strong" />
            </div>
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--softer-border, rgba(255,255,255,0.04))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  title="Merge rate over the last 30 days = merged ÷ (merged + closed). A forecast of how welcoming the repo is right now."
                >
                  Merge rate · 30d
                </div>
                <div className={`mono ${styles.numM} tnum`} style={{ color: credColor, marginTop: 2 }}>
                  {(cred * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em' }}
                  title="PRs that received a final decision (merged or closed) in the last 30 days — the denominator behind the merge-rate %."
                >
                  Resolved
                </div>
                <div className={`mono ${styles.textFgDim}`} style={{ fontSize: 12, marginTop: 2 }}>
                  {r.activity.merged30d + r.activity.closed30d} PRs
                </div>
              </div>
            </div>
          </div>

          {/* Languages — always render the section so the drawer's shape
            * matches the HTML; show a loading-style placeholder while the
            * /api/repos/metadata endpoint is still fetching. */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Primary languages
            </div>
            {r.langs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {r.langs.map(([n, p]) => {
                  const color = LANG_COLORS[n] ?? 'var(--fg-subtle)';
                  const spec = LANG_NAME_ICONS[n.toLowerCase()];
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LangIcon
                        spec={spec}
                        color={color}
                        fallbackLetter={n.slice(0, n.length <= 2 ? 1 : 2).toUpperCase()}
                        size={16}
                        title={n}
                      />
                      <span style={{ fontSize: 12.5, flex: 1 }}>{n}</span>
                      <span className={`mono tnum ${styles.textFgDim}`} style={{ fontSize: 11.5 }}>{formatLangPct(p)}</span>
                    </div>
                  );
                })}
              </div>
            ) : !metadataLoaded ? (
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic' }}>
                Loading language breakdown from GitHub…
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                Not available for this repo.
              </div>
            )}
          </div>

          {/* Labels */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Label multipliers
            </div>
            {labelsContent ?? <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>No per-label multipliers. PRs score at default ×1.00.</div>}
            {r.labels ? (
              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--softer-border, rgba(255,255,255,0.04))' }}>
                default <span className={`mono ${styles.textFgDim}`}>×{r.defaultLabel.toFixed(2)}</span> for unmatched labels
              </div>
            ) : null}
          </div>

          {/* Eligibility */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--soft-border, rgba(255,255,255,0.06))' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
              Eligibility gate
            </div>
            {eligibilityContent}
          </div>

          {/* Raw config */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Raw config · master_repositories.json
            </div>
            <pre
              className="mono"
              style={{
                fontSize: 11.5,
                color: 'var(--fg-muted)',
                lineHeight: 1.5,
                background: 'var(--bg-inset)',
                border: '1px solid var(--soft-border, rgba(255,255,255,0.06))',
                borderRadius: 4,
                padding: 12,
                overflowX: 'auto',
                margin: 0,
              }}
            >
              {buildRawJson(r)}
            </pre>
          </div>
        </div>
      </aside>
    </>
  );
}

function ActivityStat({ value, label, tone }: { value: number; label: string; tone: 'strong' | 'dim' }) {
  return (
    <div>
      <div className={`mono ${styles.numM} tnum`} style={{ color: tone === 'strong' ? 'var(--fg-default)' : 'var(--fg-muted)' }}>
        {value}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--fg-subtle)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function buildRawJson(r: RepoRow): string {
  const obj: Record<string, unknown> = {
    emission_share: r.share,
    issue_discovery_share: r.issue,
  };
  if (r.labels) obj.label_multipliers = r.labels;
  if (r.defaultLabel !== 1.0) obj.default_label_multiplier = r.defaultLabel;
  if (r.fixedBase !== null) obj.fixed_base_score = r.fixedBase;
  if (r.maintCut > 0) obj.maintainer_cut = r.maintCut;
  if (r.trusted) obj.trusted_label_pipeline = true;
  if (r.eligibility) obj.eligibility = r.eligibility;
  return JSON.stringify(obj, null, 2);
}
