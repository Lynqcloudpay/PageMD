const PDFDocument = require('pdfkit');

/**
 * Generate a professional Superbill PDF
 * @param {Object} data Full superbill data including patient, providers, diagnoses, lines
 * @returns {Promise<Buffer>}
 */
async function generateSuperbillPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const result = Buffer.concat(buffers);
                resolve(result);
            });

            // --- Header ---
            doc.fontSize(20).text(data.org_name || 'Medical Clinic', { align: 'center' });
            doc.fontSize(10).text(`${data.location_address || ''}, ${data.location_city || ''}, ${data.location_state || ''} ${data.location_zip || ''}`, { align: 'center' });
            doc.text(`Phone: ${data.org_phone || ''}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text('SUPERBILL / ENCOUNTER SUMMARY', { align: 'center', underline: true });
            doc.moveDown();

            // --- Row 1: Patient & Date ---
            const topRow = 150;
            doc.fontSize(12).font('Helvetica-Bold').text('PATIENT INFORMATION', 50, topRow);
            doc.font('Helvetica').fontSize(10);
            doc.text(`Name: ${data.patient_last_name}, ${data.patient_first_name}`, 50, topRow + 20);
            doc.text(`DOB: ${data.dob}`, 50, topRow + 35);
            doc.text(`Sex: ${data.patient_sex}`, 50, topRow + 50);
            doc.text(`MRN: ${data.mrn}`, 50, topRow + 65);

            doc.fontSize(12).font('Helvetica-Bold').text('ENCOUNTER DETAILS', 350, topRow);
            doc.font('Helvetica').fontSize(10);
            doc.text(`Service Date: ${data.service_date_from}`, 350, topRow + 20);
            doc.text(`Location: ${data.location_name || 'Main Office'}`, 350, topRow + 35);
            doc.text(`Superbill #: ${data.id.substring(0, 8).toUpperCase()}`, 350, topRow + 50);
            doc.text(`Status: ${data.status}`, 350, topRow + 65);

            doc.moveDown(4);

            // --- Row 2: Providers ---
            const midRow = doc.y;
            doc.fontSize(12).font('Helvetica-Bold').text('PROVIDER INFORMATION', 50, midRow);
            doc.font('Helvetica').fontSize(10);
            doc.text(`Rendering Provider: ${data.rendering_first_name} ${data.rendering_last_name}`, 50, midRow + 20);
            doc.text(`Rendering NPI: ${data.rendering_npi || 'N/A'}`, 50, midRow + 35);
            doc.text(`Taxonomy: ${data.rendering_taxonomy || 'N/A'}`, 50, midRow + 50);

            doc.fontSize(12).font('Helvetica-Bold').text('BILLING ENTITY', 350, midRow);
            doc.font('Helvetica').fontSize(10);
            doc.text(`Billing Provider: ${data.billing_first_name} ${data.billing_last_name}`, 350, midRow + 20);
            doc.text(`Billing NPI: ${data.billing_npi || data.org_npi || 'N/A'}`, 350, midRow + 35);
            doc.text(`Tax ID: ${data.org_tax_id || 'N/A'}`, 350, midRow + 50);

            doc.moveDown(5);

            // --- Diagnoses ---
            const diagRow = doc.y;
            doc.fontSize(12).font('Helvetica-Bold').text('DIAGNOSES (ICD-10)', 50, diagRow);
            doc.moveDown(0.5);

            let currentY = doc.y;
            doc.font('Helvetica').fontSize(9);
            data.diagnoses.forEach((diag, index) => {
                doc.text(`${index + 1}. [${diag.icd10_code}] ${diag.description}`, 60, currentY);
                currentY += 15;
                if (currentY > 700) { doc.addPage(); currentY = 50; }
            });
            doc.y = currentY + 10;

            // --- Procedures/Lines Table ---
            doc.moveDown();
            const tableTop = doc.y;
            doc.fontSize(12).font('Helvetica-Bold').text('SERVICES / PROCEDURES (CPT)', 50, tableTop);
            doc.moveDown(0.5);

            // Table Header
            const headerY = doc.y;
            doc.rect(50, headerY, 510, 20).fill('#f0f0f0');
            doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
            doc.text('CPT', 60, headerY + 5);
            doc.text('Description', 110, headerY + 5);
            doc.text('Mod', 320, headerY + 5);
            doc.text('Units', 360, headerY + 5);
            doc.text('Pointer', 400, headerY + 5);
            doc.text('Charge', 480, headerY + 5);

            let lineY = headerY + 20;
            doc.font('Helvetica').fontSize(9);
            data.lines.forEach((line) => {
                doc.text(line.cpt_code, 60, lineY + 5);
                doc.text(line.description.substring(0, 40), 110, lineY + 5);
                doc.text(line.modifier1 || '', 320, lineY + 5);
                doc.text(String(line.units), 360, lineY + 5);
                doc.text(line.diagnosis_pointers || '', 400, lineY + 5);
                doc.text(`$${parseFloat(line.charge).toFixed(2)}`, 480, lineY + 5);

                lineY += 20;
                doc.moveTo(50, lineY).lineTo(560, lineY).stroke('#eeeeee');
                if (lineY > 700) { doc.addPage(); lineY = 50; }
            });

            // --- Totals ---
            doc.moveDown();
            const totalY = lineY + 20;
            doc.font('Helvetica-Bold').fontSize(11);
            doc.text(`TOTAL UNITS: ${data.total_units}`, 350, totalY);
            doc.text(`TOTAL CHARGE: $${parseFloat(data.total_charges).toFixed(2)}`, 350, totalY + 20);

            // --- Footer ---
            const footerTop = 730;
            doc.fontSize(8).font('Helvetica').fillColor('grey');
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, footerTop);
            doc.text(`Superbill ID: ${data.id}`, 50, footerTop + 10);
            doc.text('This document is for medical billing purposes. Confidential PHI.', { align: 'center' }, 50, footerTop + 20);

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Generate a consolidated Intake Legal Packet PDF
 * @param {Object} data { clinic, session, patientId, signerName, ip, userAgent, forms: [{label, policy, signed}] }
 */
