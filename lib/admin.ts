/**
 * Admin Configuration
 * Centralized configuration for super admin access
 */

export const SUPER_ADMIN_EMAIL = 'fauwadwali@gmail.com';

/**
 * Check if a user email is the super admin
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Get admin access level for a user
 */
export function getAdminAccessLevel(email: string | null | undefined): 'super_admin' | 'none' {
    if (isSuperAdmin(email)) {
        return 'super_admin';
    }
    return 'none';
}

