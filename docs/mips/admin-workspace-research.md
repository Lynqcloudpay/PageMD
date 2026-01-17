# CMS/QPP Quality & MIPS Workspace Research (PY 2025-2026)

This document serves as the internal "CMS Truth Map" for the PageMD MIPS Admin Workspace. It outlines the structure, requirements, and available measures/activities as defined by CMS/QPP for Performance Years 2025 and 2026.

## 1. Specialty Measure Sets (Traditional MIPS)
CMS explicitly supports specialty-focused measure sets in the QPP Explore tool. For Traditional MIPS, clinicians should report a complete specialty set or at least 6 measures (including 1 outcome/high-priority measure).

### Primary Specialty Sets
| Specialty | Focus Areas |
| :--- | :--- |
| **Cardiology** | Hypertension, Atrial Fibrillation, CAD, Heart Failure, Lipid Management |
| **Endocrinology** | Diabetes (A1c, Eye Exam, Foot Exam), Hypertension, Osteoporosis |
| **Family Medicine** | Preventive screens (Cancer, Depression, Tobacco), Immunizations, BP control |
| **Geriatrics** | Cognitive assessment, Falls risk, Med review, Advanced care planning |
| **Nephrology** | ESRD care, Anemia management, BP control in CKD |
| **Gastroenterology** | Colorectal cancer screening, Hepatitis C, IBD |
| **Rheumatology** | Rheumatoid arthritis, Osteoporosis management |
| **Pulmonology** | Asthma, COPD, Tobacco cessation |

## 2. MIPS Value Pathways (MVPs) - 2026
MVPs are the preferred reporting pathway starting in 2026 for many specialties.

### Finalized MVPs for 2026 (New)
*   Diagnostic Radiology
*   Interventional Radiology
*   Neuropsychology
*   Pathology
*   Podiatry
*   Vascular Surgery

### Key Existing MVPs (Modified for 2026)
*   **Adopting Best Practices and Promoting Patient Safety within Emergency Medicine**
*   **Advancing Cancer Care**
*   **Advancing Care for Substance Use Disorders**
*   **Advancing Gastroenterology and Hepatology Patient Care** (Relevant for GI)
*   **Advancing Gynecological Oncology and Surgical Care**
*   **Advancing Rheumatology Patient Care** (Relevant for Rheum)
*   **Coordinating Mental Health and Substance Use Disorder Care**
*   **Focusing on Women’s Health**
*   **Improving Care for Lower Extremity Joint Repair**
*   **Optimal Care for Patients with Episodic Neurological Conditions**
*   **Patient Safety and Support of Positive Patient Outcomes in Anesthesia and Surgical Care**
*   **Promoting Wellness** (Relevant for PCP/Family Med)
*   **Support of Positive Outcomes after Gynecological Surgery**
*   **Support of Positive Outcomes after Musculoskeletal Surgery**
*   **Value in Hepatitis C Care**

## 3. Performance Categories & Thresholds
| Category | 2025 Weight | 2026 Weight | Requirements |
| :--- | :--- | :--- | :--- |
| **Quality** | 30% | 30% | 6 measures OR specialty set. 75% data completeness. |
| **Cost** | 30% | 30% | Tracked by CMS (33 episode-based + MSPB + TPCC). |
| **Improvement Activities** | 15% | 15% | 2 high-weight or 4 medium-weight activities (usually). |
| **Promoting Interoperability**| 25% | 25% | e-Prescribing, HIE, Patient Engagement, Public Health. |

**Performance Threshold:** 75 points (remains constant through 2028).

## 4. Cost Category Detail (2026)
*   **Total Measures:** 35 (33 episode-based + 2 population-based).
*   **Population-Based:** Total Per Capita Cost (TPCC) and Medicare Spending Per Beneficiary (MSPB).
*   **Note:** New cost measures introduced after 2024 undergo a **2-year informational-only period** before being scored.

## 5. Improvement Activities (2026 Changes)
*   **New:** Patient Safety in the Use of AI (ID: IA_ASPA_XX).
*   **Modified:** 7 activities (mostly ID updates).
*   **Removed:** 8 activities (including some health equity and COVID-19 related items).
*   **Subcategory Update:** "Achieving Health Equity" has been renamed to **"Advancing Health and Wellness"**.

## 6. Official Data Sources
*   [QPP Explore Measures & Activities](https://qpp.cms.gov/mips/explore-measures)
*   [QPP Resource Library](https://qpp.cms.gov/about/resource-library)
*   [2026 MIPS Final Rule Overview](https://qpp.cms.gov/mips/reporting-options-overview)
*   [2026 Summary of Cost Measures (PDF)](https://www.cms.gov/files/document/2026-mips-summary-cost-measures.pdf)

## 7. Build Strategy
1.  **Year-Versioned Schema**: All measures and activities are keyed by `performance_year`.
2.  **Specialty Pack Mapping**: Pre-defines the recommended measures for each specialty based on the QPP sets listed above.
3.  **Computability Engine**: Priority given to 2026 Quality Measures (Hypertension, Diabetes A1c, Smoking Status) as they are the most computable from the current EMR data.
