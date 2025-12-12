import React from 'react';
import { format } from 'date-fns';

// Lab Requisition Form Component
export const LabRequisitionForm = ({ order, patient, provider, clinic, compact = false }) => {
  const payload = typeof order.order_payload === 'string' 
    ? JSON.parse(order.order_payload) 
    : (order.order_payload || {});
  
  const testName = payload.testName || payload.test_name || payload.name || 'Lab Test';
  const labCompany = payload.company || 'Quest Diagnostics';
  const testCode = payload.code || '';
  const cptCode = payload.cpt || '';
  const diagnoses = order.diagnoses || [];
  const orderedBy = order.ordered_by_first_name && order.ordered_by_last_name
    ? `${order.ordered_by_first_name} ${order.ordered_by_last_name}`
    : provider?.name || 'Provider';
  const orderDate = format(new Date(order.created_at), 'MM/dd/yyyy');
  
  const padding = compact ? 'p-3' : 'p-6';
  const marginBottom = compact ? 'mb-2' : 'mb-4';
  const headerSize = compact ? 'text-base' : 'text-2xl';
  const headerFontSize = compact ? '14pt' : '18pt';
  const borderWidth = compact ? 'border' : 'border-2';
  const tablePadding = compact ? 'p-1' : 'p-2';
  const signatureMargin = compact ? 'mt-3 pt-2' : 'mt-6 pt-4';
  const signatureSpace = compact ? 'mb-4' : 'mb-8';
  const footerMargin = compact ? 'mt-2 pt-1' : 'mt-4 pt-2';

  return (
    <div className={`lab-requisition-form bg-white ${padding} ${borderWidth} border-gray-800`} style={{ fontFamily: 'Arial, sans-serif', fontSize: compact ? '9pt' : '11pt' }}>
      {/* Header */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'pb-1.5 mb-2' : 'pb-3 mb-4'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`${headerSize} font-bold ${compact ? 'mb-0.5' : 'mb-1'}`} style={{ fontSize: headerFontSize }}>LABORATORY REQUISITION</h1>
            <p className={compact ? 'text-xs' : 'text-sm'} style={{ fontWeight: 600 }}>{labCompany}</p>
          </div>
          <div className={`text-right ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <p><strong>Order Date:</strong> {orderDate}</p>
            <p><strong>Order #:</strong> {order.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Patient Information */}
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'} ${marginBottom}`}>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>PATIENT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Name:</strong> {patient?.name || 'N/A'}</p>
            <p><strong>DOB:</strong> {patient?.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A'}</p>
            <p><strong>Gender:</strong> {patient?.gender || 'N/A'}</p>
            <p><strong>MRN:</strong> {patient?.id?.substring(0, 8).toUpperCase() || 'N/A'}</p>
          </div>
        </div>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>CONTACT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Phone:</strong> {patient?.phone || 'N/A'}</p>
            <p><strong>Address:</strong> {patient?.address || 'N/A'}</p>
            <p><strong>City, State ZIP:</strong> {patient?.city ? `${patient.city}, ${patient.state || ''} ${patient.zip || ''}` : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Insurance Information */}
      {(patient?.insurance_name || patient?.insurance_id) && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>INSURANCE INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Insurance:</strong> {patient.insurance_name || 'N/A'}</p>
            <p><strong>Policy #:</strong> {patient.insurance_id || 'N/A'}</p>
            {patient.insurance_group && <p><strong>Group #:</strong> {patient.insurance_group}</p>}
          </div>
        </div>
      )}

      {/* Ordering Provider */}
      <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>ORDERING PROVIDER</p>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
          <p><strong>Provider:</strong> {orderedBy}</p>
          {provider?.npi && <p><strong>NPI:</strong> {provider.npi}</p>}
          {clinic?.name && <p><strong>Clinic:</strong> {clinic.name}</p>}
          {clinic?.address && <p><strong>Address:</strong> {clinic.address}</p>}
          {clinic?.phone && <p><strong>Phone:</strong> {clinic.phone}</p>}
        </div>
      </div>

      {/* Tests Ordered */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'p-2' : 'p-3'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>TESTS ORDERED</p>
        <table className={`w-full ${compact ? 'text-[10px]' : 'text-xs'} border-collapse`}>
          <thead>
            <tr className="bg-gray-100">
              <th className={`border border-gray-400 ${tablePadding} text-left`}>Test Name</th>
              <th className={`border border-gray-400 ${tablePadding} text-left`}>Test Code</th>
              <th className={`border border-gray-400 ${tablePadding} text-left`}>CPT Code</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`border border-gray-400 ${tablePadding} font-semibold`}>{testName}</td>
              <td className={`border border-gray-400 ${tablePadding}`}>{testCode || 'N/A'}</td>
              <td className={`border border-gray-400 ${tablePadding}`}>{cptCode || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Clinical Information */}
      {diagnoses.length > 0 && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>CLINICAL INFORMATION / DIAGNOSIS</p>
          <div className={compact ? 'text-[10px]' : 'text-xs'}>
            {diagnoses.map((d, idx) => (
              <p key={idx}>
                {d.icd10Code ? `${d.icd10Code} - ` : ''}{d.name}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {payload.instructions && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>SPECIAL INSTRUCTIONS</p>
          <p className={compact ? 'text-[10px]' : 'text-xs'}>{payload.instructions}</p>
        </div>
      )}

      {/* Provider Signature */}
      <div className={`${signatureMargin} ${borderWidth} border-gray-800`}>
        <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Provider Signature</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}><strong>Date:</strong> {orderDate}</p>
          </div>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Provider Name (Print)</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}>{orderedBy}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`${footerMargin} border-t border-gray-400 ${compact ? 'text-[10px]' : 'text-xs'} text-center text-gray-600`}>
        <p>This requisition is valid for 30 days from the order date.</p>
        <p className={compact ? 'mt-0.5' : 'mt-1'}>Please present this form at the laboratory location.</p>
      </div>
    </div>
  );
};

// Imaging Requisition Form Component
export const ImagingRequisitionForm = ({ order, patient, provider, clinic, compact = false }) => {
  const payload = typeof order.order_payload === 'string' 
    ? JSON.parse(order.order_payload) 
    : (order.order_payload || {});
  
  const studyName = payload.studyName || payload.name || 'Imaging Study';
  const description = payload.description || '';
  const cptCode = payload.cpt || '';
  const diagnoses = order.diagnoses || [];
  const orderedBy = order.ordered_by_first_name && order.ordered_by_last_name
    ? `${order.ordered_by_first_name} ${order.ordered_by_last_name}`
    : provider?.name || 'Provider';
  const orderDate = format(new Date(order.created_at), 'MM/dd/yyyy');
  
  const padding = compact ? 'p-3' : 'p-6';
  const marginBottom = compact ? 'mb-2' : 'mb-4';
  const headerSize = compact ? 'text-base' : 'text-2xl';
  const headerFontSize = compact ? '14pt' : '18pt';
  const borderWidth = compact ? 'border' : 'border-2';
  const tablePadding = compact ? 'p-1' : 'p-2';
  const signatureMargin = compact ? 'mt-3 pt-2' : 'mt-6 pt-4';
  const signatureSpace = compact ? 'mb-4' : 'mb-8';
  const footerMargin = compact ? 'mt-2 pt-1' : 'mt-4 pt-2';
  
  return (
    <div className={`imaging-requisition-form bg-white ${padding} ${borderWidth} border-gray-800`} style={{ fontFamily: 'Arial, sans-serif', fontSize: compact ? '9pt' : '11pt' }}>
      {/* Header */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'pb-1.5 mb-2' : 'pb-3 mb-4'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`${headerSize} font-bold ${compact ? 'mb-0.5' : 'mb-1'}`} style={{ fontSize: headerFontSize }}>RADIOLOGY / IMAGING REQUISITION</h1>
            <p className={compact ? 'text-xs' : 'text-sm'} style={{ fontWeight: 600 }}>Diagnostic Imaging Order</p>
          </div>
          <div className={`text-right ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <p><strong>Order Date:</strong> {orderDate}</p>
            <p><strong>Order #:</strong> {order.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Patient Information */}
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'} ${marginBottom}`}>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>PATIENT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Name:</strong> {patient?.name || 'N/A'}</p>
            <p><strong>DOB:</strong> {patient?.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A'}</p>
            <p><strong>Gender:</strong> {patient?.gender || 'N/A'}</p>
            <p><strong>MRN:</strong> {patient?.id?.substring(0, 8).toUpperCase() || 'N/A'}</p>
          </div>
        </div>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>CONTACT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Phone:</strong> {patient?.phone || 'N/A'}</p>
            <p><strong>Address:</strong> {patient?.address || 'N/A'}</p>
            <p><strong>City, State ZIP:</strong> {patient?.city ? `${patient.city}, ${patient.state || ''} ${patient.zip || ''}` : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Insurance Information */}
      {(patient?.insurance_name || patient?.insurance_id) && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>INSURANCE INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Insurance:</strong> {patient.insurance_name || 'N/A'}</p>
            <p><strong>Policy #:</strong> {patient.insurance_id || 'N/A'}</p>
            {patient.insurance_group && <p><strong>Group #:</strong> {patient.insurance_group}</p>}
          </div>
        </div>
      )}

      {/* Ordering Provider */}
      <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>ORDERING PROVIDER</p>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
          <p><strong>Provider:</strong> {orderedBy}</p>
          {provider?.npi && <p><strong>NPI:</strong> {provider.npi}</p>}
          {clinic?.name && <p><strong>Clinic:</strong> {clinic.name}</p>}
          {clinic?.address && <p><strong>Address:</strong> {clinic.address}</p>}
          {clinic?.phone && <p><strong>Phone:</strong> {clinic.phone}</p>}
        </div>
      </div>

      {/* Study Ordered */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'p-2' : 'p-3'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>STUDY ORDERED</p>
        <table className={`w-full ${compact ? 'text-[10px]' : 'text-xs'} border-collapse`}>
          <thead>
            <tr className="bg-gray-100">
              <th className={`border border-gray-400 ${tablePadding} text-left`}>Study Name</th>
              <th className={`border border-gray-400 ${tablePadding} text-left`}>Description</th>
              <th className={`border border-gray-400 ${tablePadding} text-left`}>CPT Code</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={`border border-gray-400 ${tablePadding} font-semibold`}>{studyName}</td>
              <td className={`border border-gray-400 ${tablePadding}`}>{description || 'N/A'}</td>
              <td className={`border border-gray-400 ${tablePadding}`}>{cptCode || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Clinical Indication */}
      {diagnoses.length > 0 && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>CLINICAL INDICATION / REASON FOR STUDY</p>
          <div className={compact ? 'text-[10px]' : 'text-xs'}>
            {diagnoses.map((d, idx) => (
              <p key={idx}>
                {d.icd10Code ? `${d.icd10Code} - ` : ''}{d.name}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {payload.instructions && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>SPECIAL INSTRUCTIONS / PREPARATION</p>
          <p className={compact ? 'text-[10px]' : 'text-xs'}>{payload.instructions}</p>
        </div>
      )}

      {/* Provider Signature */}
      <div className={`${signatureMargin} ${borderWidth} border-gray-800`}>
        <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Provider Signature</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}><strong>Date:</strong> {orderDate}</p>
          </div>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Provider Name (Print)</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}>{orderedBy}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`${footerMargin} border-t border-gray-400 ${compact ? 'text-[10px]' : 'text-xs'} text-center text-gray-600`}>
        <p>This requisition is valid for 30 days from the order date.</p>
        <p className="mt-1">Please schedule your appointment and bring this form to the imaging center.</p>
      </div>
    </div>
  );
};

// Referral Form Component
export const ReferralForm = ({ order, patient, provider, clinic, compact = false }) => {
  const payload = typeof order.order_payload === 'string' 
    ? JSON.parse(order.order_payload) 
    : (order.order_payload || {});
  
  const specialist = payload.specialist || 'Specialist';
  const reason = payload.reason || '';
  const urgency = payload.urgency || 'Routine';
  const diagnoses = order.diagnoses || [];
  const orderedBy = order.ordered_by_first_name && order.ordered_by_last_name
    ? `${order.ordered_by_first_name} ${order.ordered_by_last_name}`
    : provider?.name || 'Provider';
  const orderDate = format(new Date(order.created_at), 'MM/dd/yyyy');
  
  const padding = compact ? 'p-3' : 'p-6';
  const marginBottom = compact ? 'mb-2' : 'mb-4';
  const headerSize = compact ? 'text-base' : 'text-2xl';
  const headerFontSize = compact ? '14pt' : '18pt';
  const borderWidth = compact ? 'border' : 'border-2';
  const signatureMargin = compact ? 'mt-3 pt-2' : 'mt-6 pt-4';
  const signatureSpace = compact ? 'mb-4' : 'mb-8';
  const footerMargin = compact ? 'mt-2 pt-1' : 'mt-4 pt-2';
  
  return (
    <div className={`referral-form bg-white ${padding} ${borderWidth} border-gray-800`} style={{ fontFamily: 'Arial, sans-serif', fontSize: compact ? '9pt' : '11pt' }}>
      {/* Header */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'pb-1.5 mb-2' : 'pb-3 mb-4'}`}>
        <div className="flex justify-between items-start">
          <div>
            <h1 className={`${headerSize} font-bold ${compact ? 'mb-0.5' : 'mb-1'}`} style={{ fontSize: headerFontSize }}>SPECIALIST REFERRAL</h1>
            <p className={compact ? 'text-xs' : 'text-sm'} style={{ fontWeight: 600 }}>Consultation Request</p>
          </div>
          <div className={`text-right ${compact ? 'text-[10px]' : 'text-xs'}`}>
            <p><strong>Referral Date:</strong> {orderDate}</p>
            <p><strong>Referral #:</strong> {order.id.substring(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Patient Information */}
      <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'} ${marginBottom}`}>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>PATIENT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Name:</strong> {patient?.name || 'N/A'}</p>
            <p><strong>DOB:</strong> {patient?.dob ? format(new Date(patient.dob), 'MM/dd/yyyy') : 'N/A'}</p>
            <p><strong>Gender:</strong> {patient?.gender || 'N/A'}</p>
            <p><strong>MRN:</strong> {patient?.id?.substring(0, 8).toUpperCase() || 'N/A'}</p>
          </div>
        </div>
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>CONTACT INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Phone:</strong> {patient?.phone || 'N/A'}</p>
            <p><strong>Address:</strong> {patient?.address || 'N/A'}</p>
            <p><strong>City, State ZIP:</strong> {patient?.city ? `${patient.city}, ${patient.state || ''} ${patient.zip || ''}` : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Insurance Information */}
      {(patient?.insurance_name || patient?.insurance_id) && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>INSURANCE INFORMATION</p>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
            <p><strong>Insurance:</strong> {patient.insurance_name || 'N/A'}</p>
            <p><strong>Policy #:</strong> {patient.insurance_id || 'N/A'}</p>
            {patient.insurance_group && <p><strong>Group #:</strong> {patient.insurance_group}</p>}
          </div>
        </div>
      )}

      {/* Referring Provider */}
      <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>REFERRING PROVIDER</p>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-0' : 'space-y-0.5'}`}>
          <p><strong>Provider:</strong> {orderedBy}</p>
          {provider?.npi && <p><strong>NPI:</strong> {provider.npi}</p>}
          {clinic?.name && <p><strong>Clinic:</strong> {clinic.name}</p>}
          {clinic?.address && <p><strong>Address:</strong> {clinic.address}</p>}
          {clinic?.phone && <p><strong>Phone:</strong> {clinic.phone}</p>}
          {clinic?.fax && <p><strong>Fax:</strong> {clinic.fax}</p>}
        </div>
      </div>

      {/* Referral Details */}
      <div className={`${borderWidth} border-gray-800 ${compact ? 'p-2' : 'p-3'} ${marginBottom}`}>
        <p className={`font-semibold ${compact ? 'text-xs mb-1' : 'text-sm mb-2'}`}>REFERRAL DETAILS</p>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} ${compact ? 'space-y-1' : 'space-y-2'}`}>
          <div>
            <p><strong>Specialty / Type of Consultation:</strong></p>
            <p className={`${compact ? 'ml-2' : 'ml-4'} font-semibold`}>{specialist}</p>
          </div>
          {reason && (
            <div>
              <p><strong>Reason for Referral:</strong></p>
              <p className={compact ? 'ml-2' : 'ml-4'}>{reason}</p>
            </div>
          )}
          <div>
            <p><strong>Urgency:</strong> <span className="font-semibold">{urgency}</span></p>
          </div>
        </div>
      </div>

      {/* Clinical Information */}
      {diagnoses.length > 0 && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>PRIMARY DIAGNOSIS / CLINICAL INFORMATION</p>
          <div className={compact ? 'text-[10px]' : 'text-xs'}>
            {diagnoses.map((d, idx) => (
              <p key={idx}>
                {d.icd10Code ? `${d.icd10Code} - ` : ''}{d.name}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Relevant History */}
      {payload.history && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>RELEVANT CLINICAL HISTORY</p>
          <p className={compact ? 'text-[10px]' : 'text-xs'}>{payload.history}</p>
        </div>
      )}

      {/* Special Instructions */}
      {payload.instructions && (
        <div className={`border border-gray-400 ${compact ? 'p-1.5' : 'p-2'} ${marginBottom}`}>
          <p className={`font-semibold ${compact ? 'text-[10px] mb-0.5' : 'text-xs mb-1'}`}>SPECIAL INSTRUCTIONS</p>
          <p className={compact ? 'text-[10px]' : 'text-xs'}>{payload.instructions}</p>
        </div>
      )}

      {/* Provider Signature */}
      <div className={`${signatureMargin} ${borderWidth} border-gray-800`}>
        <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-4'}`}>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Referring Provider Signature</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}><strong>Date:</strong> {orderDate}</p>
          </div>
          <div>
            <p className={`${compact ? 'text-[10px]' : 'text-xs'} ${signatureSpace} border-b border-gray-400 pb-1`}>Provider Name (Print)</p>
            <p className={compact ? 'text-[10px]' : 'text-xs'}>{orderedBy}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`${footerMargin} border-t border-gray-400 ${compact ? 'text-[10px]' : 'text-xs'} text-center text-gray-600`}>
        <p>This referral is valid for 90 days from the referral date.</p>
        <p className={compact ? 'mt-0.5' : 'mt-1'}>Please contact the specialist's office to schedule your appointment.</p>
      </div>
    </div>
  );
};



