const pool = require('../db');

/**
 * X12 835 ERA Parser Service
 * Parses Electronic Remittance Advice files
 */
class ERAParser {

    /**
     * Parse raw 835 content
     */
    parse835(content) {
        const lines = content.split('~').map(l => l.trim()).filter(l => l);
        const result = {
            checkNumber: null,
            checkDate: null,
            payerName: null,
            payerId: null,
            totalPaid: 0,
            claims: []
        };

        let currentClaim = null;
        let currentLine = null;

        for (const line of lines) {
            const elements = line.split('*');
            const segmentId = elements[0];

            switch (segmentId) {
                case 'BPR': // Financial Information
                    result.totalPaid = parseFloat(elements[2]) || 0;
                    break;

                case 'TRN': // Trace Number (Check/EFT Number)
                    result.checkNumber = elements[2];
                    break;

                case 'DTM': // Date
                    if (elements[1] === '405') { // Production Date
                        result.checkDate = this.parseDate(elements[2]);
                    }
                    break;

                case 'N1': // Name
                    if (elements[1] === 'PR') { // Payer
                        result.payerName = elements[2];
                    }
                    break;

                case 'REF':
                    if (elements[1] === '2U') { // Payer ID
                        result.payerId = elements[2];
                    }
                    break;

                case 'CLP': // Claim Payment Information
                    if (currentClaim) {
                        result.claims.push(currentClaim);
                    }
                    currentClaim = {
                        patientControlNumber: elements[1],
                        status: this.mapClaimStatus(elements[2]),
                        chargedAmount: parseFloat(elements[3]) || 0,
                        paidAmount: parseFloat(elements[4]) || 0,
                        patientResponsibility: parseFloat(elements[5]) || 0,
                        claimFilingIndicator: elements[6],
                        payerClaimControlNumber: elements[7],
                        lines: [],
                        adjustments: []
                    };
                    break;

                case 'CAS': // Adjustment
                    if (currentClaim) {
                        // Format: CAS*CO*45*10.00*1~
                        const adj = {
                            groupCode: elements[1], // CO, PR, OA, CR, PI
                            reasonCode: elements[2],
                            amount: parseFloat(elements[3]) || 0,
                            quantity: parseInt(elements[4]) || 1
                        };

                        if (currentLine) {
                            currentLine.adjustments = currentLine.adjustments || [];
                            currentLine.adjustments.push(adj);
                        } else {
                            currentClaim.adjustments.push(adj);
                        }
                    }
                    break;

                case 'SVC': // Service Line
                    if (currentClaim) {
                        // Save previous line
                        if (currentLine) {
                            currentClaim.lines.push(currentLine);
                        }

                        // Parse procedure code
                        const procInfo = elements[1].split(':');
                        currentLine = {
                            procedureCode: procInfo[1] || procInfo[0],
                            billedAmount: parseFloat(elements[2]) || 0,
                            paidAmount: parseFloat(elements[3]) || 0,
                            units: parseInt(elements[5]) || 1,
                            adjustments: []
                        };
                    }
                    break;

                case 'SE': // Transaction Set Trailer
                    // Finalize
                    if (currentLine && currentClaim) {
                        currentClaim.lines.push(currentLine);
                        currentLine = null;
                    }
                    if (currentClaim) {
                        result.claims.push(currentClaim);
                        currentClaim = null;
                    }
                    break;
            }
        }

        return result;
    }

    parseDate(dateStr) {
        // YYYYMMDD format
        if (!dateStr || dateStr.length !== 8) return null;
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }

    mapClaimStatus(code) {
        const statusMap = {
            '1': 'processed_primary',
            '2': 'processed_secondary',
            '3': 'processed_tertiary',
            '4': 'denied',
            '19': 'processed_primary_forwarded',
            '20': 'processed_secondary_forwarded',
            '21': 'processed_tertiary_forwarded',
            '22': 'reversal',
            '23': 'not_our_claim'
        };
        return statusMap[code] || 'unknown';
    }

    /**
     * Get human-readable adjustment reason
     */
    getAdjustmentReason(groupCode, reasonCode) {
        const groups = {
            'CO': 'Contractual Obligation',
            'PR': 'Patient Responsibility',
            'OA': 'Other Adjustment',
            'CR': 'Correction/Reversal',
            'PI': 'Payor Initiated'
        };

        // Common reason codes (subset)
        const reasons = {
            '1': 'Deductible',
            '2': 'Coinsurance',
            '3': 'Copay',
            '4': 'Procedure not covered',
            '16': 'Claim lacks information',
            '18': 'Duplicate claim',
            '22': 'Coordination of Benefits',
            '23': 'Authorization/Pre-cert required',
            '27': 'Expenses incurred after coverage terminated',
            '29': 'Time limit for filing expired',
            '45': 'Charges exceed fee schedule',
            '50': 'Non-covered service',
            '96': 'Non-covered charge',
            '97': 'Payment adjusted - benefit maximum reached',
            '109': 'Claim not covered by payer',
            '119': 'Benefit for this service included in payment for another service',
            '140': 'Patient cost share',
            '253': 'Sequestration adjustment'
        };

        return {
            group: groups[groupCode] || groupCode,
            reason: reasons[reasonCode] || `Reason Code ${reasonCode}`
        };
    }
}

module.exports = new ERAParser();
