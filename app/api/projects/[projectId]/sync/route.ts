import { ApiError, apiErrorResponse, requireMember } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { WORKSPACE_ID, type SharedTask, type TaskPriority, type TaskStatus, type TaskType } from '@/lib/domain';

export const dynamic = 'force-dynamic';

const TASK_TYPES = new Set<TaskType>(['group', 'task', 'milestone']);
const TASK_STATUSES = new Set<TaskStatus>(['待开始', '进行中', '待评审', '已完成']);
const TASK_PRIORITIES = new Set<TaskPriority>(['最高', '高', '中', '低']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

type ProjectRow = { id: string; project_key: string; version: number };
type ExistingTaskRow = { id: string; project_id: string; start_date: string; end_date: string; locked: number };

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const actor = await requireMember(request);
    const { projectId } = await context.params;
    if (!ID_PATTERN.test(projectId)) throw new ApiError(400, 'invalid_project_id', '项目编号格式无效。');

    const body = await request.json().catch(() => null) as { expectedVersion?: unknown; tasks?: unknown } | null;
    if (!body || !Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1) {
      throw new ApiError(400, 'invalid_version', '缺少有效的项目版本号。');
    }
    if (!Array.isArray(body.tasks) || body.tasks.length > 80) {
      throw new ApiError(400, 'invalid_tasks', '事项列表无效或超过首期 80 条上限。');
    }

    const database = getDatabase();
    const expectedVersion = Number(body.expectedVersion);
    const project = await database.prepare(`SELECT id, project_key, version FROM projects
      WHERE id = ? AND workspace_id = ? AND archived_at IS NULL`)
      .bind(projectId, WORKSPACE_ID)
      .first<ProjectRow>();

    if (!project) throw new ApiError(404, 'project_not_found', '项目不存在或已归档。');
    if (project.version !== expectedVersion) {
      throw new ApiError(409, 'version_conflict', '项目已被其他成员更新，请刷新后合并修改。');
    }

    const tasks = body.tasks.map((value, index) => readTask(value, index, project.project_key));
    validateTaskGraph(tasks);

    const memberResult = await database.prepare(`SELECT u.id FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND u.active = 1`)
      .bind(WORKSPACE_ID)
      .all<{ id: string }>();
    const memberIds = new Set(memberResult.results.map((row) => row.id));
    for (const task of tasks) {
      if (!memberIds.has(task.ownerId)) throw new ApiError(400, 'invalid_owner', `${task.key} 的负责人不是有效工作区成员。`);
    }

    const existingResult = await database.prepare(`SELECT id, project_id, start_date, end_date, locked
      FROM tasks WHERE project_id = ? AND archived_at IS NULL`)
      .bind(projectId)
      .all<ExistingTaskRow>();
    const existing = new Map(existingResult.results.map((row) => [row.id, row]));
    const submittedIds = new Set(tasks.map((task) => task.id));
    const removedIds = [...existing.keys()].filter((id) => !submittedIds.has(id));

    if (!actor.isAdmin && removedIds.length) {
      throw new ApiError(403, 'admin_required', '只有管理员可以删除或归档事项。');
    }
    if (!actor.isAdmin) {
      for (const task of tasks) {
        const current = existing.get(task.id);
        if (current?.locked && (task.start !== current.start_date || task.end !== current.end_date || !task.locked)) {
          throw new ApiError(403, 'locked_schedule', `${task.key} 已锁定，只有管理员可以修改排期或解除锁定。`);
        }
        if (!current && task.locked) {
          throw new ApiError(403, 'admin_required', '只有管理员可以创建锁定事项。');
        }
      }
    }

    if (tasks.length) {
      const placeholders = tasks.map(() => '?').join(', ');
      const collisionResult = await database.prepare(`SELECT id, project_id FROM tasks WHERE id IN (${placeholders})`)
        .bind(...tasks.map((task) => task.id))
        .all<{ id: string; project_id: string }>();
      if (collisionResult.results.some((row) => row.project_id !== projectId)) {
        throw new ApiError(409, 'task_id_conflict', '事项标识与其他项目冲突，请重新创建。');
      }
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];

    tasks.forEach((task, index) => {
      const taskNumber = Number(task.key.split('-').at(-1)) || index + 1;
      statements.push(
        database.prepare(`INSERT INTO tasks
          (id, project_id, task_number, task_key, title, description, type, level, parent_id, owner_id, status, priority, progress, start_date, end_date, baseline_start, baseline_end, critical, locked, sort_order, version, created_by, updated_by, created_at, updated_at, archived_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL
          WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND version = ? AND archived_at IS NULL)
          ON CONFLICT(id) DO UPDATE SET
            task_number = excluded.task_number,
            task_key = excluded.task_key,
            title = excluded.title,
            description = excluded.description,
            type = excluded.type,
            level = excluded.level,
            parent_id = excluded.parent_id,
            owner_id = excluded.owner_id,
            status = excluded.status,
            priority = excluded.priority,
            progress = excluded.progress,
            start_date = excluded.start_date,
            end_date = excluded.end_date,
            baseline_start = excluded.baseline_start,
            baseline_end = excluded.baseline_end,
            critical = excluded.critical,
            locked = excluded.locked,
            sort_order = excluded.sort_order,
            version = tasks.version + 1,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at,
            archived_at = NULL
          WHERE tasks.project_id = excluded.project_id`)
          .bind(task.id, projectId, taskNumber, task.key, task.title, task.description, task.type, task.level, task.parentId ?? null, task.ownerId, task.status, task.priority, task.progress, task.start, task.end, task.baselineStart, task.baselineEnd, task.critical ? 1 : 0, task.locked ? 1 : 0, index * 10, actor.id, actor.id, now, now, projectId, expectedVersion),
        database.prepare(`DELETE FROM task_dependencies WHERE task_id = ?
          AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND version = ? AND archived_at IS NULL)`)
          .bind(task.id, projectId, expectedVersion),
      );

      for (const predecessorId of task.dependencies) {
        statements.push(
          database.prepare(`INSERT OR IGNORE INTO task_dependencies
            (task_id, predecessor_id, relation_type, lag_days, created_at)
            SELECT ?, ?, 'FS', 0, ?
            WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND version = ? AND archived_at IS NULL)`)
            .bind(task.id, predecessorId, now, projectId, expectedVersion),
        );
      }
    });

    for (const removedId of removedIds) {
      statements.push(
        database.prepare(`UPDATE tasks SET archived_at = ?, updated_by = ?, updated_at = ?, version = version + 1
          WHERE id = ? AND project_id = ?
            AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND version = ? AND archived_at IS NULL)`)
          .bind(now, actor.id, now, removedId, projectId, projectId, expectedVersion),
      );
    }

    const newTaskCount = tasks.filter((task) => !existing.has(task.id)).length;
    const summary = summarizeChange(newTaskCount, removedIds.length, tasks.length);
    statements.push(
      database.prepare(`INSERT INTO audit_events
        (workspace_id, project_id, task_id, actor_id, action, summary, changed_fields_json, occurred_at)
        SELECT ?, ?, NULL, ?, 'tasks.synced', ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND version = ? AND archived_at IS NULL)`)
        .bind(WORKSPACE_ID, projectId, actor.id, summary, JSON.stringify({ taskCount: tasks.length, newTaskCount, archivedTaskCount: removedIds.length }), now, projectId, expectedVersion),
    );

    const maxTaskNumber = tasks.reduce((maximum, task) => Math.max(maximum, Number(task.key.split('-').at(-1)) || 0), 0);
    statements.push(
      database.prepare(`UPDATE projects SET version = version + 1,
        next_task_number = MAX(next_task_number, ?), updated_by = ?, updated_at = ?
        WHERE id = ? AND workspace_id = ? AND version = ? AND archived_at IS NULL`)
        .bind(maxTaskNumber + 1, actor.id, now, projectId, WORKSPACE_ID, expectedVersion),
    );

    const results = await database.batch(statements);
    const projectUpdate = results.at(-1);
    if (!projectUpdate || Number(projectUpdate.meta.changes ?? 0) !== 1) {
      throw new ApiError(409, 'version_conflict', '项目已被其他成员更新，请刷新后合并修改。');
    }

    const activityResult = await database.prepare(`SELECT a.id, a.task_id, a.actor_id, a.action, a.summary, a.occurred_at,
      u.name AS actor_name, u.initials AS actor_initials
      FROM audit_events a JOIN users u ON u.id = a.actor_id
      WHERE a.project_id = ? ORDER BY a.id DESC LIMIT 20`)
      .bind(projectId)
      .all<{
        id: number;
        task_id: string | null;
        actor_id: string;
        action: string;
        summary: string;
        occurred_at: string;
        actor_name: string;
        actor_initials: string;
      }>();

    return Response.json({
      projectVersion: expectedVersion + 1,
      savedAt: now,
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
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function readTask(value: unknown, index: number, projectKey: string): SharedTask {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'invalid_task', `第 ${index + 1} 条事项格式无效。`);
  }
  const task = value as Record<string, unknown>;
  const id = requiredString(task.id, '事项标识', 64);
  const key = requiredString(task.key, '事项编号', 40);
  const title = requiredString(task.title, '事项名称', 240);
  const description = optionalString(task.description, '事项描述', 10000);
  const type = task.type as TaskType;
  const status = task.status as TaskStatus;
  const priority = task.priority as TaskPriority;
  const level = Number(task.level);
  const progress = Number(task.progress);
  const ownerId = requiredString(task.ownerId, '负责人', 64);
  const parentId = task.parentId == null || task.parentId === '' ? undefined : requiredString(task.parentId, '父事项', 64);
  const start = validDate(task.start, '开始日期');
  const end = validDate(task.end, '截止日期');
  const baselineStart = validDate(task.baselineStart, '基线开始日期');
  const baselineEnd = validDate(task.baselineEnd, '基线截止日期');

  if (!ID_PATTERN.test(id)) throw new ApiError(400, 'invalid_task_id', `${key} 的事项标识格式无效。`);
  if (!key.startsWith(`${projectKey}-`) || !Number.isInteger(Number(key.split('-').at(-1)))) {
    throw new ApiError(400, 'invalid_task_key', `${key} 不属于当前项目编号空间。`);
  }
  if (!TASK_TYPES.has(type)) throw new ApiError(400, 'invalid_task_type', `${key} 的事项类型无效。`);
  if (!TASK_STATUSES.has(status)) throw new ApiError(400, 'invalid_task_status', `${key} 的状态无效。`);
  if (!TASK_PRIORITIES.has(priority)) throw new ApiError(400, 'invalid_task_priority', `${key} 的优先级无效。`);
  if (!Number.isInteger(level) || level < 0 || level > 8) throw new ApiError(400, 'invalid_task_level', `${key} 的层级无效。`);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) throw new ApiError(400, 'invalid_task_progress', `${key} 的进度必须为 0–100。`);
  if (end < start) throw new ApiError(400, 'invalid_task_dates', `${key} 的截止日期不能早于开始日期。`);
  if (type === 'milestone' && end !== start) throw new ApiError(400, 'invalid_milestone_dates', `${key} 里程碑必须在同一天开始和结束。`);
  if (baselineEnd < baselineStart) throw new ApiError(400, 'invalid_baseline_dates', `${key} 的基线日期范围无效。`);
  if (!Array.isArray(task.dependencies) || task.dependencies.some((dependency) => typeof dependency !== 'string' || !ID_PATTERN.test(dependency))) {
    throw new ApiError(400, 'invalid_dependencies', `${key} 的依赖关系无效。`);
  }
  if (typeof task.critical !== 'boolean' || typeof task.locked !== 'boolean') {
    throw new ApiError(400, 'invalid_task_flags', `${key} 的治理标记无效。`);
  }

  return {
    id,
    key,
    title,
    description,
    type,
    level,
    ...(parentId ? { parentId } : {}),
    ownerId,
    status,
    priority,
    progress,
    start,
    end,
    baselineStart,
    baselineEnd,
    dependencies: [...new Set(task.dependencies as string[])],
    critical: task.critical,
    locked: task.locked,
  };
}

