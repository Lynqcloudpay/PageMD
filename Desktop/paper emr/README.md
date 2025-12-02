# PageMD - MVP for Clinic

PageMD is a minimal, paper-chart-like electronic medical record system that preserves the simplicity of paper charts while providing digital benefits.

## Features

- **Paper-first simplicity**: One-page visit notes with familiar sections
- **Patient snapshot**: Quick view of problems, meds, allergies, and recent notes
- **Visit documentation**: HPI, ROS, PE, Assessment & Plan in a single view
- **Labs viewer**: Integrated lab results with FHIR support
- **e-Prescribing**: Electronic prescription management (integration-ready)
- **Document management**: Upload and review PDFs, CCDA, and other documents
- **Referrals**: Create and track referrals to specialists
- **Secure messaging**: Internal messaging and task assignment
- **Audit logging**: Complete audit trail of all actions

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT with role-based access control

## Setup

1. Install dependencies:
```bash
npm run install-all
```

2. Set up environment variables:
```bash
cp server/.env.example server/.env
# Edit server/.env with your database credentials
```

3. Run database migrations:
```bash
cd server && npm run migrate
```

4. Start development servers:
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## User Roles

- **Clinician** (MD/NP/PA): Full access to charts, orders, e-prescribing, signing notes
- **Nurse/MA**: Vitals entry, intake, messaging, order requests
- **Front-desk**: Appointments, demographics, document uploads
- **Admin**: User management, audit logs

## Security & Compliance

- TLS 1.2+ for all transports
- AES-256 encryption at rest
- Role-based access control
- Comprehensive audit logging
- HIPAA-focused security measures

## License

MIT



