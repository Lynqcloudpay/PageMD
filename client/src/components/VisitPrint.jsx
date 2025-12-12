import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Printer, X, CheckSquare, Square } from 'lucide-react';
import { visitsAPI, patientsAPI, ordersAPI, documentsAPI } from '../services/api';
import { format } from 'date-fns';

const VisitPrint = ({ visitId, patientId, onClose }) => {
  const [patient, setPatient] = useState(null);
  const [allVisits, setAllVisits] = useState([]);
  const [selectedVisits, setSelectedVisits] = useState([visitId]);
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [problems, setProblems] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [socialHistory, setSocialHistory] = useState(null);

  const printRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          patientRes,
          allergiesRes,
          medicationsRes,
          problemsRes,
          familyHistoryRes,
          socialHistoryRes,
          visitsRes,
        ] = await Promise.all([
          patientsAPI.get(patientId),
          patientsAPI.getAllergies(patientId).catch(() => ({ data: [] })),
          patientsAPI.getMedications(patientId).catch(() => ({ data: [] })),
          patientsAPI.getProblems(patientId).catch(() => ({ data: [] })),
          patientsAPI.getFamilyHistory(patientId).catch(() => ({ data: [] })),
          patientsAPI.getSocialHistory(patientId).catch(() => ({ data: null })),
          visitsAPI.getByPatient(patientId).catch(async () => {
            const v = await visitsAPI.get(visitId);
            return { data: [v.data] };
          }),
        ]);

        if (!mounted) return;

        setPatient(patientRes.data);
        setAllergies(allergiesRes.data || []);
        setMedications(medicationsRes.data || []);
        setProblems(problemsRes.data || []);
        setFamilyHistory(familyHistoryRes.data || []);
        setSocialHistory(socialHistoryRes.data);

        setAllVisits(visitsRes.data || []);
      } catch (e) {
        console.error('VisitPrint fetch error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      mounted = false;
    };
  }, [visitId, patientId]);

  useEffect(() => {
    if (!patientId) return;

    const fetchOrdersAndDocs = async () => {
      try {
        const [ordersRes, docsRes] = await Promise.all([
          ordersAPI.getByPatient(patientId).catch(() => ({ data: [] })),
          documentsAPI.getByPatient(patientId).catch(() => ({ data: [] })),
        ]);

        const sel = new Set(selectedVisits);
        setOrders((ordersRes.data || []).filter(o => sel.has(o.visit_id)));
        setDocuments((docsRes.data || []).filter(d => sel.has(d.visit_id)));
      } catch (e) {
        console.error('VisitPrint orders/docs error:', e);
      }
    };

    fetchOrdersAndDocs();
  }, [patientId, selectedVisits]);

  const visitsToPrint = useMemo(
    () => (allVisits || []).filter(v => selectedVisits.includes(v.id)),
    [allVisits, selectedVisits]
  );

  const toggleVisit = (vid) => {
    setSelectedVisits(prev => {
      if (prev.includes(vid)) {
        if (prev.length === 1) return prev;
        return prev.filter(v => v !== vid);
      }
      return [...prev, vid];
    });
  };

  const decodeHtml = (text) => {
    if (!text) return '';
    return String(text)
      .replace(/&#x2F;|&#47;/g, '/')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  };

  const parseNoteText = (noteText) => {
    if (!noteText) return { chiefComplaint: '', hpi: '', ros: '', pe: '', assessment: '', plan: '' };

    const sections = { chiefComplaint: '', hpi: '', ros: '', pe: '', assessment: '', plan: '' };

    const ccMatch = noteText.match(/(?:Chief Complaint|CC):\s*(.+?)(?:\n\n|\n(?:HPI|History|ROS|Review|PE|Physical|Assessment|Plan):)/is);
    if (ccMatch) sections.chiefComplaint = ccMatch[1].trim();

    const hpiMatch = noteText.match(/(?:HPI|History of Present Illness):\s*(.+?)(?:\n\n|\n(?:ROS|Review|PE|Physical|Assessment|Plan):)/is);
    if (hpiMatch) sections.hpi = hpiMatch[1].trim();

    const rosMatch = noteText.match(/(?:ROS|Review of Systems):\s*(.+?)(?:\n\n|\n(?:PE|Physical|Assessment|Plan):)/is);
    if (rosMatch) sections.ros = rosMatch[1].trim();

    const peMatch = noteText.match(/(?:PE|Physical Exam|Physical Examination):\s*(.+?)(?:\n\n|\n(?:Assessment|Plan):)/is);
    if (peMatch) sections.pe = peMatch[1].trim();

    const assessmentMatch = noteText.match(/(?:Assessment|A):\s*(.+?)(?:\n\n|\n(?:Plan|P):)/is);
    if (assessmentMatch) sections.assessment = assessmentMatch[1].trim();

    const planMatch = noteText.match(/(?:Plan|P):\s*(.+?)(?:\n\n|$)/is);
    if (planMatch) sections.plan = planMatch[1].trim();

    return sections;
  };

  // ✅ PrintableOrders-style print: clone + body class + afterprint cleanup
  const handlePrint = () => {
    const printContent = document.querySelector('#print-template .print-content');
    if (!printContent) {
      console.error('VisitPrint: print content not found');
      return window.print();
    }

    // Remove any old clone
    document.getElementById('print-visit-clone')?.remove();

    const clone = printContent.cloneNode(true);
    clone.id = 'print-visit-clone';

    // Put it offscreen (same as PrintableOrders)
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = '8.5in';
    clone.style.background = 'white';
    clone.style.zIndex = '99999';
    clone.style.display = 'block';

    document.body.appendChild(clone);

    document.body.classList.add('printing-visit');

    const cleanup = () => {
      document.body.classList.remove('printing-visit');
      document.getElementById('print-visit-clone')?.remove();
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* IMPORTANT: use id="print-template" so VisitChartView global print CSS doesn't blank the page */}
      <div ref={printRef} id="print-template" className="print-only">
        <div className="print-content">
          <div className="p-6 bg-white">
            {patient && (
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Visit Chart (PageMD)</h1>
                <div className="text-sm space-y-1">
                  <div><strong>Patient:</strong> {patient.first_name} {patient.last_name}</div>
                  <div><strong>DOB:</strong> {patient.dob ? format(new Date(patient.dob), 'MMM d, yyyy') : 'N/A'}</div>
                  <div><strong>MRN:</strong> {patient.mrn || 'N/A'}</div>
                  <div><strong>Sex:</strong> {patient.sex || 'N/A'}</div>
                </div>
              </div>
            )}

            {/* Structured background */}
            {problems.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Past Medical History</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {problems.map((p, i) => (
                    <li key={i}>{p.icd10_code ? `${p.icd10_code} - ` : ''}{p.problem_name || p.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {medications.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Current Medications</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {medications.map((m, i) => (
                    <li key={i}>
                      <strong>{m.medication_name}</strong>
                      {m.dosage ? ` - ${m.dosage}` : ''}
                      {m.frequency ? `, ${m.frequency}` : ''}
                      {m.route ? `, ${m.route}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {allergies.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Allergies</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {allergies.map((a, i) => (
                    <li key={i}><strong>{a.allergen}</strong>{a.reaction ? ` - ${a.reaction}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            {familyHistory.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Family History</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {familyHistory.map((f, i) => (
                    <li key={i}><strong>{f.condition}</strong>{f.relationship ? ` - ${f.relationship}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            {socialHistory && (
              <div className="mb-6">
                <h3 className="font-bold mb-2">Social History</h3>
                <div className="text-sm space-y-1">
                  {socialHistory.smoking_status && <div>Smoking: {socialHistory.smoking_status}</div>}
                  {socialHistory.alcohol_use && <div>Alcohol: {socialHistory.alcohol_use}</div>}
                  {socialHistory.occupation && <div>Occupation: {socialHistory.occupation}</div>}
                </div>
              </div>
            )}

            {/* Visits */}
            {visitsToPrint.map((visit, idx) => {
              const visitVitals = visit.vitals ? (typeof visit.vitals === 'string' ? JSON.parse(visit.vitals) : visit.vitals) : null;
              const note = visit.note_draft ? parseNoteText(visit.note_draft) : null;

              const providerName =
                visit.provider_first_name && visit.provider_last_name
                  ? `${visit.provider_first_name} ${visit.provider_last_name}`
                  : 'Provider';

              return (
                <div key={visit.id} className={idx > 0 ? 'page-break-before mt-6 pt-6' : ''}>
                  <div className="border-b pb-2 mb-3">
                    <div className="text-lg font-bold">
                      Visit: {visit.visit_date ? format(new Date(visit.visit_date), 'MMMM d, yyyy') : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-700">
                      Provider: {providerName} | Visit Type: {visit.visit_type || 'Office Visit'}
                    </div>
                  </div>

                  {visitVitals && (
                    <div className="mb-4">
                      <h3 className="font-bold mb-2">Vital Signs</h3>
                      <div className="text-sm space-y-1">
                        {visitVitals.bp && <div><strong>BP:</strong> {visitVitals.bp}</div>}
                        {visitVitals.pulse && <div><strong>HR:</strong> {visitVitals.pulse}</div>}
                        {visitVitals.temp && <div><strong>Temp:</strong> {visitVitals.temp}</div>}
                        {visitVitals.resp && <div><strong>RR:</strong> {visitVitals.resp}</div>}
                        {visitVitals.o2sat && <div><strong>O2 Sat:</strong> {visitVitals.o2sat}</div>}
                        {visitVitals.weight && <div><strong>Weight:</strong> {visitVitals.weight}</div>}
                        {visitVitals.height && <div><strong>Height:</strong> {visitVitals.height}</div>}
                        {visitVitals.bmi && <div><strong>BMI:</strong> {visitVitals.bmi}</div>}
                      </div>
                    </div>
                  )}

                  {note?.chiefComplaint && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">Chief Complaint</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.chiefComplaint)}</div>
                    </div>
                  )}
                  {note?.hpi && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">History of Present Illness</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.hpi)}</div>
                    </div>
                  )}
                  {note?.ros && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">Review of Systems</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.ros)}</div>
                    </div>
                  )}
                  {note?.pe && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">Physical Examination</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.pe)}</div>
                    </div>
                  )}
                  {note?.assessment && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">Assessment</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.assessment)}</div>
                    </div>
                  )}
                  {note?.plan && (
                    <div className="mb-3">
                      <h3 className="font-bold mb-1">Plan</h3>
                      <div className="text-sm whitespace-pre-wrap">{decodeHtml(note.plan)}</div>
                    </div>
                  )}

                  {/* Full note fallback so nothing is "missing" */}
                  {visit.note_draft && (
                    <div className="mt-4 pt-3 border-t">
                      <h3 className="font-bold mb-2">Full Note</h3>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }} className="text-sm">
                        {decodeHtml(visit.note_draft)}
                      </pre>
                    </div>
                  )}

                  {orders.filter(o => o.visit_id === visit.id).length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-bold mb-2">Orders</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {orders.filter(o => o.visit_id === visit.id).map((o, i) => (
                          <li key={i}>
                            <strong className="capitalize">{o.order_type}:</strong>{' '}
                            {o.order_payload?.test_name ||
                              o.order_payload?.study_name ||
                              o.order_payload?.testName ||
                              o.order_payload?.procedureName ||
                              'Order'}
                            {o.status ? ` (${o.status})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {documents.filter(d => d.visit_id === visit.id).length > 0 && (
                    <div className="mt-4">
                      <h3 className="font-bold mb-2">Documents</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {documents.filter(d => d.visit_id === visit.id).map((d, i) => (
                          <li key={i}>{d.filename} ({d.doc_type || 'document'})</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-6 pt-3 border-t text-xs text-gray-600 text-center">
              Generated on {format(new Date(), 'MMMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Print Visit Chart</h2>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">Select Visits to Include:</label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                {allVisits.map(v => {
                  const isSelected = selectedVisits.includes(v.id);
                  const isCurrent = v.id === visitId;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer ${isCurrent ? 'bg-blue-50' : ''}`}
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      <div className="flex-1">
                        <div className="font-medium">
                          {format(new Date(v.visit_date), 'MMM d, yyyy')}
                          {isCurrent && <span className="ml-2 text-xs text-blue-600">(Current)</span>}
                        </div>
                        <div className="text-sm text-gray-600">{v.visit_type || 'Office Visit'}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVisit(v.id)}
                        disabled={isCurrent && selectedVisits.length === 1}
                        className="hidden"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button onClick={onClose} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-white rounded-md flex items-center space-x-2"
                style={{ background: 'linear-gradient(to right, #3B82F6, #2563EB)' }}
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Styles (same pattern as PrintableOrders) */}
      <style>{`
        @media screen {
          .print-only { display: none !important; }
        }

        body.printing-visit #root { display: none !important; }
        body.printing-visit #print-visit-clone { display: block !important; }

        @media print {
          @page { margin: 0.5in; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Extra safety: force the clone visible during print */
          body.printing-visit #print-visit-clone,
          body.printing-visit #print-visit-clone * {
            visibility: visible !important;
          }
          
          .page-break-before { page-break-before: always; break-before: page; }
          .print\\:hidden, .fixed, button { display: none !important; }
        }
      `}</style>
    </>
  );
};

export default VisitPrint;
