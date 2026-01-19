const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const DEFAULT_LEGAL_SETTINGS = [
    {
        key: 'hipaa_notice',
        category: 'legal',
        description: 'HIPAA Notice of Privacy Practices',
        value: `NOTICE OF PRIVACY PRACTICES\n\nThis notice describes how medical information about you may be used and disclosed and how you can get access to this information. Please review it carefully.\n\nOUR PLEDGE REGARDING HEALTH INFORMATION:\nWe understand that health information about you and your health is personal. We are committed to protecting health information about you. We create a record of the care and services you receive at {CLINIC_NAME}. We need this record to provide you with quality care and to comply with certain legal requirements.\n\nHOW WE MAY USE AND DISCLOSE HEALTH INFORMATION ABOUT YOU:\n- For Treatment\n- For Payment\n- For Health Care Operations\n- To Individuals Involved in Your Care\n- Personal Representatives\n- Business Associates\n- Appointment Reminders\n- Health-Related Benefits and Services\n\nYOUR RIGHTS REGARDING HEALTH INFORMATION ABOUT YOU:\n- Right to Inspect and Copy\n- Right to Amend\n- Right to an Accounting of Disclosures\n- Right to Request Restrictions\n- Right to Request Confidential Communications\n- Right to a Paper Copy of This Notice`
    },
    {
        key: 'consent_to_treat',
        category: 'legal',
        description: 'General Consent to Medical Treatment',
        value: `CONSENT TO MEDICAL TREATMENT\n\nI hereby consent to and authorize the administration of all medical treatments and diagnostic procedures which may be advised or recommended by the medical providers at {CLINIC_NAME}. I understand that no guarantees have been made to me as to the results of any examination or treatment.\n\nI understand that my treatment may include telehealth services, and I consent to the use of electronic communications for this purpose.\n\nI recognize that my care is a collaborative effort between myself and my providers, and I agree to participate actively in my treatment plan.`
    },
    {
        key: 'assignment_of_benefits',
        category: 'legal',
        description: 'Assignment of Benefits and Financial Responsibility',
        value: `ASSIGNMENT OF BENEFITS AND FINANCIAL RESPONSIBILITY\n\nI hereby assign and authorize direct payment to {CLINIC_NAME} of all insurance benefits otherwise payable to me for services rendered. I understand that I am financially responsible for all charges not covered by my insurance, including co-payments, deductibles, and non-covered services.\n\nI authorize the release of any medical information necessary to process my insurance claims and to determine benefits payable for related services.`
    },
    {
        key: 'release_of_information',
        category: 'legal',
        description: 'Release of Information to Representative',
        value: `AUTHORIZATION TO RELEASE INFORMATION\n\nI authorize {CLINIC_NAME} to discuss my medical care and treatment, including but not limited to diagnosis, medications, and laboratory results, with the following individuals:\n{ROI_LIST}\n\nThis authorization shall remain in effect until revoked by me in writing.`
    }
];

async function seedIntakeSettings() {
    const client = await pool.connect();
    try {
        const schemasRes = await client.query("SELECT schema_name FROM public.clinics WHERE status = 'active' UNION SELECT 'public'");
        const schemas = schemasRes.rows.map(r => r.schema_name);

        for (const schema of schemas) {
            console.log(`Seeding intake_settings for schema: ${schema}`);
            await client.query(`SET search_path TO ${schema}, public`);

            for (const setting of DEFAULT_LEGAL_SETTINGS) {
                await client.query(`
                    INSERT INTO intake_settings (key, category, description, value)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (key) DO UPDATE SET 
                        value = CASE WHEN intake_settings.value = '' THEN EXCLUDED.value ELSE intake_settings.value END,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category
                `, [setting.key, setting.category, setting.description, setting.value]);
            }
        }
        console.log('✅ Intake settings seeded successfully.');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedIntakeSettings();
