/**
 * Session Service
 * 
 * HIPAA-compliant session management with Redis
 * Supports inactivity timeout (15 min) and absolute timeout (12 hours)
 */

const redis = require('redis');
const crypto = require('crypto');
const pool = require('../db');

// Redis client (singleton)
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });
    
    // Connect if not already connected
    if (!redisClient.isOpen) {
      redisClient.connect().catch(console.error);
    }
  }
  return redisClient;
};

class SessionService {
  /**
   * Create new session
   * @param {string} userId - User ID
   * @param {string} ipAddress - IP address
   * @param {string} userAgent - User agent string
   * @returns {Promise<{sessionId: string, expiresAt: Date}>}
   */
  async createSession(userId, ipAddress, userAgent) {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const inactivityTimeout = 15 * 60 * 1000; // 15 minutes
    const absoluteTimeout = 12 * 60 * 60 * 1000; // 12 hours
    const expiresAt = new Date(now + absoluteTimeout);
    
    const sessionData = {
      userId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: expiresAt.getTime(),
      mfaVerified: false
    };
    
    try {
      const client = getRedisClient();
      
      // Store in Redis with absolute timeout
      await client.setEx(
        `session:${sessionId}`,
        Math.floor(absoluteTimeout / 1000), // Redis TTL in seconds
        JSON.stringify(sessionData)
      );
      
      // Also store in database for audit trail
      await pool.query(`
        INSERT INTO sessions (user_id, session_id, ip_address, user_agent, expires_at, last_activity)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [userId, sessionId, ipAddress, userAgent, expiresAt]);
      
      return { sessionId, expiresAt };
    } catch (error) {
      console.error('Session creation error:', error);
      // Fallback to database-only if Redis fails
      const result = await pool.query(`
        INSERT INTO sessions (user_id, session_id, ip_address, user_agent, expires_at, last_activity)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING session_id, expires_at
      `, [userId, sessionId, ipAddress, userAgent, expiresAt]);
      
      return {
        sessionId: result.rows[0].session_id,
        expiresAt: result.rows[0].expires_at
      };
    }
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<object|null>} Session data or null if not found/expired
   */
  async getSession(sessionId) {
    if (!sessionId) return null;
    
    try {
      const client = getRedisClient();
      const sessionData = await client.get(`session:${sessionId}`);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        const now = Date.now();
        const inactivityTimeout = 15 * 60 * 1000; // 15 minutes
        
        // Check inactivity timeout
        if (now - session.lastActivity > inactivityTimeout) {
          await this.destroySession(sessionId);
          return null;
        }
        
        // Check absolute timeout
        if (now > session.expiresAt) {
          await this.destroySession(sessionId);
          return null;
        }
        
        return session;
      }
    } catch (error) {
      console.error('Redis session get error:', error);
    }
    
    // Fallback to database
    try {
      const result = await pool.query(`
        SELECT user_id, ip_address, user_agent, expires_at, last_activity, mfa_verified
        FROM sessions
        WHERE session_id = $1 AND expires_at > CURRENT_TIMESTAMP
      `, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const session = result.rows[0];
      const now = Date.now();
      const lastActivity = new Date(session.last_activity).getTime();
      const inactivityTimeout = 15 * 60 * 1000;
      
      if (now - lastActivity > inactivityTimeout) {
        await this.destroySession(sessionId);
        return null;
      }
      
      return {
        userId: session.user_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        lastActivity: lastActivity,
        expiresAt: new Date(session.expires_at).getTime(),
        mfaVerified: session.mfa_verified
      };
    } catch (error) {
      console.error('Database session get error:', error);
      return null;
    }
  }

  /**
   * Update session activity (reset inactivity timer)
   * @param {string} sessionId - Session ID
   * @returns {Promise<boolean>} True if session was updated
   */
  async updateActivity(sessionId) {
    if (!sessionId) return false;
    
    const now = Date.now();
    
    try {
      const client = getRedisClient();
      const sessionData = await client.get(`session:${sessionId}`);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.lastActivity = now;
        
        // Update Redis with remaining TTL
        const remainingTTL = Math.floor((session.expiresAt - now) / 1000);
        if (remainingTTL > 0) {
          await client.setEx(`session:${sessionId}`, remainingTTL, JSON.stringify(session));
        }
      }
    } catch (error) {
      console.error('Redis session update error:', error);
    }
    
    // Also update database
    try {
      await pool.query(`
        UPDATE sessions
        SET last_activity = CURRENT_TIMESTAMP
        WHERE session_id = $1 AND expires_at > CURRENT_TIMESTAMP
      `, [sessionId]);
      return true;
    } catch (error) {
      console.error('Database session update error:', error);
      return false;
    }
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async destroySession(sessionId) {
    if (!sessionId) return;
    
    try {
      const client = getRedisClient();
      await client.del(`session:${sessionId}`);
    } catch (error) {
      console.error('Redis session destroy error:', error);
    }
    
    try {
      await pool.query(`
        UPDATE sessions
        SET expires_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
      `, [sessionId]);
    } catch (error) {
      console.error('Database session destroy error:', error);
    }
  }

  /**
   * Mark MFA as verified for session
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async markMFAVerified(sessionId) {
    if (!sessionId) return;
    
    try {
      const client = getRedisClient();
      const sessionData = await client.get(`session:${sessionId}`);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        session.mfaVerified = true;
        const remainingTTL = Math.floor((session.expiresAt - Date.now()) / 1000);
        if (remainingTTL > 0) {
          await client.setEx(`session:${sessionId}`, remainingTTL, JSON.stringify(session));
        }
      }
    } catch (error) {
      console.error('Redis MFA mark error:', error);
    }
    
    try {
      await pool.query(`
        UPDATE sessions
        SET mfa_verified = true
        WHERE session_id = $1
      `, [sessionId]);
    } catch (error) {
      console.error('Database MFA mark error:', error);
    }
  }

  /**
   * Cleanup expired sessions (run periodically)
   * @returns {Promise<number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      const result = await pool.query(`
        DELETE FROM sessions
        WHERE expires_at < CURRENT_TIMESTAMP
        RETURNING session_id
      `);
      
      // Also clean Redis (it should auto-expire, but clean explicitly)
      if (result.rows.length > 0) {
        const client = getRedisClient();
        for (const row of result.rows) {
          await client.del(`session:${row.session_id}`);
        }
      }
      
      return result.rows.length;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }
}

module.exports = new SessionService();





















