import { PublishedJob } from '../types';

export const INITIAL_PUBLISHED_JOBS: PublishedJob[] = [
  {
    id: 'job-synesis-001',
    title: 'Senior Full-Stack Engineer (TypeScript & Cloud)',
    department: 'Engineering',
    location: 'Dhaka, Bangladesh',
    workplace_type: 'Hybrid',
    employment_type: 'Full-time',
    summary:
      'Join Synesis IT to build mission-critical enterprise HRMIS SaaS platforms, scaling microservices and modern React applications serving thousands of public and private sector employees.',
    responsibilities: [
      'Design, implement, and maintain high-throughput backend services and clean React user experiences.',
      'Architect robust PostgreSQL schemas, Supabase Edge Functions, and secure Row Level Security policies.',
      'Optimize application latency and database indexing across mission-critical SaaS workloads.',
      'Collaborate with Product Managers, UX Designers, and QA Engineers in an agile bi-weekly cadence.',
      'Mentor intermediate engineers and lead architectural design reviews for recruitment modules.'
    ],
    requirements: [
      '5+ years of production experience with TypeScript, React, Node.js, and relational databases (PostgreSQL preferred).',
      'Proven expertise with modern REST / GraphQL APIs, Supabase or Firebase authentication and RLS security models.',
      'Familiarity with Tailwind CSS, Vite, automated testing (Jest / Playwright), and Docker containerization.',
      'Strong communication skills and dedication to building accessible, resilient user interfaces.'
    ],
    benefits: [
      'Competitive compensation package with bi-annual performance bonuses',
      'Comprehensive health, dental, and life insurance for employee and dependents',
      'Flexible hybrid working arrangements with home office setup allowance',
      'Annual learning stipend for certifications, conferences, and technical books',
      'Subsidized wellness programs and catered team lunches'
    ],
    published_salary_min: 160000,
    published_salary_max: 220000,
    salary_currency: 'BDT',
    salary_is_public: true,
    vacancy_count: 2,
    application_deadline: '2026-11-15T23:59:59Z',
    status: 'published',
    published_at: '2026-10-01T08:00:00Z',
    created_at: '2026-10-01T08:00:00Z',
    screening_questions: [
      {
        id: 'q1',
        question: 'How many years of commercial experience do you have with TypeScript and React?',
        type: 'select',
        required: true,
        options: ['Less than 2 years', '2 - 4 years', '5 - 7 years', '8+ years']
      },
      {
        id: 'q2',
        question: 'Have you implemented PostgreSQL Row Level Security (RLS) policies in production?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q3',
        question: 'What is your current notice period?',
        type: 'select',
        required: true,
        options: ['Immediate', '15 days', '30 days', '60 days', '90 days']
      },
      {
        id: 'q4',
        question: 'Share a link to a project or repository you are most proud of:',
        type: 'text',
        required: false,
        placeholder: 'https://github.com/username/project'
      }
    ]
  },
  {
    id: 'job-synesis-002',
    title: 'Lead Product Designer (Design Systems & Enterprise UX)',
    department: 'Product & Design',
    location: 'Dhaka, Bangladesh',
    workplace_type: 'Hybrid',
    employment_type: 'Full-time',
    summary:
      'We are looking for a Lead Product Designer to guide the design foundation of Synesis HRMIS and Candidate Portal, ensuring cohesive UX tokens, accessibility compliance, and high usability.',
    responsibilities: [
      'Evolve and maintain the Synesis design system across web and mobile experiences.',
      'Lead end-to-end design workflows: discovery, user journeys, wireframing, high-fidelity prototypes, and design handoff.',
      'Conduct usability research sessions with HR administrators, recruiters, and candidates.',
      'Champion WCAG 2.1 AA accessibility standards, zero-clutter visual hierarchy, and cohesive typography.'
    ],
    requirements: [
      '6+ years of UX/UI product design experience specializing in enterprise SaaS or complex web systems.',
      'Mastery of Figma, component token architecture, auto-layout, and interactive prototypes.',
      'Demonstrated portfolio showing thoughtful problem-solving, UX metric improvements, and systems thinking.',
      'Strong understanding of HTML/CSS capabilities and design system implementation constraints.'
    ],
    benefits: [
      'Top-tier salary package with annual equity options',
      'Flexible working schedule and remote work options',
      'Premium health insurance and annual wellness allowance',
      'Dedicated equipment budget for high-end display and MacBook Pro',
      'Professional conference and workshop sponsorships'
    ],
    published_salary_min: 150000,
    published_salary_max: 200000,
    salary_currency: 'BDT',
    salary_is_public: false, // Hidden salary test case!
    vacancy_count: 1,
    application_deadline: '2026-11-20T23:59:59Z',
    status: 'published',
    published_at: '2026-10-02T10:00:00Z',
    created_at: '2026-10-02T10:00:00Z',
    screening_questions: [
      {
        id: 'q1',
        question: 'Link to your online design portfolio (required):',
        type: 'text',
        required: true,
        placeholder: 'https://dribbble.com/yourname or personal website'
      },
      {
        id: 'q2',
        question: 'Do you have direct experience building or managing multi-brand design tokens?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q3',
        question: 'What is your expected gross monthly salary (BDT)?',
        type: 'text',
        required: true,
        placeholder: 'e.g. 180,000'
      }
    ]
  },
  {
    id: 'job-synesis-003',
    title: 'Senior DevOps & Site Reliability Engineer',
    department: 'Engineering',
    location: 'Remote',
    workplace_type: 'Remote',
    employment_type: 'Full-time',
    summary:
      'Manage and enhance our multi-cloud deployment pipelines, Kubernetes clusters, automated CI/CD security scanning, and high-availability database replication across regional data centers.',
    responsibilities: [
      'Maintain Kubernetes clusters (EKS / GKE) with automated scaling, self-healing, and observability.',
      'Manage CI/CD workflows using GitHub Actions and ArgoCD for zero-downtime blue-green deployments.',
      'Ensure 99.95% system uptime, disaster recovery drills, and automated database backups.',
      'Implement zero-trust security postures, IAM permissions, and secret management.'
    ],
    requirements: [
      '4+ years working in DevOps, Cloud Engineering, or SRE roles.',
      'Deep hands-on expertise with Terraform, Kubernetes, Helm, and Linux administration.',
      'Strong scripting ability in Bash and Python/Go.',
      'Experience with Prometheus, Grafana, OpenTelemetry, and incident management workflows.'
    ],
    benefits: [
      '100% remote flexibility with home office setup stipend',
      'Competitive international salary benchmarked against regional tech leaders',
      'Medical, dental, vision coverage with mental wellness support',
      'Flexible paid time off (24 days vacation + national holidays)'
    ],
    published_salary_min: 170000,
    published_salary_max: 230000,
    salary_currency: 'BDT',
    salary_is_public: true,
    vacancy_count: 1,
    application_deadline: '2026-11-10T23:59:59Z',
    status: 'published',
    published_at: '2026-10-04T09:00:00Z',
    created_at: '2026-10-04T09:00:00Z',
    screening_questions: [
      {
        id: 'q1',
        question: 'Do you have production experience managing Kubernetes clusters with Terraform?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q2',
        question: 'What is your primary cloud provider specialty?',
        type: 'select',
        required: true,
        options: ['AWS', 'Google Cloud (GCP)', 'Microsoft Azure', 'Multi-cloud']
      }
    ]
  },
  {
    id: 'job-synesis-004',
    title: 'HR Operations & Talent Specialist',
    department: 'HR & People Ops',
    location: 'Dhaka, Bangladesh',
    workplace_type: 'On-site',
    employment_type: 'Full-time',
    summary:
      'Drive seamless recruitment workflows, interview coordination, candidate experience, and onboarding handoffs for Synesis corporate and engineering divisions.',
    responsibilities: [
      'Collaborate with hiring managers to publish vacancies, calibrate candidate profiles, and schedule panel interviews.',
      'Manage candidate communications throughout the application lifecycle to ensure an empathetic, transparent experience.',
      'Administer preboarding verification documents, contract preparation, and employee orientation scheduling.',
      'Track recruitment metrics (time-to-hire, offer acceptance rate, source efficiency) in Synesis HRMIS.'
    ],
    requirements: [
      '3+ years of technical recruitment or human resources operations experience.',
      'Strong grasp of local labor laws, employment verification standards, and payroll documentation.',
      'Superb interpersonal communication, scheduling diligence, and dispute resolution ability.',
      'Proficiency with Applicant Tracking Systems (ATS) and HRMIS platforms.'
    ],
    benefits: [
      'Festival bonuses and annual performance incentives',
      'Gratuity and Provident fund benefits',
      'Medical coverage for employee and family members',
      'Dynamic, growth-oriented corporate learning culture'
    ],
    published_salary_min: 75000,
    published_salary_max: 105000,
    salary_currency: 'BDT',
    salary_is_public: true,
    vacancy_count: 2,
    application_deadline: '2026-11-25T23:59:59Z',
    status: 'published',
    published_at: '2026-10-05T11:00:00Z',
    created_at: '2026-10-05T11:00:00Z',
    screening_questions: [
      {
        id: 'q1',
        question: 'Have you used an enterprise HRMIS or ATS platform in your previous roles?',
        type: 'yes_no',
        required: true
      },
      {
        id: 'q2',
        question: 'Are you comfortable working on-site at our Dhaka headquarters?',
        type: 'yes_no',
        required: true
      }
    ]
  },
  {
    id: 'job-synesis-005',
    title: 'Data & AI Engineer (Machine Learning Pipelines)',
    department: 'Data & AI',
    location: 'Dhaka, Bangladesh',
    workplace_type: 'Hybrid',
    employment_type: 'Full-time',
    summary:
      'Build scalable data ingestion pipelines, vector indexing, and enterprise AI automation models integrated into Synesis HRMIS intelligence modules.',
    responsibilities: [
      'Develop ETL pipelines processing unstructured candidate resumes and HR records with high accuracy.',
      'Train, fine-tune, and evaluate ML models for skill taxonomy matching and semantic job search.',
      'Deploy low-latency inferencing services using Python, FastAPI, and container orchestration.',
      'Enforce data privacy, anonymization, and GDPR-aligned recruitment compliance.'
    ],
    requirements: [
      '3+ years of experience with Python, PyTorch/TensorFlow, and data pipeline frameworks.',
      'Knowledge of vector databases (pgvector, Qdrant), embeddings, and transformer architectures.',
      'Solid foundations in SQL, data cleaning, and statistical validation.',
      'Experience with REST APIs and containerized microservice deployments.'
    ],
    benefits: [
      'Attractive compensation package and project milestones bonus',
      'Hybrid work flexibility',
      'Health insurance and medical allowance',
      'Access to GPU compute clusters for experimentation and research'
    ],
    published_salary_min: 140000,
    published_salary_max: 190000,
    salary_currency: 'BDT',
    salary_is_public: false, // Hidden salary
    vacancy_count: 1,
    application_deadline: '2026-11-18T23:59:59Z',
    status: 'published',
    published_at: '2026-10-06T14:00:00Z',
    created_at: '2026-10-06T14:00:00Z',
    screening_questions: [
      {
        id: 'q1',
        question: 'Describe your experience with LLMs or semantic search models:',
        type: 'text',
        required: true,
        placeholder: 'Brief summary of relevant frameworks and models used...'
      },
      {
        id: 'q2',
        question: 'Have you worked with PostgreSQL pgvector or vector databases?',
        type: 'yes_no',
        required: true
      }
    ]
  }
];