async function generateIntakeLegalPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'LETTER', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const { clinic, session, forms, signerName, ip, userAgent, patientId } = data;

            // Header for every page
            const addHeader = () => {
                doc.fontSize(18).font('Helvetica-Bold').text(clinic.name || 'Medical Clinic', { align: 'center' });
                doc.fontSize(8).font('Helvetica').text(clinic.address || '', { align: 'center' });
                doc.text(`Phone: ${clinic.phone || ''} | Email: ${clinic.email || ''}`, { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).font('Helvetica-Bold').text('PATIENT REGISTRATION & LEGAL ACKNOWLEDGMENTS', { align: 'center' });
                doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke('#e5e7eb');
                doc.moveDown();
            };

            addHeader();

            // Audit Info Block
            doc.rect(50, doc.y, 510, 80).fill('#f9fafb');
            doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text('AUDIT & COMPLIANCE METADATA', 60, doc.y - 75);
            doc.font('Helvetica').fontSize(9).fillColor('#374151');
            doc.text(`Patient ID: ${patientId || 'NEW_REGISTRATION'}`, 60, doc.y + 5);
            doc.text(`Signer Name: ${signerName}`, 60, doc.y + 5);
            doc.text(`Timestamp: ${new Date().toLocaleString()}`, 60, doc.y + 5);
            doc.text(`IP Address: ${ip}`, 300, doc.y - 45);
            doc.text(`User Agent: ${userAgent.substring(0, 50)}...`, 300, doc.y + 5);
            doc.moveDown(4);

            // Forms
            forms.forEach((form, idx) => {
                if (idx > 0) {
                    doc.addPage();
                    addHeader();
                }

                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af').text(form.label.toUpperCase());
                doc.moveDown(0.5);

                doc.fontSize(10).font('Helvetica').fillColor('#374151').text(form.processedPolicy, {
                    lineGap: 2,
                    align: 'justify'
                });

                doc.moveDown(2);
                doc.rect(50, doc.y, 510, 40).fill('#ecfdf5');
                doc.fillColor('#065f46').font('Helvetica-Bold').text('✓ ELECTRONICALLY SIGNED & ACKNOWLEDGED', 60, doc.y - 30);
                doc.font('Helvetica').text(`Signed by ${signerName} on ${new Date().toLocaleDateString()}`, 60, doc.y + 5);
                doc.moveDown();
            });

            // Footer (Page Numbers)
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).fillColor('grey').text(
                    `Page ${i + 1} of ${range.count} | ${clinic.name} | Confidential Legal Record`,
                    50,
                    750,
                    { align: 'center' }
                );
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateSuperbillPDF,
    generateIntakeLegalPDF
};
