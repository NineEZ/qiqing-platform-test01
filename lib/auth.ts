import { ensureDatabase, getDatabase } from '@/lib/database';
import { WORKSPACE_ID } from '@/lib/domain';

export type Actor = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  accessRole: 'ADMIN' | 'MEMBER';
  responsibilityTitle: string;
  isAdmin: boolean;
};

type ActorRow = {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  access_role: 'ADMIN' | 'MEMBER';
  responsibility_title: string;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function requireMember(request: Request): Promise<Actor> {
  await ensureDatabase();
  const database = getDatabase();
  const url = new URL(request.url);
  const platformUserId = request.headers.get('oai-authenticated-user-id');
  const platformEmail = request.headers.get('oai-authenticated-user-email');
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

  let row: ActorRow | null = null;

  if (platformUserId || platformEmail) {
    row = await database.prepare(`SELECT
      u.id, u.name, u.initials, u.email, wm.access_role, wm.responsibility_title
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND u.active = 1
        AND (u.auth_user_id = ? OR (u.email IS NOT NULL AND lower(u.email) = lower(?)))
      LIMIT 1`)
      .bind(WORKSPACE_ID, platformUserId ?? '', platformEmail ?? '')
      .first<ActorRow>();

    if (row && platformUserId) {
      await database.prepare('UPDATE users SET auth_user_id = COALESCE(auth_user_id, ?) WHERE id = ?')
        .bind(platformUserId, row.id)
        .run();
    }
  } else if (isLocal) {
    const localMemberId = request.headers.get('x-xeng-member-id') ?? 'zww';
    row = await database.prepare(`SELECT
      u.id, u.name, u.initials, u.email, wm.access_role, wm.responsibility_title
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND u.id = ? AND u.active = 1
      LIMIT 1`)
      .bind(WORKSPACE_ID, localMemberId)
      .first<ActorRow>();
  }

  if (!row) {
    throw new ApiError(403, 'identity_not_bound', '当前登录身份尚未绑定到企擎四人工作区。');
  }

  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    email: row.email,
    accessRole: row.access_role,
    responsibilityTitle: row.responsibility_title,
    isAdmin: row.access_role === 'ADMIN',
  };
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: 'internal_error', message: '服务暂时不可用，请稍后重试。' }, { status: 500 });
}
