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
            const doc = new PDFDocument({ margin: 60, size: 'LETTER', bufferPages: true });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const { clinic, session, forms, signerName, ip, userAgent, patientId } = data;
            const pageWidth = 612;
            const contentWidth = pageWidth - 120; // 60px margins on each side
            const timestamp = new Date();

            // Header for every page
            const addHeader = (isFirstPage = false) => {
                const startY = 50;

                // Clinic Name (centered, bold)
                doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f2937')
                    .text(clinic.name || 'Medical Clinic', 60, startY, { width: contentWidth, align: 'center' });

                // Clinic Address
                doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                    .text(clinic.address || '', 60, doc.y + 2, { width: contentWidth, align: 'center' });

                // Phone & Email
                doc.text(`Phone: ${clinic.phone || 'N/A'} | Email: ${clinic.email || 'N/A'}`, 60, doc.y + 2, { width: contentWidth, align: 'center' });

                doc.moveDown(0.8);

                // Divider line
                doc.moveTo(60, doc.y).lineTo(pageWidth - 60, doc.y).strokeColor('#d1d5db').stroke();
                doc.moveDown(0.5);

                // Document title
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#374151')
                    .text('PATIENT REGISTRATION & LEGAL ACKNOWLEDGMENTS', 60, doc.y, { width: contentWidth, align: 'center' });

                doc.moveDown(1);

                return doc.y;
            };

            // Add audit metadata block (first page only)
            const addAuditBlock = () => {
                const blockStartY = doc.y;
                const blockHeight = 70;

                // Background box
                doc.rect(60, blockStartY, contentWidth, blockHeight).fill('#f8fafc');

                // Title
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b')
                    .text('AUDIT & COMPLIANCE METADATA', 70, blockStartY + 10);

                // Draw a line under the title
                doc.moveTo(70, blockStartY + 22).lineTo(200, blockStartY + 22).strokeColor('#cbd5e1').stroke();

                // Left column
                doc.fontSize(8).font('Helvetica').fillColor('#475569');
                doc.text(`Patient ID: ${patientId || 'NEW_REGISTRATION'}`, 70, blockStartY + 30);
                doc.text(`Signer Name: ${signerName}`, 70, blockStartY + 42);
                doc.text(`Timestamp: ${timestamp.toLocaleString()}`, 70, blockStartY + 54);

                // Right column
                doc.text(`IP Address: ${ip || 'N/A'}`, 320, blockStartY + 30);
                const uaDisplay = (userAgent || 'Unknown').substring(0, 45);
                doc.text(`User Agent: ${uaDisplay}...`, 320, blockStartY + 42);

                // Reset position after block
                doc.y = blockStartY + blockHeight + 20;
            };

            // Add a form section
            const addFormSection = (form, isFirstForm) => {
                // Form title with blue accent
                doc.fontSize(13).font('Helvetica-Bold').fillColor('#1d4ed8')
                    .text(form.label.toUpperCase(), 60, doc.y, { width: contentWidth });

                doc.moveDown(0.3);

                // Subtitle (form type)
                doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
                    .text(form.processedPolicy.split('\n')[0] || '', 60, doc.y, { width: contentWidth });

                doc.moveDown(0.8);

                // Form content - skip the first line as it's already the subtitle
                const policyLines = form.processedPolicy.split('\n').slice(1).join('\n').trim();

                doc.fontSize(10).font('Helvetica').fillColor('#374151')
                    .text(policyLines, 60, doc.y, {
                        width: contentWidth,
                        lineGap: 3,
                        align: 'left'
                    });

                doc.moveDown(1.5);

                // Signature block
                const sigBlockY = doc.y;
                const sigBlockHeight = 50;

                // Green signature box
                doc.rect(60, sigBlockY, contentWidth, sigBlockHeight).fill('#dcfce7');

                // Checkmark and text
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#166534')
                    .text('✓ ELECTRONICALLY SIGNED & ACKNOWLEDGED', 75, sigBlockY + 12);

                doc.fontSize(9).font('Helvetica').fillColor('#166534')
                    .text(`Signed by ${signerName} on ${timestamp.toLocaleDateString()} at ${timestamp.toLocaleTimeString()}`, 75, sigBlockY + 28);

                doc.y = sigBlockY + sigBlockHeight + 15;
            };

            // === Build the PDF ===

            // First page with header and audit block
            addHeader(true);
            addAuditBlock();

            // Add each form
            forms.forEach((form, idx) => {
                if (idx > 0) {
                    doc.addPage();
                    addHeader(false);
                }
                addFormSection(form, idx === 0);
            });

            // Add page numbers to all pages (IMPORTANT: lineBreak: false prevents new pages)
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                const footerText = `Page ${i + 1} of ${range.count} | ${clinic.name} | Confidential Legal Document`;
                doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
                    .text(footerText, 60, 745, { width: contentWidth, align: 'center', lineBreak: false });
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
