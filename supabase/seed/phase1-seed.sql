-- =============================================================================
-- PrepPilot — Phase 1 Seed Data
-- =============================================================================
-- Run AFTER phase1.sql.
-- Contains only minimal starter roles needed for the application to work.
-- Do NOT add large datasets. Students add data through the UI.
-- =============================================================================

-- Starter roles — CSE-centric but extensible
-- configuration.modules lists skill categories for future Phase 2 roadmap generation.

insert into public.roles (name, slug, category, description, is_active, is_cse_related, configuration)
values

  (
    'Software Developer',
    'software-developer',
    'software',
    'General software development — DSA, system design, and core CS fundamentals.',
    true,
    true,
    '{
      "modules": ["Programming","DSA","OOP","DBMS","OS","Computer Networks","SQL","Coding Practice","Projects","Resume","Interview Prep"],
      "skills": ["Data Structures","Algorithms","Problem Solving","System Design"],
      "assessment_topics": ["DSA","OOP","DBMS","OS","CN"]
    }'::jsonb
  ),

  (
    'Full Stack Developer',
    'full-stack-developer',
    'software',
    'Frontend and backend development — React, Node, APIs, and databases.',
    true,
    true,
    '{
      "modules": ["Programming","HTML","CSS","JavaScript","React","Backend","Databases","APIs","Git","Projects"],
      "skills": ["Frontend","Backend","REST APIs","Database Design"],
      "assessment_topics": ["HTML/CSS","JavaScript","React","Node.js","SQL"]
    }'::jsonb
  ),

  (
    'Backend Developer',
    'backend-developer',
    'software',
    'Server-side engineering — APIs, databases, performance, and scalability.',
    true,
    true,
    '{
      "modules": ["Programming","APIs","Databases","System Design","OS","Computer Networks","Security","Projects"],
      "skills": ["REST/GraphQL APIs","SQL/NoSQL","System Design","Performance"],
      "assessment_topics": ["APIs","Databases","OS","CN","System Design"]
    }'::jsonb
  ),

  (
    'Frontend Developer',
    'frontend-developer',
    'software',
    'UI engineering — HTML, CSS, JavaScript, and modern frameworks.',
    true,
    true,
    '{
      "modules": ["HTML","CSS","JavaScript","React","Accessibility","Performance","Testing","Projects"],
      "skills": ["HTML/CSS","JavaScript","React","Responsive Design"],
      "assessment_topics": ["HTML","CSS","JavaScript","React"]
    }'::jsonb
  ),

  (
    'Data Analyst',
    'data-analyst',
    'data',
    'Business intelligence — SQL, data wrangling, and visualisation.',
    true,
    true,
    '{
      "modules": ["SQL","Python","Excel","Statistics","Data Visualization","Business Insights","Projects"],
      "skills": ["SQL","Python","Statistics","Tableau/Power BI"],
      "assessment_topics": ["SQL","Statistics","Python","Data Viz"]
    }'::jsonb
  ),

  (
    'Data Scientist',
    'data-scientist',
    'data',
    'ML model development — Python, statistics, and data engineering.',
    true,
    true,
    '{
      "modules": ["Python","Statistics","SQL","Pandas","NumPy","Machine Learning","Feature Engineering","Projects"],
      "skills": ["Python","Statistics","Machine Learning","Data Engineering"],
      "assessment_topics": ["Python","Statistics","ML Concepts","SQL"]
    }'::jsonb
  ),

  (
    'AI / ML Engineer',
    'ai-ml-engineer',
    'data',
    'Deep learning, MLOps, and production AI systems.',
    true,
    true,
    '{
      "modules": ["Python","Mathematics","Deep Learning","NLP","Computer Vision","MLOps","Cloud","Projects"],
      "skills": ["Deep Learning","PyTorch/TensorFlow","MLOps","Mathematics"],
      "assessment_topics": ["ML Concepts","Deep Learning","Mathematics","Python"]
    }'::jsonb
  ),

  (
    'Cybersecurity Engineer',
    'cybersecurity-engineer',
    'security',
    'Network security, ethical hacking, and security engineering.',
    true,
    true,
    '{
      "modules": ["Networking","Linux","OS Security","Web Security","Cryptography","Ethical Hacking","Tools","Labs"],
      "skills": ["Networking","Linux","Security Fundamentals","Penetration Testing"],
      "assessment_topics": ["Networking","Linux","Web Security","Cryptography"]
    }'::jsonb
  ),

  (
    'Cloud / DevOps Engineer',
    'cloud-devops-engineer',
    'cloud',
    'Cloud infrastructure, CI/CD, and site reliability engineering.',
    true,
    true,
    '{
      "modules": ["Linux","AWS/GCP/Azure","Docker","Kubernetes","CI/CD","Infrastructure as Code","Monitoring","Projects"],
      "skills": ["Cloud Platforms","Docker/K8s","CI/CD","Infrastructure"],
      "assessment_topics": ["Cloud Fundamentals","Docker","Linux","CI/CD"]
    }'::jsonb
  ),

  (
    'QA / Automation Engineer',
    'qa-automation-engineer',
    'qa',
    'Testing, automation frameworks, and quality assurance.',
    true,
    true,
    '{
      "modules": ["Testing Fundamentals","Manual Testing","Selenium","API Testing","CI/CD","Projects"],
      "skills": ["Manual Testing","Automation","Selenium/Playwright","API Testing"],
      "assessment_topics": ["Testing Concepts","Selenium","API Testing"]
    }'::jsonb
  ),

  (
    'Business Analyst',
    'business-analyst',
    'business',
    'Requirements gathering, data analysis, and stakeholder management.',
    true,
    false,
    '{
      "modules": ["Excel","SQL","Business Communication","Requirements","Process Mapping","Projects"],
      "skills": ["SQL","Excel","Communication","Requirements Analysis"],
      "assessment_topics": ["SQL","Excel","Business Concepts"]
    }'::jsonb
  ),

  (
    'UI/UX Designer',
    'ui-ux-designer',
    'design',
    'User research, interaction design, and design systems.',
    true,
    false,
    '{
      "modules": ["Design Principles","User Research","Wireframing","Figma","Prototyping","Portfolio"],
      "skills": ["Figma","User Research","Interaction Design","Visual Design"],
      "assessment_topics": ["Design Principles","UX Research","Figma"]
    }'::jsonb
  ),

  (
    'Core Engineering',
    'core-engineering',
    'core',
    'Mechanical, civil, electrical, or electronics engineering roles.',
    true,
    false,
    '{
      "modules": ["Core Subject 1","Core Subject 2","Aptitude","Communication","Resume","Interview Prep"],
      "skills": ["Domain Knowledge","Aptitude","Problem Solving"],
      "assessment_topics": ["Core Subjects","Aptitude"]
    }'::jsonb
  )

on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  configuration = excluded.configuration,
  is_active = excluded.is_active,
  updated_at = now();

-- =============================================================================
-- END OF PHASE 1 SEED
-- =============================================================================
-- To create your first admin:
--   1. Sign up normally in the application.
--   2. Find your user id: select id from auth.users where email = 'your@email.com';
--   3. Promote to admin:  update public.profiles set user_type = 'admin' where id = '<id>';
-- =============================================================================
