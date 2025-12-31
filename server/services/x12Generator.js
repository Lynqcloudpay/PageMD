const pool = require('../db');

/**
 * X12 837P Generator Service
 * Builds ANSI X12 837 Professional Claims
 */
class X12Generator {

    /**
     * Generate 837P for a batch of claims
     * @param {Array} claimIds - UUIDs of claims to include
     * @param {Object} options - { senderId, receiverId, npi, taxId }
     */
    async generate837P(claimIds, options = {}) {
        const segments = [];
        const now = new Date();
        const controlNumber = this.generateControlNumber();

        // ISA - Interchange Control Header
        segments.push(this.buildISA(options, controlNumber, now));

        // GS - Functional Group Header
        segments.push(this.buildGS(options, controlNumber, now));

        // ST - Transaction Set Header
        segments.push(`ST*837*${controlNumber.substring(0, 4)}*005010X222A1~`);

        // BHT - Beginning of Hierarchical Transaction
        segments.push(`BHT*0019*00*${controlNumber}*${this.formatDate(now)}*${this.formatTime(now)}*CH~`);

        // 1000A - Submitter Name
        segments.push(this.build1000A(options));

        // 1000B - Receiver Name
        segments.push(this.build1000B(options));

        // Process each claim
        let hlCounter = 0;
        for (const claimId of claimIds) {
            const claimSegments = await this.buildClaimLoop(claimId, ++hlCounter, options);
            segments.push(...claimSegments);
        }

        // SE - Transaction Set Trailer
        const segmentCount = segments.filter(s => s && !s.startsWith('ISA') && !s.startsWith('GS')).length + 1;
        segments.push(`SE*${segmentCount}*${controlNumber.substring(0, 4)}~`);

        // GE - Functional Group Trailer
        segments.push(`GE*1*${controlNumber}~`);

        // IEA - Interchange Control Trailer
        segments.push(`IEA*1*${controlNumber}~`);

        return segments.join('\n');
    }

    generateControlNumber() {
        return Date.now().toString().substring(0, 9);
    }

    formatDate(d) {
        return d.toISOString().slice(0, 10).replace(/-/g, '');
    }

    formatTime(d) {
        return d.toTimeString().slice(0, 5).replace(':', '');
    }

    buildISA(options, controlNumber, now) {
        const senderId = (options.senderId || 'PAGEMD').padEnd(15);
        const receiverId = (options.receiverId || 'CLEARINGHOUSE').padEnd(15);
        return `ISA*00*          *00*          *ZZ*${senderId}*ZZ*${receiverId}*${this.formatDate(now).substring(2)}*${this.formatTime(now)}*^*00501*${controlNumber}*0*P*:~`;
    }

    buildGS(options, controlNumber, now) {
        return `GS*HC*${options.senderId || 'PAGEMD'}*${options.receiverId || 'PAYER'}*${this.formatDate(now)}*${this.formatTime(now)}*${controlNumber}*X*005010X222A1~`;
    }

    build1000A(options) {
        // Submitter
        return `NM1*41*2*${options.submitterName || 'PAGEMD EMR'}*****46*${options.submitterEin || '123456789'}~\nPER*IC*BILLING*TE*${options.phone || '5551234567'}~`;
    }

    build1000B(options) {
        // Receiver (Clearinghouse/Payer)
        return `NM1*40*2*${options.receiverName || 'CLEARINGHOUSE'}*****46*${options.receiverId || '999999999'}~`;
    }

