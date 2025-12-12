// Comprehensive medication database with drug interactions and alerts
// Based on common prescribing patterns from Epic, eCW, and Meditech

export const medicationDatabase = [
  // Cardiovascular
  { name: 'Lisinopril', brandNames: ['Prinivil', 'Zestril'], class: 'ACE Inhibitor', ndc: '68180-0513-01', strengths: ['2.5mg', '5mg', '10mg', '20mg', '40mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Amlodipine', brandNames: ['Norvasc'], class: 'Calcium Channel Blocker', ndc: '00069-1520-66', strengths: ['2.5mg', '5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Metoprolol Succinate ER', brandNames: ['Toprol-XL'], class: 'Beta Blocker', ndc: '00186-1088-05', strengths: ['25mg', '50mg', '100mg', '200mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Metoprolol Tartrate', brandNames: ['Lopressor'], class: 'Beta Blocker', ndc: '00781-5071-01', strengths: ['25mg', '50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'cardiovascular', controlled: false },
  { name: 'Losartan', brandNames: ['Cozaar'], class: 'ARB', ndc: '00006-0951-31', strengths: ['25mg', '50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Atorvastatin', brandNames: ['Lipitor'], class: 'Statin', ndc: '00071-0155-23', strengths: ['10mg', '20mg', '40mg', '80mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'cardiovascular', controlled: false },
  { name: 'Rosuvastatin', brandNames: ['Crestor'], class: 'Statin', ndc: '00310-0755-90', strengths: ['5mg', '10mg', '20mg', '40mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'cardiovascular', controlled: false },
  { name: 'Furosemide', brandNames: ['Lasix'], class: 'Loop Diuretic', ndc: '00054-4299-25', strengths: ['20mg', '40mg', '80mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Hydrochlorothiazide', brandNames: ['Microzide'], class: 'Thiazide Diuretic', ndc: '00904-5869-61', strengths: ['12.5mg', '25mg', '50mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Spironolactone', brandNames: ['Aldactone'], class: 'Potassium-Sparing Diuretic', ndc: '00054-4458-25', strengths: ['25mg', '50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Carvedilol', brandNames: ['Coreg'], class: 'Beta Blocker', ndc: '00007-4140-20', strengths: ['3.125mg', '6.25mg', '12.5mg', '25mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'cardiovascular', controlled: false },
  { name: 'Clopidogrel', brandNames: ['Plavix'], class: 'Antiplatelet', ndc: '63653-1171-01', strengths: ['75mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'cardiovascular', controlled: false },
  { name: 'Warfarin', brandNames: ['Coumadin', 'Jantoven'], class: 'Anticoagulant', ndc: '00056-0169-75', strengths: ['1mg', '2mg', '2.5mg', '3mg', '4mg', '5mg', '6mg', '7.5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take as directed by INR levels', category: 'cardiovascular', controlled: false },
  { name: 'Apixaban', brandNames: ['Eliquis'], class: 'DOAC', ndc: '00003-0893-21', strengths: ['2.5mg', '5mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'cardiovascular', controlled: false },
  { name: 'Rivaroxaban', brandNames: ['Xarelto'], class: 'DOAC', ndc: '50458-0580-30', strengths: ['10mg', '15mg', '20mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily with food', category: 'cardiovascular', controlled: false },
  
  // Diabetes
  { name: 'Metformin', brandNames: ['Glucophage'], class: 'Biguanide', ndc: '00087-6060-13', strengths: ['500mg', '850mg', '1000mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily with meals', category: 'diabetes', controlled: false },
  { name: 'Metformin ER', brandNames: ['Glucophage XR', 'Glumetza'], class: 'Biguanide', ndc: '00087-6063-13', strengths: ['500mg', '750mg', '1000mg'], forms: ['tablet'], defaultSig: 'Take with evening meal once daily', category: 'diabetes', controlled: false },
  { name: 'Glipizide', brandNames: ['Glucotrol'], class: 'Sulfonylurea', ndc: '00049-4110-66', strengths: ['5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth 30 minutes before breakfast', category: 'diabetes', controlled: false },
  { name: 'Glimepiride', brandNames: ['Amaryl'], class: 'Sulfonylurea', ndc: '00039-0221-10', strengths: ['1mg', '2mg', '4mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth with first main meal', category: 'diabetes', controlled: false },
  { name: 'Sitagliptin', brandNames: ['Januvia'], class: 'DPP-4 Inhibitor', ndc: '00006-0277-31', strengths: ['25mg', '50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'diabetes', controlled: false },
  { name: 'Empagliflozin', brandNames: ['Jardiance'], class: 'SGLT2 Inhibitor', ndc: '00597-0152-30', strengths: ['10mg', '25mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily in the morning', category: 'diabetes', controlled: false },
  { name: 'Liraglutide', brandNames: ['Victoza'], class: 'GLP-1 Agonist', ndc: '00169-4060-12', strengths: ['6mg/mL'], forms: ['injection pen'], defaultSig: 'Inject 0.6mg subcutaneously once daily, increase to 1.2mg after 1 week', category: 'diabetes', controlled: false },
  { name: 'Semaglutide', brandNames: ['Ozempic', 'Wegovy'], class: 'GLP-1 Agonist', ndc: '00169-4130-12', strengths: ['0.25mg', '0.5mg', '1mg', '2mg'], forms: ['injection pen'], defaultSig: 'Inject subcutaneously once weekly', category: 'diabetes', controlled: false },
  { name: 'Insulin Glargine', brandNames: ['Lantus', 'Basaglar'], class: 'Long-Acting Insulin', ndc: '00088-2220-33', strengths: ['100 units/mL'], forms: ['injection'], defaultSig: 'Inject subcutaneously at bedtime', category: 'diabetes', controlled: false },
  { name: 'Insulin Lispro', brandNames: ['Humalog'], class: 'Rapid-Acting Insulin', ndc: '00002-7510-01', strengths: ['100 units/mL'], forms: ['injection'], defaultSig: 'Inject subcutaneously with meals per sliding scale', category: 'diabetes', controlled: false },
  
  // Pain/Anti-inflammatory
  { name: 'Ibuprofen', brandNames: ['Advil', 'Motrin'], class: 'NSAID', ndc: '00904-5853-60', strengths: ['200mg', '400mg', '600mg', '800mg'], forms: ['tablet', 'capsule'], defaultSig: 'Take 1 tablet by mouth every 6-8 hours as needed for pain', category: 'pain', controlled: false },
  { name: 'Naproxen', brandNames: ['Aleve', 'Naprosyn'], class: 'NSAID', ndc: '00904-5929-60', strengths: ['250mg', '375mg', '500mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily as needed', category: 'pain', controlled: false },
  { name: 'Meloxicam', brandNames: ['Mobic'], class: 'NSAID', ndc: '59762-3061-01', strengths: ['7.5mg', '15mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'pain', controlled: false },
  { name: 'Celecoxib', brandNames: ['Celebrex'], class: 'COX-2 Inhibitor', ndc: '00025-1525-31', strengths: ['100mg', '200mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth twice daily', category: 'pain', controlled: false },
  { name: 'Acetaminophen', brandNames: ['Tylenol'], class: 'Analgesic', ndc: '00045-0500-60', strengths: ['325mg', '500mg', '650mg'], forms: ['tablet', 'capsule'], defaultSig: 'Take 1-2 tablets by mouth every 4-6 hours as needed', category: 'pain', controlled: false },
  { name: 'Tramadol', brandNames: ['Ultram'], class: 'Opioid Analgesic', ndc: '00591-5612-01', strengths: ['50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth every 4-6 hours as needed for pain', category: 'pain', controlled: true, schedule: 'IV' },
  { name: 'Hydrocodone/Acetaminophen', brandNames: ['Norco', 'Vicodin'], class: 'Opioid Analgesic', ndc: '00591-0385-01', strengths: ['5/325mg', '7.5/325mg', '10/325mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth every 4-6 hours as needed for pain', category: 'pain', controlled: true, schedule: 'II' },
  { name: 'Oxycodone', brandNames: ['OxyContin', 'Roxicodone'], class: 'Opioid Analgesic', ndc: '59011-0442-10', strengths: ['5mg', '10mg', '15mg', '20mg', '30mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth every 4-6 hours as needed for pain', category: 'pain', controlled: true, schedule: 'II' },
  { name: 'Gabapentin', brandNames: ['Neurontin'], class: 'Anticonvulsant/Pain', ndc: '00071-0806-40', strengths: ['100mg', '300mg', '400mg', '600mg', '800mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1 capsule by mouth three times daily', category: 'pain', controlled: false },
  { name: 'Pregabalin', brandNames: ['Lyrica'], class: 'Anticonvulsant/Pain', ndc: '00071-1013-68', strengths: ['25mg', '50mg', '75mg', '100mg', '150mg', '200mg', '300mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth twice daily', category: 'pain', controlled: true, schedule: 'V' },
  { name: 'Cyclobenzaprine', brandNames: ['Flexeril'], class: 'Muscle Relaxant', ndc: '00378-0283-01', strengths: ['5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth three times daily as needed', category: 'pain', controlled: false },
  
  // Psychiatric/Mental Health
  { name: 'Sertraline', brandNames: ['Zoloft'], class: 'SSRI', ndc: '00049-4900-66', strengths: ['25mg', '50mg', '100mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'psychiatric', controlled: false },
  { name: 'Escitalopram', brandNames: ['Lexapro'], class: 'SSRI', ndc: '00456-2010-01', strengths: ['5mg', '10mg', '20mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'psychiatric', controlled: false },
  { name: 'Fluoxetine', brandNames: ['Prozac'], class: 'SSRI', ndc: '00777-3105-02', strengths: ['10mg', '20mg', '40mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth once daily in the morning', category: 'psychiatric', controlled: false },
  { name: 'Duloxetine', brandNames: ['Cymbalta'], class: 'SNRI', ndc: '00002-3235-30', strengths: ['20mg', '30mg', '60mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth once daily', category: 'psychiatric', controlled: false },
  { name: 'Venlafaxine ER', brandNames: ['Effexor XR'], class: 'SNRI', ndc: '00008-0833-01', strengths: ['37.5mg', '75mg', '150mg', '225mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth once daily', category: 'psychiatric', controlled: false },
  { name: 'Bupropion XL', brandNames: ['Wellbutrin XL'], class: 'NDRI', ndc: '00173-0177-55', strengths: ['150mg', '300mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily in the morning', category: 'psychiatric', controlled: false },
  { name: 'Trazodone', brandNames: ['Desyrel'], class: 'SARI', ndc: '00603-4890-21', strengths: ['50mg', '100mg', '150mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'psychiatric', controlled: false },
  { name: 'Mirtazapine', brandNames: ['Remeron'], class: 'NaSSA', ndc: '00052-0105-01', strengths: ['7.5mg', '15mg', '30mg', '45mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'psychiatric', controlled: false },
  { name: 'Alprazolam', brandNames: ['Xanax'], class: 'Benzodiazepine', ndc: '00009-0029-01', strengths: ['0.25mg', '0.5mg', '1mg', '2mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth three times daily as needed for anxiety', category: 'psychiatric', controlled: true, schedule: 'IV' },
  { name: 'Lorazepam', brandNames: ['Ativan'], class: 'Benzodiazepine', ndc: '00187-0063-01', strengths: ['0.5mg', '1mg', '2mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth as needed for anxiety', category: 'psychiatric', controlled: true, schedule: 'IV' },
  { name: 'Clonazepam', brandNames: ['Klonopin'], class: 'Benzodiazepine', ndc: '00004-0058-01', strengths: ['0.5mg', '1mg', '2mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'psychiatric', controlled: true, schedule: 'IV' },
  { name: 'Buspirone', brandNames: ['BuSpar'], class: 'Anxiolytic', ndc: '00087-0818-01', strengths: ['5mg', '7.5mg', '10mg', '15mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'psychiatric', controlled: false },
  { name: 'Quetiapine', brandNames: ['Seroquel'], class: 'Atypical Antipsychotic', ndc: '00310-0271-10', strengths: ['25mg', '50mg', '100mg', '200mg', '300mg', '400mg'], forms: ['tablet'], defaultSig: 'Take as directed', category: 'psychiatric', controlled: false },
  { name: 'Aripiprazole', brandNames: ['Abilify'], class: 'Atypical Antipsychotic', ndc: '59148-0016-13', strengths: ['2mg', '5mg', '10mg', '15mg', '20mg', '30mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'psychiatric', controlled: false },
  
  // Respiratory
  { name: 'Albuterol Inhaler', brandNames: ['ProAir', 'Ventolin', 'Proventil'], class: 'Short-Acting Beta Agonist', ndc: '59310-0579-22', strengths: ['90mcg/actuation'], forms: ['inhaler'], defaultSig: 'Inhale 1-2 puffs every 4-6 hours as needed for shortness of breath', category: 'respiratory', controlled: false },
  { name: 'Fluticasone Inhaler', brandNames: ['Flovent'], class: 'Inhaled Corticosteroid', ndc: '00173-0601-20', strengths: ['44mcg', '110mcg', '220mcg'], forms: ['inhaler'], defaultSig: 'Inhale 2 puffs twice daily', category: 'respiratory', controlled: false },
  { name: 'Fluticasone/Salmeterol', brandNames: ['Advair'], class: 'ICS/LABA', ndc: '00173-0696-00', strengths: ['100/50mcg', '250/50mcg', '500/50mcg'], forms: ['diskus'], defaultSig: 'Inhale 1 puff twice daily', category: 'respiratory', controlled: false },
  { name: 'Budesonide/Formoterol', brandNames: ['Symbicort'], class: 'ICS/LABA', ndc: '00186-0372-20', strengths: ['80/4.5mcg', '160/4.5mcg'], forms: ['inhaler'], defaultSig: 'Inhale 2 puffs twice daily', category: 'respiratory', controlled: false },
  { name: 'Montelukast', brandNames: ['Singulair'], class: 'Leukotriene Inhibitor', ndc: '00006-0275-31', strengths: ['4mg', '5mg', '10mg'], forms: ['tablet', 'chewable'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'respiratory', controlled: false },
  { name: 'Tiotropium', brandNames: ['Spiriva'], class: 'Long-Acting Anticholinergic', ndc: '00597-0075-75', strengths: ['18mcg'], forms: ['handihaler capsule'], defaultSig: 'Inhale contents of 1 capsule once daily', category: 'respiratory', controlled: false },
  { name: 'Prednisone', brandNames: ['Deltasone'], class: 'Corticosteroid', ndc: '00591-5442-01', strengths: ['1mg', '2.5mg', '5mg', '10mg', '20mg', '50mg'], forms: ['tablet'], defaultSig: 'Take as directed', category: 'respiratory', controlled: false },
  
  // Gastrointestinal
  { name: 'Omeprazole', brandNames: ['Prilosec'], class: 'Proton Pump Inhibitor', ndc: '00186-5020-31', strengths: ['10mg', '20mg', '40mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth once daily before breakfast', category: 'gastrointestinal', controlled: false },
  { name: 'Pantoprazole', brandNames: ['Protonix'], class: 'Proton Pump Inhibitor', ndc: '00008-0841-81', strengths: ['20mg', '40mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily before breakfast', category: 'gastrointestinal', controlled: false },
  { name: 'Esomeprazole', brandNames: ['Nexium'], class: 'Proton Pump Inhibitor', ndc: '00186-5020-31', strengths: ['20mg', '40mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth once daily before breakfast', category: 'gastrointestinal', controlled: false },
  { name: 'Famotidine', brandNames: ['Pepcid'], class: 'H2 Blocker', ndc: '00006-0963-68', strengths: ['10mg', '20mg', '40mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily', category: 'gastrointestinal', controlled: false },
  { name: 'Ondansetron', brandNames: ['Zofran'], class: 'Antiemetic', ndc: '00173-0446-00', strengths: ['4mg', '8mg'], forms: ['tablet', 'ODT'], defaultSig: 'Take 1 tablet by mouth every 8 hours as needed for nausea', category: 'gastrointestinal', controlled: false },
  { name: 'Dicyclomine', brandNames: ['Bentyl'], class: 'Antispasmodic', ndc: '00074-6830-01', strengths: ['10mg', '20mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1 capsule by mouth four times daily', category: 'gastrointestinal', controlled: false },
  { name: 'Polyethylene Glycol 3350', brandNames: ['MiraLAX'], class: 'Laxative', ndc: '11523-7271-07', strengths: ['17g'], forms: ['powder'], defaultSig: 'Mix 17g in 8oz of liquid and drink once daily', category: 'gastrointestinal', controlled: false },
  
  // Antibiotics
  { name: 'Amoxicillin', brandNames: ['Amoxil'], class: 'Penicillin', ndc: '00093-2263-01', strengths: ['250mg', '500mg', '875mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1 capsule by mouth three times daily for 10 days', category: 'antibiotic', controlled: false },
  { name: 'Amoxicillin/Clavulanate', brandNames: ['Augmentin'], class: 'Penicillin Combination', ndc: '00029-6085-39', strengths: ['500/125mg', '875/125mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily for 10 days', category: 'antibiotic', controlled: false },
  { name: 'Azithromycin', brandNames: ['Zithromax', 'Z-Pack'], class: 'Macrolide', ndc: '00069-3060-75', strengths: ['250mg', '500mg'], forms: ['tablet'], defaultSig: 'Take 500mg on day 1, then 250mg daily for 4 days', category: 'antibiotic', controlled: false },
  { name: 'Ciprofloxacin', brandNames: ['Cipro'], class: 'Fluoroquinolone', ndc: '00093-0867-01', strengths: ['250mg', '500mg', '750mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily for 7 days', category: 'antibiotic', controlled: false },
  { name: 'Levofloxacin', brandNames: ['Levaquin'], class: 'Fluoroquinolone', ndc: '00093-7190-01', strengths: ['250mg', '500mg', '750mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily for 7 days', category: 'antibiotic', controlled: false },
  { name: 'Doxycycline', brandNames: ['Vibramycin'], class: 'Tetracycline', ndc: '00093-2191-01', strengths: ['50mg', '100mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1 capsule by mouth twice daily for 10 days', category: 'antibiotic', controlled: false },
  { name: 'Sulfamethoxazole/Trimethoprim', brandNames: ['Bactrim', 'Septra'], class: 'Sulfonamide', ndc: '00781-5762-01', strengths: ['400/80mg', '800/160mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily for 7 days', category: 'antibiotic', controlled: false },
  { name: 'Cephalexin', brandNames: ['Keflex'], class: 'Cephalosporin', ndc: '00093-3145-01', strengths: ['250mg', '500mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth four times daily for 10 days', category: 'antibiotic', controlled: false },
  { name: 'Metronidazole', brandNames: ['Flagyl'], class: 'Nitroimidazole', ndc: '00093-0812-01', strengths: ['250mg', '500mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth three times daily for 7 days', category: 'antibiotic', controlled: false },
  { name: 'Nitrofurantoin', brandNames: ['Macrobid', 'Macrodantin'], class: 'Nitrofuran', ndc: '00149-0710-01', strengths: ['50mg', '100mg'], forms: ['capsule'], defaultSig: 'Take 1 capsule by mouth twice daily for 5 days', category: 'antibiotic', controlled: false },
  
  // Thyroid
  { name: 'Levothyroxine', brandNames: ['Synthroid', 'Levoxyl'], class: 'Thyroid Hormone', ndc: '00074-6624-13', strengths: ['25mcg', '50mcg', '75mcg', '88mcg', '100mcg', '112mcg', '125mcg', '137mcg', '150mcg', '175mcg', '200mcg', '300mcg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily in the morning on empty stomach', category: 'endocrine', controlled: false },
  
  // Allergy
  { name: 'Cetirizine', brandNames: ['Zyrtec'], class: 'Antihistamine', ndc: '00591-5613-01', strengths: ['5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'allergy', controlled: false },
  { name: 'Loratadine', brandNames: ['Claritin'], class: 'Antihistamine', ndc: '11523-7160-01', strengths: ['10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'allergy', controlled: false },
  { name: 'Fexofenadine', brandNames: ['Allegra'], class: 'Antihistamine', ndc: '00088-1090-47', strengths: ['60mg', '180mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'allergy', controlled: false },
  { name: 'Diphenhydramine', brandNames: ['Benadryl'], class: 'Antihistamine', ndc: '00071-2215-24', strengths: ['25mg', '50mg'], forms: ['capsule', 'tablet'], defaultSig: 'Take 1-2 tablets by mouth every 4-6 hours as needed', category: 'allergy', controlled: false },
  { name: 'Fluticasone Nasal', brandNames: ['Flonase'], class: 'Nasal Corticosteroid', ndc: '00173-0453-01', strengths: ['50mcg/spray'], forms: ['nasal spray'], defaultSig: 'Spray 2 sprays in each nostril once daily', category: 'allergy', controlled: false },
  
  // Sleep
  { name: 'Zolpidem', brandNames: ['Ambien'], class: 'Sedative-Hypnotic', ndc: '00024-5401-31', strengths: ['5mg', '10mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime as needed', category: 'sleep', controlled: true, schedule: 'IV' },
  { name: 'Eszopiclone', brandNames: ['Lunesta'], class: 'Sedative-Hypnotic', ndc: '63402-0301-30', strengths: ['1mg', '2mg', '3mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth at bedtime as needed', category: 'sleep', controlled: true, schedule: 'IV' },
  { name: 'Melatonin', brandNames: ['Various'], class: 'Supplement', ndc: 'N/A', strengths: ['1mg', '3mg', '5mg', '10mg'], forms: ['tablet', 'gummy'], defaultSig: 'Take 1 tablet by mouth at bedtime', category: 'sleep', controlled: false },
  
  // Vitamins/Supplements
  { name: 'Vitamin D3', brandNames: ['Various'], class: 'Vitamin', ndc: 'N/A', strengths: ['400IU', '1000IU', '2000IU', '5000IU', '50000IU'], forms: ['tablet', 'capsule'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'supplement', controlled: false },
  { name: 'Vitamin B12', brandNames: ['Various'], class: 'Vitamin', ndc: 'N/A', strengths: ['100mcg', '500mcg', '1000mcg', '2500mcg'], forms: ['tablet', 'sublingual'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'supplement', controlled: false },
  { name: 'Folic Acid', brandNames: ['Various'], class: 'Vitamin', ndc: 'N/A', strengths: ['400mcg', '800mcg', '1mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily', category: 'supplement', controlled: false },
  { name: 'Iron Sulfate', brandNames: ['Feosol', 'Slow Fe'], class: 'Mineral', ndc: 'N/A', strengths: ['325mg'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth once daily with vitamin C', category: 'supplement', controlled: false },
  { name: 'Calcium/Vitamin D', brandNames: ['Caltrate', 'Os-Cal'], class: 'Supplement', ndc: 'N/A', strengths: ['600mg/400IU', '600mg/800IU'], forms: ['tablet'], defaultSig: 'Take 1 tablet by mouth twice daily with meals', category: 'supplement', controlled: false },
];

// Drug-Drug Interactions Database
export const drugInteractions = [
  // Severe interactions (contraindicated)
  { drug1: 'Warfarin', drug2: 'Ibuprofen', severity: 'severe', description: 'Increased risk of bleeding. NSAIDs inhibit platelet function and can cause GI bleeding.' },
  { drug1: 'Warfarin', drug2: 'Naproxen', severity: 'severe', description: 'Increased risk of bleeding. NSAIDs inhibit platelet function and can cause GI bleeding.' },
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'severe', description: 'Increased risk of major bleeding when combined.' },
  { drug1: 'Lisinopril', drug2: 'Spironolactone', severity: 'severe', description: 'Risk of severe hyperkalemia. Monitor potassium levels closely.' },
  { drug1: 'Lisinopril', drug2: 'Potassium', severity: 'severe', description: 'Risk of severe hyperkalemia. Monitor potassium levels closely.' },
  { drug1: 'Methotrexate', drug2: 'Sulfamethoxazole/Trimethoprim', severity: 'severe', description: 'Increased methotrexate toxicity due to decreased renal elimination.' },
  { drug1: 'Simvastatin', drug2: 'Amiodarone', severity: 'severe', description: 'Increased risk of rhabdomyolysis. Limit simvastatin to 20mg/day.' },
  { drug1: 'Clarithromycin', drug2: 'Simvastatin', severity: 'severe', description: 'Increased risk of rhabdomyolysis. Avoid combination.' },
  { drug1: 'MAOIs', drug2: 'Sertraline', severity: 'severe', description: 'Risk of serotonin syndrome. Contraindicated within 14 days of each other.' },
  { drug1: 'MAOIs', drug2: 'Fluoxetine', severity: 'severe', description: 'Risk of serotonin syndrome. Contraindicated within 14 days of each other.' },
  { drug1: 'Fluoxetine', drug2: 'MAOIs', severity: 'severe', description: 'Risk of serotonin syndrome. Allow 5 weeks washout after fluoxetine.' },
  { drug1: 'Metformin', drug2: 'Contrast Dye', severity: 'severe', description: 'Risk of lactic acidosis. Hold metformin 48 hours before and after contrast.' },
  { drug1: 'Ciprofloxacin', drug2: 'Tizanidine', severity: 'severe', description: 'Significant increase in tizanidine levels. Contraindicated.' },
  { drug1: 'Sildenafil', drug2: 'Nitrates', severity: 'severe', description: 'Severe hypotension risk. Contraindicated combination.' },
  
  // Moderate interactions
  { drug1: 'Metformin', drug2: 'Alcohol', severity: 'moderate', description: 'Increased risk of lactic acidosis and hypoglycemia.' },
  { drug1: 'Lisinopril', drug2: 'Ibuprofen', severity: 'moderate', description: 'NSAIDs may reduce antihypertensive effect and increase renal risk.' },
  { drug1: 'Losartan', drug2: 'Ibuprofen', severity: 'moderate', description: 'NSAIDs may reduce antihypertensive effect and increase renal risk.' },
  { drug1: 'Amlodipine', drug2: 'Simvastatin', severity: 'moderate', description: 'Increased statin levels. Limit simvastatin to 20mg/day.' },
  { drug1: 'Fluoxetine', drug2: 'Tramadol', severity: 'moderate', description: 'Increased risk of serotonin syndrome and seizures.' },
  { drug1: 'Sertraline', drug2: 'Tramadol', severity: 'moderate', description: 'Increased risk of serotonin syndrome and seizures.' },
  { drug1: 'Omeprazole', drug2: 'Clopidogrel', severity: 'moderate', description: 'Reduced clopidogrel effectiveness. Consider pantoprazole instead.' },
  { drug1: 'Ciprofloxacin', drug2: 'Calcium', severity: 'moderate', description: 'Reduced ciprofloxacin absorption. Separate by 2 hours.' },
  { drug1: 'Ciprofloxacin', drug2: 'Iron', severity: 'moderate', description: 'Reduced ciprofloxacin absorption. Separate by 2 hours.' },
  { drug1: 'Levothyroxine', drug2: 'Calcium', severity: 'moderate', description: 'Reduced levothyroxine absorption. Separate by 4 hours.' },
  { drug1: 'Levothyroxine', drug2: 'Iron', severity: 'moderate', description: 'Reduced levothyroxine absorption. Separate by 4 hours.' },
  { drug1: 'Alprazolam', drug2: 'Opioids', severity: 'moderate', description: 'Increased CNS and respiratory depression. Use lowest effective doses.' },
  { drug1: 'Lorazepam', drug2: 'Opioids', severity: 'moderate', description: 'Increased CNS and respiratory depression. Use lowest effective doses.' },
  { drug1: 'Warfarin', drug2: 'Acetaminophen', severity: 'moderate', description: 'High-dose acetaminophen may increase INR. Monitor closely.' },
  { drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'moderate', description: 'Increased digoxin levels. Reduce digoxin dose by 50%.' },
  { drug1: 'Lithium', drug2: 'Lisinopril', severity: 'moderate', description: 'Increased lithium levels. Monitor lithium levels closely.' },
  { drug1: 'Lithium', drug2: 'Ibuprofen', severity: 'moderate', description: 'Increased lithium levels. Monitor lithium levels closely.' },
  
  // Mild interactions
  { drug1: 'Gabapentin', drug2: 'Antacids', severity: 'mild', description: 'Reduced gabapentin absorption. Separate by 2 hours.' },
  { drug1: 'Metoprolol', drug2: 'Diphenhydramine', severity: 'mild', description: 'Increased metoprolol levels. Monitor for bradycardia.' },
  { drug1: 'Atorvastatin', drug2: 'Grapefruit', severity: 'mild', description: 'Increased statin levels with large amounts of grapefruit.' },
  { drug1: 'Amlodipine', drug2: 'Grapefruit', severity: 'mild', description: 'Increased amlodipine levels with large amounts of grapefruit.' },
];

// Common Pharmacies Database
export const pharmacyDatabase = [
  { name: 'CVS Pharmacy', chain: 'CVS', ncpdp: '1234567', npi: '1234567890', phone: '(800) 746-7287', fax: '(800) 746-7288', address: '123 Main St' },
  { name: 'Walgreens', chain: 'Walgreens', ncpdp: '2345678', npi: '2345678901', phone: '(800) 925-4733', fax: '(800) 925-4734', address: '456 Oak Ave' },
  { name: 'Walmart Pharmacy', chain: 'Walmart', ncpdp: '3456789', npi: '3456789012', phone: '(800) 925-6278', fax: '(800) 925-6279', address: '789 Elm St' },
  { name: 'Rite Aid', chain: 'Rite Aid', ncpdp: '4567890', npi: '4567890123', phone: '(800) 748-3243', fax: '(800) 748-3244', address: '321 Pine Rd' },
  { name: 'Costco Pharmacy', chain: 'Costco', ncpdp: '5678901', npi: '5678901234', phone: '(800) 774-2678', fax: '(800) 774-2679', address: '654 Birch Ln' },
  { name: 'Kroger Pharmacy', chain: 'Kroger', ncpdp: '6789012', npi: '6789012345', phone: '(800) 576-4377', fax: '(800) 576-4378', address: '987 Cedar Blvd' },
  { name: 'Target Pharmacy (CVS)', chain: 'CVS', ncpdp: '7890123', npi: '7890123456', phone: '(800) 746-7287', fax: '(800) 746-7288', address: '147 Maple Dr' },
  { name: 'Publix Pharmacy', chain: 'Publix', ncpdp: '8901234', npi: '8901234567', phone: '(800) 242-1227', fax: '(800) 242-1228', address: '258 Spruce Ave' },
  { name: 'Express Scripts Mail Order', chain: 'Express Scripts', ncpdp: '9012345', npi: '9012345678', phone: '(800) 282-2881', fax: '(800) 282-2882', address: 'Mail Order', isMailOrder: true },
  { name: 'OptumRx Mail Order', chain: 'OptumRx', ncpdp: '0123456', npi: '0123456789', phone: '(800) 788-4863', fax: '(800) 788-4864', address: 'Mail Order', isMailOrder: true },
];

// Search medications
export const searchMedications = (query) => {
  if (!query || query.length < 2) return [];
  const searchLower = query.toLowerCase();
  return medicationDatabase.filter(med => 
    med.name.toLowerCase().includes(searchLower) ||
    med.brandNames.some(brand => brand.toLowerCase().includes(searchLower)) ||
    med.class.toLowerCase().includes(searchLower)
  ).slice(0, 15);
};

// Check drug interactions
export const checkDrugInteractions = (medications) => {
  const interactions = [];
  const medNames = medications.map(m => m.name || m);
  
  for (let i = 0; i < medNames.length; i++) {
    for (let j = i + 1; j < medNames.length; j++) {
      const med1 = medNames[i];
      const med2 = medNames[j];
      
      const interaction = drugInteractions.find(int => 
        (int.drug1.toLowerCase() === med1.toLowerCase() && int.drug2.toLowerCase() === med2.toLowerCase()) ||
        (int.drug1.toLowerCase() === med2.toLowerCase() && int.drug2.toLowerCase() === med1.toLowerCase())
      );
      
      if (interaction) {
        interactions.push({
          ...interaction,
          medications: [med1, med2]
        });
      }
    }
  }
  
  return interactions;
};

// Search pharmacies
export const searchPharmacies = (query) => {
  if (!query || query.length < 2) return pharmacyDatabase;
  const searchLower = query.toLowerCase();
  return pharmacyDatabase.filter(pharmacy => 
    pharmacy.name.toLowerCase().includes(searchLower) ||
    pharmacy.chain.toLowerCase().includes(searchLower) ||
    pharmacy.address.toLowerCase().includes(searchLower)
  );
};

export default { medicationDatabase, drugInteractions, pharmacyDatabase, searchMedications, checkDrugInteractions, searchPharmacies };






























