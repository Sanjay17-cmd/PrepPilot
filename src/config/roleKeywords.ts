/**
 * Role-specific keyword lists for resume analysis.
 * Used by resumeService to send relevant keywords to Gemini.
 * Static config — NOT student data.
 */
export const ROLE_KEYWORDS: Record<string, string[]> = {
  'Software Developer': [
    'Data Structures', 'Algorithms', 'OOP', 'DBMS', 'SQL', 'Git', 'REST API',
    'Time Complexity', 'Arrays', 'Linked List', 'Trees', 'Graphs', 'Dynamic Programming',
    'Java', 'Python', 'C++', 'Operating Systems', 'Computer Networks', 'System Design',
  ],
  'Full Stack Developer': [
    'HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'REST API', 'SQL', 'MongoDB',
    'Git', 'Docker', 'TypeScript', 'Express', 'Authentication', 'Database Design',
    'Frontend', 'Backend', 'API Integration', 'Deployment',
  ],
  'Data Scientist': [
    'Python', 'SQL', 'Machine Learning', 'Statistics', 'Pandas', 'NumPy', 'Scikit-learn',
    'Data Analysis', 'Visualization', 'R', 'Jupyter', 'TensorFlow', 'Feature Engineering',
    'A/B Testing', 'Regression', 'Classification', 'Deep Learning',
  ],
  'Data Analyst': [
    'SQL', 'Excel', 'Python', 'Power BI', 'Tableau', 'Data Visualization', 'Statistics',
    'Pandas', 'Dashboard', 'ETL', 'Data Cleaning', 'Business Intelligence',
    'Reporting', 'Pivot Tables',
  ],
  'Cybersecurity Engineer': [
    'Networking', 'Linux', 'Python', 'Firewalls', 'Penetration Testing', 'SIEM',
    'Cryptography', 'Vulnerability Assessment', 'OWASP', 'Security Auditing',
    'TCP/IP', 'Ethical Hacking', 'SOC', 'Incident Response',
  ],
  'DevOps Engineer': [
    'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Git', 'Linux', 'AWS', 'Terraform',
    'Ansible', 'Monitoring', 'Shell Scripting', 'Nginx', 'Cloud', 'Deployment Pipeline',
  ],
  'Machine Learning Engineer': [
    'Python', 'TensorFlow', 'PyTorch', 'Machine Learning', 'Deep Learning', 'NLP',
    'Computer Vision', 'Model Deployment', 'MLOps', 'Feature Engineering',
    'Scikit-learn', 'REST API', 'Docker', 'SQL',
  ],
  'Backend Developer': [
    'Node.js', 'Java', 'Python', 'REST API', 'SQL', 'PostgreSQL', 'MongoDB',
    'Redis', 'Authentication', 'Authorization', 'Microservices', 'Git',
    'System Design', 'Docker', 'Message Queues',
  ],
  'Frontend Developer': [
    'HTML', 'CSS', 'JavaScript', 'React', 'TypeScript', 'Responsive Design',
    'Web Accessibility', 'Git', 'Figma', 'Redux', 'Performance Optimization',
    'Browser APIs', 'Testing', 'Build Tools',
  ],
  'Cloud Engineer': [
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Networking',
    'Linux', 'CI/CD', 'Cloud Security', 'IAM', 'S3', 'EC2', 'Load Balancing',
  ],
}

// Fallback for unknown roles
export const DEFAULT_KEYWORDS = [
  'Communication', 'Problem Solving', 'Teamwork', 'SQL', 'Python',
  'Git', 'Data Analysis', 'Project Management',
]
