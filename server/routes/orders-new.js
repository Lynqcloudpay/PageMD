// Create order - IMPROVED VERSION
router.post('/', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();
  
  // --- helpers ---
  const normalizeOrderType = (t) => {
    if (!t) return t;
    const v = String(t).toLowerCase().trim();
    // keep DB consistent: store/link prescriptions as "prescription"
    if (v === 'rx') return 'prescription';
    return v;
  };

  const toCleanString = (v) => (v == null ? '' : String(v).trim());

  // Upsert a "problem" for a diagnosis object and return problem_id
  const upsertProblemFromDiagnosis = async (patientId, d) => {
    const name =
      toCleanString(d?.problem_name) ||
      toCleanString(d?.name) ||
      toCleanString(d?.label);

    const icd10 =
      toCleanString(d?.icd10_code) ||
      toCleanString(d?.icd10Code) ||
      null;

    if (!name) return null;

    // 1) Try match by ICD10 (best)
    if (icd10) {
      const byCode = await client.query(
        `SELECT id
         FROM problems
         WHERE patient_id = $1 AND icd10_code = $2 AND status = 'active'
         ORDER BY date_identified DESC
         LIMIT 1`,
        [patientId, icd10]
      );
      if (byCode.rows[0]?.id) return byCode.rows[0].id;
    }

    // 2) Try match by name
    const byName = await client.query(
      `SELECT id
       FROM problems
       WHERE patient_id = $1 AND (problem_name = $2 OR name = $2) AND status = 'active'
       ORDER BY date_identified DESC
       LIMIT 1`,
      [patientId, name]
    );
    if (byName.rows[0]?.id) return byName.rows[0].id;

    // 3) Create new
    const created = await client.query(
      `INSERT INTO problems (patient_id, problem_name, icd10_code, status, date_identified)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
       RETURNING id`,
      [patientId, name, icd10]
    );
    return created.rows[0]?.id || null;
  };

  try {
    await client.query('BEGIN');

    const patientId = req.body?.patientId;
    const visitId = req.body?.visitId || null;
    const orderTypeRaw = req.body?.orderType;
    const orderType = normalizeOrderType(orderTypeRaw);
    const orderPayload = req.body?.orderPayload;
    const diagnosisIds = Array.isArray(req.body?.diagnosisIds) ? req.body.diagnosisIds : [];
    const diagnosisObjects = Array.isArray(req.body?.diagnosisObjects) ? req.body.diagnosisObjects : [];

    // Validate required fields
    if (!patientId) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    if (!orderType) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({ error: 'Order type is required' });
    }

    const allowedOrderTypes = ['lab', 'imaging', 'prescription', 'referral', 'procedure'];
    if (!allowedOrderTypes.includes(orderType)) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: `Invalid order type: ${orderTypeRaw}. Must be one of: ${allowedOrderTypes.join(', ')}`
      });
    }

    // ✅ IMPORTANT FIX: allow diagnosisObjects as satisfying diagnosis requirement
    if ((diagnosisIds.length === 0) && (diagnosisObjects.length === 0)) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: 'At least one diagnosis is required (diagnosisIds or diagnosisObjects).'
      });
    }

    if (!req.user?.id) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Ensure payload is object (JSONB)
    let payloadValue = null;
    if (orderPayload != null) {
      if (typeof orderPayload === 'string') {
        try {
          payloadValue = JSON.parse(orderPayload);
        } catch {
          payloadValue = orderPayload;
        }
      } else {
        payloadValue = orderPayload;
      }
    }

    // Create the order
    const orderInsert = await client.query(
      `INSERT INTO orders (patient_id, visit_id, order_type, ordered_by, order_payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [patientId, visitId, orderType, req.user.id, payloadValue]
    );
    const order = orderInsert.rows[0];

    // ---- Resolve diagnoses to real problems.id ----
    const problemIds = new Set();
    const invalidDiagnosisIds = [];

    // 1) If diagnosisObjects provided, upsert problems for them (most reliable)
    for (const d of diagnosisObjects) {
      const pid = await upsertProblemFromDiagnosis(patientId, d);
      if (pid) problemIds.add(String(pid));
    }

    // 2) Also accept "real" problem IDs from diagnosisIds (ignore temp ids safely)
    for (const rawId of diagnosisIds) {
      if (!rawId) continue;
      const idStr = String(rawId);

      // Skip temp IDs (we handled via diagnosisObjects already)
      if (idStr.startsWith('temp-') || idStr.startsWith('assessment-')) continue;

      const check = await client.query(
        `SELECT id
         FROM problems
         WHERE id = $1 AND patient_id = $2`,
        [rawId, patientId]
      );

      if (check.rows[0]?.id) {
        problemIds.add(String(check.rows[0].id));
      } else {
        invalidDiagnosisIds.push(idStr);
      }
    }

    // ✅ If still nothing, throw the same error but now you'll know WHY
    if (problemIds.size === 0) {
      await client.query('ROLLBACK').catch(() => {});
      return res.status(400).json({
        error: 'At least one valid diagnosis is required. The provided diagnosis IDs are invalid or do not exist in the database.',
        details: process.env.NODE_ENV === 'development'
          ? { patientId, orderType, diagnosisIds, diagnosisObjectsCount: diagnosisObjects.length, invalidDiagnosisIds }
          : undefined
      });
    }

    // Link order_diagnoses
    for (const pid of problemIds) {
      await client.query(
        `INSERT INTO order_diagnoses (order_id, problem_id, order_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (order_id, problem_id, order_type) DO NOTHING`,
        [order.id, pid, orderType]
      );
    }

    await client.query('COMMIT');

    // Return order with diagnoses
    const diagnosesResult = await pool.query(
      `SELECT pr.id, pr.problem_name, pr.name, pr.icd10_code
       FROM order_diagnoses od
       JOIN problems pr ON od.problem_id = pr.id
       WHERE od.order_id = $1 AND od.order_type = $2`,
      [order.id, orderType]
    );

    // Non-blocking audit
    try {
      await logAudit(req.user.id, 'create_order', 'order', order.id, { orderType, diagnosisCount: problemIds.size }, req.ip);
    } catch {}

    return res.status(201).json({
      ...order,
      diagnoses: diagnosesResult.rows.map(d => ({
        id: d.id,
        name: d.problem_name || d.name,
        icd10Code: d.icd10_code
      }))
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error creating order:', error);
    return res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
      details: (process.env.NODE_ENV === 'development') ? {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      } : undefined
    });
  } finally {
    client.release();
  }
});