    async buildClaimLoop(claimId, hlCounter, options) {
        const segments = [];

        // Fetch claim with all details
        const claimRes = await pool.query(`
            SELECT c.*, 
                   p.first_name, p.last_name, p.date_of_birth, p.gender,
                   p.address_line1, p.city, p.state, p.zip,
                   p.insurance_id, p.insurance_provider,
                   v.visit_date
            FROM claims c
            JOIN patients p ON c.patient_id = p.id
            JOIN visits v ON c.visit_id = v.id
            WHERE c.id = $1
        `, [claimId]);

        if (claimRes.rows.length === 0) {
            console.warn(`Claim ${claimId} not found`);
            return segments;
        }

        const claim = claimRes.rows[0];
        const diagCodes = typeof claim.diagnosis_codes === 'string'
            ? JSON.parse(claim.diagnosis_codes)
            : claim.diagnosis_codes || [];
        const procCodes = typeof claim.procedure_codes === 'string'
            ? JSON.parse(claim.procedure_codes)
            : claim.procedure_codes || [];

        // 2000A - Billing Provider HL
        segments.push(`HL*${hlCounter}**20*1~`);
        segments.push(`NM1*85*2*${options.billingProviderName || 'PROVIDER NAME'}*****XX*${options.npi || '1234567890'}~`);
        segments.push(`N3*${options.billingAddress || '123 MAIN ST'}~`);
        segments.push(`N4*${options.billingCity || 'MIAMI'}*${options.billingState || 'FL'}*${options.billingZip || '33101'}~`);
        segments.push(`REF*EI*${options.taxId || '123456789'}~`);

        // 2000B - Subscriber HL
        hlCounter++;
        segments.push(`HL*${hlCounter}*${hlCounter - 1}*22*1~`);
        segments.push(`SBR*P*18*${claim.insurance_group_number || ''}******CI~`);

        // 2010BA - Subscriber Name
        const lastName = (claim.last_name || 'DOE').toUpperCase();
        const firstName = (claim.first_name || 'JOHN').toUpperCase();
        segments.push(`NM1*IL*1*${lastName}*${firstName}****MI*${claim.insurance_id || claim.insurance_member_id || 'UNKNOWN'}~`);
        segments.push(`N3*${claim.address_line1 || '123 PATIENT ST'}~`);
        segments.push(`N4*${claim.city || 'MIAMI'}*${claim.state || 'FL'}*${claim.zip || '33101'}~`);
        segments.push(`DMG*D8*${this.formatDate(new Date(claim.date_of_birth || '1980-01-01'))}*${claim.gender === 'Female' ? 'F' : 'M'}~`);

        // 2010BB - Payer Name
        segments.push(`NM1*PR*2*${claim.insurance_provider || 'INSURANCE CO'}*****PI*${options.payerId || '12345'}~`);

        // 2300 - Claim Information
        hlCounter++;
        segments.push(`HL*${hlCounter}*${hlCounter - 1}*23*0~`);

        const claimNumber = claim.claim_number || `CLM${Date.now()}`;
        const totalCharges = claim.total_charges || claim.total_amount || 0;
        segments.push(`CLM*${claimNumber}*${totalCharges}***${claim.place_of_service_code || '11'}:B:1*Y*A*Y*Y~`);

        // Diagnosis Codes (HI segment)
        if (diagCodes.length > 0) {
            const hiCodes = diagCodes.slice(0, 12).map((dx, i) => {
                const code = (dx.code || dx).replace('.', '');
                return i === 0 ? `ABK:${code}` : `ABF:${code}`;
            }).join('*');
            segments.push(`HI*${hiCodes}~`);
        }

        // 2400 - Service Lines
        let lineNumber = 0;
        for (const proc of procCodes) {
            lineNumber++;
            const code = proc.code || proc;
            const amount = proc.amount || 0;
            const units = proc.units || 1;
            const modifier = proc.modifier || '';
            const serviceDate = this.formatDate(new Date(claim.visit_date || claim.service_date_start));

            segments.push(`LX*${lineNumber}~`);
            segments.push(`SV1*HC:${code}${modifier ? ':' + modifier : ''}*${amount}*UN*${units}***1~`);
            segments.push(`DTP*472*D8*${serviceDate}~`);
        }

        return segments;
    }
}

module.exports = new X12Generator();
