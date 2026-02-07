/**
 * Authentication and Authorization Utility Functions
 * Provides standardized role validation and permission checking
 */

/**
 * Valid role types in the system
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  GYM_ADMIN: 'gym_admin',
  GYM_MANAGER: 'gym_manager',
  TRAINER: 'trainer',
  MEMBER: 'member',
};

/**
 * Role groups for permission checking
 */
export const ROLE_GROUPS = {
  ADMIN: [ROLES.GYM_ADMIN, ROLES.GYM_MANAGER],
  ALL_STAFF: [ROLES.SUPER_ADMIN, ROLES.GYM_ADMIN, ROLES.GYM_MANAGER, ROLES.TRAINER],
  ALL_USERS: [ROLES.SUPER_ADMIN, ROLES.GYM_ADMIN, ROLES.GYM_MANAGER, ROLES.TRAINER, ROLES.MEMBER],
};

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object with role property
 * @param {Array<string>} roles - Array of role names to check against
 * @returns {boolean}
 */
export const hasRole = (user, roles) => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

/**
 * Check if user is a gym admin or manager
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const isAdmin = (user) => {
  return hasRole(user, ROLE_GROUPS.ADMIN);
};

/**
 * Check if user is a super admin
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const isSuperAdmin = (user) => {
  return hasRole(user, [ROLES.SUPER_ADMIN]);
};

/**
 * Check if user is a trainer/instructor
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const isTrainer = (user) => {
  return hasRole(user, [ROLES.TRAINER]);
};

/**
 * Check if user is a member
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const isMember = (user) => {
  return hasRole(user, [ROLES.MEMBER]);
};

/**
 * Check if user is any type of staff (super admin, gym admin, manager, or trainer)
 * @param {Object} user - User object with role property
 * @returns {boolean}
 */
export const isStaff = (user) => {
  return hasRole(user, ROLE_GROUPS.ALL_STAFF);
};

/**
 * Validate that user has required permissions
 * @param {Object} user - User object
 * @param {Array<string>} requiredRoles - Required roles
 * @throws {Error} If user doesn't have required permissions
 */
export const requireRole = (user, requiredRoles) => {
  if (!hasRole(user, requiredRoles)) {
    throw new Error('Insufficient permissions');
  }
};

/**
 * Get user-friendly role name
 * @param {string} role - Role identifier
 * @returns {string}
 */
export const getRoleName = (role) => {
  const roleNames = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.GYM_ADMIN]: 'Gym Admin',
    [ROLES.GYM_MANAGER]: 'Gym Manager',
    [ROLES.TRAINER]: 'Trainer',
    [ROLES.MEMBER]: 'Member',
  };
  return roleNames[role] || role;
};

/**
 * Validate gym ID exists for admin users
 * @param {Object} user - User object with gymId property
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export const validateGymId = (user) => {
  // Super admin doesn't need gymId
  if (isSuperAdmin(user)) {
    return { isValid: true, error: null };
  }

  // Admin users must have gymId
  if (isAdmin(user) && !user.gymId) {
    return {
      isValid: false,
      error: 'Your account is not associated with a gym. Please contact support.',
    };
  }

  // Trainers must have gymId
  if (isTrainer(user) && !user.gymId) {
    return {
      isValid: false,
      error: 'Your account is not associated with a gym. Please contact support.',
    };
  }

  // Members must have gymId
  if (isMember(user) && !user.gymId) {
    return {
      isValid: false,
      error: 'Your account is not associated with a gym. Please contact support.',
    };
  }

  return { isValid: true, error: null };
};

/**
 * Check if user can access gym-specific data
 * @param {Object} user - User object
 * @param {string} targetGymId - Gym ID to check access for
 * @returns {boolean}
 */
export const canAccessGym = (user, targetGymId) => {
  // Super admin can access all gyms
  if (isSuperAdmin(user)) return true;

  // Other users can only access their own gym
  return user?.gymId === targetGymId;
};
