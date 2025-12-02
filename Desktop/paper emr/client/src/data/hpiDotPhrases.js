// Comprehensive HPI dot phrases for common chief complaints
// Includes [] placeholders for billing-relevant information (location, quality, severity, timing, context, etc.)
// All placeholders can be filled using F2 key for quick documentation

export const hpiDotPhrases = {
    // Chest Pain & Cardiovascular
    '.chest_pain': `Patient presents with [chief complaint - chest pain/chest discomfort/chest pressure]. Onset [onset - sudden/gradual] [duration - minutes/hours/days] ago. Describes the pain as [quality - sharp/dull/pressure/crushing/tightness/burning], located in [location - substernal/left chest/right chest/epigastric], with radiation to [radiation - left arm/right arm/jaw/back/shoulders/none]. Pain severity is [severity - 1-10 scale] out of 10. Associated symptoms include [associated symptoms - shortness of breath/nausea/vomiting/diaphoresis/palpitations/dizziness/none]. Aggravated by [aggravating factors - exertion/lying flat/deep breathing/movement/none]. Relieved by [relieving factors - rest/nitroglycerin/sitting up/position change/nothing]. Context: [context - at rest/during activity/after eating/emotional stress/none]. Modifying factors: [modifying factors - position change/medications/none]. Previous similar episodes: [history - yes/no]. Last episode: [last episode - date/none].`,
    
    '.chest_pain_stable': `Patient returns for follow-up of stable chest pain. Pain frequency is [frequency - daily/weekly/monthly/episodic]. Pain is described as [quality - pressure/tightness/dull/aching], located in [location - substernal/left chest/right chest/epigastric], with radiation to [radiation - left arm/right arm/jaw/back/none]. Severity is [severity - 1-10 scale] out of 10. Pattern: [pattern - unchanged/improving/worsening]. Associated symptoms: [associated symptoms - none/shortness of breath/mild discomfort]. Aggravated by [aggravating factors - exertion/stress/none]. Relieved by [relieving factors - rest/medications/none]. Well-controlled on current medications. No new concerns.`,
    
    '.palpitations': `Patient presents with [chief complaint - palpitations/irregular heartbeat/rapid heartbeat]. Onset [onset - sudden/gradual] [duration - minutes/hours/days/weeks] ago. Describes as [quality - rapid heartbeat/skipped beats/fluttering/pounding/irregular rhythm], occurring [frequency - daily/weekly/episodic/constant]. Duration of episodes: [episode duration - seconds/minutes/hours]. Associated symptoms include [associated symptoms - dizziness/lightheadedness/chest pain/shortness of breath/syncope/near-syncope/none]. Triggered by [triggers - caffeine/stress/exertion/position change/none]. Relieved by [relieving factors - rest/medications/Valsalva maneuver/nothing]. Context: [context - at rest/during activity/after eating/emotional stress/none]. No loss of consciousness.`,
    
    '.shortness_breath': `Patient presents with [chief complaint - shortness of breath/dyspnea/difficulty breathing]. Onset [onset - acute/gradual] [duration - minutes/hours/days/weeks] ago. Severity: [severity - mild/moderate/severe] with [exertion level - minimal exertion/moderate exertion/at rest]. Worse with [exacerbating factors - exertion/lying flat/exposure to allergens/cold air/none]. Better with [relieving factors - rest/sitting up/medications/oxygen/nothing]. Associated symptoms include [associated symptoms - chest pain/cough/wheezing/orthopnea/paroxysmal nocturnal dyspnea/ankle swelling/none]. Context: [context - at rest/during activity/after eating/emotional stress/none]. No fever or chills.`,
    
    '.hypertension_followup': `Patient returns for routine follow-up of hypertension. Blood pressure control: [status - well-controlled/variable/elevated]. Recent readings: [readings - systolic/diastolic range]. Symptoms: [symptoms - no symptoms/headaches/chest pain/visual changes/none]. Medication adherence: [adherence - excellent/good/fair/poor]. Taking medications as prescribed. Side effects: [side effects - none/mild/moderate]. Lifestyle modifications: [lifestyle - diet/exercise/weight loss/smoking cessation/none]. No new concerns.`,
    
    // Abdominal/GI
    '.abdominal_pain': `Patient presents with [chief complaint - abdominal pain/abdominal discomfort/stomach pain]. Onset [onset - sudden/gradual] [duration - hours/days/weeks] ago. Describes the pain as [quality - sharp/dull/cramping/burning/stabbing/colicky], located in [location - epigastric/RUQ/LUQ/RLQ/LLQ/periumbilical/diffuse], with radiation to [radiation - back/shoulders/groin/none]. Pain severity is [severity - 1-10 scale] out of 10. Pattern: [pattern - constant/intermittent/episodic]. Associated symptoms include [associated symptoms - nausea/vomiting/diarrhea/constipation/bloating/fever/chills/loss of appetite/none]. Aggravated by [aggravating factors - eating/fasting/movement/pressure/none]. Relieved by [relieving factors - antacids/position change/medications/nothing]. Context: [context - after eating/before eating/at night/during day/none]. Modifying factors: [modifying factors - food intake/medications/position/none]. Bowel movements: [bowel movements - normal/diarrhea/constipation/blood in stool/none].`,
    
    '.nausea_vomiting': `Patient presents with [chief complaint - nausea/nausea and vomiting/vomiting]. Onset [onset - sudden/gradual] [duration - hours/days] ago. Frequency of vomiting: [frequency - times per day/episodic]. Vomitus contains [content - food/bile/blood/clear fluid]. Associated symptoms include [associated symptoms - abdominal pain/diarrhea/fever/chills/headache/dizziness/none]. Triggered by [triggers - food intake/movement/medications/none]. Relieved by [relieving factors - medications/rest/nothing]. Context: [context - after eating/before eating/constant/none]. No known dietary triggers.`,
    
    '.diarrhea': `Patient presents with [chief complaint - diarrhea/loose stools]. Onset [onset - sudden/gradual] [duration - hours/days/weeks] ago. Frequency: [frequency - times per day]. Stool characteristics: [character - watery/loose/mucoid/bloody/foul-smelling]. Associated symptoms include [associated symptoms - abdominal pain/cramping/nausea/vomiting/fever/chills/bloating/urgency/none]. Aggravated by [aggravating factors - food intake/movement/none]. Context: [context - after eating/constant/none]. Recent travel: [travel - yes/no]. Dietary changes: [dietary changes - yes/no/none].`,
    
    '.constipation': `Patient presents with [chief complaint - constipation/difficulty with bowel movements]. Duration [duration - days/weeks/months]. Bowel movement frequency: [frequency - times per week]. Stool characteristics: [character - hard/dry/small pellets/large]. Associated symptoms include [associated symptoms - abdominal pain/bloating/straining/feeling of incomplete evacuation/none]. Aggravated by [aggravating factors - certain foods/lack of exercise/none]. Relieved by [relieving factors - laxatives/increased fiber/fluids/nothing]. Dietary fiber intake: [fiber - adequate/inadequate]. Fluid intake: [fluids - adequate/inadequate]. No blood in stool.`,
    
    '.heartburn': `Patient presents with [chief complaint - heartburn/acid reflux/GERD symptoms]. Onset [onset - sudden/gradual] [duration - days/weeks/months] ago. Describes as [quality - burning/pressure/aching], located in [location - substernal/epigastric], with radiation to [radiation - throat/back/chest/none]. Occurs [frequency - daily/weekly/after meals/at night]. Severity: [severity - mild/moderate/severe]. Associated symptoms: [associated symptoms - regurgitation/dysphagia/chest pain/none]. Aggravated by [aggravating factors - spicy foods/acidic foods/lying down/bending over/none]. Relieved by [relieving factors - antacids/upright position/medications/nothing]. Context: [context - after meals/at night/during day/none].`,
    
    '.gerd_followup': `Patient returns for follow-up of GERD. Symptom control: [status - well-controlled/improving/persistent/worsening]. Frequency: [frequency - daily/weekly/monthly/episodic]. Severity: [severity - mild/moderate/severe]. Medication adherence: [adherence - excellent/good/fair/poor]. Taking medications as prescribed. Lifestyle modifications: [lifestyle - diet/weight loss/elevating head of bed/smoking cessation/none]. Associated symptoms: [symptoms - no dysphagia/no weight loss/dysphagia present/weight loss present].`,
    
    // Respiratory
    '.cough': `Patient presents with [chief complaint - cough/persistent cough]. Duration [duration - days/weeks/months]. Cough is [character - dry/productive/hacking/barking]. Sputum characteristics: [sputum - clear/yellow/green/blood-tinged/none]. Amount: [amount - minimal/moderate/large]. Associated symptoms include [associated symptoms - fever/chills/shortness of breath/chest pain/wheezing/post-nasal drip/none]. Worse at [time - night/morning/all day/with activity]. Better with [relieving factors - medications/rest/nothing]. Context: [context - after meals/at night/during day/constant]. Triggered by [triggers - allergens/cold air/exertion/none].`,
    
    '.upper_respiratory': `Patient presents with [chief complaint - upper respiratory symptoms/cold symptoms/URI]. Onset [onset - sudden/gradual] [duration - days] ago. Reports [symptoms - nasal congestion/rhinorrhea/sneezing/sore throat/cough/hoarseness]. Severity: [severity - mild/moderate/severe]. Associated symptoms include [associated symptoms - fever/chills/malaise/headache/body aches/none]. Context: [context - exposure to sick contacts/recent travel/none]. No shortness of breath or chest pain.`,
    
    '.sinus_pressure': `Patient presents with [chief complaint - sinus pressure/sinus congestion/sinusitis]. Duration [duration - days/weeks]. Location: [location - frontal/maxillary/ethmoid/sphenoid/bilateral]. Pain severity: [severity - 1-10 scale] out of 10. Associated symptoms include [associated symptoms - facial pain/headache/nasal discharge/post-nasal drip/fever/none]. Discharge characteristics: [discharge - clear/yellow/green/blood-tinged]. Aggravated by [aggravating factors - bending forward/lying down/none]. Relieved by [relieving factors - medications/position change/nothing]. No fever.`,
    
    '.asthma_exacerbation': `Patient presents with [chief complaint - asthma exacerbation/asthma attack/wheezing]. Onset [onset - sudden/gradual] [duration - hours/days] ago. Reports [symptoms - wheezing/shortness of breath/chest tightness/cough]. Severity: [severity - mild/moderate/severe]. Triggered by [triggers - allergens/exercise/cold air/infections/stress/none]. Using rescue inhaler [frequency - times per day]. Response to rescue inhaler: [response - good/partial/poor]. Current medications: [medications - taking as prescribed/not taking]. No improvement with current medications.`,
    
    '.copd_followup': `Patient returns for follow-up of COPD. Symptom status: [status - stable/improving/worsening]. Shortness of breath: [severity - mild/moderate/severe] with [exertion level - minimal exertion/moderate exertion/at rest]. Cough: [status - improved/stable/worse], [character - productive/dry]. Sputum: [sputum - clear/yellow/green/blood-tinged/none]. Medication adherence: [adherence - excellent/good/fair/poor]. Using medications as prescribed. Oxygen use: [oxygen - yes/no], [flow rate - L/min]. Exercise tolerance: [tolerance - improved/stable/declined].`,
    
    // Neurological
    '.headache': `Patient presents with headache. Describes headache as [quality - throbbing/pressure/sharp/dull], located in [location - frontal/temporal/occipital/bilateral]. Started [duration] ago. Severity [severity - 1-10 scale]. Associated with [associated symptoms - nausea/vomiting/photophobia/phonophobia/visual changes]. Aggravated by [aggravating factors - light/sound/movement]. Relieved by [relieving factors - rest/dark room/medications]. No focal neurological symptoms.`,
    
    '.migraine': `Patient presents with migraine headache. Describes as [quality - throbbing/pulsating], located in [location - unilateral/bilateral]. Duration [duration]. Severity [severity - 1-10 scale]. Associated with [associated symptoms - nausea/vomiting/photophobia/phonophobia/aura]. Preceded by [prodrome - visual aura/sensory changes]. No focal neurological deficits.`,
    
    '.dizziness': `Patient presents with dizziness. Describes as [quality - lightheadedness/vertigo/unsteadiness]. Started [duration] ago. Occurs [frequency - constant/episodic/positional]. Associated with [associated symptoms - nausea/vomiting/hearing loss/tinnitus]. Triggered by [triggers - position change/movement]. No loss of consciousness.`,
    
    '.back_pain': `Patient presents with back pain. Pain located in [location - cervical/thoracic/lumbar], started [duration] ago. Describes pain as [quality - sharp/dull/aching/burning]. Severity [severity - 1-10 scale]. Radiates to [radiation - legs/arms/buttocks/none]. Aggravated by [aggravating factors - movement/sitting/standing]. Relieved by [relieving factors - rest/position change/medications]. No weakness or numbness.`,
    
    '.neck_pain': `Patient presents with neck pain. Pain located in [location - cervical spine/bilateral], started [duration] ago. Describes as [quality - sharp/stiff/aching]. Severity [severity - 1-10 scale]. Radiates to [radiation - shoulders/arms/head/none]. Aggravated by [aggravating factors - movement/position]. Associated with [associated symptoms - stiffness/headache].`,
    
    // Musculoskeletal
    '.joint_pain': `Patient presents with joint pain. Affects [joints - knees/hips/shoulders/hands/wrists]. Pain described as [quality - aching/stiff/sharp]. Started [duration] ago. Associated with [associated symptoms - stiffness/swelling/redness/warmth]. Aggravated by [aggravating factors - movement/activity]. Relieved by [relieving factors - rest/ice/medications].`,
    
    '.knee_pain': `Patient presents with knee pain. Location [location - medial/lateral/anterior/posterior/bilateral]. Started [duration] ago. Pain is [quality - sharp/dull/aching]. Severity [severity - 1-10 scale]. Associated with [associated symptoms - swelling/stiffness/instability/clicking]. Aggravated by [aggravating factors - walking/stairs/bending]. No trauma.`,
    
    '.shoulder_pain': `Patient presents with shoulder pain. Location [location - anterior/posterior/lateral/bilateral]. Started [duration] ago. Pain is [quality - sharp/dull/aching]. Severity [severity - 1-10 scale]. Associated with [associated symptoms - stiffness/weakness/limited range of motion]. Aggravated by [aggravating factors - overhead activities/reaching].`,
    
    '.hip_pain': `Patient presents with hip pain. Location [location - anterior/posterior/lateral/groin/bilateral]. Started [duration] ago. Pain is [quality - sharp/dull/aching]. Severity [severity - 1-10 scale]. Associated with [associated symptoms - stiffness/limping/limited range of motion]. Aggravated by [aggravating factors - walking/standing/sitting].`,
    
    // Genitourinary
    '.dysuria': `Patient presents with dysuria. Duration [duration]. Describes as [quality - burning/stinging/painful]. Frequency [frequency - times per day]. Associated with [associated symptoms - urgency/frequency/hematuria/back pain]. No fever or chills.`,
    
    '.urinary_frequency': `Patient presents with urinary frequency and urgency. Duration [duration]. Frequency [frequency - times per day/night]. Associated with [associated symptoms - dysuria/hematuria/incontinence]. No fever.`,
    
    '.hematuria': `Patient presents with hematuria. Duration [duration]. Blood is [character - gross/microscopic], [timing - initial/terminal/total]. Associated with [associated symptoms - dysuria/frequency/pain/flank pain]. No trauma.`,
    
    '.uti_followup': `Patient returns for follow-up of urinary tract infection. Symptoms are [status - resolved/improving/persistent]. Taking antibiotics as prescribed. No fever or flank pain.`,
    
    // Dermatological
    '.rash': `Patient presents with rash. Location [location - face/trunk/extremities/generalized]. Started [duration] ago. Rash is [character - red/raised/itchy/painful]. Associated with [associated symptoms - itching/pain/burning]. No known triggers or exposures.`,
    
    '.skin_lesion': `Patient presents with skin lesion. Location [location]. Started [duration] ago. Lesion is [character - raised/flat/ulcerated/changing]. Size [size]. Associated with [associated symptoms - itching/pain/bleeding]. No trauma.`,
    
    // Endocrine/Metabolic
    '.diabetes_followup': `Patient returns for routine follow-up of Type 2 Diabetes Mellitus. Blood glucose has been [status - well-controlled/variable/elevated]. No episodes of hypoglycemia. No polyuria, polydipsia, or polyphagia. No vision changes, numbness, or tingling in extremities. Taking medications as prescribed.`,
    
    '.diabetes_poor_control': `Patient presents with poorly controlled diabetes. Blood glucose readings have been [readings - elevated/variable]. Reports [symptoms - polyuria/polydipsia/fatigue/blurred vision]. No episodes of hypoglycemia. Adherence to medications [status - good/poor].`,
    
    '.thyroid_followup': `Patient returns for follow-up of [condition - hypothyroidism/hyperthyroidism]. Symptoms are [status - stable/improving/worsening]. Taking medications as prescribed. No new concerns.`,
    
    // Fatigue & General
    '.fatigue': `Patient presents with complaint of fatigue. Duration [duration]. Reports feeling tired [severity - mild/moderate/severe]. Associated with [associated symptoms - weakness/sleep disturbances/depression]. No fever, weight loss, or night sweats. Sleep pattern [status - normal/disturbed].`,
    
    '.weakness': `Patient presents with weakness. Location [location - generalized/upper extremities/lower extremities]. Duration [duration]. Severity [severity - mild/moderate/severe]. Associated with [associated symptoms - fatigue/numbness/pain]. No trauma.`,
    
    // Well Visits
    '.well_visit': `Patient presents for routine well visit/annual physical examination. No acute complaints. Reviewing preventive care and health maintenance. Last physical examination [date].`,
    
    '.preventive_care': `Patient presents for preventive care visit. No acute complaints. Reviewing [screening - cancer screening/immunizations/health maintenance]. Up to date on [status - immunizations/screenings].`,
    
    // Medication Related
    '.medication_refill': `Patient presents for medication refill. Currently taking medications as prescribed. No new concerns or side effects. Medications are [status - effective/needs adjustment].`,
    
    '.medication_side_effects': `Patient presents with concerns about medication side effects. Reports [symptoms]. Started [duration] after starting [medication]. Severity [severity - mild/moderate/severe]. Impact on daily activities [impact - none/minimal/significant].`,
    
    // Mental Health
    '.anxiety': `Patient presents with anxiety. Duration [duration]. Symptoms include [symptoms - worry/restlessness/irritability/panic attacks]. Severity [severity - mild/moderate/severe]. Impact on daily activities [impact - minimal/moderate/significant]. Triggered by [triggers - stress/work/relationships].`,
    
    '.depression': `Patient presents with depression. Duration [duration]. Symptoms include [symptoms - sadness/loss of interest/fatigue/sleep changes]. Severity [severity - mild/moderate/severe]. Impact on daily activities [impact - minimal/moderate/significant]. No suicidal ideation.`,
    
    '.insomnia': `Patient presents with insomnia. Duration [duration]. Sleep pattern [pattern - difficulty falling asleep/waking frequently/early awakening]. Sleeps approximately [hours] hours per night. Associated with [associated factors - stress/anxiety/pain]. Impact on daily function [impact - mild/moderate/severe].`,
    
    // Eye/Ear
    '.eye_pain': `Patient presents with eye pain. Location [location - right/left/bilateral]. Duration [duration]. Pain is [quality - sharp/dull/burning]. Associated with [associated symptoms - redness/tearing/vision changes/discharge]. No trauma.`,
    
    '.vision_changes': `Patient presents with vision changes. Duration [duration]. Describes as [changes - blurry/double/floaters/flashing lights]. Location [location - right/left/bilateral]. Associated with [associated symptoms - eye pain/headache]. No trauma.`,
    
    '.ear_pain': `Patient presents with ear pain. Location [location - right/left/bilateral]. Duration [duration]. Pain is [quality - sharp/dull/pressure]. Associated with [associated symptoms - hearing loss/discharge/fever]. No trauma.`,
    
    '.hearing_loss': `Patient presents with hearing loss. Location [location - right/left/bilateral]. Duration [duration]. Severity [severity - mild/moderate/severe]. Associated with [associated symptoms - ear pain/tinnitus/dizziness]. Onset [onset - sudden/gradual].`,
    
    // Additional Common Complaints
    '.fever': `Patient presents with fever. Duration [duration]. Temperature [temperature]. Associated with [associated symptoms - chills/sweats/body aches/malaise]. No localizing symptoms.`,
    
    '.sore_throat': `Patient presents with sore throat. Duration [duration]. Severity [severity - mild/moderate/severe]. Associated with [associated symptoms - fever/difficulty swallowing/hoarseness/swollen glands]. No known exposure.`,
    
    '.allergies': `Patient presents with allergy symptoms. Duration [duration]. Symptoms include [symptoms - sneezing/nasal congestion/itchy eyes/runny nose]. Triggered by [triggers - pollen/dust/pets/seasonal]. Severity [severity - mild/moderate/severe].`,
    
    '.weight_loss': `Patient presents with unintentional weight loss. Duration [duration]. Weight loss of [amount] pounds. Associated with [associated symptoms - decreased appetite/fatigue/night sweats]. No dietary changes.`,
    
    '.weight_gain': `Patient presents with weight gain. Duration [duration]. Weight gain of [amount] pounds. Associated with [associated factors - dietary changes/decreased activity/medications]. No edema or shortness of breath.`,
    
    '.edema': `Patient presents with edema. Location [location - lower extremities/upper extremities/generalized]. Duration [duration]. Severity [severity - mild/moderate/severe]. Associated with [associated symptoms - shortness of breath/weight gain]. No chest pain.`,
    
    '.numbness_tingling': `Patient presents with numbness and tingling. Location [location - hands/feet/face/generalized]. Duration [duration]. Pattern [pattern - constant/intermittent]. Associated with [associated symptoms - weakness/pain]. No trauma.`,
    
    '.memory_problems': `Patient presents with memory problems. Duration [duration]. Describes as [symptoms - forgetfulness/confusion/difficulty concentrating]. Severity [severity - mild/moderate/severe]. Impact on daily activities [impact - minimal/moderate/significant].`,
    
    '.sleep_apnea_followup': `Patient returns for follow-up of sleep apnea. Using CPAP [compliance - regularly/irregularly/not using]. Symptoms are [status - improved/stable/worse]. Energy level [status - improved/stable/worse].`,
    
    '.cholesterol_followup': `Patient returns for follow-up of hyperlipidemia. Taking medications as prescribed. Diet and exercise [status - compliant/non-compliant]. No chest pain or cardiovascular symptoms.`,
    
    '.arthritis_followup': `Patient returns for follow-up of [type - osteoarthritis/rheumatoid arthritis]. Joint pain is [status - well-controlled/improving/worsening]. Taking medications as prescribed. Functional status [status - stable/improving/declining].`,
    
    '.osteoporosis_followup': `Patient returns for follow-up of osteoporosis. Taking medications as prescribed. No new fractures. Fall risk [status - low/moderate/high].`,
    
    '.anemia_followup': `Patient returns for follow-up of anemia. Symptoms are [status - improved/stable/worse]. Taking iron supplements [compliance - as prescribed/irregularly]. Energy level [status - improved/stable/worse].`,
    
    '.hypertension_new': `Patient presents with newly diagnosed hypertension. Blood pressure readings have been [readings - elevated/variable]. No symptoms. Family history [status - positive/negative]. Starting treatment.`,
    
    '.diabetes_new': `Patient presents with newly diagnosed diabetes. Blood glucose readings [readings]. Symptoms include [symptoms - polyuria/polydipsia/fatigue]. Family history [status - positive/negative]. Starting treatment and education.`,
    
    '.copd_new': `Patient presents with newly diagnosed COPD. Symptoms include [symptoms - cough/shortness of breath/wheezing]. Duration [duration]. Smoking history [status]. Starting treatment.`,
    
    '.asthma_new': `Patient presents with newly diagnosed asthma. Symptoms include [symptoms - wheezing/shortness of breath/chest tightness]. Triggered by [triggers]. Starting treatment and education.`,
    
    '.heart_failure_followup': `Patient returns for follow-up of heart failure. Symptoms are [status - stable/improving/worsening]. Shortness of breath with [exertion level]. Edema [status - present/absent]. Taking medications as prescribed.`,
    
    '.afib_followup': `Patient returns for follow-up of atrial fibrillation. Rate control [status - adequate/inadequate]. Taking anticoagulation [status - as prescribed]. No symptoms of stroke or bleeding.`,
    
    '.ckd_followup': `Patient returns for follow-up of chronic kidney disease. Stage [stage]. Symptoms are [status - stable/improving/worsening]. Taking medications as prescribed. No edema or shortness of breath.`,
    
    '.liver_disease_followup': `Patient returns for follow-up of [condition - fatty liver disease/hepatitis/cirrhosis]. Symptoms are [status - stable/improving/worsening]. No jaundice or abdominal distension.`,
    
    '.thyroid_new': `Patient presents with newly diagnosed [condition - hypothyroidism/hyperthyroidism]. Symptoms include [symptoms]. Lab results [status - abnormal/elevated/low]. Starting treatment.`,
    
    '.anemia_new': `Patient presents with newly diagnosed anemia. Symptoms include [symptoms - fatigue/weakness/pallor]. Lab results show [findings]. Starting treatment.`,
    
    '.osteoporosis_new': `Patient presents with newly diagnosed osteoporosis. DEXA scan shows [findings]. No fractures. Risk factors [factors]. Starting treatment and fall prevention.`,
    
    '.depression_new': `Patient presents with newly diagnosed depression. Symptoms include [symptoms]. Duration [duration]. Severity [severity]. Impact on function [impact]. Starting treatment.`,
    
    '.anxiety_new': `Patient presents with newly diagnosed anxiety. Symptoms include [symptoms]. Duration [duration]. Severity [severity]. Impact on function [impact]. Starting treatment.`,
    
    '.migraine_new': `Patient presents with newly diagnosed migraines. Frequency [frequency - times per month]. Severity [severity]. Associated symptoms [symptoms]. Starting preventive and abortive treatment.`,
    
    '.fibromyalgia_followup': `Patient returns for follow-up of fibromyalgia. Pain is [status - well-controlled/improving/worsening]. Fatigue [status - improved/stable/worse]. Taking medications as prescribed.`,
    
    '.lupus_followup': `Patient returns for follow-up of systemic lupus erythematosus. Symptoms are [status - stable/improving/worsening]. Taking medications as prescribed. No flares.`,
    
    '.rheumatoid_arthritis_followup': `Patient returns for follow-up of rheumatoid arthritis. Joint pain and swelling [status - well-controlled/improving/worsening]. Taking medications as prescribed. Functional status [status - stable/improving/declining].`,
    
    '.psoriasis_followup': `Patient returns for follow-up of psoriasis. Skin lesions are [status - improved/stable/worse]. Location [location]. Taking medications as prescribed.`,
    
    '.eczema_followup': `Patient returns for follow-up of eczema. Skin is [status - improved/stable/worse]. Location [location]. Itching [status - improved/stable/worse]. Using topical treatments as prescribed.`,
    
    '.acne_followup': `Patient returns for follow-up of acne. Lesions are [status - improved/stable/worse]. Location [location]. Using medications as prescribed.`,
    
    '.rosacea_followup': `Patient returns for follow-up of rosacea. Facial redness and lesions are [status - improved/stable/worse]. Using medications as prescribed.`,
    
    '.gout_followup': `Patient returns for follow-up of gout. Attacks are [frequency - frequent/rare/none]. Last attack [duration] ago. Taking medications as prescribed. Diet [status - compliant/non-compliant].`,
    
    '.osteoporosis_screening': `Patient presents for osteoporosis screening. Age [age]. Risk factors include [factors - family history/smoking/steroid use]. No fractures. Ordering DEXA scan.`,
    
    '.colon_cancer_screening': `Patient presents for colon cancer screening. Age [age]. Family history [status - positive/negative]. Last colonoscopy [date - if applicable]. Scheduling screening.`,
    
    '.mammogram_screening': `Patient presents for mammogram screening. Age [age]. Family history [status - positive/negative]. Last mammogram [date - if applicable]. Scheduling screening.`,
    
    '.prostate_screening': `Patient presents for prostate cancer screening. Age [age]. Family history [status - positive/negative]. Last PSA [date - if applicable]. Discussing screening options.`,
    
    '.vaccination': `Patient presents for vaccination. Age [age]. Vaccination history [status - up to date/needs update]. Administering [vaccine type].`,
    
    '.travel_consultation': `Patient presents for travel consultation. Traveling to [destination] for [duration]. Discussing travel health recommendations, vaccinations, and medications.`,
    
    '.preop_clearance': `Patient presents for preoperative clearance. Scheduled for [procedure] on [date]. Reviewing medical history, medications, and risk factors.`,
    
    '.work_physical': `Patient presents for work physical examination. Employer [employer]. Job requirements [requirements]. Performing physical examination and clearance.`,
    
    '.dmv_physical': `Patient presents for DMV physical examination. Commercial driver requirements. Performing physical examination and clearance.`,
    
    '.sports_physical': `Patient presents for sports physical examination. Sport [sport]. Age [age]. Performing pre-participation physical examination.`,
    
    '.school_physical': `Patient presents for school physical examination. Grade [grade]. Age [age]. Performing physical examination and updating immunizations.`,
    
    '.disability_evaluation': `Patient presents for disability evaluation. Condition [condition]. Duration [duration]. Impact on function [impact]. Documenting limitations.`,
    
    '.fmla_documentation': `Patient presents for FMLA documentation. Condition [condition]. Need for leave [reason]. Duration [duration]. Completing documentation.`,
    
    '.work_restriction': `Patient presents for work restriction documentation. Condition [condition]. Restrictions needed [restrictions]. Duration [duration]. Completing documentation.`,
    
    '.medication_reconciliation': `Patient presents for medication reconciliation. Reviewing current medications, allergies, and updating medication list.`,
    
    '.fall_risk_assessment': `Patient presents for fall risk assessment. Age [age]. History of falls [status - yes/no]. Risk factors [factors]. Performing assessment and recommendations.`,
    
    '.memory_screening': `Patient presents for memory screening. Age [age]. Concerns about [concerns]. Performing cognitive assessment.`,
    
    '.depression_screening': `Patient presents for depression screening. PHQ-9 score [score]. Symptoms [symptoms]. Discussing treatment options.`,
    
    '.anxiety_screening': `Patient presents for anxiety screening. GAD-7 score [score]. Symptoms [symptoms]. Discussing treatment options.`,
    
    '.substance_use_screening': `Patient presents for substance use screening. Substances [substances]. Frequency [frequency]. Discussing treatment options.`,
    
    '.domestic_violence_screening': `Patient presents for domestic violence screening. Safety concerns [concerns]. Providing resources and support.`,
    
    '.suicide_risk_assessment': `Patient presents with suicidal ideation. Risk level [level - low/moderate/high]. Plan [status - yes/no]. Means [status - yes/no]. Providing crisis intervention.`,
};

