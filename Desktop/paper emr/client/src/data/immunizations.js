// Immunization Schedule Database based on CDC/ACIP recommendations
// For adult and pediatric vaccines

export const vaccineDatabase = [
  // Adult Vaccines
  { 
    name: 'Influenza (Flu)', 
    code: '90686', 
    cvx: '158', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Annual',
    ageRange: { min: 0.5, max: 999 },
    frequency: 'Every year',
    series: 1,
    notes: 'Annual vaccination recommended for everyone 6 months and older',
    contraindications: ['Severe allergic reaction to previous flu vaccine or component'],
    administrationNotes: '0.5mL IM in deltoid for adults, anterolateral thigh for infants'
  },
  { 
    name: 'COVID-19 mRNA', 
    code: '91309', 
    cvx: '229', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Per CDC recommendations',
    ageRange: { min: 0.5, max: 999 },
    frequency: 'Updated vaccine annually',
    series: 'Varies by age and history',
    notes: 'Updated COVID-19 vaccine recommended annually',
    contraindications: ['Severe allergic reaction to previous COVID vaccine or component'],
    administrationNotes: '0.5mL IM in deltoid'
  },
  { 
    name: 'Tdap (Tetanus, Diphtheria, Pertussis)', 
    code: '90715', 
    cvx: '115', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Once as adult, Td booster every 10 years',
    ageRange: { min: 7, max: 999 },
    frequency: 'Once + Td every 10 years',
    series: 1,
    notes: 'One dose Tdap, then Td or Tdap booster every 10 years. Tdap recommended during each pregnancy.',
    contraindications: ['Severe allergic reaction to vaccine component', 'Encephalopathy within 7 days of previous dose'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'Pneumococcal (PCV20 or PCV15)', 
    code: '90677', 
    cvx: '215', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Age 65+ or high-risk adults',
    ageRange: { min: 19, max: 999 },
    frequency: 'Once (check previous vaccines)',
    series: '1-2 depending on type',
    notes: 'PCV20 alone OR PCV15 followed by PPSV23. For adults 65+ or younger with risk factors.',
    contraindications: ['Severe allergic reaction to vaccine or component'],
    highRiskConditions: ['Diabetes', 'Chronic heart/lung/liver disease', 'Immunocompromised', 'Asplenia', 'Cochlear implant', 'CSF leak', 'Smoking', 'Alcoholism']
  },
  { 
    name: 'Shingles (Shingrix)', 
    code: '90750', 
    cvx: '187', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Age 50+ (2 doses)',
    ageRange: { min: 50, max: 999 },
    frequency: '2 doses, 2-6 months apart',
    series: 2,
    notes: 'Two doses recommended for adults 50 and older. Can give even if previous Zostavax or prior shingles.',
    contraindications: ['Severe allergic reaction to vaccine component', 'Currently has shingles'],
    administrationNotes: '0.5mL IM. Second dose 2-6 months after first.'
  },
  { 
    name: 'RSV (Respiratory Syncytial Virus)', 
    code: '90678', 
    cvx: '305', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'Age 60+ or pregnant 32-36 weeks',
    ageRange: { min: 60, max: 999 },
    frequency: 'Single dose',
    series: 1,
    notes: 'Recommended for adults 60+ (shared decision-making). Also for pregnant women 32-36 weeks gestation.',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'Hepatitis B', 
    code: '90746', 
    cvx: '43', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: '3-dose series or 2-dose (Heplisav-B)',
    ageRange: { min: 0, max: 999 },
    frequency: '0, 1, 6 months (or 0, 1 month for Heplisav-B)',
    series: 3,
    notes: 'All adults through age 59. Adults 60+ with risk factors or request. Can check titers before vaccinating.',
    contraindications: ['Severe allergic reaction to yeast or vaccine component'],
    administrationNotes: '1.0mL IM adults'
  },
  { 
    name: 'Hepatitis A', 
    code: '90632', 
    cvx: '83', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: '2-dose series',
    ageRange: { min: 1, max: 999 },
    frequency: '0, 6-12 months',
    series: 2,
    notes: 'Recommended for travelers to endemic areas, MSM, drug users, chronic liver disease, homelessness.',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '1.0mL IM adults'
  },
  { 
    name: 'MMR (Measles, Mumps, Rubella)', 
    code: '90707', 
    cvx: '03', 
    route: 'SQ', 
    site: 'Upper arm',
    schedule: '1-2 doses based on birth year/risk',
    ageRange: { min: 1, max: 999 },
    frequency: '1-2 doses',
    series: 2,
    notes: 'Adults born 1957 or later without evidence of immunity need 1 dose. Healthcare workers and students need 2 doses.',
    contraindications: ['Pregnancy', 'Severe immunodeficiency', 'Severe allergic reaction to component'],
    administrationNotes: '0.5mL SQ'
  },
  { 
    name: 'Varicella (Chickenpox)', 
    code: '90716', 
    cvx: '21', 
    route: 'SQ', 
    site: 'Upper arm',
    schedule: '2-dose series if no immunity',
    ageRange: { min: 1, max: 999 },
    frequency: '2 doses, 4-8 weeks apart',
    series: 2,
    notes: 'For adults without evidence of immunity (no history of disease, vaccination, or positive titers)',
    contraindications: ['Pregnancy', 'Severe immunodeficiency', 'Severe allergic reaction to component'],
    administrationNotes: '0.5mL SQ'
  },
  { 
    name: 'HPV (Human Papillomavirus)', 
    code: '90651', 
    cvx: '165', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: '2-3 doses through age 26 (catch-up to 45)',
    ageRange: { min: 9, max: 45 },
    frequency: '2 doses if <15yo, 3 doses if 15+',
    series: 3,
    notes: 'Routine for ages 11-12. Catch-up through 26. Shared decision-making for adults 27-45.',
    contraindications: ['Pregnancy', 'Severe allergic reaction to vaccine or yeast'],
    administrationNotes: '0.5mL IM. Series: 0, 2, 6 months (or 0, 6-12 months if started before 15)'
  },
  { 
    name: 'Meningococcal ACWY', 
    code: '90734', 
    cvx: '147', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'High-risk adults and adolescents',
    ageRange: { min: 11, max: 999 },
    frequency: '2 doses 8 weeks apart, boost every 5 years if risk persists',
    series: 2,
    notes: 'For asplenia, complement deficiency, HIV, microbiologists, travelers to endemic areas, college students (if not vaccinated)',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'Meningococcal B', 
    code: '90620', 
    cvx: '163', 
    route: 'IM', 
    site: 'Deltoid',
    schedule: 'High-risk adults and adolescents 16-23',
    ageRange: { min: 10, max: 999 },
    frequency: '2-3 doses based on product',
    series: 2,
    notes: 'For asplenia, complement deficiency, microbiologists, outbreak settings. Shared decision for 16-23.',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '0.5mL IM'
  },
  
  // Pediatric Vaccines
  { 
    name: 'DTaP (Diphtheria, Tetanus, Pertussis)', 
    code: '90700', 
    cvx: '20', 
    route: 'IM', 
    site: 'Anterolateral thigh/Deltoid',
    schedule: '5-dose series',
    ageRange: { min: 0.16, max: 7 },
    frequency: '2, 4, 6, 15-18 months, 4-6 years',
    series: 5,
    notes: 'For children under 7. Switch to Tdap/Td at age 7+',
    contraindications: ['Encephalopathy within 7 days of previous dose', 'Severe allergic reaction'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'IPV (Polio)', 
    code: '90713', 
    cvx: '10', 
    route: 'IM or SQ', 
    site: 'Anterolateral thigh/Deltoid',
    schedule: '4-dose series',
    ageRange: { min: 0.16, max: 18 },
    frequency: '2, 4, 6-18 months, 4-6 years',
    series: 4,
    notes: 'For children. Adults need if incomplete series or traveling to endemic areas.',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '0.5mL IM or SQ'
  },
  { 
    name: 'Hib (Haemophilus influenzae type b)', 
    code: '90648', 
    cvx: '48', 
    route: 'IM', 
    site: 'Anterolateral thigh/Deltoid',
    schedule: '3-4 dose series',
    ageRange: { min: 0.16, max: 5 },
    frequency: '2, 4, (6), 12-15 months',
    series: 4,
    notes: 'Routine for infants. Adults with asplenia or stem cell transplant may need.',
    contraindications: ['Severe allergic reaction to vaccine component', 'Age <6 weeks'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'PCV (Pneumococcal Conjugate - Pediatric)', 
    code: '90670', 
    cvx: '152', 
    route: 'IM', 
    site: 'Anterolateral thigh/Deltoid',
    schedule: '4-dose series',
    ageRange: { min: 0.16, max: 5 },
    frequency: '2, 4, 6, 12-15 months',
    series: 4,
    notes: 'Routine for infants and young children.',
    contraindications: ['Severe allergic reaction to vaccine component'],
    administrationNotes: '0.5mL IM'
  },
  { 
    name: 'Rotavirus', 
    code: '90681', 
    cvx: '122', 
    route: 'PO', 
    site: 'Oral',
    schedule: '2-3 dose series (oral)',
    ageRange: { min: 0.16, max: 0.67 },
    frequency: '2, 4, (6) months',
    series: 3,
    notes: 'Must complete series by 8 months of age. Oral vaccine.',
    contraindications: ['SCID', 'History of intussusception', 'Severe allergic reaction to vaccine component'],
    administrationNotes: 'Oral administration only'
  },
];

// Age-appropriate vaccine recommendations
export const getRecommendedVaccines = (ageYears, conditions = []) => {
  const recommended = [];
  
  vaccineDatabase.forEach(vaccine => {
    if (ageYears >= vaccine.ageRange.min && ageYears <= vaccine.ageRange.max) {
      let priority = 'routine';
      let reason = 'Age-appropriate';
      
      // Check for high-risk conditions
      if (vaccine.highRiskConditions) {
        const matchingConditions = conditions.filter(c => 
          vaccine.highRiskConditions.some(hrc => 
            c.toLowerCase().includes(hrc.toLowerCase())
          )
        );
        if (matchingConditions.length > 0) {
          priority = 'high';
          reason = `High risk: ${matchingConditions.join(', ')}`;
        }
      }
      
      recommended.push({
        ...vaccine,
        priority,
        reason
      });
    }
  });
  
  return recommended;
};

// Vaccine administration record template
export const createVaccineRecord = (vaccine, patient, provider) => ({
  vaccineId: vaccine.code,
  vaccineName: vaccine.name,
  cvxCode: vaccine.cvx,
  lotNumber: '',
  expirationDate: '',
  manufacturer: '',
  site: vaccine.site,
  route: vaccine.route,
  dose: vaccine.series > 1 ? 1 : 1,
  seriesTotal: vaccine.series,
  administeredDate: new Date().toISOString(),
  administeredBy: provider?.id,
  patientId: patient?.id,
  notes: '',
  reaction: null,
  visDate: new Date().toISOString(), // Vaccine Information Statement date
});

// Search vaccines
export const searchVaccines = (query) => {
  if (!query || query.length < 2) return vaccineDatabase;
  const searchLower = query.toLowerCase();
  return vaccineDatabase.filter(vaccine =>
    vaccine.name.toLowerCase().includes(searchLower) ||
    vaccine.code.includes(searchLower) ||
    vaccine.cvx.includes(searchLower)
  );
};

export default { vaccineDatabase, getRecommendedVaccines, createVaccineRecord, searchVaccines };














