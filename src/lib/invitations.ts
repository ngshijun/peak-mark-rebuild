import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database.types'

type InvitationRow = Database['public']['Tables']['parent_student_invitations']['Row']

export interface ParentStudentInvitation {
  id: string
  parentId: string | null
  parentEmail: string
  parentName?: string
  studentId: string | null
  studentEmail: string
  studentName?: string
  direction: Database['public']['Enums']['invitation_direction']
  status: Database['public']['Enums']['invitation_status']
  createdAt: string
  respondedAt: string | null
}

/** Batch-fetch profiles and map invitation rows to ParentStudentInvitation[] */
export async function mapInvitationRows(rows: InvitationRow[]): Promise<ParentStudentInvitation[]> {
  const userIds = new Set<string>()
  for (const row of rows) {
    if (row.parent_id) userIds.add(row.parent_id)
    if (row.student_id) userIds.add(row.student_id)
  }

  const profilesMap = new Map<string, string>()
  if (userIds.size > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', [...userIds])

    for (const p of data ?? []) {
      profilesMap.set(p.id, p.name)
    }
  }

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    parentEmail: row.parent_email,
    parentName: row.parent_id ? profilesMap.get(row.parent_id) : undefined,
    studentId: row.student_id,
    studentEmail: row.student_email,
    studentName: row.student_id ? profilesMap.get(row.student_id) : undefined,
    direction: row.direction,
    status: row.status ?? 'pending',
    createdAt: row.created_at ?? new Date().toISOString(),
    respondedAt: row.responded_at,
  }))
}
