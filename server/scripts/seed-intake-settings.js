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
        value: `NOTICE OF PRIVACY PRACTICES

THIS NOTICE DESCRIBES HOW MEDICAL INFORMATION ABOUT YOU MAY BE USED AND DISCLOSED AND HOW YOU CAN GET ACCESS TO THIS INFORMATION. PLEASE REVIEW IT CAREFULLY.

EFFECTIVE DATE: {EFFECTIVE_DATE}

OUR COMMITMENT TO YOUR PRIVACY

{CLINIC_NAME} is dedicated to maintaining the privacy of your protected health information (PHI). PHI is information that may identify you and that relates to your past, present, or future physical or mental health condition and related health care services. This Notice of Privacy Practices ("Notice") is required by law to provide you with the legal duties and the privacy practices that {CLINIC_NAME} maintains concerning your PHI. It also describes your rights regarding your health information.

We are required by law to:
• Maintain the privacy of your PHI as required by law
• Provide you with this Notice of our duties and privacy practices regarding PHI
• Notify you in the event of a breach of your unsecured PHI
• Follow the terms of the Notice that is currently in effect

HOW WE MAY USE AND DISCLOSE YOUR HEALTH INFORMATION

Treatment: We may use or disclose your health information to provide, coordinate, or manage your health care and any related services. For example, we may share your PHI with a specialist physician to whom you have been referred for treatment.

Payment: We may use and disclose your health information to obtain payment for services we provide to you. For example, we may send claims to your insurance company containing certain health information.

Healthcare Operations: We may use and disclose health information about you for operational purposes. For example, your health information may be used to review the quality of services you received.

Appointment Reminders and Health-Related Benefits: We may use and disclose your health information to contact you as a reminder for scheduled appointments, or to provide information about treatment alternatives or other health-related benefits and services.

Individuals Involved in Your Care: We may disclose your health information to a family member, friend, or other individual who you indicate is involved in your care or payment for your care, unless you object.

YOUR RIGHTS REGARDING YOUR HEALTH INFORMATION

You have the following rights regarding your health information:

Right to Inspect and Copy: You have the right to inspect and obtain a copy of your health information, including medical and billing records. We may charge a reasonable fee for copies.

Right to Amend: If you believe that information in your record is incorrect or incomplete, you may ask us to amend the information. We may deny your request under certain circumstances.

Right to an Accounting of Disclosures: You have the right to request an "accounting of disclosures" – a list of certain disclosures we have made of your health information.

Right to Request Restrictions: You have the right to request a restriction on certain uses and disclosures of your health information. We are not required to agree to your request, except in certain circumstances.

Right to Request Confidential Communications: You have the right to request that we communicate with you about health matters in a certain way or at a certain location.

Right to a Paper Copy of This Notice: You have the right to a paper copy of this Notice at any time. You may contact us at {CLINIC_ADDRESS} or call {CLINIC_PHONE} to request a paper copy.

Right to File a Complaint: If you believe your privacy rights have been violated, you may file a complaint with our office or with the Secretary of the Department of Health and Human Services. To file a complaint with our office, contact us at {PRIVACY_EMAIL}.

CHANGES TO THIS NOTICE

We reserve the right to change this Notice and make the new provisions effective for all PHI that we maintain. If we make material changes to this Notice, we will post the revised Notice in our office and on our website.

CONTACT INFORMATION

{CLINIC_NAME}
{CLINIC_ADDRESS}
Phone: {CLINIC_PHONE}
Email: {PRIVACY_EMAIL}

If you have any questions about this Notice, please contact our Privacy Officer at {PRIVACY_EMAIL}.`
    },
    {
        key: 'consent_to_treat',
        category: 'legal',
        description: 'General Consent to Medical Treatment',
        value: `CONSENT TO MEDICAL TREATMENT

PATIENT CONSENT FOR EVALUATION AND TREATMENT

I, the undersigned patient (or authorized representative), hereby voluntarily consent to and authorize {CLINIC_NAME} and its physicians, nurse practitioners, physician assistants, and other healthcare providers to provide such diagnostic procedures, examinations, and treatments as may be deemed necessary, advisable, or appropriate in my case.

SCOPE OF CONSENT

This consent includes, but is not limited to:
• Physical examinations and medical history taking
• Laboratory tests, X-rays, and other diagnostic procedures
• Administration of medications, injections, and immunizations
• Minor surgical procedures performed in the office setting
• Telehealth consultations via audio and video technology

UNDERSTANDING OF TREATMENT

I understand that:
1. The practice of medicine is not an exact science, and no guarantees or assurances have been made to me concerning the results of any examination, test, or treatment.
2. I have the right to ask questions about any procedure or treatment and to have those questions answered to my satisfaction before proceeding.
3. I may refuse any examination, test, treatment, or procedure at any time and that such refusal will not affect my access to future care.
4. Alternative treatment options may be available and have been or will be discussed with me.

TELEHEALTH SERVICES CONSENT

If I receive telehealth services, I understand that:
• My care may be provided via audio, video, or other electronic communications
• Technical difficulties may occur, and an in-person visit may be required
• I have the right to withdraw consent for telehealth services at any time
• Electronic communications may be recorded for quality assurance purposes

COLLABORATIVE CARE

I recognize that my healthcare is a collaborative effort. I agree to:
• Provide accurate and complete information about my health history
• Follow the treatment plan agreed upon with my healthcare providers
• Keep scheduled appointments or provide timely notice of cancellations
• Ask questions when I do not understand my care instructions

DURATION OF CONSENT

This consent shall remain in effect for all future visits and treatments at {CLINIC_NAME} unless revoked by me in writing.

By signing below (or electronically acknowledging), I confirm that I have read and understand this consent form, have had the opportunity to ask questions, and voluntarily consent to treatment.`
    },
    {
        key: 'assignment_of_benefits',
        category: 'legal',
        description: 'Assignment of Benefits and Financial Responsibility',
        value: `ASSIGNMENT OF BENEFITS AND FINANCIAL RESPONSIBILITY

AUTHORIZATION TO PAY BENEFITS

I hereby authorize and direct my insurance company(ies), including Medicare, Medicaid, or any other third-party payer, to pay directly to {CLINIC_NAME} all medical and/or surgical benefits payable to me for services rendered. I understand that this assignment does not relieve me of my financial responsibility for charges not covered by my insurance.

FINANCIAL RESPONSIBILITY

I understand and agree that:

1. PATIENT RESPONSIBILITY: I am personally and fully responsible for payment of all charges incurred for services provided to me (or the patient, if I am signing on behalf of a minor or dependent), regardless of insurance coverage.

2. CO-PAYMENTS AND DEDUCTIBLES: I agree to pay all applicable co-payments at the time of service and to pay any deductibles, coinsurance, or non-covered services within 30 days of receiving a statement.

3. NON-COVERED SERVICES: If my insurance company denies payment for any reason, including but not limited to services deemed not medically necessary, I accept full financial responsibility for those charges.

4. INSURANCE VERIFICATION: While {CLINIC_NAME} will attempt to verify my insurance coverage, I understand that verification is not a guarantee of payment and does not waive my responsibility for payment.

5. COORDINATION OF BENEFITS: If I have more than one insurance plan, I agree to provide information about all plans so that claims can be properly coordinated.

6. MEDICARE PATIENTS: I understand that Medicare may not pay for all services and that I may be responsible for deductibles, coinsurance, and non-covered services. I request that payment of authorized Medicare benefits be made on my behalf.

AUTHORIZATION TO RELEASE INFORMATION

I authorize {CLINIC_NAME} to:
• Release any medical or other information necessary to process insurance claims
• Submit claims electronically on my behalf
• Receive payment directly from my insurance company
• Appeal claim denials on my behalf

COLLECTION COSTS

If my account becomes delinquent and is referred for collection, I agree to pay all costs of collection, including reasonable attorney fees and court costs.

This assignment and authorization shall remain in effect until revoked by me in writing. A photocopy of this authorization shall be considered as effective and valid as the original.`
    },
    {
        key: 'release_of_information',
        category: 'legal',
        description: 'Release of Information Authorization',
        value: `AUTHORIZATION TO RELEASE INFORMATION

PATIENT AUTHORIZATION FOR DISCLOSURE OF PROTECTED HEALTH INFORMATION

I, the undersigned patient (or authorized representative), hereby authorize {CLINIC_NAME} to use and/or disclose my protected health information as described below.

PERSONS AUTHORIZED TO RECEIVE INFORMATION

I authorize the disclosure of my medical information to the following individuals:

{ROI_LIST}

SCOPE OF AUTHORIZATION

This authorization permits the discussion and disclosure of my medical care and treatment, including but not limited to:
• Diagnosis and medical conditions
• Treatment plans and progress
• Medications and dosages
• Laboratory and test results
• Appointment scheduling and reminders
• Billing and insurance matters

INFORMATION TO BE PROTECTED

I understand that certain types of information may require a separate authorization or may have additional protections under law, including:
• HIV/AIDS-related information
• Mental health records
• Substance abuse treatment records
• Genetic information

DURATION AND REVOCATION

This authorization shall remain in full force and effect until I revoke it in writing. I understand that:
• I may revoke this authorization at any time by submitting a written request to {CLINIC_NAME}
• Revocation will not affect any actions already taken in reliance on this authorization
• {CLINIC_NAME} may not condition my treatment on whether I sign this authorization

REDISCLOSURE

I understand that once my health information is disclosed pursuant to this authorization, it may no longer be protected by federal privacy regulations and may be subject to redisclosure by the recipient.

VOLUNTARY AUTHORIZATION

I am signing this authorization voluntarily. I have been informed of my right to refuse to sign this authorization and understand that my refusal will not affect my ability to obtain treatment, payment, or eligibility for benefits.

CONTACT INFORMATION

To revoke this authorization or for questions, contact:
{CLINIC_NAME}
{CLINIC_ADDRESS}
Phone: {CLINIC_PHONE}
Email: {PRIVACY_EMAIL}`
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
                // Force update all legal templates regardless of existing values
                await client.query(`
                    INSERT INTO intake_settings (key, category, description, value)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (key) DO UPDATE SET 
                        value = EXCLUDED.value,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category
                `, [setting.key, setting.category, setting.description, setting.value]);
            }
        }
        console.log('✅ Intake settings seeded successfully with comprehensive legal templates.');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seedIntakeSettings();
