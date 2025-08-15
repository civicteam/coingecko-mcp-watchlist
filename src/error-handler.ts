/**
 * Error Handling Utilities for Crypto Watchlist MCP Server
 * Provides standardized error responses and handling
 */

import { WatchlistError, ErrorResponse, ErrorCode } from './types.js';

// ============================================================================
// ERROR HANDLER FUNCTIONS
// ============================================================================

export function createErrorResponse(error: WatchlistError | Error): ErrorResponse {
  if (error instanceof WatchlistError) {
    return {
      error: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  // Handle standard JavaScript errors
  console.error('Unexpected error:', error);
  
  return {
    error: 'InternalError',
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  };
}

export function handleMcpError(error: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  const errorResponse = error instanceof Error 
    ? createErrorResponse(error) 
    : createErrorResponse(new Error('Unknown error occurred'));

  return {
    content: [{
      type: "text",
      text: JSON.stringify(errorResponse, null, 2)
    }]
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateRequiredParam(value: any, paramName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} is required`);
  }
}

export function validateStringParam(value: any, paramName: string, maxLength?: number): string {
  validateRequiredParam(value, paramName);
  
  if (typeof value !== 'string') {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} cannot be empty`);
  }

  if (maxLength && trimmed.length > maxLength) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

export function validateNumberParam(value: any, paramName: string, options?: {
  min?: number;
  max?: number;
  allowZero?: boolean;
  required?: boolean;
}): number | undefined {
  const { min, max, allowZero = false, required = true } = options || {};

  if (value === undefined || value === null) {
    if (required) {
      throw new WatchlistError('VALIDATION_ERROR', `${paramName} is required`);
    }
    return undefined;
  }

  const num = Number(value);
  if (!isFinite(num)) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be a valid number`);
  }

  if (!allowZero && num <= 0) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be greater than zero`);
  }

  if (min !== undefined && num < min) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be at least ${min}`);
  }

  if (max !== undefined && num > max) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be at most ${max}`);
  }

  return num;
}

export function validateBooleanParam(value: any, paramName: string, required = false): boolean | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new WatchlistError('VALIDATION_ERROR', `${paramName} is required`);
    }
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }

  throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be a boolean value`);
}

export function validateArrayParam<T>(
  value: any, 
  paramName: string, 
  validator: (item: any, index: number) => T,
  maxLength?: number,
  required = false
): T[] | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new WatchlistError('VALIDATION_ERROR', `${paramName} is required`);
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} must be an array`);
  }

  if (maxLength && value.length > maxLength) {
    throw new WatchlistError('VALIDATION_ERROR', `${paramName} cannot have more than ${maxLength} items`);
  }

  try {
    return value.map(validator);
  } catch (error) {
    if (error instanceof WatchlistError) {
      throw new WatchlistError(
        error.code,
        `Invalid ${paramName}: ${error.message}`,
        error.details
      );
    }
    throw error;
  }
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

export function extractUserId(authInfo: any): string {
  if (!authInfo?.extra?.sub) {
    throw new WatchlistError('UNAUTHORIZED', 'User authentication required');
  }
  return authInfo.extra.sub as string;
}

export function extractUserEmail(authInfo: any): string | undefined {
  return authInfo?.extra?.email as string | undefined;
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  userId: string, 
  action: string, 
  limit: number, 
  windowMs: number
): void {
  const key = `${userId}:${action}`;
  const now = Date.now();
  
  let record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, record);
  }
  
  record.count++;
  
  if (record.count > limit) {
    const resetIn = Math.ceil((record.resetTime - now) / 1000);
    throw new WatchlistError(
      'RATE_LIMITED', 
      `Rate limit exceeded for ${action}. Try again in ${resetIn} seconds.`,
      { limit, windowMs, resetIn }
    );
  }
}

// Cleanup expired rate limit records
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

// ============================================================================
// COMMON ERROR FACTORIES
// ============================================================================

export const Errors = {
  unauthorized: (message = 'Authentication required') => 
    new WatchlistError('UNAUTHORIZED', message),
    
  notFound: (resource: string, id?: string) => 
    new WatchlistError('NOT_FOUND', `${resource}${id ? ` with id ${id}` : ''} not found`),
    
  forbidden: (message = 'Access denied') => 
    new WatchlistError('FORBIDDEN', message),
    
  validation: (message: string, details?: any) => 
    new WatchlistError('VALIDATION_ERROR', message, details),
    
  rateLimited: (message = 'Rate limit exceeded') => 
    new WatchlistError('RATE_LIMITED', message),
    
  internal: (message = 'Internal server error') => 
    new WatchlistError('INTERNAL_ERROR', message),
};

// ============================================================================
// ASYNC ERROR WRAPPER
// ============================================================================

export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof WatchlistError) {
        throw error;
      }
      
      console.error('Unexpected async error:', error);
      throw new WatchlistError(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        process.env.NODE_ENV === 'development' ? error : undefined
      );
    }
  };
}

