// Patient Education Handouts Database
// Based on common conditions and medications from Epic and eCW handout libraries

export const educationHandouts = {
  // Diabetes Education
  diabetes: {
    title: 'Managing Your Diabetes',
    category: 'Chronic Conditions',
    icd10: ['E11.9', 'E10.9'],
    content: `
# Managing Your Diabetes

## What is Diabetes?
Diabetes is a condition where your body has trouble managing blood sugar (glucose). Glucose is the main source of energy for your cells, but it needs insulin to enter cells properly.

## Types of Diabetes
- **Type 1**: Your body doesn't make insulin
- **Type 2**: Your body doesn't use insulin well (most common)
- **Prediabetes**: Blood sugar is higher than normal but not yet diabetes

## Managing Your Blood Sugar

### Monitor Your Blood Sugar
- Check your blood sugar as directed by your doctor
- Keep a log of your readings
- Bring your log to every appointment

### Target Blood Sugar Levels
- Before meals: 80-130 mg/dL
- 2 hours after meals: Less than 180 mg/dL
- A1c goal: Usually less than 7%

### Signs of LOW Blood Sugar (Hypoglycemia)
- Shakiness, sweating
- Dizziness, confusion
- Fast heartbeat
- Hunger

**What to do**: Eat or drink 15 grams of fast-acting sugar (4 glucose tablets, 4 oz juice, or 4 oz regular soda)

### Signs of HIGH Blood Sugar (Hyperglycemia)
- Increased thirst
- Frequent urination
- Blurred vision
- Fatigue

## Healthy Eating
- Count carbohydrates
- Eat regular meals and snacks
- Choose whole grains, vegetables, lean proteins
- Limit sugary drinks and sweets

## Stay Active
- Aim for 150 minutes of moderate activity per week
- Walking, swimming, biking are great options
- Check blood sugar before and after exercise

## Take Your Medications
- Take medications exactly as prescribed
- Don't skip doses
- Tell your doctor about side effects

## Foot Care
- Check your feet daily for cuts, blisters, or sores
- Wash feet daily, dry between toes
- Wear comfortable, well-fitting shoes
- Never go barefoot

## Regular Check-ups
- A1c every 3-6 months
- Annual eye exam
- Annual foot exam
- Regular blood pressure and cholesterol checks
    `,
  },

  hypertension: {
    title: 'Understanding High Blood Pressure',
    category: 'Chronic Conditions',
    icd10: ['I10'],
    content: `
# Understanding High Blood Pressure

## What is Blood Pressure?
Blood pressure is the force of blood pushing against your artery walls. It's measured with two numbers:
- **Systolic** (top number): Pressure when heart beats
- **Diastolic** (bottom number): Pressure when heart rests

## Blood Pressure Categories
- **Normal**: Less than 120/80 mmHg
- **Elevated**: 120-129 / less than 80 mmHg
- **High (Stage 1)**: 130-139 / 80-89 mmHg
- **High (Stage 2)**: 140+ / 90+ mmHg
- **Crisis**: Higher than 180/120 mmHg (Seek immediate care!)

## Why Control Blood Pressure?
Uncontrolled high blood pressure can lead to:
- Heart attack and heart disease
- Stroke
- Kidney damage
- Vision loss
- Memory problems

## Lifestyle Changes (DASH)

### Dietary Approaches to Stop Hypertension
- Eat fruits, vegetables, whole grains
- Choose lean proteins (fish, chicken)
- Limit saturated fats
- Reduce sodium to less than 2,300 mg/day
- Limit alcohol

### Stay Active
- 150 minutes of moderate exercise per week
- Examples: Walking, swimming, cycling

### Maintain Healthy Weight
- Even losing 10 pounds can help lower blood pressure

### Reduce Stress
- Practice relaxation techniques
- Get enough sleep (7-9 hours)
- Consider meditation or yoga

### Quit Smoking
- Smoking raises blood pressure
- Ask your doctor about quit aids

## Taking Your Medication
- Take at the same time each day
- Don't stop without talking to your doctor
- Some medications work better with or without food
- Report side effects to your doctor

## Monitor at Home
- Check blood pressure regularly
- Keep a log of your readings
- Bring log to appointments
- Rest 5 minutes before checking
- Don't smoke or drink caffeine 30 minutes before
    `,
  },

  asthma: {
    title: 'Asthma Action Plan',
    category: 'Respiratory',
    icd10: ['J45.909'],
    content: `
# Your Asthma Action Plan

## Understanding Asthma
Asthma causes your airways to swell and produce extra mucus, making it hard to breathe.

## Know Your Triggers
Common triggers include:
- Allergens (dust, pollen, pet dander, mold)
- Smoke and air pollution
- Cold air
- Exercise
- Respiratory infections
- Strong emotions

## The Zone System

### GREEN ZONE - Doing Well
**Symptoms**: No cough, wheeze, chest tightness, or shortness of breath
**Peak Flow**: 80-100% of personal best

**Action**: Take daily controller medications as prescribed

### YELLOW ZONE - Caution
**Symptoms**: Coughing, wheezing, chest tightness, waking at night
**Peak Flow**: 50-80% of personal best

**Action**: 
- Take quick-relief inhaler
- Continue controller medications
- Call doctor if no improvement in 24 hours

### RED ZONE - Medical Alert
**Symptoms**: Very hard to breathe, quick-relief not helping, cannot do usual activities
**Peak Flow**: Less than 50% of personal best

**Action**:
- Take quick-relief inhaler immediately
- Call doctor or go to emergency room
- If severe, call 911

## Using Your Inhalers

### Metered Dose Inhaler (MDI)
1. Shake well
2. Breathe out completely
3. Put mouthpiece in mouth, seal lips
4. Press down and breathe in slowly
5. Hold breath 10 seconds
6. Wait 1 minute between puffs
7. Rinse mouth after steroid inhalers

### With Spacer
1. Attach inhaler to spacer
2. Shake well
3. Breathe out
4. Press inhaler once
5. Breathe in slowly
6. Hold breath 10 seconds

## Prevent Attacks
- Take controller medications daily
- Keep rescue inhaler with you always
- Avoid known triggers
- Get flu shot yearly
- Have regular check-ups
    `,
  },

  // Medication Education
  metformin: {
    title: 'Taking Metformin Safely',
    category: 'Medications',
    medications: ['Metformin', 'Glucophage'],
    content: `
# Taking Metformin Safely

## What is Metformin?
Metformin is a medication that helps control blood sugar in Type 2 diabetes. It's usually the first medication prescribed for diabetes.

## How Does It Work?
- Decreases sugar production by your liver
- Improves your body's response to insulin
- May help with weight management

## How to Take
- Take with food to reduce stomach upset
- Take at the same time each day
- Swallow extended-release tablets whole - don't crush or chew
- If you miss a dose, take it as soon as you remember (skip if almost time for next dose)

## Common Side Effects
These often improve after a few weeks:
- Nausea, upset stomach
- Diarrhea
- Gas and bloating
- Metallic taste

## Serious Side Effects - Call Doctor Immediately
- Muscle pain or weakness
- Trouble breathing
- Unusual tiredness
- Stomach pain with nausea/vomiting
- Feeling cold, dizzy, or lightheaded
- Slow or irregular heartbeat

## Important Warnings

### Before Procedures with Contrast Dye
- Tell your doctor you take metformin
- May need to stop 48 hours before and after

### Alcohol
- Limit alcohol - increases risk of low blood sugar and lactic acidosis

### Kidney Function
- Your doctor will check kidney function regularly
- Metformin may need adjustment if kidneys aren't working well

## Storage
- Keep at room temperature
- Protect from moisture and heat
- Keep out of reach of children
    `,
  },

  // Procedure Preparation
  colonoscopy: {
    title: 'Preparing for Your Colonoscopy',
    category: 'Procedures',
    content: `
# Preparing for Your Colonoscopy

## What is a Colonoscopy?
A colonoscopy examines the inside of your large intestine (colon) using a flexible camera. It can detect polyps, cancer, and other conditions.

## One Week Before
- Stop taking iron supplements
- Arrange for someone to drive you home
- You cannot drive for 24 hours after the procedure

## Special Medication Instructions
**Blood Thinners**: Ask your doctor about:
- Warfarin (Coumadin)
- Aspirin
- Clopidogrel (Plavix)
- Other blood thinners

**Diabetes Medications**: 
- May need to adjust insulin
- Ask your doctor for specific instructions

## The Day Before
### Diet
- Clear liquids ONLY all day:
  - Water, clear broth
  - Apple juice, white grape juice
  - Tea or coffee (no milk or cream)
  - Clear sports drinks
  - Jell-O (no red or purple)
  - Popsicles (no red or purple)

### Avoid
- Solid foods
- Red or purple liquids (they look like blood)
- Milk products

### Bowel Prep
- Follow prep instructions exactly
- Start at the time your doctor specified
- Drink all the prep solution
- Stay near a bathroom
- Apply barrier cream if needed

## Day of Procedure
- Nothing to eat or drink after midnight (or as directed)
- Take approved medications with small sip of water
- Wear comfortable, loose clothing
- Leave jewelry and valuables at home
- Bring your driver

## After the Procedure
- You'll rest until sedation wears off
- Someone must drive you home
- No driving for 24 hours
- No alcohol for 24 hours
- No important decisions for 24 hours
- Start with light foods
- Some bloating and gas is normal
    `,
  },

  // General Health
  smoking_cessation: {
    title: 'Quitting Smoking - Your Guide to Success',
    category: 'Lifestyle',
    content: `
# Quitting Smoking - Your Guide to Success

## Why Quit?
### Immediate Benefits
- Blood pressure drops within 20 minutes
- Carbon monoxide levels normalize in 12 hours
- Heart attack risk begins to drop in 24 hours
- Taste and smell improve in 48 hours

### Long-term Benefits
- Lung function improves in 1-9 months
- Heart disease risk cut in half at 1 year
- Stroke risk equals non-smoker at 5 years
- Lung cancer risk cut in half at 10 years

## Prepare to Quit

### Set a Quit Date
- Choose a date within 2 weeks
- Mark it on your calendar
- Tell friends and family

### Know Your Triggers
- Stress
- Alcohol
- Coffee
- After meals
- Other smokers
- Driving

## Quit Methods

### Medications (Talk to Your Doctor)
**Nicotine Replacement**
- Patches
- Gum
- Lozenges
- Inhalers
- Nasal spray

**Prescription Medications**
- Varenicline (Chantix)
- Bupropion (Wellbutrin, Zyban)

### Behavioral Strategies
- Identify triggers and avoid them
- Find new habits for cravings
- Deep breathing exercises
- Physical activity
- Support groups
- Counseling

## Managing Cravings
Cravings last about 3-5 minutes. Try:
- Deep breaths
- Drink water
- Chew gum or hard candy
- Walk or exercise
- Call a friend
- Review your reasons to quit

## Withdrawal Symptoms
These are temporary and usually peak at 3-5 days:
- Irritability
- Difficulty concentrating
- Increased appetite
- Trouble sleeping
- Cravings

## Resources
- 1-800-QUIT-NOW (1-800-784-8669)
- Smokefree.gov
- Text QUIT to 47848
    `,
  },
};

