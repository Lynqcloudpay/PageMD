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

## Quick Setup (New Computer)

After cloning the repository, run this single command in Cursor terminal:

```bash
npm run setup
```

**Or use:** `npm run init` or `bash setup.sh`

This will:
- ✅ Install all dependencies (server + client)
- ✅ Create `.env` file with default settings
- ✅ Check database setup
- ✅ Guide you through remaining steps

**Or use the one-liner:**
```bash
cd server && npm install && cd ../client && npm install && cd .. && [ ! -f server/.env ] && cat > server/.env << 'EOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=paper_emr
DB_USER=postgres
DB_PASSWORD=postgres
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
EOF
echo "✅ Setup complete! Edit server/.env, then start servers:"
echo "   Terminal 1: cd server && npm start"
echo "   Terminal 2: cd client && npm run dev"
```

## Manual Setup

1. Install dependencies:
```bash
cd server && npm install && cd ../client && npm install && cd ..
```

2. Set up environment variables:
```bash
# Create server/.env file with your database credentials
# See QUICK_SETUP.md for template
```

3. Create database:
```bash
createdb paper_emr
```

4. Run database migrations:
```bash
cd server && npm run migrate && cd ..
```

5. Start development servers:
```bash
# Terminal 1:
cd server && npm start

# Terminal 2:
cd client && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

See `QUICK_SETUP.md` for detailed instructions.

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

## Maintenance & Recovery

- **Clinical Archives**: Deleted clinic data is automatically encrypted and stored in `server/archives/`.
- **Data Recovery**: Use the utility script to decrypt HIPAA archives:
  ```bash
  node server/scripts/decrypt-archive.js --file ./path/to/backup.enc --out ./recovered.sql
  ```
- **Backup Location**: Production archives are isolated from git but protected during deployments via `deploy-fast.sh`.

## License

MIT



