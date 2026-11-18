import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Database, Key, Eye, AlertTriangle, Trash2, Mail, Server, FileText } from 'lucide-react';

const Section: React.FC<{ id: string; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  id,
  icon,
  title,
  children,
}) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-emerald-400 shrink-0">
        {icon}
      </div>
      <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">{title}</h2>
    </div>
    <div className="pl-12 space-y-4 text-neutral-400 text-sm leading-relaxed">{children}</div>
  </section>
);

const Badge: React.FC<{ label: string; status: 'green' | 'yellow' | 'blue' }> = ({ label, status }) => {
  const colors = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wider ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'green' ? 'bg-emerald-400' : status === 'yellow' ? 'bg-amber-400' : 'bg-blue-400'}`} />
      {label}
    </span>
  );
};

const toc = [
  { id: 'authentication', label: 'Authentication & Authorization' },
  { id: 'database', label: 'Database Access Controls' },
  { id: 'file-security', label: 'Resume & File Security' },
  { id: 'transit', label: 'Encryption in Transit' },
  { id: 'monitoring', label: 'Security Monitoring & Audit Logs' },
  { id: 'admin', label: 'Admin Role Enforcement' },
  { id: 'vulnerabilities', label: 'Vulnerability Management' },
  { id: 'incident', label: 'Incident Response' },
  { id: 'deletion', label: 'Secure Data Deletion' },
  { id: 'disclosure', label: 'Responsible Disclosure' },
];

export const SecurityPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Hero */}
      <div className="border-b border-neutral-900 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-4">
            Legal Documentation · Last Updated November 2026
          </span>
          <h1 className="font-display font-black text-5xl sm:text-7xl uppercase tracking-tight leading-[0.9] mb-6">
            Security<br />Standards
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            GrailJobs is built on Supabase PostgreSQL with Row Level Security enforced across every table. This
            document describes the security controls, infrastructure architecture, and responsible disclosure process
            for grailjobs.online.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Badge label="RLS Enforced" status="green" />
            <Badge label="HTTPS/TLS" status="green" />
            <Badge label="Private Storage Buckets" status="green" />
            <Badge label="Vercel Edge" status="blue" />
            <Badge label="Supabase Auth" status="blue" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Table of Contents */}
        <nav className="mb-16 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">Contents</h3>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {toc.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span className="font-mono text-neutral-600">{String(i + 1).padStart(2, '0')}.</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Architecture overview */}
        <div className="mb-16 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">Architecture Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {[
              { layer: 'Frontend', tech: 'React 19 + Vite · Vercel CDN · HTTPS only' },
              { layer: 'API Layer', tech: 'Vercel Serverless Functions · Node.js · Service Role Key (server-side only)' },
              { layer: 'Database', tech: 'Supabase PostgreSQL · RLS on all tables · Private storage buckets' },
            ].map(({ layer, tech }) => (
              <div key={layer} className="p-3 bg-neutral-800 border border-neutral-700 rounded">
                <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-wider block mb-1">{layer}</span>
                <p className="text-neutral-300">{tech}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-16">
          {/* 1 */}
          <Section id="authentication" icon={<Key className="w-4 h-4" />} title="Authentication & Authorization">
            <p>
              Authentication is handled by <strong className="text-neutral-300">Supabase Auth</strong>, which provides:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Bcrypt-hashed password storage — plaintext passwords are never stored or logged</li>
              <li>JWT-based session tokens with configurable expiry</li>
              <li>Server-side session validation on all protected API routes</li>
              <li>Email + password authentication (no third-party OAuth for candidates currently)</li>
            </ul>
            <p>
              Session tokens are stored in browser <code className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded">localStorage</code>.
              We use Supabase's anon key (safe to expose to the browser) for read operations, and the service role key
              only in server-side Vercel Serverless Functions — it is never shipped to the browser.
            </p>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
              <span className="text-emerald-400">✓</span> <code>SUPABASE_SERVICE_ROLE_KEY</code> is a server-only
              environment variable, set via Vercel Project Settings and never committed to source control.
            </div>
          </Section>

          {/* 2 */}
          <Section id="database" icon={<Database className="w-4 h-4" />} title="Database Access Controls">
            <p>
              <strong className="text-neutral-300">Row Level Security (RLS)</strong> is enabled on every table in the
              GrailJobs PostgreSQL schema. Access policies are enforced at the database level — not just in application
              code — meaning even a misconfigured API route cannot expose data beyond policy bounds.
            </p>
            <div className="space-y-3">
              {[
                {
                  table: 'profiles',
                  policy: 'Users can read and update only their own profile row (WHERE auth.uid() = id)',
                  note: 'Profile reads are scoped to the authenticated user; no public profile directory',
                },
                {
                  table: 'resumes',
                  policy: 'Users can read/insert/delete only their own resumes (WHERE auth.uid() = user_id)',
                  note: 'Admins can read all resumes using the service role key (server-side only)',
                },
                {
                  table: 'applications',
                  policy: 'Candidates see only their own applications; admins see all via service role',
                  note: 'Application status updates are restricted to admin role',
                },
                {
                  table: 'jobs',
                  policy: 'Public read for active listings; insert/update/delete requires admin role',
                  note: null,
                },
                {
                  table: 'contact_messages / newsletter_subscribers',
                  policy: 'Insert-only for anon users; read requires admin role',
                  note: 'No authentication required to submit — rate limiting applies at API layer',
                },
              ].map(({ table, policy, note }) => (
                <div key={table} className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                  <code className="text-emerald-400 text-xs font-mono block mb-1">{table}</code>
                  <p className="text-xs text-neutral-400">{policy}</p>
                  {note && <p className="text-xs text-neutral-500 mt-1 italic">{note}</p>}
                </div>
              ))}
            </div>
          </Section>

          {/* 3 */}
          <Section id="file-security" icon={<FileText className="w-4 h-4" />} title="Resume & File Security">
            <p>
              Uploaded resumes are stored in <strong className="text-neutral-300">private Supabase Storage buckets</strong>.
              Private buckets block all direct, unauthenticated URL access.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Download URLs are generated as short-lived signed URLs via the Supabase storage API</li>
              <li>Signed URLs expire after a configurable window (default: 60 minutes)</li>
              <li>File access is validated against the user's authenticated session before a signed URL is issued</li>
              <li>Accepted file types: PDF and DOCX only; maximum file size: 5MB per upload</li>
              <li>File names are stored in the database; storage paths are opaque UUIDs, not user-supplied names</li>
            </ul>
            <div className="p-4 bg-neutral-900 border border-amber-900/40 rounded text-xs font-mono text-amber-400/80">
              ⚠ Resume files are not publicly listed or indexable. Sharing a signed URL grants temporary access;
              users should not share signed URLs with unauthorized parties.
            </div>
          </Section>

          {/* 4 */}
          <Section id="transit" icon={<Lock className="w-4 h-4" />} title="Encryption in Transit">
            <p>All data transmitted between users and GrailJobs is encrypted using:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-neutral-300">HTTPS with TLS 1.2+</strong> enforced by Vercel's edge network
                on all public endpoints
              </li>
              <li>
                HTTP is automatically redirected to HTTPS — no unencrypted traffic is accepted
              </li>
              <li>
                All Supabase API calls (database queries, storage operations) use TLS over the Supabase REST and
                Realtime APIs
              </li>
              <li>
                Vercel's CDN edge certificates are managed automatically and renewed before expiry
              </li>
            </ul>
          </Section>

          {/* 5 */}
          <Section id="monitoring" icon={<Eye className="w-4 h-4" />} title="Security Monitoring & Audit Logs">
            <p>GrailJobs maintains the following audit and monitoring systems:</p>
            <div className="space-y-3">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-2">Admin Activity Log</h4>
                <p className="text-xs text-neutral-400">
                  Every admin action (job create/update/delete, user management, application status changes) is written
                  to the <code>admin_activity_log</code> table with the acting admin's ID, action type, resource
                  identifier, and timestamp. Logs are retained for 12 months.
                </p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-2">Supabase Auth Logs</h4>
                <p className="text-xs text-neutral-400">
                  Supabase records all authentication events (login, logout, failed attempts, password resets) in its
                  platform-level logs, accessible to project administrators.
                </p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-2">Vercel Function Logs</h4>
                <p className="text-xs text-neutral-400">
                  Serverless function invocations (cron jobs, scheduler API routes) are logged in Vercel's deployment
                  dashboard. No personal data is written to function logs.
                </p>
              </div>
            </div>
          </Section>

          {/* 6 */}
          <Section id="admin" icon={<Shield className="w-4 h-4" />} title="Admin Role Enforcement">
            <p>
              Administrator and super-administrator privileges are enforced at <strong className="text-white">multiple
              layers</strong>:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-neutral-300">Database layer:</strong> Admin-only operations use Supabase service
                role key, which bypasses RLS. The service role key is exclusively available in server-side Vercel
                Serverless Functions and is never sent to the browser.
              </li>
              <li>
                <strong className="text-neutral-300">API layer:</strong> All admin API routes validate the requesting
                user's role from the database before executing any privileged operation.
              </li>
              <li>
                <strong className="text-neutral-300">Frontend layer:</strong> Admin portal UI routes check role in
                the AuthContext and redirect non-admins to the home page. Frontend-only checks are not relied upon
                for security — they are supplementary to server-side validation.
              </li>
            </ul>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
              <span className="text-emerald-400">✓</span> Demo credentials used in development are removed before
              production deployment. Admin demo accounts are disabled in live environments.
            </div>
          </Section>

          {/* 7 */}
          <Section id="vulnerabilities" icon={<AlertTriangle className="w-4 h-4" />} title="Vulnerability Management">
            <p>GrailJobs applies the following vulnerability management practices:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-neutral-300">Dependency updates:</strong> npm dependencies are reviewed and
                updated on a regular cadence. <code>npm audit</code> is run as part of the CI/CD pipeline.
              </li>
              <li>
                <strong className="text-neutral-300">Supabase platform security:</strong> We rely on Supabase's
                underlying infrastructure security, which includes SOC 2 Type 2 compliance and regular penetration
                testing of the Supabase platform.
              </li>
              <li>
                <strong className="text-neutral-300">Environment variable hygiene:</strong> All secrets are stored as
                Vercel environment variables. <code>.env</code> files are excluded from source control via
                <code> .gitignore</code>. No secrets are hardcoded in source files.
              </li>
              <li>
                <strong className="text-neutral-300">Input validation:</strong> Contact and newsletter form inputs are
                validated on both the client and the server-side API layer before database insertion.
              </li>
            </ul>
          </Section>

          {/* 8 */}
          <Section id="incident" icon={<Server className="w-4 h-4" />} title="Incident Response">
            <p>In the event of a confirmed security incident affecting user data, GrailJobs will:</p>
            <div className="space-y-3">
              {[
                ['Within 24 hours', 'Identify and contain the incident; revoke compromised credentials or tokens'],
                ['Within 48 hours', 'Assess scope of affected data and affected user accounts'],
                ['Within 72 hours', 'Notify affected users by email and, where required by law, relevant supervisory authorities (e.g., under GDPR Article 33)'],
                ['Within 7 days', 'Publish a post-incident report and implement remediation measures'],
              ].map(([time, action]) => (
                <div key={time} className="flex items-start gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded">
                  <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-wider shrink-0 w-28 mt-0.5">{time}</span>
                  <p className="text-xs text-neutral-400">{action}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* 9 */}
          <Section id="deletion" icon={<Trash2 className="w-4 h-4" />} title="Secure Data Deletion">
            <p>
              When a user deletes their account or requests data erasure, GrailJobs performs the following:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Profile row deleted from the <code>profiles</code> table</li>
              <li>All resume files deleted from the private Supabase Storage bucket</li>
              <li>All resume metadata rows deleted from the <code>resumes</code> table</li>
              <li>All application records associated with the user deleted</li>
              <li>All saved job records deleted</li>
              <li>Supabase Auth user record deleted (Supabase purges auth tokens)</li>
            </ul>
            <p>
              Deletion is processed within 30 days of the request. Admin activity logs referencing the user's actions
              may be retained in anonymised form for security audit purposes as permitted by applicable law.
            </p>
          </Section>

          {/* 10 */}
          <Section id="disclosure" icon={<Mail className="w-4 h-4" />} title="Responsible Disclosure">
            <p>
              We welcome responsible security research and reports. If you discover a potential security vulnerability
              in GrailJobs, please report it to us before public disclosure so we have the opportunity to investigate
              and remediate.
            </p>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded space-y-3 text-xs font-mono">
              <div>
                <span className="text-neutral-500">Contact: </span>
                <a href="mailto:hello@grailjobs.online" className="text-white">hello@grailjobs.online</a>
              </div>
              <div>
                <span className="text-neutral-500">Subject: </span>
                <span className="text-neutral-300">"Security Disclosure — [Brief Description]"</span>
              </div>
              <div>
                <span className="text-neutral-500">Include: </span>
                <span className="text-neutral-400">
                  Affected endpoint or feature, reproduction steps, severity assessment, and any proof of concept
                  (do not include actual user data in your report)
                </span>
              </div>
            </div>
            <p>
              We commit to acknowledging valid reports within <strong className="text-neutral-300">5 business days</strong>{' '}
              and providing a remediation timeline within <strong className="text-neutral-300">14 business days</strong>.
              We do not currently operate a bug bounty programme, but we do acknowledge responsible researchers
              publicly (with their consent).
            </p>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
              <span className="text-amber-400">⚠</span> Please do not test vulnerabilities against live user data, production databases,
              or other users' accounts. Use only your own account for testing.
            </div>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t border-neutral-800 flex flex-wrap gap-6 text-xs font-mono text-neutral-500">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy →</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service →</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact Editorial →</Link>
        </div>
      </div>
    </div>
  );
};
