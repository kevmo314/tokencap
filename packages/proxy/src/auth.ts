/**
 * Authentication Module
 * Handles user registration, login, API key validation, and session management
 * MIT License
 */

import bcrypt from 'bcrypt';
import type { Context, Next } from 'hono';
import type {
  User,
  ApiKey,
  Session,
  AuthContext,
  Plan,
  PLAN_LIMITS,
} from './types.js';
import {
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSessionByToken,
  deleteSession,
  createApiKey,
  getApiKeyByKey,
  getApiKeysByUserId,
  revokeApiKey,
  updateApiKeyLastUsed,
  getMonthlyRequestCount,
  countUserProjects,
  createProject,
} from './db.js';
import { PLAN_LIMITS as PlanLimits } from './types.js';

// Number of bcrypt salt rounds
const SALT_ROUNDS = 12;

// Minimum password length
const MIN_PASSWORD_LENGTH = 8;

// ============================================================================
// Password Operations
// ============================================================================

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; message?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: 'Invalid email format',
    };
  }
  return { valid: true };
}

// ============================================================================
// User Registration and Login
// ============================================================================

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  // Validate email
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.message };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.message };
  }

  // Check if user already exists
  const existingUser = getUserByEmail(email);
  if (existingUser) {
    return { success: false, error: 'Email already registered' };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = createUser(email, passwordHash, 'free');

  // Create a default project for the user
  createProject(user.id, 'Default Project');

  return { success: true, user };
}

/**
 * Login a user and create a session
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; session?: Session; user?: User; error?: string }> {
  // Find user by email
  const user = getUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Create session
  const session = createSession(user.id);

  return { success: true, session, user };
}

/**
 * Logout a user by deleting their session
 */
export function logoutUser(token: string): boolean {
  return deleteSession(token);
}

// ============================================================================
// Authentication Extraction
// ============================================================================

/**
 * Extract API key from Authorization header
 */
export function extractApiKey(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Support both "Bearer tc_xxx" and just "tc_xxx"
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('tc_')) {
      return token;
    }
  } else if (authHeader.startsWith('tc_')) {
    return authHeader;
  }

  return null;
}

/**
 * Extract session token from Authorization header
 */
export function extractSessionToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Session tokens don't start with tc_
    if (!token.startsWith('tc_')) {
      return token;
    }
  }

  return null;
}

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Middleware to authenticate requests using API key
 */
export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
  const apiKeyValue = extractApiKey(c);

  if (!apiKeyValue) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Missing or invalid API key. Use Authorization: Bearer tc_xxx header.',
        },
      },
      401
    );
  }

  const apiKey = getApiKeyByKey(apiKeyValue);
  if (!apiKey) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Invalid or revoked API key',
        },
      },
      401
    );
  }

  const user = getUserById(apiKey.userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'User not found',
        },
      },
      401
    );
  }

  // Update last used time
  updateApiKeyLastUsed(apiKey.id);

  // Set auth context on request
  const authContext: AuthContext = { user, apiKey };
  c.set('auth', authContext);

  await next();
}

/**
 * Middleware to authenticate requests using session token
 */
export async function sessionAuth(c: Context, next: Next): Promise<Response | void> {
  const sessionToken = extractSessionToken(c);

  if (!sessionToken) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Missing or invalid session token. Use Authorization: Bearer <token> header.',
        },
      },
      401
    );
  }

  const session = getSessionByToken(sessionToken);
  if (!session) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Invalid or expired session',
        },
      },
      401
    );
  }

  const user = getUserById(session.userId);
  if (!user) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'User not found',
        },
      },
      401
    );
  }

  // Set auth context on request
  const authContext: AuthContext = { user, session };
  c.set('auth', authContext);

  await next();
}

/**
 * Middleware to authenticate using either API key or session
 * API key takes precedence
 */
export async function flexAuth(c: Context, next: Next): Promise<Response | void> {
  const apiKeyValue = extractApiKey(c);
  const sessionToken = extractSessionToken(c);

  // Try API key first
  if (apiKeyValue) {
    const apiKey = getApiKeyByKey(apiKeyValue);
    if (apiKey) {
      const user = getUserById(apiKey.userId);
      if (user) {
        updateApiKeyLastUsed(apiKey.id);
        const authContext: AuthContext = { user, apiKey };
        c.set('auth', authContext);
        await next();
        return;
      }
    }
  }

  // Try session token
  if (sessionToken) {
    const session = getSessionByToken(sessionToken);
    if (session) {
      const user = getUserById(session.userId);
      if (user) {
        const authContext: AuthContext = { user, session };
        c.set('auth', authContext);
        await next();
        return;
      }
    }
  }

  return c.json(
    {
      error: {
        type: 'unauthorized',
        message: 'Missing or invalid authentication. Use Authorization: Bearer <api_key or session_token> header.',
      },
    },
    401
  );
}

// ============================================================================
// Plan Limits Checking
// ============================================================================

/**
 * Check if user has exceeded their monthly request limit
 */
export function checkRequestLimit(user: User): { allowed: boolean; message?: string } {
  const limits = PlanLimits[user.plan];
  const requestCount = getMonthlyRequestCount(user.id);

  if (requestCount >= limits.maxRequestsPerMonth) {
    return {
      allowed: false,
      message: `Monthly request limit reached (${limits.maxRequestsPerMonth} requests). Upgrade your plan for more requests.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can create more projects
 */
export function checkProjectLimit(user: User): { allowed: boolean; message?: string } {
  const limits = PlanLimits[user.plan];

  // -1 means unlimited
  if (limits.maxProjects === -1) {
    return { allowed: true };
  }

  const projectCount = countUserProjects(user.id);
  if (projectCount >= limits.maxProjects) {
    return {
      allowed: false,
      message: `Project limit reached (${limits.maxProjects} projects). Upgrade your plan for more projects.`,
    };
  }

  return { allowed: true };
}

/**
 * Middleware to check request limits before allowing API calls
 */
export async function checkPlanLimits(c: Context, next: Next): Promise<Response | void> {
  const auth = c.get('auth') as AuthContext | undefined;

  if (!auth) {
    return c.json(
      {
        error: {
          type: 'unauthorized',
          message: 'Authentication required',
        },
      },
      401
    );
  }

  const limitCheck = checkRequestLimit(auth.user);
  if (!limitCheck.allowed) {
    return c.json(
      {
        error: {
          type: 'rate_limit_exceeded',
          message: limitCheck.message,
        },
      },
      429
    );
  }

  await next();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get auth context from request
 */
export function getAuthContext(c: Context): AuthContext | undefined {
  return c.get('auth') as AuthContext | undefined;
}

/**
 * Mask an API key for display (show only prefix)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 7) return key;
  return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
}
