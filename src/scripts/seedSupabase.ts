/**
 * GrailJobs – Supabase seed + migration script
 * Acts as the single source of truth for all initial data.
 * Run once: npx tsx src/scripts/seedSupabase.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Supabase client ─────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!supabaseUrl.startsWith('http') || !supabaseKey) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function upsert(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) { console.log(`⏭  ${table}: nothing to seed`); return; }
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' });
  if (error) console.error(`❌  ${table}:`, error.message);
  else       console.log(`✅  ${table}: ${rows.length} rows`);
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const categories = [
  { id: 'cat-1', name: 'UI/UX Design',       slug: 'ui-ux-design',      description: 'Product design, design systems, interface architecture', icon: 'Layout'   },
  { id: 'cat-2', name: 'Web & Frontend',      slug: 'web-frontend',      description: 'React, TypeScript, WebGL, creative engineering',           icon: 'Code'      },
  { id: 'cat-3', name: 'Motion & 3D',         slug: 'motion-3d',         description: 'Lottie, After Effects, Three.js, kinetic animation',       icon: 'Sparkles'  },
  { id: 'cat-4', name: 'Art Direction',       slug: 'art-direction',     description: 'Creative direction, brand identity, visual storytelling',  icon: 'Compass'   },
  { id: 'cat-5', name: 'eCommerce & Growth',  slug: 'ecommerce-growth',  description: 'Shopify Plus, direct-to-consumer optimization',            icon: 'TrendingUp'},
];

const skills = [
  { id: 'sk-1',  name: 'Figma',            slug: 'figma'           },
  { id: 'sk-2',  name: 'Design Systems',   slug: 'design-systems'  },
  { id: 'sk-3',  name: 'React',            slug: 'react'           },
  { id: 'sk-4',  name: 'Tailwind CSS',     slug: 'tailwind-css'    },
  { id: 'sk-5',  name: 'Lottie',           slug: 'lottie'          },
  { id: 'sk-6',  name: 'Three.js / WebGL', slug: 'threejs-webgl'   },
  { id: 'sk-7',  name: 'Shopify Plus',     slug: 'shopify-plus'    },
  { id: 'sk-8',  name: 'Typography',       slug: 'typography'      },
  { id: 'sk-9',  name: 'UX Research',      slug: 'ux-research'     },
  { id: 'sk-10', name: 'Motion Design',    slug: 'motion-design'   },
];

const companies = [
  {
    id: 'comp-1', name: 'Storetasker', slug: 'storetasker',
    logo_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=160&auto=format&fit=crop&q=80',
    cover_url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&auto=format&fit=crop&q=80',
    description: 'The leading curated freelance talent platform for high-growth DTC eCommerce brands.',
    website: 'https://storetasker.com', industry: 'Design & eCommerce Talent', company_size: '51-200',
    headquarters: 'New York, NY', country: 'United States', city: 'New York',
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5  * 86400000).toISOString(),
  },
  {
    id: 'comp-2', name: 'Dagobert', slug: 'dagobert',
    logo_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=160&auto=format&fit=crop&q=80',
    cover_url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    description: 'An independent digital creative communications agency accompanying leading global brands.',
    website: 'https://dagobert.com', industry: 'Creative Communications', company_size: '50-100',
    headquarters: 'Paris', country: 'France', city: 'Paris',
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'comp-3', name: 'Limesharp', slug: 'limesharp',
    logo_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=160&auto=format&fit=crop&q=80',
    cover_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80',
    description: 'Award-winning digital commerce agency creating bespoke solutions for fashion and lifestyle brands.',
    website: 'https://limesharp.net', industry: 'Luxury eCommerce', company_size: '20-50',
    headquarters: 'London', country: 'United Kingdom', city: 'London',
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3  * 86400000).toISOString(),
  },
];

const jobs = [
  {
    id: 'job-seed-1',
    title: 'Senior UI/UX Designer',
    slug: 'senior-ui-ux-designer-storetasker',
    company_id: 'comp-1',
    category_id: 'cat-1',
    description: 'Join our design team to craft world-class shopping experiences for leading DTC brands.',
    responsibilities: JSON.stringify(['Lead end-to-end design process', 'Create design systems', 'Collaborate with engineering']),
    requirements:     JSON.stringify(['5+ years UI/UX experience', 'Proficient in Figma', 'Portfolio of eCommerce work']),
    qualifications:   JSON.stringify(['Bachelor degree in Design or equivalent', 'Experience with Shopify']),
    benefits:         JSON.stringify(['Remote-first', 'Health insurance', 'Equity', '$2k equipment budget']),
    location: 'Remote', city: 'New York', country: 'United States',
    workplace_type: 'remote', employment_type: 'full-time', experience_level: 'senior',
    salary_min: 90000, salary_max: 130000, salary_currency: 'USD', salary_period: 'yearly',
    salary_visible: true, application_mode: 'internal',
    status: 'published', is_featured: true, promotion_status: 'active',
    published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    skills: JSON.stringify(['figma', 'design-systems', 'ux-research']),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'job-seed-2',
    title: 'Creative Frontend Engineer',
    slug: 'creative-frontend-engineer-dagobert',
    company_id: 'comp-2',
    category_id: 'cat-2',
    description: 'Build immersive, high-performance web experiences for global luxury and lifestyle brands.',
    responsibilities: JSON.stringify(['Build interactive React components', 'Implement WebGL experiences', 'Performance optimisation']),
    requirements:     JSON.stringify(['3+ years React/TypeScript', 'WebGL / Three.js experience', 'Eye for design']),
    qualifications:   JSON.stringify(['CS degree or bootcamp', 'Open-source contributions a plus']),
    benefits:         JSON.stringify(['Hybrid Paris office', 'Annual creative budget', '5 weeks holiday']),
    location: 'Paris / Remote', city: 'Paris', country: 'France',
    workplace_type: 'hybrid', employment_type: 'full-time', experience_level: 'mid',
    salary_min: 55000, salary_max: 80000, salary_currency: 'EUR', salary_period: 'yearly',
    salary_visible: true, application_mode: 'internal',
    status: 'published', is_featured: false, promotion_status: 'inactive',
    published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    skills: JSON.stringify(['react', 'threejs-webgl', 'tailwind-css']),
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'job-seed-3',
    title: 'Motion Designer',
    slug: 'motion-designer-limesharp',
    company_id: 'comp-3',
    category_id: 'cat-3',
    description: 'Craft engaging motion graphics and animations for luxury fashion brands.',
    responsibilities: JSON.stringify(['Produce Lottie animations', 'Create brand motion guidelines', 'Collaborate with art directors']),
    requirements:     JSON.stringify(['3+ years motion design', 'After Effects & Lottie', 'Fashion/luxury brand experience']),
    qualifications:   JSON.stringify(['Motion design portfolio']),
    benefits:         JSON.stringify(['London studio + remote', 'Private healthcare', 'Monthly team events']),
    location: 'London / Remote', city: 'London', country: 'United Kingdom',
    workplace_type: 'hybrid', employment_type: 'full-time', experience_level: 'mid',
    salary_min: 45000, salary_max: 65000, salary_currency: 'GBP', salary_period: 'yearly',
    salary_visible: true, application_mode: 'internal',
    status: 'published', is_featured: false, promotion_status: 'inactive',
    published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    skills: JSON.stringify(['lottie', 'motion-design', 'typography']),
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

const pricingPackages = [
  {
    id: 'pkg-1', name: 'Basic', price: 99, currency: 'USD', duration_days: 30,
    description: 'Get your job in front of qualified designers.',
    features: JSON.stringify(['30-day listing', 'Standard placement', 'Email support']),
    is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'pkg-2', name: 'Featured', price: 249, currency: 'USD', duration_days: 30,
    description: 'Featured badge + top placement for maximum visibility.',
    features: JSON.stringify(['30-day listing', 'Featured badge', 'Top of search results', 'Social media boost', 'Priority support']),
    is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'pkg-3', name: 'Bundle (3 Jobs)', price: 599, currency: 'USD', duration_days: 60,
    description: 'Post up to 3 jobs with featured placement.',
    features: JSON.stringify(['3 job slots', '60-day listings', 'Featured badge', 'Dedicated account manager']),
    is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
];

const siteSettings = [{
  id: 'default',
  site_name: 'GrailJobs',
  hero_headline: 'Find your next creative role',
  hero_subtitle: 'Curated design & creative jobs at the world\'s best studios and brands.',
  seo_title: 'GrailJobs – Curated Creative Jobs',
  seo_description: 'The best UI/UX, frontend, motion & creative jobs at leading studios worldwide.',
  contact_email: 'hello@grailjobs.co',
  twitter_url: 'https://twitter.com/grailjobs',
  github_url: '',
  linkedin_url: 'https://linkedin.com/company/grailjobs',
  footer_text: '© 2026 GrailJobs. Built with precision and typographic rigor.',
  updated_at: new Date().toISOString(),
}];

// ── Run ───────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  GrailJobs – Seeding Supabase\n');
  await upsert('categories',            categories);
  await upsert('skills',                skills);
  await upsert('companies',             companies);
  await upsert('jobs',                  jobs);
  await upsert('pricing_packages',      pricingPackages);
  await upsert('site_settings',         siteSettings);
  console.log('\n🚀  Seed complete.\n');
}

seed().catch(console.error);