function validateTaskGraph(tasks: SharedTask[]) {
  const byId = new Map<string, SharedTask>();
  const keys = new Set<string>();
  for (const task of tasks) {
    if (byId.has(task.id)) throw new ApiError(400, 'duplicate_task_id', `事项标识 ${task.id} 重复。`);
    if (keys.has(task.key)) throw new ApiError(400, 'duplicate_task_key', `事项编号 ${task.key} 重复。`);
    byId.set(task.id, task);
    keys.add(task.key);
  }

  for (const task of tasks) {
    if (task.parentId && (!byId.has(task.parentId) || task.parentId === task.id)) {
      throw new ApiError(400, 'invalid_parent', `${task.key} 的父事项不存在或无效。`);
    }
    for (const dependency of task.dependencies) {
      if (!byId.has(dependency) || dependency === task.id) {
        throw new ApiError(400, 'invalid_dependency', `${task.key} 包含不存在或自引用的依赖。`);
      }
    }
  }

  detectCycle(tasks, (task) => task.dependencies, '依赖关系');
  detectCycle(tasks, (task) => task.parentId ? [task.parentId] : [], '父子层级');
}

function detectCycle(tasks: SharedTask[], edgesOf: (task: SharedTask) => string[], label: string) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string) => {
    if (visiting.has(id)) throw new ApiError(400, 'cyclic_graph', `${label}中存在循环，请先解除循环。`);
    if (visited.has(id)) return;
    visiting.add(id);
    const task = byId.get(id);
    if (task) edgesOf(task).forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };

  tasks.forEach((task) => visit(task.id));
}

function requiredString(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
    throw new ApiError(400, 'invalid_string', `${label}不能为空且不能超过 ${maximum} 个字符。`);
  }
  return value.trim();
}

function optionalString(value: unknown, label: string, maximum: number) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > maximum) {
    throw new ApiError(400, 'invalid_string', `${label}不能超过 ${maximum} 个字符。`);
  }
  return value;
}

function validDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ApiError(400, 'invalid_date', `${label}格式无效。`);
  }
  return value;
}

function summarizeChange(created: number, archived: number, total: number) {
  if (created && archived) return `新增 ${created} 项、归档 ${archived} 项并同步排期`;
  if (created) return `新增 ${created} 个事项并同步排期`;
  if (archived) return `归档 ${archived} 个事项并同步排期`;
  return `同步了 ${total} 个事项的最新状态`;
}
