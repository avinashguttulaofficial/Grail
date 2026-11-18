import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Database, Trash2, Mail, Globe, FileText } from 'lucide-react';

const Section: React.FC<{ id: string; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  id,
  icon,
  title,
  children,
}) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-center gap-3 mb-6">
      <div className="w-9 h-9 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300 shrink-0">
        {icon}
      </div>
      <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">{title}</h2>
    </div>
    <div className="pl-12 space-y-4 text-neutral-400 text-sm leading-relaxed">{children}</div>
  </section>
);

const toc = [
  { id: 'information-collected', label: 'Information We Collect' },
  { id: 'use-of-data', label: 'How We Use Your Data' },
  { id: 'data-sharing', label: 'Data Sharing & Third Parties' },
  { id: 'storage-security', label: 'Storage & Security' },
  { id: 'cookies', label: 'Cookies & Local Storage' },
  { id: 'retention', label: 'Data Retention & Deletion' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'international', label: 'International Transfers' },
  { id: 'contact', label: 'Contact' },
];

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Hero */}
      <div className="border-b border-neutral-900 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-4">
            Legal Documentation · Last Updated November 2026
          </span>
          <h1 className="font-display font-black text-5xl sm:text-7xl uppercase tracking-tight leading-[0.9] mb-6">
            Privacy<br />Policy
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            GrailJobs is committed to protecting your privacy. This policy explains what personal data we collect,
            why we collect it, how it's stored, and your rights over it. We collect only what is necessary to operate
            the platform.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Table of Contents */}
        <nav className="mb-16 p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
          <h3 className="text-xs font-mono uppercase tracking-widest text-neutral-500 mb-4">Table of Contents</h3>
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

        <div className="space-y-16">
          {/* 1 */}
          <Section id="information-collected" icon={<Database className="w-4 h-4" />} title="Information We Collect">
            <p>
              We collect the following categories of personal data when you create an account, apply to jobs, or use
              GrailJobs features:
            </p>
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Account & Profile Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>Full name and email address (required for registration)</li>
                  <li>Avatar / profile photo (optional)</li>
                  <li>Professional headline, location, country, phone number (optional)</li>
                  <li>Professional summary, years of experience, work history (optional)</li>
                  <li>Portfolio URL and LinkedIn URL (optional)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Resume Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>File name, file size, and MIME type of uploaded resumes</li>
                  <li>Storage path in Supabase private storage buckets</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Job Application Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>Job ID, application status, and status history</li>
                  <li>Cover letter content (if submitted)</li>
                  <li>Resume reference used for each application</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Saved Jobs & Activity
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>Job IDs of positions you bookmark or save</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Contact & Newsletter
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>Name, email, subject, and message from contact form submissions</li>
                  <li>Email address and subscription status for newsletter sign-ups</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-2 font-mono">
                  Technical & Usage Data
                </h3>
                <ul className="list-disc list-inside space-y-1 text-neutral-400">
                  <li>Session tokens stored in browser localStorage (not cookies)</li>
                  <li>Admin activity logs: actions, resource identifiers, timestamps (admin accounts only)</li>
                  <li>
                    We do <strong className="text-white">not</strong> use Google Analytics, Meta Pixel, or any
                    third-party tracking scripts on this platform.
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          {/* 2 */}
          <Section id="use-of-data" icon={<Eye className="w-4 h-4" />} title="How We Use Your Data">
            <p>Your data is used exclusively to operate and improve GrailJobs. Specific uses include:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Authenticating your account and maintaining your logged-in session</li>
              <li>Displaying your profile to yourself in the candidate dashboard</li>
              <li>Processing and tracking job applications you submit</li>
              <li>Enabling administrators to review applications for listed positions</li>
              <li>Sending newsletter digests to subscribers who explicitly opt in</li>
              <li>Routing contact form messages to our editorial team</li>
              <li>Maintaining platform security through admin activity audit logs</li>
              <li>Aggregating anonymised job market data for salary benchmark resources</li>
            </ul>
            <p className="mt-4 p-4 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-400">
              We do not sell, rent, or trade your personal data to any third party for marketing or advertising
              purposes.
            </p>
          </Section>

          {/* 3 */}
          <Section id="data-sharing" icon={<Globe className="w-4 h-4" />} title="Data Sharing & Third Parties">
            <p>
              GrailJobs shares your data only with the following sub-processors necessary to operate the platform:
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-1">Supabase</h4>
                <p className="text-xs">
                  Our primary database and file-storage provider. All account data, resumes, applications, and messages
                  are stored in a PostgreSQL database hosted by Supabase, Inc. (US). Supabase processes data under their
                  DPA and is SOC 2 Type 2 certified.
                </p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-1">Vercel</h4>
                <p className="text-xs">
                  Our hosting and serverless functions provider. Vercel processes HTTP requests (including IP addresses)
                  as part of standard CDN and edge-compute operations. We do not log or persist IP addresses ourselves.
                </p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-1">Himalayas API</h4>
                <p className="text-xs">
                  An external job aggregation API. We pull publicly available job listings from Himalayas (himalayas.app)
                  and store them in our database. If you apply to a Himalayas-sourced listing, you are redirected to the
                  employer's own application page — GrailJobs does not transmit your profile data to Himalayas or the
                  external employer.
                </p>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              Beyond the above, we do not share your personal data with third parties.
            </p>
          </Section>

          {/* 4 */}
          <Section id="storage-security" icon={<Lock className="w-4 h-4" />} title="Storage & Security">
            <p>
              All data is stored in a Supabase-hosted PostgreSQL database with Row Level Security (RLS) enforced on
              every table. Resume files are stored in private Supabase Storage buckets and are only accessible via
              time-limited signed URLs generated server-side. We use HTTPS/TLS for all data in transit. See our{' '}
              <Link to="/security" className="text-white underline underline-offset-2 hover:no-underline">
                Security Standards
              </Link>{' '}
              page for the full technical detail.
            </p>
          </Section>

          {/* 5 */}
          <Section id="cookies" icon={<FileText className="w-4 h-4" />} title="Cookies & Local Storage">
            <p>
              GrailJobs does <strong className="text-white">not</strong> use cookies for tracking or advertising. We
              use browser <code className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded">localStorage</code> for the
              following essential operational purposes only:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-neutral-300">Session token</strong> — your authenticated session key so you
                remain logged in between page loads.
              </li>
              <li>
                <strong className="text-neutral-300">UI preferences</strong> — transient view state such as selected
                job filters.
              </li>
            </ul>
            <p>
              You can clear all locally stored data at any time by clearing your browser's site data for{' '}
              <span className="text-neutral-300">grailjobs.online</span>. Clearing session storage will log you out.
            </p>
          </Section>

          {/* 6 */}
          <Section id="retention" icon={<Trash2 className="w-4 h-4" />} title="Data Retention & Deletion">
            <p>We retain your personal data for as long as your account is active, subject to these rules:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong className="text-neutral-300">Account deletion</strong> — deleting your account removes your
                profile, all saved jobs, all application records, and all associated resume files from storage within
                30 days.
              </li>
              <li>
                <strong className="text-neutral-300">Newsletter unsubscribe</strong> — your email is flagged inactive
                immediately; you will receive no further emails. The email record is retained for suppression list
                purposes.
              </li>
              <li>
                <strong className="text-neutral-300">Contact messages</strong> — retained for up to 24 months for
                audit and support history purposes.
              </li>
              <li>
                <strong className="text-neutral-300">Admin logs</strong> — retained for 12 months for security
                audit purposes.
              </li>
            </ul>
            <p>
              To request deletion of your data, email{' '}
              <a href="mailto:hello@grailjobs.online" className="text-white underline underline-offset-2">
                hello@grailjobs.online
              </a>{' '}
              with the subject line <em>"Data Deletion Request"</em>.
            </p>
          </Section>

          {/* 7 */}
          <Section id="your-rights" icon={<Shield className="w-4 h-4" />} title="Your Rights">
            <p>
              Depending on your jurisdiction, you may have the following rights regarding your personal data. We honour
              these requests without requiring a specific jurisdiction code:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Access', 'Request a copy of all personal data we hold about you.'],
                ['Correction', 'Update inaccurate or incomplete information via your dashboard profile settings.'],
                ['Deletion', 'Request erasure of all your personal data (see retention section above).'],
                ['Portability', 'Receive your data in a machine-readable format (JSON export available on request).'],
                ['Objection', 'Object to processing of your data for newsletter or marketing purposes.'],
                ['Restriction', 'Ask us to restrict processing while a dispute is under review.'],
              ].map(([right, desc]) => (
                <div key={right} className="p-3 bg-neutral-900 border border-neutral-800 rounded">
                  <strong className="text-white text-xs uppercase font-mono tracking-wider block mb-1">{right}</strong>
                  <p className="text-xs text-neutral-400">{desc}</p>
                </div>
              ))}
            </div>
            <p>
              To exercise any right, contact us at{' '}
              <a href="mailto:hello@grailjobs.online" className="text-white underline underline-offset-2">
                hello@grailjobs.online
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          {/* 8 */}
          <Section id="international" icon={<Globe className="w-4 h-4" />} title="International Transfers">
            <p>
              GrailJobs is hosted on infrastructure based in the United States (Supabase and Vercel). If you access the
              platform from the European Economic Area, United Kingdom, India, or any other jurisdiction, your data will
              be transferred to and processed in the United States. We rely on Supabase's standard contractual clauses
              and data processing agreement for EU/UK transfers.
            </p>
          </Section>

          {/* 9 */}
          <Section id="contact" icon={<Mail className="w-4 h-4" />} title="Contact">
            <p>
              For any privacy-related queries, data requests, or concerns, please reach out to our editorial team:
            </p>
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded space-y-2 text-xs font-mono">
              <div>
                <span className="text-neutral-500">Email: </span>
                <a href="mailto:hello@grailjobs.online" className="text-white">
                  hello@grailjobs.online
                </a>
              </div>
              <div>
                <span className="text-neutral-500">Subject line: </span>
                <span className="text-neutral-300">"Privacy Request — [Your Name]"</span>
              </div>
              <div>
                <span className="text-neutral-500">Website: </span>
                <span className="text-neutral-300">grailjobs.online</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500">
              This policy was last updated in November 2026. We reserve the right to update this policy; material
              changes will be communicated via the email address associated with your account.
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t border-neutral-800 flex flex-wrap gap-6 text-xs font-mono text-neutral-500">
          <Link to="/terms" className="hover:text-white transition-colors">Terms of Service →</Link>
          <Link to="/security" className="hover:text-white transition-colors">Security Standards →</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact Editorial →</Link>
        </div>
      </div>
    </div>
  );
};
