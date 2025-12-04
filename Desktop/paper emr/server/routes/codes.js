const express = require('express');
const pool = require('../db');
const { authenticate, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ICD-10 code lookup - Enhanced with database support
router.get('/icd10', async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    // First, try database if icd10_codes table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'icd10_codes'
        );
      `);

      if (tableCheck.rows[0].exists && search) {
        // Use database search with full-text search
        const result = await pool.query(`
          SELECT code, description, billable, valid_for_submission
          FROM icd10_codes
          WHERE search_vector @@ plainto_tsquery('english', $1)
             OR code ILIKE $2
             OR description ILIKE $2
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC,
                   CASE WHEN code ILIKE $2 THEN 1 ELSE 2 END
          LIMIT $3
        `, [search, `%${search}%`, parseInt(limit)]);

        if (result.rows.length > 0) {
          return res.json(result.rows.map(row => ({
            code: row.code,
            description: row.description,
            billable: row.billable,
            valid: row.valid_for_submission
          })));
        }
      }
    } catch (dbError) {
      console.warn('Database search failed, using fallback:', dbError.message);
      // Fall through to hardcoded codes
    }
    
    // Fallback to hardcoded cardiology-specific ICD-10 codes (200 most common)
    const commonCodes = [
      // ========== HYPERTENSIVE DISEASES ==========
      { code: 'I10', description: 'Essential (primary) hypertension' },
      { code: 'I11.0', description: 'Hypertensive heart disease with heart failure' },
      { code: 'I11.9', description: 'Hypertensive heart disease without heart failure' },
      { code: 'I12.0', description: 'Hypertensive chronic kidney disease with stage 5 chronic kidney disease or end-stage renal disease' },
      { code: 'I12.9', description: 'Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease' },
      { code: 'I13.0', description: 'Hypertensive heart and chronic kidney disease with heart failure and stage 1 through stage 4 chronic kidney disease' },
      { code: 'I13.2', description: 'Hypertensive heart and chronic kidney disease with heart failure and with stage 5 chronic kidney disease, or end-stage renal disease' },
      { code: 'I15.0', description: 'Renovascular hypertension' },
      { code: 'I15.1', description: 'Hypertension secondary to other renal disorders' },
      { code: 'I15.2', description: 'Hypertension secondary to endocrine disorders' },
      { code: 'I15.8', description: 'Other secondary hypertension' },
      { code: 'I15.9', description: 'Secondary hypertension, unspecified' },
      
      // ========== ISCHEMIC HEART DISEASES ==========
      { code: 'I20.0', description: 'Unstable angina' },
      { code: 'I20.1', description: 'Angina pectoris with documented spasm' },
      { code: 'I20.8', description: 'Other forms of angina pectoris' },
      { code: 'I20.9', description: 'Angina pectoris, unspecified' },
      { code: 'I21.01', description: 'ST elevation (STEMI) myocardial infarction involving left main coronary artery' },
      { code: 'I21.02', description: 'STEMI involving left anterior descending coronary artery' },
      { code: 'I21.09', description: 'STEMI involving other coronary artery of anterior wall' },
      { code: 'I21.11', description: 'STEMI involving right coronary artery' },
      { code: 'I21.19', description: 'STEMI involving other coronary artery of inferior wall' },
      { code: 'I21.21', description: 'STEMI involving left circumflex coronary artery' },
      { code: 'I21.29', description: 'STEMI involving other sites' },
      { code: 'I21.3', description: 'STEMI of unspecified site' },
      { code: 'I21.4', description: 'Non-ST elevation (NSTEMI) myocardial infarction' },
      { code: 'I21.9', description: 'Acute myocardial infarction, unspecified' },
      { code: 'I22.0', description: 'Subsequent STEMI of anterior wall' },
      { code: 'I22.1', description: 'Subsequent STEMI of inferior wall' },
      { code: 'I22.2', description: 'Subsequent STEMI of other sites' },
      { code: 'I22.8', description: 'Subsequent NSTEMI' },
      { code: 'I22.9', description: 'Subsequent myocardial infarction of unspecified type' },
      { code: 'I23.0', description: 'Hemopericardium as current complication following acute myocardial infarction' },
      { code: 'I23.1', description: 'Atrial septal defect as current complication following acute myocardial infarction' },
      { code: 'I23.2', description: 'Ventricular septal defect as current complication following acute myocardial infarction' },
      { code: 'I23.3', description: 'Rupture of cardiac wall without hemopericardium as current complication following acute myocardial infarction' },
      { code: 'I23.6', description: 'Thrombosis of atrium, auricular appendage, and ventricle as current complications following acute myocardial infarction' },
      { code: 'I23.7', description: 'Postinfarction angina' },
      { code: 'I24.0', description: 'Acute coronary thrombosis not resulting in myocardial infarction' },
      { code: 'I24.1', description: "Dressler's syndrome" },
      { code: 'I24.8', description: 'Other forms of acute ischemic heart disease' },
      { code: 'I24.9', description: 'Acute ischemic heart disease, unspecified' },
      { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
      { code: 'I25.110', description: 'Atherosclerotic heart disease of native coronary artery with unstable angina pectoris' },
      { code: 'I25.119', description: 'Atherosclerotic heart disease of native coronary artery with unspecified angina pectoris' },
      { code: 'I25.2', description: 'Old myocardial infarction' },
      { code: 'I25.3', description: 'Aneurysm of heart' },
      { code: 'I25.41', description: 'Coronary artery aneurysm' },
      { code: 'I25.42', description: 'Coronary artery dissection' },
      { code: 'I25.5', description: 'Ischemic cardiomyopathy' },
      { code: 'I25.6', description: 'Silent myocardial ischemia' },
      { code: 'I25.700', description: 'Atherosclerosis of coronary artery bypass graft(s), unspecified, with unstable angina pectoris' },
      { code: 'I25.710', description: 'Atherosclerosis of autologous vein coronary artery bypass graft(s) with unstable angina pectoris' },
      { code: 'I25.720', description: 'Atherosclerosis of autologous artery coronary artery bypass graft(s) with unstable angina pectoris' },
      
      // ========== PULMONARY HEART DISEASE ==========
      { code: 'I26.01', description: 'Septic pulmonary embolism with acute cor pulmonale' },
      { code: 'I26.02', description: 'Saddle embolus of pulmonary artery with acute cor pulmonale' },
      { code: 'I26.09', description: 'Other pulmonary embolism with acute cor pulmonale' },
      { code: 'I26.90', description: 'Septic pulmonary embolism without acute cor pulmonale' },
      { code: 'I26.92', description: 'Saddle embolus of pulmonary artery without acute cor pulmonale' },
      { code: 'I26.99', description: 'Other pulmonary embolism without acute cor pulmonale' },
      { code: 'I27.0', description: 'Primary pulmonary hypertension' },
      { code: 'I27.1', description: 'Kyphoscoliotic heart disease' },
      { code: 'I27.2', description: 'Other secondary pulmonary hypertension' },
      { code: 'I27.20', description: 'Pulmonary hypertension, unspecified' },
      { code: 'I27.21', description: 'Secondary pulmonary arterial hypertension' },
      { code: 'I27.22', description: 'Pulmonary hypertension due to left heart disease' },
      { code: 'I27.23', description: 'Pulmonary hypertension due to lung diseases and hypoxia' },
      { code: 'I27.24', description: 'Chronic thromboembolic pulmonary hypertension' },
      { code: 'I27.29', description: 'Other secondary pulmonary hypertension' },
      { code: 'I27.81', description: 'Pulmonary hypertension due to schistosomiasis' },
      { code: 'I27.82', description: 'Pulmonary hypertension due to other parasitic diseases' },
      { code: 'I27.83', description: 'Pulmonary hypertension due to interstitial lung disease' },
      { code: 'I27.89', description: 'Other specified pulmonary heart diseases' },
      { code: 'I27.9', description: 'Pulmonary heart disease, unspecified' },
      
      // ========== OTHER FORMS OF HEART DISEASE ==========
      { code: 'I28.0', description: 'Arteriovenous fistula of pulmonary vessels' },
      { code: 'I28.1', description: 'Aneurysm of pulmonary artery' },
      { code: 'I28.8', description: 'Other specified diseases of pulmonary vessels' },
      { code: 'I28.9', description: 'Disease of pulmonary vessels, unspecified' },
      { code: 'I30.0', description: 'Acute nonspecific idiopathic pericarditis' },
      { code: 'I30.1', description: 'Infective pericarditis' },
      { code: 'I30.8', description: 'Other forms of acute pericarditis' },
      { code: 'I30.9', description: 'Acute pericarditis, unspecified' },
      { code: 'I31.0', description: 'Chronic adhesive pericarditis' },
      { code: 'I31.1', description: 'Chronic constrictive pericarditis' },
      { code: 'I31.2', description: 'Hemopericardium, not elsewhere classified' },
      { code: 'I31.3', description: 'Pericardial effusion (noninflammatory)' },
      { code: 'I31.4', description: 'Cardiac tamponade' },
      { code: 'I31.8', description: 'Other specified diseases of pericardium' },
      { code: 'I31.9', description: 'Disease of pericardium, unspecified' },
      { code: 'I32.0', description: 'Pericarditis in diseases classified elsewhere' },
      { code: 'I32.8', description: 'Other forms of pericarditis in diseases classified elsewhere' },
      { code: 'I33.0', description: 'Acute and subacute infective endocarditis' },
      { code: 'I33.9', description: 'Acute endocarditis, unspecified' },
      { code: 'I34.0', description: 'Nonrheumatic mitral (valve) insufficiency' },
      { code: 'I34.1', description: 'Nonrheumatic mitral (valve) prolapse' },
      { code: 'I34.2', description: 'Nonrheumatic mitral (valve) stenosis' },
      { code: 'I34.8', description: 'Other nonrheumatic mitral valve disorders' },
      { code: 'I34.9', description: 'Nonrheumatic mitral valve disorder, unspecified' },
      { code: 'I35.0', description: 'Nonrheumatic aortic (valve) stenosis' },
      { code: 'I35.1', description: 'Nonrheumatic aortic (valve) insufficiency' },
      { code: 'I35.2', description: 'Nonrheumatic aortic (valve) stenosis with insufficiency' },
      { code: 'I35.8', description: 'Other nonrheumatic aortic valve disorders' },
      { code: 'I35.9', description: 'Nonrheumatic aortic valve disorder, unspecified' },
      { code: 'I36.0', description: 'Nonrheumatic tricuspid (valve) stenosis' },
      { code: 'I36.1', description: 'Nonrheumatic tricuspid (valve) insufficiency' },
      { code: 'I36.2', description: 'Nonrheumatic tricuspid (valve) stenosis with insufficiency' },
      { code: 'I36.8', description: 'Other nonrheumatic tricuspid valve disorders' },
      { code: 'I36.9', description: 'Nonrheumatic tricuspid valve disorder, unspecified' },
      { code: 'I37.0', description: 'Nonrheumatic pulmonary valve stenosis' },
      { code: 'I37.1', description: 'Nonrheumatic pulmonary valve insufficiency' },
      { code: 'I37.2', description: 'Nonrheumatic pulmonary valve stenosis with insufficiency' },
      { code: 'I37.8', description: 'Other nonrheumatic pulmonary valve disorders' },
      { code: 'I37.9', description: 'Nonrheumatic pulmonary valve disorder, unspecified' },
      { code: 'I38', description: 'Endocarditis, valve unspecified' },
      { code: 'I39.0', description: 'Mitral valve disorders in diseases classified elsewhere' },
      { code: 'I39.1', description: 'Aortic valve disorders in diseases classified elsewhere' },
      { code: 'I39.2', description: 'Tricuspid valve disorders in diseases classified elsewhere' },
      { code: 'I39.3', description: 'Pulmonary valve disorders in diseases classified elsewhere' },
      { code: 'I39.4', description: 'Multiple valve disorders in diseases classified elsewhere' },
      { code: 'I39.8', description: 'Endocarditis and valve disorders in diseases classified elsewhere' },
      
      // ========== CARDIOMYOPATHY ==========
      { code: 'I40.0', description: 'Infective cardiomyopathy' },
      { code: 'I40.1', description: 'Isolated myocarditis' },
      { code: 'I40.8', description: 'Other acute myocarditis' },
      { code: 'I40.9', description: 'Acute myocarditis, unspecified' },
      { code: 'I41.0', description: 'Myocarditis in bacterial diseases classified elsewhere' },
      { code: 'I41.1', description: 'Myocarditis in viral diseases classified elsewhere' },
      { code: 'I41.2', description: 'Myocarditis in other infectious and parasitic diseases classified elsewhere' },
      { code: 'I41.8', description: 'Myocarditis in other diseases classified elsewhere' },
      { code: 'I42.0', description: 'Dilated cardiomyopathy' },
      { code: 'I42.1', description: 'Obstructive hypertrophic cardiomyopathy' },
      { code: 'I42.2', description: 'Other hypertrophic cardiomyopathy' },
      { code: 'I42.3', description: 'Endomyocardial (eosinophilic) disease' },
      { code: 'I42.4', description: 'Endocardial fibroelastosis' },
      { code: 'I42.5', description: 'Other restrictive cardiomyopathy' },
      { code: 'I42.6', description: 'Alcoholic cardiomyopathy' },
      { code: 'I42.7', description: 'Cardiomyopathy due to drug and external agent' },
      { code: 'I42.8', description: 'Other cardiomyopathies' },
      { code: 'I42.9', description: 'Cardiomyopathy, unspecified' },
      { code: 'I43.0', description: 'Cardiomyopathy in infectious and parasitic diseases classified elsewhere' },
      { code: 'I43.1', description: 'Cardiomyopathy in metabolic diseases' },
      { code: 'I43.2', description: 'Cardiomyopathy in nutritional diseases' },
      { code: 'I43.8', description: 'Cardiomyopathy in other diseases classified elsewhere' },
      
      // ========== CONDUCTION DISORDERS ==========
      { code: 'I44.0', description: 'Atrioventricular block, first degree' },
      { code: 'I44.1', description: 'Atrioventricular block, second degree' },
      { code: 'I44.2', description: 'Atrioventricular block, complete' },
      { code: 'I44.3', description: 'Other and unspecified atrioventricular block' },
      { code: 'I44.4', description: 'Left anterior fascicular block' },
      { code: 'I44.5', description: 'Left posterior fascicular block' },
      { code: 'I44.6', description: 'Other fascicular block' },
      { code: 'I44.7', description: 'Left bundle-branch block, unspecified' },
      { code: 'I45.0', description: 'Right fascicular block' },
      { code: 'I45.1', description: 'Other and unspecified right bundle-branch block' },
      { code: 'I45.2', description: 'Bifascicular block' },
      { code: 'I45.3', description: 'Trifascicular block' },
      { code: 'I45.4', description: 'Nonspecific intraventricular block' },
      { code: 'I45.5', description: 'Other specified conduction disorders' },
      { code: 'I45.6', description: 'Pre-excitation syndrome' },
      { code: 'I45.81', description: 'Long QT syndrome' },
      { code: 'I45.89', description: 'Other specified conduction disorders' },
      { code: 'I45.9', description: 'Conduction disorder, unspecified' },
      
      // ========== CARDIAC ARRHYTHMIAS ==========
      { code: 'I46.2', description: 'Cardiac arrest due to underlying cardiac condition' },
      { code: 'I46.8', description: 'Cardiac arrest due to other underlying condition' },
      { code: 'I46.9', description: 'Cardiac arrest, cause unspecified' },
      { code: 'I47.0', description: 'Re-entry ventricular arrhythmia' },
      { code: 'I47.1', description: 'Supraventricular tachycardia' },
      { code: 'I47.2', description: 'Ventricular tachycardia' },
      { code: 'I47.9', description: 'Paroxysmal tachycardia, unspecified' },
      { code: 'I48.0', description: 'Paroxysmal atrial fibrillation' },
      { code: 'I48.1', description: 'Persistent atrial fibrillation' },
      { code: 'I48.11', description: 'Longstanding persistent atrial fibrillation' },
      { code: 'I48.19', description: 'Other persistent atrial fibrillation' },
      { code: 'I48.20', description: 'Chronic atrial fibrillation, unspecified' },
      { code: 'I48.21', description: 'Permanent atrial fibrillation' },
      { code: 'I48.91', description: 'Unspecified atrial fibrillation' },
      { code: 'I49.01', description: 'Ventricular fibrillation' },
      { code: 'I49.02', description: 'Ventricular flutter' },
      { code: 'I49.1', description: 'Atrial premature depolarization' },
      { code: 'I49.2', description: 'Junctional premature depolarization' },
      { code: 'I49.3', description: 'Ventricular premature depolarization' },
      { code: 'I49.40', description: 'Unspecified premature depolarization' },
      { code: 'I49.49', description: 'Other premature depolarization' },
      { code: 'I49.5', description: 'Sick sinus syndrome' },
      { code: 'I49.8', description: 'Other specified cardiac arrhythmias' },
      { code: 'I49.9', description: 'Cardiac arrhythmia, unspecified' },
      
      // ========== HEART FAILURE ==========
      { code: 'I50.1', description: 'Left ventricular failure' },
      { code: 'I50.2', description: 'Systolic heart failure' },
      { code: 'I50.3', description: 'Diastolic heart failure' },
      { code: 'I50.4', description: 'Combined systolic and diastolic heart failure' },
      { code: 'I50.9', description: 'Heart failure, unspecified' },
      { code: 'I50.20', description: 'Unspecified systolic heart failure' },
      { code: 'I50.21', description: 'Acute systolic heart failure' },
      { code: 'I50.22', description: 'Chronic systolic heart failure' },
      { code: 'I50.23', description: 'Acute on chronic systolic heart failure' },
      { code: 'I50.30', description: 'Unspecified diastolic heart failure' },
      { code: 'I50.31', description: 'Acute diastolic heart failure' },
      { code: 'I50.32', description: 'Chronic diastolic heart failure' },
      { code: 'I50.33', description: 'Acute on chronic diastolic heart failure' },
      { code: 'I50.40', description: 'Unspecified combined systolic and diastolic heart failure' },
      { code: 'I50.41', description: 'Acute combined systolic and diastolic heart failure' },
      { code: 'I50.42', description: 'Chronic combined systolic and diastolic heart failure' },
      { code: 'I50.43', description: 'Acute on chronic combined systolic and diastolic heart failure' },
      
      // ========== COMPLICATIONS AND ILL-DEFINED HEART DISEASE ==========
      { code: 'I51.0', description: 'Cardiac septal defect, acquired' },
      { code: 'I51.1', description: 'Rupture of chordae tendineae, not elsewhere classified' },
      { code: 'I51.2', description: 'Rupture of papillary muscle, not elsewhere classified' },
      { code: 'I51.3', description: 'Intracardiac thrombosis, not elsewhere classified' },
      { code: 'I51.4', description: 'Myocarditis, unspecified' },
      { code: 'I51.5', description: 'Myocardial degeneration' },
      { code: 'I51.7', description: 'Cardiomegaly' },
      { code: 'I51.81', description: 'Takotsubo syndrome' },
      { code: 'I51.89', description: 'Other ill-defined heart diseases' },
      { code: 'I51.9', description: 'Heart disease, unspecified' },
      
      // ========== CEREBROVASCULAR DISEASES ==========
      { code: 'I63.9', description: 'Cerebral infarction, unspecified' },
      { code: 'I64', description: 'Stroke, not specified as hemorrhage or infarction' },
      { code: 'I65.29', description: 'Occlusion and stenosis of unspecified carotid artery' },
      { code: 'I66.9', description: 'Occlusion and stenosis of unspecified cerebral artery' },
      
      // ========== DISEASES OF ARTERIES, ARTERIOLES AND CAPILLARIES ==========
      { code: 'I70.0', description: 'Atherosclerosis of aorta' },
      { code: 'I70.1', description: 'Atherosclerosis of renal artery' },
      { code: 'I70.2', description: 'Atherosclerosis of native arteries of the extremities' },
      { code: 'I70.9', description: 'Generalized and unspecified atherosclerosis' },
      { code: 'I71.00', description: 'Dissection of unspecified site of aorta' },
      { code: 'I71.01', description: 'Dissection of thoracic aorta' },
      { code: 'I71.02', description: 'Dissection of abdominal aorta' },
      { code: 'I71.03', description: 'Dissection of thoracoabdominal aorta' },
      { code: 'I71.1', description: 'Thoracic aortic aneurysm, ruptured' },
      { code: 'I71.2', description: 'Thoracic aortic aneurysm, without rupture' },
      { code: 'I71.3', description: 'Abdominal aortic aneurysm, ruptured' },
      { code: 'I71.4', description: 'Abdominal aortic aneurysm, without rupture' },
      { code: 'I71.5', description: 'Thoracoabdominal aortic aneurysm, ruptured' },
      { code: 'I71.6', description: 'Thoracoabdominal aortic aneurysm, without rupture' },
      { code: 'I71.8', description: 'Aortic aneurysm of unspecified site, ruptured' },
      { code: 'I71.9', description: 'Aortic aneurysm of unspecified site, without rupture' },
      { code: 'I72.0', description: 'Aneurysm of carotid artery' },
      { code: 'I72.1', description: 'Aneurysm of artery of upper extremity' },
      { code: 'I72.2', description: 'Aneurysm of renal artery' },
      { code: 'I72.3', description: 'Aneurysm of iliac artery' },
      { code: 'I72.4', description: 'Aneurysm of artery of lower extremity' },
      { code: 'I72.8', description: 'Aneurysm of other specified arteries' },
      { code: 'I72.9', description: 'Aneurysm of unspecified site' },
      { code: 'I73.0', description: 'Raynaud syndrome' },
      { code: 'I73.00', description: 'Raynaud syndrome without gangrene' },
      { code: 'I73.01', description: 'Raynaud syndrome with gangrene' },
      { code: 'I73.1', description: 'Thromboangiitis obliterans [Buerger]' },
      { code: 'I73.81', description: 'Erythromelalgia' },
      { code: 'I73.89', description: 'Other specified peripheral vascular diseases' },
      { code: 'I73.9', description: 'Peripheral vascular disease, unspecified' },
      { code: 'I74.0', description: 'Embolism and thrombosis of abdominal aorta' },
      { code: 'I74.1', description: 'Embolism and thrombosis of thoracic aorta' },
      { code: 'I74.2', description: 'Embolism and thrombosis of arteries of upper extremities' },
      { code: 'I74.3', description: 'Embolism and thrombosis of arteries of lower extremities' },
      { code: 'I74.4', description: 'Embolism and thrombosis of arteries of extremities, unspecified' },
      { code: 'I74.5', description: 'Embolism and thrombosis of iliac artery' },
      { code: 'I74.8', description: 'Embolism and thrombosis of other arteries' },
      { code: 'I74.9', description: 'Embolism and thrombosis of unspecified artery' },
      { code: 'I77.0', description: 'Arteriovenous fistula, acquired' },
      { code: 'I77.1', description: 'Stricture of artery' },
      { code: 'I77.3', description: 'Arterial fibromuscular dysplasia' },
      { code: 'I77.6', description: 'Arteritis, unspecified' },
      { code: 'I77.89', description: 'Other specified disorders of arteries and arterioles' },
      { code: 'I77.9', description: 'Disorder of arteries and arterioles, unspecified' },
      { code: 'I78.0', description: 'Hereditary hemorrhagic telangiectasia' },
      { code: 'I78.9', description: 'Disease of capillaries, unspecified' },
      
      // ========== DISEASES OF VEINS, LYMPHATIC VESSELS AND LYMPH NODES ==========
      { code: 'I80.10', description: 'Phlebitis and thrombophlebitis of unspecified femoral vein' },
      { code: 'I80.11', description: 'Phlebitis and thrombophlebitis of right femoral vein' },
      { code: 'I80.12', description: 'Phlebitis and thrombophlebitis of left femoral vein' },
      { code: 'I80.13', description: 'Phlebitis and thrombophlebitis of bilateral femoral veins' },
      { code: 'I80.20', description: 'Phlebitis and thrombophlebitis of unspecified deep vessels of lower extremities' },
      { code: 'I80.21', description: 'Phlebitis and thrombophlebitis of right deep vessels of lower extremities' },
      { code: 'I80.22', description: 'Phlebitis and thrombophlebitis of left deep vessels of lower extremities' },
      { code: 'I80.23', description: 'Phlebitis and thrombophlebitis of bilateral deep vessels of lower extremities' },
      { code: 'I80.29', description: 'Phlebitis and thrombophlebitis of other deep vessels of lower extremities' },
      { code: 'I80.3', description: 'Phlebitis and thrombophlebitis of lower extremities, unspecified' },
      { code: 'I82.40', description: 'Acute embolism and thrombosis of unspecified deep veins of lower extremity' },
      { code: 'I82.41', description: 'Acute embolism and thrombosis of right deep veins of lower extremity' },
      { code: 'I82.42', description: 'Acute embolism and thrombosis of left deep veins of lower extremity' },
      { code: 'I82.43', description: 'Acute embolism and thrombosis of bilateral deep veins of lower extremity' },
      { code: 'I82.90', description: 'Acute embolism and thrombosis of unspecified vein' },
      { code: 'I82.91', description: 'Acute embolism and thrombosis of right vein' },
      { code: 'I82.92', description: 'Acute embolism and thrombosis of left vein' },
      { code: 'I82.93', description: 'Acute embolism and thrombosis of bilateral veins' },
      { code: 'I83.10', description: 'Varicose veins of unspecified lower extremity with inflammation' },
      { code: 'I83.11', description: 'Varicose veins of right lower extremity with inflammation' },
      { code: 'I83.12', description: 'Varicose veins of left lower extremity with inflammation' },
      { code: 'I83.13', description: 'Varicose veins of bilateral lower extremities with inflammation' },
      { code: 'I83.20', description: 'Varicose veins of unspecified lower extremity with both ulcer of unspecified site and inflammation' },
      { code: 'I83.90', description: 'Asymptomatic varicose veins of unspecified lower extremity' },
      { code: 'I87.0', description: 'Postthrombotic syndrome without complications' },
      { code: 'I87.1', description: 'Compression of vein' },
      { code: 'I87.2', description: 'Venous insufficiency (chronic) (peripheral)' },
      { code: 'I87.8', description: 'Other specified disorders of veins' },
      { code: 'I87.9', description: 'Disorder of vein, unspecified' },
      
      // ========== OTHER AND ILL-DEFINED DISORDERS OF CIRCULATORY SYSTEM ==========
      { code: 'I95.0', description: 'Idiopathic hypotension' },
      { code: 'I95.1', description: 'Orthostatic hypotension' },
      { code: 'I95.2', description: 'Hypotension due to drugs' },
      { code: 'I95.3', description: 'Hypotension of hemodialysis' },
      { code: 'I95.81', description: 'Postprocedural hypotension' },
      { code: 'I95.89', description: 'Other hypotension' },
      { code: 'I95.9', description: 'Hypotension, unspecified' },
      { code: 'I97.0', description: 'Postcardiotomy syndrome' },
      { code: 'I97.110', description: 'Postprocedural heart failure following cardiac surgery' },
      { code: 'I97.111', description: 'Postprocedural heart failure following other surgery' },
      { code: 'I97.120', description: 'Postprocedural cardiac insufficiency following cardiac surgery' },
      { code: 'I97.121', description: 'Postprocedural cardiac insufficiency following other surgery' },
      { code: 'I97.130', description: 'Postprocedural cardiac arrest following cardiac surgery' },
      { code: 'I97.131', description: 'Postprocedural cardiac arrest following other surgery' },
      { code: 'I97.190', description: 'Other postprocedural cardiac functional disturbances following cardiac surgery' },
      { code: 'I97.191', description: 'Other postprocedural cardiac functional disturbances following other surgery' },
      { code: 'I97.2', description: 'Postmastectomy lymphedema syndrome' },
      { code: 'I97.3', description: 'Postprocedural hypertension' },
      { code: 'I97.4', description: 'Intraoperative hemorrhage and hematoma of a circulatory system organ or structure complicating a procedure' },
      { code: 'I97.5', description: 'Postprocedural hemorrhage and hematoma of a circulatory system organ or structure complicating a procedure' },
      { code: 'I97.610', description: 'Intraoperative cardiac arrest during cardiac surgery' },
      { code: 'I97.611', description: 'Intraoperative cardiac arrest during other surgery' },
      { code: 'I97.620', description: 'Postprocedural cardiac arrest during cardiac surgery' },
      { code: 'I97.621', description: 'Postprocedural cardiac arrest during other surgery' },
      { code: 'I97.710', description: 'Accidental puncture and laceration of a circulatory system organ or structure during a circulatory system procedure' },
      { code: 'I97.711', description: 'Accidental puncture and laceration of a circulatory system organ or structure during other procedure' },
      { code: 'I97.790', description: 'Other intraoperative complications of circulatory system' },
      { code: 'I97.791', description: 'Other postprocedural complications of circulatory system' },
      { code: 'I97.810', description: 'Intraoperative cerebrovascular infarction during cardiac surgery' },
      { code: 'I97.811', description: 'Intraoperative cerebrovascular infarction during other surgery' },
      { code: 'I97.820', description: 'Postprocedural cerebrovascular infarction during cardiac surgery' },
      { code: 'I97.821', description: 'Postprocedural cerebrovascular infarction during other surgery' },
      { code: 'I97.89', description: 'Other intraoperative and postprocedural complications and disorders of circulatory system, not elsewhere classified' },
      { code: 'I97.9', description: 'Unspecified intraoperative and postprocedural complication and disorder of circulatory system' },
      { code: 'I99', description: 'Other and unspecified disorders of circulatory system' },
      
      // ========== SYMPTOMS AND SIGNS ==========
      { code: 'R00.0', description: 'Tachycardia, unspecified' },
      { code: 'R00.1', description: 'Bradycardia, unspecified' },
      { code: 'R00.2', description: 'Palpitations' },
      { code: 'R06.00', description: 'Dyspnea, unspecified' },
      { code: 'R06.02', description: 'Shortness of breath' },
      { code: 'R06.03', description: 'Acute respiratory distress' },
      { code: 'R06.09', description: 'Other abnormalities of breathing' },
      { code: 'R50.9', description: 'Fever, unspecified' },
      { code: 'R51', description: 'Headache' },
      { code: 'R53.83', description: 'Other fatigue' },
      { code: 'R55', description: 'Syncope and collapse' },
      { code: 'R57.0', description: 'Cardiogenic shock' },
      { code: 'R94.31', description: 'Abnormal electrocardiogram [ECG] [EKG]' },
      
      // ========== ENCOUNTERS FOR EXAMINATION ==========
      { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' },
      { code: 'Z00.01', description: 'Encounter for general adult medical examination with abnormal findings' },
      { code: 'Z13.6', description: 'Encounter for screening for cardiovascular disorders' },
      { code: 'Z51.11', description: 'Encounter for antineoplastic chemotherapy' },
      { code: 'Z95.1', description: 'Presence of aortocoronary bypass graft' },
      { code: 'Z95.2', description: 'Presence of prosthetic heart valve' },
      { code: 'Z95.3', description: 'Presence of xenogenic heart valve' },
      { code: 'Z95.4', description: 'Presence of other heart-valve replacement' },
      { code: 'Z95.5', description: 'Presence of coronary angioplasty implant and graft' },
      { code: 'Z95.811', description: 'Presence of right artificial heart' },
      { code: 'Z95.812', description: 'Presence of left artificial heart' },
      { code: 'Z95.813', description: 'Presence of biventricular artificial heart' },
      { code: 'Z95.818', description: 'Presence of other cardiac implants and grafts' },
      { code: 'Z95.819', description: 'Presence of unspecified cardiac implant and graft' },
      { code: 'Z98.61', description: 'Personal history of cardiac arrest' },
      { code: 'Z98.84', description: 'Personal history of cardiac surgery' },
    ];

    let results = commonCodes;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      results = commonCodes.filter(c => 
        c.code.toLowerCase().includes(searchLower) || 
        c.description.toLowerCase().includes(searchLower)
      );
    }

    // Return up to limit (default 50, but allow more for comprehensive search)
    const resultLimit = parseInt(limit) || 50;
    res.json(results.slice(0, resultLimit));
  } catch (error) {
    console.error('ICD-10 lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup ICD-10 codes' });
  }
});

// CPT code lookup - Enhanced with database support
router.get('/cpt', async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    
    // First, try database if cpt_codes table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'cpt_codes'
        );
      `);

      if (tableCheck.rows[0].exists && search) {
        // Use database search with full-text search
        const result = await pool.query(`
          SELECT code, description, category, medicare_fee, active
          FROM cpt_codes
          WHERE search_vector @@ plainto_tsquery('english', $1)
             OR code ILIKE $2
             OR description ILIKE $2
          ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC,
                   CASE WHEN code ILIKE $2 THEN 1 ELSE 2 END
          LIMIT $3
        `, [search, `%${search}%`, parseInt(limit)]);

        if (result.rows.length > 0) {
          return res.json(result.rows.map(row => ({
            code: row.code,
            description: row.description,
            category: row.category,
            medicareFee: row.medicare_fee,
            active: row.active
          })));
        }
      }
    } catch (dbError) {
      console.warn('Database search failed, using fallback:', dbError.message);
      // Fall through to hardcoded codes
    }
    
    // Fallback to hardcoded common codes
    const commonCodes = [
      { code: '99213', description: 'Office or other outpatient visit, established patient' },
      { code: '99214', description: 'Office or other outpatient visit, established patient, detailed' },
      { code: '99215', description: 'Office or other outpatient visit, established patient, comprehensive' },
      { code: '99203', description: 'Office or other outpatient visit, new patient' },
      { code: '99204', description: 'Office or other outpatient visit, new patient, detailed' },
      { code: '99205', description: 'Office or other outpatient visit, new patient, comprehensive' },
      { code: '85025', description: 'Complete blood count (CBC)' },
      { code: '80053', description: 'Comprehensive metabolic panel' },
      { code: '80061', description: 'Lipid panel' },
    ];

    let results = commonCodes;
    if (search) {
      const searchLower = search.toLowerCase();
      results = commonCodes.filter(c => 
        c.code.toLowerCase().includes(searchLower) || 
        c.description.toLowerCase().includes(searchLower)
      );
    }

    res.json(results.slice(0, 50));
  } catch (error) {
    console.error('CPT lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup CPT codes' });
  }
});

module.exports = router;


