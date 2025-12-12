import React, { useState, useEffect, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { ordersAPI, patientsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { LabRequisitionForm, ImagingRequisitionForm, ReferralForm } from './OrderForms';

const PrintableOrders = ({ visitId, patientId, patientName, visitDate, planStructured = [], onClose }) => {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [databaseOrders, setDatabaseOrders] = useState([]); // Only for form components, not for filtering
  const { user } = useAuth();
  const usedOrderIdsRef = useRef(new Set()); // Track used order IDs across all diagnosis groups

  useEffect(() => {
    if (patientId) {
      fetchPatient();
      // Optionally fetch database orders for form components (but don't use for filtering)
      if (visitId) {
        fetchDatabaseOrders();
      } else {
        setLoading(false);
      }
    }
  }, [visitId, patientId]);

  // Reset usedOrderIds when planStructured changes
  useEffect(() => {
    usedOrderIdsRef.current = new Set();
  }, [planStructured]);

  // Fetch database orders only for form components (LabRequisitionForm, etc.)
  // These are NOT used for filtering - planStructured is the source of truth
  const fetchDatabaseOrders = async () => {
    try {
      const response = await ordersAPI.getByVisit(visitId);
      setDatabaseOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching database orders (non-critical):', error);
      setDatabaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatient = async () => {
    try {
      const response = await patientsAPI.get(patientId);
      const patientData = response.data || response;
      setPatient({
        name: patientName || `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim(),
        dob: patientData.date_of_birth,
        gender: patientData.gender,
        phone: patientData.phone,
        address: patientData.address,
        city: patientData.city,
        state: patientData.state,
        zip: patientData.zip_code || patientData.zip,
        insurance_name: patientData.insurance_name,
        insurance_id: patientData.insurance_id,
        insurance_group: patientData.insurance_group,
        id: patientId
      });
    } catch (error) {
      console.error('Error fetching patient:', error);
      setPatient({
        name: patientName || 'N/A',
        id: patientId
      });
    }
  };

  // Build orders to print DIRECTLY from planStructured (single source of truth)
  const ordersToPrint = React.useMemo(() => {
    if (!planStructured || planStructured.length === 0) {
      return [];
    }

    const orders = planStructured
      .filter(item => item && item.diagnosis && Array.isArray(item.orders) && item.orders.length > 0)
      .flatMap(item =>
        item.orders
          .filter(orderText => orderText && orderText.trim())
          .map(orderText => ({
            diagnosis: item.diagnosis,
            orderText: orderText.trim(),
            // Extract ICD-10 code if present (format: "I25.3 - Aneurysm of heart")
            diagnosisObj: (() => {
              const diagMatch = item.diagnosis.match(/^([A-Z]\d{2}\.\d+)\s*-\s*(.+)$/);
              return {
                name: diagMatch ? diagMatch[2] : item.diagnosis,
                icd10Code: diagMatch ? diagMatch[1] : null
              };
            })()
          }))
      );
    
    if (process.env.NODE_ENV === 'development') {
      console.log('=== PrintableOrders Debug ===');
      console.log('planStructured:', planStructured);
      console.log('ordersToPrint (from planStructured):', orders);
      console.log('Total orders to print:', orders.length);
    }
    
    return orders;
  }, [planStructured]);

  // Helper to find matching database order for form components (optional)
  // Uses EXACT matching to ensure correct order is found - no fuzzy matching
  const findMatchingDatabaseOrder = (orderText, usedOrderIds = new Set()) => {
    if (!orderText || !databaseOrders.length) return null;

    // Extract identifiers from plan order text for exact matching
    let planCode = null;
    let planCPT = null;
    let planTestName = null;
    
    // Lab pattern: "Lab: Complete Blood Count (CBC) [Quest: 6399, CPT: 85025]"
    // or "Lab: Comprehensive Metabolic Panel (CMP) [Quest: 10231, CPT: 80053]"
    const labMatch = orderText.match(/Lab:\s*([^[]+?)(?:\s*\[(?:Quest|LabCorp):\s*(\d+)(?:,\s*CPT:\s*(\d+))?\])?/i);
    if (labMatch) {
      planTestName = labMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
      planCode = labMatch[2];
      planCPT = labMatch[3];
    }
    
    // Find matching order with EXACT code/CPT match first, then exact name match
    // Priority: code > CPT > exact name match
    for (const order of databaseOrders) {
      // Skip if already used (prevent duplicate matches)
      if (usedOrderIds.has(order.id)) continue;
      
      const payload = typeof order.order_payload === 'string' 
        ? JSON.parse(order.order_payload) 
        : (order.order_payload || {});
      
      if (order.order_type === 'lab') {
        const code = (payload.code || '').toString();
        const cpt = (payload.cpt || '').toString();
        const testName = (payload.testName || payload.test_name || payload.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        
        // EXACT code match (highest priority - most reliable)
        if (planCode && code && planCode === code) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Matched by code:', { planCode, code, testName: payload.testName || payload.test_name || payload.name });
          }
          return order;
        }
        // EXACT CPT match (second priority)
        if (planCPT && cpt && planCPT === cpt) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Matched by CPT:', { planCPT, cpt, testName: payload.testName || payload.test_name || payload.name });
          }
          return order;
        }
        // EXACT name match (normalized, third priority)
        if (planTestName && testName && planTestName === testName) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Matched by exact name:', { planTestName, testName });
          }
          return order;
        }
        // NO fallback fuzzy matching - only exact matches
      } else if (order.order_type === 'imaging') {
        const cpt = (payload.cpt || '').toString();
        const studyName = (payload.studyName || payload.name || '').toLowerCase().replace(/\s+/g, ' ');
        const imagingCPT = orderText.match(/CPT:\s*(\d+)/i)?.[1];
        const imagingName = orderText.match(/Imaging:\s*([^[]+)/i)?.[1]?.trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (imagingCPT && cpt && imagingCPT === cpt) {
          return order;
        }
        if (imagingName && studyName && imagingName === studyName) {
          return order;
        }
      } else if (order.order_type === 'referral') {
        const specialist = (payload.specialist || payload.recipientName || payload.recipientSpecialty || '').toLowerCase().replace(/\s+/g, ' ');
        const referralSpecialist = orderText.match(/Referral:\s*([^-]+)/i)?.[1]?.trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (referralSpecialist && specialist && referralSpecialist === specialist) {
          return order;
        }
      } else if (order.order_type === 'prescription' || order.order_type === 'rx') {
        const medication = (payload.medication || payload.medicationName || '').toLowerCase().replace(/\s+/g, ' ');
        const rxMedication = orderText.match(/(?:Rx|Prescription):\s*(.+)/i)?.[1]?.trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (rxMedication && medication && rxMedication === medication) {
          return order;
        }
      }
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('❌ No match found for:', orderText);
    }
    
    return null;
  };

  const handlePrint = () => {
    // Find the print content
    const printContent = document.querySelector('.print-content');
    if (!printContent) {
      console.error('Print content not found!');
      window.print();
      return;
    }
    
    // Clone the print content instead of moving it (to avoid React DOM issues)
    const printClone = printContent.cloneNode(true);
    printClone.id = 'print-orders-clone';
    printClone.style.position = 'absolute';
    printClone.style.left = '-9999px';
    printClone.style.top = '0';
    printClone.style.width = '8.5in';
    printClone.style.background = 'white';
    printClone.style.zIndex = '99999';
    printClone.style.display = 'block';
    printClone.style.visibility = 'visible';
    
    // Add clone to body
    document.body.appendChild(printClone);
    
    // Hide all other content temporarily using CSS classes
    document.body.classList.add('printing-orders');
    
    // Trigger print
    window.print();
    
    // Restore after print
    setTimeout(() => {
      // Remove clone
      const clone = document.getElementById('print-orders-clone');
      if (clone && clone.parentNode) {
        clone.parentNode.removeChild(clone);
      }
      
      // Remove printing class
      document.body.classList.remove('printing-orders');
    }, 100);
  };

  // Group orders by diagnosis
  const ordersByDiagnosis = React.useMemo(() => {
    const grouped = {};
    ordersToPrint.forEach(({ diagnosis, orderText, diagnosisObj }) => {
      const diagKey = diagnosisObj.icd10Code || diagnosisObj.name || diagnosis;
      if (!grouped[diagKey]) {
        grouped[diagKey] = {
          diagnosis: diagnosisObj,
          orders: []
        };
      }
      grouped[diagKey].orders.push({ orderText, diagnosisObj });
    });
    return grouped;
  }, [ordersToPrint]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (ordersToPrint.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Medical Orders - Print View</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-500">No orders in the current plan section.</p>
        </div>
      </div>
    );
  }

  const provider = {
    name: user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : 'Provider',
    npi: user?.npi || null
  };
  
  const clinic = {
    name: 'Medical Center',
    address: '123 Medical Center Drive, Suite 100',
    phone: '(555) 123-4567',
    fax: '(555) 123-4568'
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold">Medical Orders - Print View</h2>
              <p className="text-sm text-gray-600 mt-1">
                Orders from Plan section • Only orders currently in the plan are shown
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {/* Printable Content */}
            <div className="print-content">
              {/* Orders - Grouped by Diagnosis */}
              <div className="space-y-3">
                {Object.values(ordersByDiagnosis).map((group, groupIndex) => {
                  const diagnosis = group.diagnosis;
                  const diagnosisOrders = group.orders;
                  
                  return (
                    <div key={diagnosis.icd10Code || diagnosis.name || groupIndex} className="break-after-page">
                      {/* Diagnosis Header */}
                      <div className="mb-1.5 pb-1 border-b border-gray-600">
                        <h2 className="text-sm font-bold">
                          {diagnosis.icd10Code ? `${diagnosis.icd10Code} - ` : ''}{diagnosis.name}
                        </h2>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {diagnosisOrders.length} order{diagnosisOrders.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      {/* Orders for this diagnosis */}
                      <div className="mt-1">
                        {diagnosisOrders.map(({ orderText }, orderIndex) => {
                          // Try to find matching database order for form component
                          const matchingOrder = findMatchingDatabaseOrder(orderText, usedOrderIdsRef.current);
                          
                          // Mark this order as used if found
                          if (matchingOrder) {
                            usedOrderIdsRef.current.add(matchingOrder.id);
                          }
                          
                          if (process.env.NODE_ENV === 'development') {
                            console.log('Rendering order from plan:', {
                              orderText,
                              foundMatch: !!matchingOrder,
                              matchingOrderId: matchingOrder?.id,
                              matchingOrderType: matchingOrder?.order_type
                            });
                          }
                          
                          if (matchingOrder) {
                            // Use form component if we have a matching database order
                            if (matchingOrder.order_type === 'lab') {
                              return (
                                <div key={`${diagnosis.name}-${orderIndex}`} className={orderIndex < diagnosisOrders.length - 1 ? "mb-2" : ""}>
                                  <LabRequisitionForm 
                                    order={matchingOrder} 
                                    patient={patient} 
                                    provider={provider} 
                                    clinic={clinic} 
                                    compact={true}
                                  />
                                </div>
                              );
                            } else if (matchingOrder.order_type === 'imaging') {
                              return (
                                <div key={`${diagnosis.name}-${orderIndex}`} className={orderIndex < diagnosisOrders.length - 1 ? "mb-2" : ""}>
                                  <ImagingRequisitionForm 
                                    order={matchingOrder} 
                                    patient={patient} 
                                    provider={provider} 
                                    clinic={clinic} 
                                    compact={true}
                                  />
                                </div>
                              );
                            } else if (matchingOrder.order_type === 'referral') {
                              return (
                                <div key={`${diagnosis.name}-${orderIndex}`} className={orderIndex < diagnosisOrders.length - 1 ? "mb-2" : ""}>
                                  <ReferralForm 
                                    order={matchingOrder} 
                                    patient={patient} 
                                    provider={provider} 
                                    clinic={clinic} 
                                    compact={true}
                                  />
                                </div>
                              );
                            }
                          }
                          
                          // Fallback: render as text if no matching database order found
                          // Parse order type from text
                          const orderType = orderText.match(/^(Lab|Imaging|Referral|Rx|Prescription):/i)?.[1]?.toLowerCase() || 'order';
                          
                          return (
                            <div key={`${diagnosis.name}-${orderIndex}`} className={`text-xs py-1 ${orderIndex < diagnosisOrders.length - 1 ? "border-b border-gray-200" : ""}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <span className="font-semibold text-gray-900">
                                    {orderText.split(':')[1]?.trim() || orderText}
                                  </span>
                                  {orderText.match(/\(CPT:\s*(\d+)\)/i) && (
                                    <span className="text-gray-500 ml-2">
                                      (CPT: {orderText.match(/\(CPT:\s*(\d+)\)/i)[1]})
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-500 capitalize ml-2 text-[10px]">
                                  {orderType === 'rx' ? 'Rx' : orderType.charAt(0).toUpperCase() + orderType.slice(1)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-1.5 border-t border-gray-300 text-[10px] text-gray-500 text-center">
                <p>This is a printed copy of medical orders. Please bring this document when completing your orders.</p>
                <p className="mt-0.5">If you have any questions, please contact your healthcare provider.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        /* When printing-orders class is active, hide everything except print clone */
        body.printing-orders > *:not(#print-orders-clone),
        body.printing-orders #root > * {
          display: none !important;
          visibility: hidden !important;
        }
        
        body.printing-orders #print-orders-clone {
          display: block !important;
          visibility: visible !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
        }
        
        @media print {
          @page {
            margin: 0.5in;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          #print-orders-clone,
          #print-orders-clone * {
            visibility: visible !important;
          }
          #print-orders-clone {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0.5in !important;
            background: white !important;
            z-index: 9999 !important;
          }
          .fixed,
          button,
          [class*="print-hidden"],
          [class*="hidden"] {
            display: none !important;
            visibility: hidden !important;
          }
          .break-after-page {
            page-break-after: always;
          }
          .lab-requisition-form,
          .imaging-requisition-form,
          .referral-form {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
};

export default PrintableOrders;
