/**
 * Audit logging for admin and user actions.
 * Writes to the `audit_logs` Supabase table (non-blocking).
 * Never throws — audit logging must not break the main request.
 *
 * Run supabase/migrations/001_audit_logs.sql to create the table.
 */

import { supabaseAdmin } from '@/lib/api-helpers'

export type AuditAction =
  | 'charging.start'
  | 'charging.stop'
  | 'charging.initiate'
  | 'user.balance_adjust'
  | 'charger.status_change'
  | 'admin.login'
  | string // allow ad-hoc actions

/**
 * Log an audit event asynchronously (fire-and-forget).
 * @param userId     The user performing the action (null for system)
 * @param action     Short verb-noun string, e.g. 'charging.start'
 * @param resourceType  Table or entity type, e.g. 'charging_session'
 * @param resourceId    Primary key of the affected resource (optional)
 * @param metadata   Any extra data to record
 */
export function logAuditEvent(
  userId: string | null,
  action: AuditAction,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): void {
  // Fire-and-forget: do not await, do not throw
  ;(async () => {
    try {
      const supabase = supabaseAdmin()
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        resource_type: resourceType,
        resource_id: resourceId ?? null,
        metadata: metadata ?? {},
      })
    } catch (err) {
      console.error('[AuditLog] Failed to write audit event:', action, err)
    }
  })()
}
