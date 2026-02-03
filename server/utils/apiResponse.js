/**
 * API Response Utilities
 * 
 * Standard response formatting for the commercial API platform
 */

const crypto = require('crypto');

/**
 * Generate a unique request ID
 */
function generateRequestId() {
    return 'req_' + crypto.randomBytes(12).toString('base64url');
}

/**
 * Standard success response
 */
function success(res, data, statusCode = 200) {
    const response = {
        data,
        request_id: res.requestId
    };
    return res.status(statusCode).json(response);
}

/**
 * Standard success response with pagination
 */
function successWithPagination(res, data, pagination, statusCode = 200) {
    const response = {
        data,
        pagination,
        request_id: res.requestId
    };
    return res.status(statusCode).json(response);
}

/**
 * Standard error response
 * 
 * @param {Object} res - Express response object
 * @param {string} code - Error code (e.g., 'invalid_request', 'not_found')
 * @param {string} message - Human readable error message
 * @param {number} statusCode - HTTP status code
 * @param {Array} details - Optional field-level error details
 */
function error(res, code, message, statusCode = 400, details = null) {
    const response = {
        error: {
            code,
            message,
            request_id: res.requestId || res.req?.requestId
        }
    };

    if (details && details.length > 0) {
        response.error.details = details;
    }

    return res.status(statusCode).json(response);
}

/**
 * Not found error
 */
function notFound(res, resource = 'Resource') {
    return error(res, 'not_found', `${resource} not found`, 404);
}

/**
 * Validation error with field details
 */
function validationError(res, message, fieldErrors) {
    const details = fieldErrors.map(fe => ({
        field: fe.field,
        issue: fe.issue || fe.message
    }));
    return error(res, 'validation_error', message, 400, details);
}

/**
 * Unauthorized error
 */
function unauthorized(res, message = 'Authentication required') {
    return error(res, 'unauthorized', message, 401);
}

/**
 * Forbidden error
 */
function forbidden(res, message = 'Access denied') {
    return error(res, 'forbidden', message, 403);
}

/**
 * Rate limit exceeded error
 */
function rateLimited(res, retryAfter = 60) {
    res.set('Retry-After', retryAfter);
    return error(res, 'rate_limit_exceeded', 'Too many requests. Please retry later.', 429);
}

/**
 * Internal server error
 */
function serverError(res, message = 'An internal error occurred') {
    return error(res, 'internal_error', message, 500);
}

/**
 * Request ID middleware
 * Attaches or generates X-Request-Id for request correlation
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    req.requestId = requestId;
    res.requestId = requestId;
    res.set('X-Request-Id', requestId);
    next();
}

/**
 * Cursor-based pagination helper
 * 
 * @param {Array} items - Array of items to paginate
 * @param {string} cursorField - Field to use for cursor (e.g., 'id', 'created_at')
 * @param {number} limit - Max items per page
 * @param {string} cursor - Current cursor value
 * @returns {Object} { data, pagination }
 */
function paginateWithCursor(items, cursorField, limit, cursor = null) {
    let filteredItems = items;

    // If cursor provided, find items after cursor
    if (cursor) {
        const cursorIndex = items.findIndex(item => String(item[cursorField]) === cursor);
        if (cursorIndex >= 0) {
            filteredItems = items.slice(cursorIndex + 1);
        }
    }

    const hasMore = filteredItems.length > limit;
    const pageItems = filteredItems.slice(0, limit);
    const nextCursor = hasMore && pageItems.length > 0
        ? String(pageItems[pageItems.length - 1][cursorField])
        : null;

    return {
        data: pageItems,
        pagination: {
            limit,
            has_more: hasMore,
            next_cursor: nextCursor
        }
    };
}

/**
 * Build SQL cursor condition
 * 
 * @param {string} cursor - Base64 encoded cursor
 * @param {string} field - Database field for cursor
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Object} { condition, value }
 */
function buildCursorCondition(cursor, field = 'created_at', direction = 'desc') {
    if (!cursor) {
        return { condition: '', value: null };
    }

    try {
        const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
        const operator = direction === 'desc' ? '<' : '>';
        return {
            condition: `${field} ${operator} $CURSOR_PARAM`,
            value: decoded
        };
    } catch (e) {
        return { condition: '', value: null };
    }
}

/**
 * Encode cursor value
 */
function encodeCursor(value) {
    if (!value) return null;
    return Buffer.from(String(value), 'utf-8').toString('base64url');
}

/**
 * Parse updated_since filter
 */
function parseUpdatedSince(updatedSince) {
    if (!updatedSince) return null;

    const date = new Date(updatedSince);
    if (isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}

module.exports = {
    generateRequestId,
    success,
    successWithPagination,
    error,
    notFound,
    validationError,
    unauthorized,
    forbidden,
    rateLimited,
    serverError,
    requestIdMiddleware,
    paginateWithCursor,
    buildCursorCondition,
    encodeCursor,
    parseUpdatedSince
};