// Search handouts
export const searchEducation = (query) => {
  if (!query) return Object.entries(educationHandouts).map(([key, doc]) => ({ key, ...doc }));
  const searchLower = query.toLowerCase();
  return Object.entries(educationHandouts)
    .filter(([key, doc]) =>
      doc.title.toLowerCase().includes(searchLower) ||
      doc.category.toLowerCase().includes(searchLower) ||
      key.toLowerCase().includes(searchLower) ||
      doc.content.toLowerCase().includes(searchLower) ||
      (doc.icd10 && doc.icd10.some(code => code.toLowerCase().includes(searchLower))) ||
      (doc.medications && doc.medications.some(med => med.toLowerCase().includes(searchLower)))
    )
    .map(([key, doc]) => ({ key, ...doc }));
};

// Get handouts by condition
export const getHandoutsByCondition = (icd10Codes) => {
  return Object.entries(educationHandouts)
    .filter(([_, doc]) => doc.icd10 && doc.icd10.some(code => icd10Codes.includes(code)))
    .map(([key, doc]) => ({ key, ...doc }));
};

// Get handouts by medication
export const getHandoutsByMedication = (medications) => {
  const medNames = medications.map(m => (m.name || m).toLowerCase());
  return Object.entries(educationHandouts)
    .filter(([_, doc]) => doc.medications && doc.medications.some(med => 
      medNames.some(name => name.includes(med.toLowerCase()) || med.toLowerCase().includes(name))
    ))
    .map(([key, doc]) => ({ key, ...doc }));
};

export default educationHandouts;






























