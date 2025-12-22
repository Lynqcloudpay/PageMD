const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all ordersets (with optional filtering)
router.get('/', async (req, res) => {
  try {
    const { specialty, category, search, tags } = req.query;
    const userId = req.user?.id;

    let query = 'SELECT * FROM ordersets WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (specialty) {
      query += ` AND specialty = $${paramIndex}`;
      params.push(specialty);
      paramIndex++;
    }

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query += ` AND tags && $${paramIndex}::text[]`;
      params.push(tagArray);
      paramIndex++;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);

    // Get user's favorites if logged in
    let favoriteIds = new Set();
    if (userId) {
      try {
        const favoritesResult = await pool.query(
          'SELECT favorite_id FROM favorites WHERE user_id = $1 AND favorite_type = $2',
          [userId, 'orderset']
        );
        favoriteIds = new Set(favoritesResult.rows.map(row => String(row.favorite_id)));
      } catch (favError) {
        console.warn('Error fetching favorites:', favError);
      }
    }

    // Parse JSONB orders field and add isFavorite flag
    const ordersets = result.rows.map(row => ({
      ...row,
      orders: typeof row.orders === 'string' ? JSON.parse(row.orders) : row.orders,
      isFavorite: favoriteIds.has(String(row.id))
    }));

    res.json(ordersets);
  } catch (error) {
    console.error('Error fetching ordersets:', error);
    res.status(500).json({ error: 'Failed to fetch ordersets' });
  }
});

