import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Briefcase, AlertTriangle, Copyright, Ban, Scale, Settings } from 'lucide-react';

const Section: React.FC<{ id: string; number: string; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  id,
  number,
  icon,
  title,
  children,
}) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-start gap-4 mb-6">
      <div className="shrink-0 flex flex-col items-center gap-2">
        <span className="text-[10px] font-mono text-neutral-600 tracking-widest">{number}</span>
        <div className="w-9 h-9 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
          {icon}
        </div>
      </div>
      <div className="pt-4">
        <h2 className="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-tight">{title}</h2>
      </div>
    </div>
    <div className="pl-[52px] space-y-4 text-neutral-400 text-sm leading-relaxed">{children}</div>
  </section>
);

const toc = [
  { id: 'eligibility', label: 'Eligibility' },
  { id: 'account', label: 'Account Registration & Security' },
  { id: 'platform', label: 'Platform Functionality' },
  { id: 'job-listings', label: 'Job Listings & Accuracy' },
  { id: 'third-party', label: 'Third-Party Employers & External Links' },
  { id: 'candidate', label: 'Candidate Responsibilities' },
  { id: 'prohibited', label: 'Prohibited Conduct' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'disclaimer', label: 'Employment Disclaimer' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'termination', label: 'Account Suspension & Termination' },
  { id: 'changes', label: 'Changes to These Terms' },
];

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Hero */}
      <div className="border-b border-neutral-900 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-4">
            Legal Documentation · Last Updated November 2026
          </span>
          <h1 className="font-display font-black text-5xl sm:text-7xl uppercase tracking-tight leading-[0.9] mb-6">
            Terms of<br />Service
          </h1>
          <p className="text-neutral-400 text-sm sm:text-base max-w-2xl leading-relaxed">
            By accessing or using GrailJobs (grailjobs.online), you agree to be bound by these Terms of Service.
            Please read them carefully before creating an account or applying to any listed position.
          </p>
          <div className="mt-6 p-4 bg-neutral-900 border border-amber-900/40 rounded text-xs text-amber-400/80 font-mono">
            ⚠ GrailJobs is a job discovery and aggregation platform, not an employer. We do not guarantee employment
            outcomes or the accuracy of third-party job listings.
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

        <div className="space-y-16">
          <Section id="eligibility" number="01" icon={<Users className="w-4 h-4" />} title="Eligibility">
            <p>
              You must be at least <strong className="text-white">18 years of age</strong> to create an account or use
              GrailJobs. By using the platform, you represent and warrant that you meet this age requirement and that
              you have the legal capacity to enter into a binding agreement.
            </p>
            <p>
              GrailJobs is currently available to candidates globally. Access may be restricted in jurisdictions where
              use of the platform would violate local laws.
            </p>
          </Section>

          <Section id="account" number="02" icon={<Settings className="w-4 h-4" />} title="Account Registration & Security">
            <p>
              When you register, you agree to provide accurate, complete, and current information. You are solely
              responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying us immediately at <a href="mailto:hello@grailjobs.online" className="text-white underline underline-offset-2">hello@grailjobs.online</a> if you suspect unauthorized access</li>
            </ul>
            <p>
              GrailJobs uses Supabase for authentication. Passwords are hashed and never stored in plaintext. Session
              tokens are stored in browser localStorage. We may suspend accounts where unusual or suspicious activity
              is detected.
            </p>
          </Section>

          <Section id="platform" number="03" icon={<Briefcase className="w-4 h-4" />} title="Platform Functionality">
            <p>GrailJobs provides the following features to registered candidates:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Job search and discovery across curated and aggregated listings',
                'Candidate dashboard with application tracking',
                'Resume uploads (PDF/DOCX, max 5MB per file)',
                'Bookmarking and saving job listings',
                'Profile management with public-facing controls',
                'Newsletter subscription for curated weekly dispatches',
              ].map((f) => (
                <div key={f} className="flex items-start gap-2 text-xs text-neutral-400">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <p>
              We reserve the right to modify, suspend, or discontinue any feature at any time without prior notice.
              GrailJobs strives for 99.5% uptime but does not guarantee continuous availability.
            </p>
          </Section>

          <Section id="job-listings" number="04" icon={<FileText className="w-4 h-4" />} title="Job Listings & Accuracy">
            <p>
              GrailJobs hosts two categories of job listings:
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-2">Curated Editorial Listings</h4>
                <p className="text-xs">
                  Manually vetted by GrailJobs administrators. These listings include verified compensation ranges and
                  direct employer partnership. Accuracy is maintained on a best-effort basis; roles may close without
                  notice.
                </p>
              </div>
              <div className="p-4 bg-neutral-900 border border-neutral-800 rounded">
                <h4 className="text-white font-mono text-xs uppercase tracking-wider mb-2">Aggregated Listings (Himalayas API)</h4>
                <p className="text-xs">
                  Automatically pulled from the Himalayas job aggregation API and stored in our database. These listings
                  are publicly available job postings. GrailJobs does not independently verify their accuracy, current
                  availability, or compensation claims. These listings redirect to the employer's or Himalayas' own
                  application pages.
                </p>
              </div>
            </div>
            <p>
              Job listings may become outdated. GrailJobs runs automated synchronization every 6 hours to remove
              expired listings, but we cannot guarantee all listings are current at any given time.
            </p>
          </Section>

          <Section id="third-party" number="05" icon={<Scale className="w-4 h-4" />} title="Third-Party Employers & External Links">
            <p>
              Many listings on GrailJobs link to external employer websites or third-party platforms (e.g., the
              Himalayas application portal). When you click an external application link:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>You leave GrailJobs and are subject to the third party's own terms and privacy policy</li>
              <li>GrailJobs does <strong className="text-white">not</strong> transmit your profile or resume data to the external employer</li>
              <li>GrailJobs is not responsible for the content, accuracy, or hiring practices of external employers</li>
              <li>GrailJobs does not receive a referral fee or placement fee from any employer</li>
            </ul>
            <p>
              We recommend reviewing the external employer's privacy policy before submitting any personal information
              to their platform.
            </p>
          </Section>

          <Section id="candidate" number="06" icon={<Users className="w-4 h-4" />} title="Candidate Responsibilities">
            <p>As a candidate using GrailJobs, you agree to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Provide truthful, accurate information in your profile, applications, and cover letters</li>
              <li>Upload only resumes and documents you own or have rights to share</li>
              <li>Not impersonate another person or misrepresent your credentials</li>
              <li>Use the platform only for legitimate job-seeking purposes</li>
              <li>Not submit fictitious applications to test the system or waste employer time</li>
            </ul>
          </Section>

          <Section id="prohibited" number="07" icon={<Ban className="w-4 h-4" />} title="Prohibited Conduct">
            <p>You must not engage in any of the following on or through GrailJobs:</p>
            <div className="space-y-2">
              {[
                'Scraping, crawling, or bulk-extracting job listings or company data via automated means without written permission',
                'Attempting to access another user\'s account, data, or the admin portal without authorization',
                'Submitting spam, unsolicited messages, or mass form submissions through the contact or newsletter forms',
                'Uploading malicious files, executables, or content that violates third-party rights',
                'Using the platform to facilitate fraudulent job offers, phishing, or employment scams',
                'Circumventing any access controls, rate limits, or authentication mechanisms',
                'Using the platform for any illegal purpose under applicable law',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-neutral-400">
                  <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p>
              Violation of these prohibitions may result in immediate account suspension and, where applicable,
              referral to law enforcement.
            </p>
          </Section>

          <Section id="ip" number="08" icon={<Copyright className="w-4 h-4" />} title="Intellectual Property">
            <p>
              All design, typography, editorial content, codebase, and brand assets of GrailJobs (including the GRAIL
              JOBS wordmark and the editorial aesthetic system) are the intellectual property of GrailJobs and may not
              be reproduced, copied, or distributed without written permission.
            </p>
            <p>
              Job listing data sourced from Himalayas API is used under their public API terms. Company logos and job
              descriptions sourced from employers remain the property of their respective owners.
            </p>
            <p>
              <strong className="text-neutral-300">Your Content:</strong> You retain ownership of all content you
              upload (resumes, profile information, cover letters). By uploading content, you grant GrailJobs a
              non-exclusive, royalty-free licence to store and display that content to authorized users (administrators
              reviewing your applications) solely for platform operation purposes.
            </p>
          </Section>

          <Section id="disclaimer" number="09" icon={<AlertTriangle className="w-4 h-4" />} title="Employment Disclaimer">
            <div className="p-4 bg-neutral-900 border border-amber-900/40 rounded">
              <p className="text-amber-400/80 text-xs font-mono">
                GRAILJOBS IS A JOB DISCOVERY AND AGGREGATION PLATFORM. WE ARE NOT AN EMPLOYMENT AGENCY, STAFFING FIRM,
                OR RECRUITER. LISTING A POSITION ON GRAILJOBS OR APPLYING TO A POSITION THROUGH GRAILJOBS DOES NOT
                CREATE AN EMPLOYMENT RELATIONSHIP BETWEEN YOU AND GRAILJOBS, OR BETWEEN YOU AND ANY LISTED EMPLOYER.
              </p>
            </div>
            <p>
              We make no representations or warranties that any listed position will result in an interview, offer of
              employment, or any other outcome. Hiring decisions are made exclusively by the respective employers.
            </p>
          </Section>

          <Section id="liability" number="10" icon={<Scale className="w-4 h-4" />} title="Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, GrailJobs and its operators shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Loss of employment opportunity or income</li>
              <li>Inaccuracy or expiry of third-party job listings</li>
              <li>Service interruptions or data loss not caused by our gross negligence</li>
              <li>Actions taken by external employers or third-party platforms</li>
            </ul>
            <p>
              In jurisdictions that do not allow exclusion of certain warranties, our liability is limited to the
              maximum extent permitted by law. Our aggregate liability to you shall not exceed the greater of \$50 USD
              or the amount you paid to us in the 12 months preceding the claim (noting that GrailJobs is a free
              platform for candidates).
            </p>
          </Section>

          <Section id="termination" number="11" icon={<Ban className="w-4 h-4" />} title="Account Suspension & Termination">
            <p>
              <strong className="text-neutral-300">By You:</strong> You may delete your account at any time from your
              dashboard Settings tab. Account deletion permanently removes your profile, applications, resumes, and
              saved jobs within 30 days.
            </p>
            <p>
              <strong className="text-neutral-300">By GrailJobs:</strong> We reserve the right to suspend or terminate
              your account without notice if we determine, in our sole discretion, that you have violated these Terms,
              engaged in prohibited conduct, or posed a security risk to the platform or other users.
            </p>
            <p>
              Sections on Intellectual Property, Employment Disclaimer, Limitation of Liability, and Prohibited Conduct
              survive termination of your account.
            </p>
          </Section>

          <Section id="changes" number="12" icon={<FileText className="w-4 h-4" />} title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we make material changes, we will update the "Last
              Updated" date at the top of this page and, where appropriate, notify registered users via email.
              Continued use of GrailJobs after such changes constitutes acceptance of the revised Terms.
            </p>
            <p>
              Questions about these Terms? Contact us at{' '}
              <a href="mailto:hello@grailjobs.online" className="text-white underline underline-offset-2">
                hello@grailjobs.online
              </a>
              .
            </p>
          </Section>
        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t border-neutral-800 flex flex-wrap gap-6 text-xs font-mono text-neutral-500">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy →</Link>
          <Link to="/security" className="hover:text-white transition-colors">Security Standards →</Link>
          <Link to="/contact" className="hover:text-white transition-colors">Contact Editorial →</Link>
        </div>
      </div>
    </div>
  );
};
