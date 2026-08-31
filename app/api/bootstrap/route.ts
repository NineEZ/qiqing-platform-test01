import { ApiError, apiErrorResponse, requireMember } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { WORKSPACE_ID } from '@/lib/domain';

export const dynamic = 'force-dynamic';

type TaskRow = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'group' | 'task' | 'milestone';
  level: number;
  parent_id: string | null;
  owner_id: string;
  status: '待开始' | '进行中' | '待评审' | '已完成';
  priority: '最高' | '高' | '中' | '低';
  progress: number;
  start_date: string;
  end_date: string;
  baseline_start: string;
  baseline_end: string;
  critical: number;
  locked: number;
};

export async function GET(request: Request) {
  try {
    const actor = await requireMember(request);
    const database = getDatabase();
    const projectId = new URL(request.url).searchParams.get('projectId') ?? 'base';

    const [project, projectResult, memberResult] = await Promise.all([
      database.prepare(`SELECT id, version FROM projects
        WHERE id = ? AND workspace_id = ? AND archived_at IS NULL`)
        .bind(projectId, WORKSPACE_ID)
        .first<{ id: string; version: number }>(),
      database.prepare(`SELECT id, project_key, name, short_name, color, health, target_date, version
        FROM projects WHERE workspace_id = ? AND archived_at IS NULL ORDER BY created_at, id`)
        .bind(WORKSPACE_ID)
        .all(),
      database.prepare(`SELECT u.id, u.name, u.initials, u.color, wm.access_role, wm.responsibility_title
        FROM users u JOIN workspace_members wm ON wm.user_id = u.id
        WHERE wm.workspace_id = ? AND u.active = 1 ORDER BY CASE wm.access_role WHEN 'ADMIN' THEN 0 ELSE 1 END, u.created_at`)
        .bind(WORKSPACE_ID)
        .all(),
    ]);

    if (!project) throw new ApiError(404, 'project_not_found', '项目不存在或已归档。');

    const [taskResult, dependencyResult, activityResult] = await Promise.all([
      database.prepare(`SELECT id, task_key AS key, title, description, type, level, parent_id, owner_id,
        status, priority, progress, start_date, end_date, baseline_start, baseline_end, critical, locked
        FROM tasks WHERE project_id = ? AND archived_at IS NULL ORDER BY sort_order, created_at`)
        .bind(projectId)
        .all<TaskRow>(),
      database.prepare(`SELECT d.task_id, d.predecessor_id
        FROM task_dependencies d
        JOIN tasks t ON t.id = d.task_id AND t.archived_at IS NULL
        JOIN tasks p ON p.id = d.predecessor_id AND p.archived_at IS NULL
        WHERE t.project_id = ? ORDER BY d.task_id, d.created_at`)
        .bind(projectId)
        .all<{ task_id: string; predecessor_id: string }>(),
      database.prepare(`SELECT a.id, a.task_id, a.actor_id, a.action, a.summary, a.occurred_at,
        u.name AS actor_name, u.initials AS actor_initials
        FROM audit_events a JOIN users u ON u.id = a.actor_id
        WHERE a.project_id = ? ORDER BY a.id DESC LIMIT 20`)
        .bind(projectId)
        .all(),
    ]);

    const dependencies = new Map<string, string[]>();
    for (const row of dependencyResult.results) {
      const current = dependencies.get(row.task_id) ?? [];
      current.push(row.predecessor_id);
      dependencies.set(row.task_id, current);
    }

    const tasks = taskResult.results.map((task) => ({
      id: task.id,
      key: task.key,
      title: task.title,
      description: task.description,
      type: task.type,
      level: task.level,
      ...(task.parent_id ? { parentId: task.parent_id } : {}),
      ownerId: task.owner_id,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      start: task.start_date,
      end: task.end_date,
      baselineStart: task.baseline_start,
      baselineEnd: task.baseline_end,
      dependencies: dependencies.get(task.id) ?? [],
      critical: Boolean(task.critical),
      locked: Boolean(task.locked),
    }));

    return Response.json({
      me: {
        id: actor.id,
        name: actor.name,
        short: actor.initials,
        role: actor.isAdmin ? '管理员' : '成员',
        responsibilityTitle: actor.responsibilityTitle,
        isAdmin: actor.isAdmin,
      },
      members: memberResult.results.map((row) => ({
        id: row.id,
        name: row.name,
        short: row.initials,
        color: row.color,
        role: `${row.access_role === 'ADMIN' ? '管理员 · ' : ''}${row.responsibility_title}`,
        accessRole: row.access_role,
      })),
      projects: projectResult.results.map((row) => ({
        id: row.id,
        key: row.project_key,
        name: row.name,
        short: row.short_name,
        color: row.color,
        health: row.health,
        targetDate: row.target_date,
        version: row.version,
      })),
      projectVersion: project.version,
      tasks,
      activity: activityResult.results.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        actorId: row.actor_id,
        action: row.action,
        summary: row.summary,
        occurredAt: row.occurred_at,
        actorName: row.actor_name,
        actorInitials: row.actor_initials,
      })),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