// Create new orderset
router.post('/', requireRole('clinician'), async (req, res) => {
  try {
    console.log('📝 Creating orderset:', {
      name: req.body?.name,
      ordersCount: req.body?.orders?.length || 0,
      userId: req.user?.id
    });
    const { name, description, specialty, category, orders, tags } = req.body;
    const userId = req.user?.id;

    // Validate required fields
    if (!name || !name.trim()) {
      console.warn('❌ Orderset creation failed: Missing name');
      return res.status(400).json({ error: 'Orderset name is required' });
    }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      console.warn('❌ Orderset creation failed: Missing or empty orders array');
      return res.status(400).json({ error: 'At least one order is required' });
    }

    // Validate order structure
    const allowedOrderTypes = ['lab', 'imaging', 'rx', 'referral', 'procedure', 'prescription', 'other'];
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (!order.type || !allowedOrderTypes.includes(order.type)) {
        console.warn(`❌ Orderset creation failed: Invalid order type at index ${i}:`, order.type);
        return res.status(400).json({ error: `Invalid order type: ${order.type}. Must be one of: ${allowedOrderTypes.join(', ')}` });
      }
      if (!order.payload) {
        console.warn(`❌ Orderset creation failed: Missing payload at index ${i}`);
        return res.status(400).json({ error: 'Each order must have a payload' });
      }
    }

    // Insert new orderset
    const result = await pool.query(
      `INSERT INTO ordersets (name, description, specialty, category, orders, tags, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [
        name.trim(),
        description?.trim() || null,
        specialty || 'cardiology',
        category || 'general',
        JSON.stringify(orders),
        tags && Array.isArray(tags) ? tags : [],
        userId
      ]
    );

    const orderset = result.rows[0];
    orderset.orders = typeof orderset.orders === 'string' ? JSON.parse(orderset.orders) : orderset.orders;

    res.status(201).json(orderset);
  } catch (error) {
    console.error('❌ Error creating orderset:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      stack: error.stack
    });
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'An orderset with this name already exists' });
    }
    res.status(500).json({
      error: 'Failed to create orderset',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      } : undefined
    });
  }
});

// Add/remove orderset favorite - MUST come before /:id route
// Using explicit path to ensure it matches correctly
router.post('/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    console.log('[FAVORITE ROUTE] Hit:', {
      id,
      userId,
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      route: req.route?.path
    });

    if (!userId) {
      console.log('[FAVORITE ROUTE] No user ID');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if already favorited
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND favorite_type = $2 AND favorite_id = $3',
      [userId, 'orderset', id]
    );

    if (existing.rows.length > 0) {
      // Remove favorite
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND favorite_type = $2 AND favorite_id = $3',
        [userId, 'orderset', id]
      );
      res.json({ isFavorite: false });
    } else {
      // Add favorite
      await pool.query(
        'INSERT INTO favorites (user_id, favorite_type, favorite_id) VALUES ($1, $2, $3)',
        [userId, 'orderset', id]
      );
      res.json({ isFavorite: true });
    }
  } catch (error) {
    console.error('Error toggling orderset favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Apply orderset - creates multiple orders from orderset
router.post('/:id/apply', requireRole('clinician'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { patientId, visitId, diagnosisIds = [] } = req.body;

    // Get orderset
    const ordersetResult = await client.query(
      'SELECT * FROM ordersets WHERE id = $1 AND is_active = true',
      [id]
    );

    if (ordersetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orderset not found' });
    }

    const orderset = ordersetResult.rows[0];
    const orders = typeof orderset.orders === 'string' ? JSON.parse(orderset.orders) : orderset.orders;

    console.log(`Applying orderset "${orderset.name}" (ID: ${id})`);
    console.log(`Orderset has ${Array.isArray(orders) ? orders.length : 0} orders`);

    if (!Array.isArray(orders) || orders.length === 0) {
      await client.query('ROLLBACK');
      console.error(`Orderset ${id} has no orders or invalid orders structure`);
      return res.status(400).json({ error: 'Orderset has no orders' });
    }

    // Validate required fields
    if (!patientId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    // Create orders from orderset
    const createdOrders = [];
    const skippedOrders = [];
    const allowedOrderTypes = ['lab', 'imaging', 'rx', 'referral', 'procedure', 'prescription'];

    for (const orderTemplate of orders) {
      try {
        const orderType = orderTemplate.type;

        if (!orderType) {
          console.warn(`Skipping order with no type:`, JSON.stringify(orderTemplate));
          skippedOrders.push({ reason: 'No order type', order: orderTemplate });
          continue;
        }

        if (!allowedOrderTypes.includes(orderType)) {
          console.warn(`Skipping invalid order type: ${orderType}`, JSON.stringify(orderTemplate));
          skippedOrders.push({ reason: `Invalid order type: ${orderType}`, order: orderTemplate });
          continue;
        }

        // Create order
        const orderResult = await client.query(`
          INSERT INTO orders (patient_id, visit_id, order_type, ordered_by, order_payload)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [
          patientId,
          visitId || null,
          orderType,
          req.user.id,
          orderTemplate.payload || {}
        ]);

        const order = orderResult.rows[0];

        // Link diagnoses if provided
        if (diagnosisIds && diagnosisIds.length > 0) {
          for (const problemId of diagnosisIds) {
            try {
              await client.query(`
                INSERT INTO order_diagnoses (order_id, problem_id, order_type)
                VALUES ($1, $2, $3)
                ON CONFLICT (order_id, problem_id, order_type) DO NOTHING
              `, [order.id, problemId, orderType]);
            } catch (diagError) {
              console.warn(`Error linking diagnosis ${problemId} to order ${order.id}:`, diagError.message);
            }
          }
        }

        createdOrders.push(order);
      } catch (orderError) {
        console.error(`Error creating order from orderset:`, orderError);
        console.error(`Failed order template:`, JSON.stringify(orderTemplate));
        skippedOrders.push({ reason: orderError.message, order: orderTemplate });
        // Continue with next order
      }
    }

    if (createdOrders.length === 0) {
      await client.query('ROLLBACK');
      console.error(`No orders were created for orderset ${id}. Skipped: ${skippedOrders.length}`);
      return res.status(400).json({
        error: 'No orders could be created from this orderset',
        details: skippedOrders.length > 0 ? `Skipped ${skippedOrders.length} orders: ${skippedOrders.map(s => s.reason).join(', ')}` : 'All orders failed validation'
      });
    }

    await client.query('COMMIT');

    console.log(`Successfully created ${createdOrders.length} orders from orderset "${orderset.name}"`);
    if (skippedOrders.length > 0) {
      console.warn(`Skipped ${skippedOrders.length} orders:`, skippedOrders.map(s => s.reason).join(', '));
    }

    res.json({
      success: true,
      orderset: orderset.name,
      ordersCreated: createdOrders.length,
      ordersSkipped: skippedOrders.length,
      orders: createdOrders
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying orderset:', error);
    res.status(500).json({ error: 'Failed to apply orderset' });
  } finally {
    client.release();
  }
});

// Get single orderset by ID - MUST come after specific routes like /:id/favorite
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ordersets WHERE id = $1 AND is_active = true', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orderset not found' });
    }

    const orderset = result.rows[0];
    orderset.orders = typeof orderset.orders === 'string' ? JSON.parse(orderset.orders) : orderset.orders;

    res.json(orderset);
  } catch (error) {
    console.error('Error fetching orderset:', error);
    res.status(500).json({ error: 'Failed to fetch orderset' });
  }
});

module.exports = router;


