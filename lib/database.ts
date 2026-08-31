import { env } from 'cloudflare:workers';
import { SEED_PROJECTS, SEED_TASKS, WORKSPACE_ID, WORKSPACE_MEMBERS } from '@/lib/domain';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    auth_user_id TEXT,
    email TEXT,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users (auth_user_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
  `CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_role TEXT NOT NULL CHECK(access_role IN ('ADMIN', 'MEMBER')),
    responsibility_title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members (user_id)`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_key TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    color TEXT NOT NULL,
    health TEXT NOT NULL,
    target_date TEXT,
    next_task_number INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    updated_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_workspace_key ON projects (workspace_id, project_key)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_workspace_active ON projects (workspace_id, archived_at)`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_number INTEGER NOT NULL,
    task_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('group', 'task', 'milestone')),
    level INTEGER NOT NULL DEFAULT 0 CHECK(level BETWEEN 0 AND 8),
    parent_id TEXT REFERENCES tasks(id) ON DELETE RESTRICT,
    owner_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('待开始', '进行中', '待评审', '已完成')),
    priority TEXT NOT NULL CHECK(priority IN ('最高', '高', '中', '低')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    baseline_start TEXT NOT NULL,
    baseline_end TEXT NOT NULL,
    critical INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    updated_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_key ON tasks (project_id, task_key)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project_active_order ON tasks (project_id, archived_at, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_project_owner_status ON tasks (project_id, owner_id, status)`,
  `CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    predecessor_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'FS' CHECK(relation_type = 'FS'),
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    CHECK(task_id <> predecessor_id),
    PRIMARY KEY (task_id, predecessor_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor ON task_dependencies (predecessor_id)`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    actor_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    changed_fields_json TEXT,
    occurred_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_project_time ON audit_events (project_id, occurred_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_task_time ON audit_events (task_id, occurred_at)`,
];

let initializationPromise: Promise<void> | null = null;

export function getDatabase() {
  return env.DB;
}

export async function ensureDatabase() {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  await initializationPromise;
}

async function initializeDatabase() {
  const database = getDatabase();
  await database.batch(SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)));

  const now = new Date().toISOString();
  const seedStatements: D1PreparedStatement[] = [
    database.prepare('INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES (?, ?, ?)').bind(WORKSPACE_ID, '企擎公司工作区', now),
  ];

  for (const member of WORKSPACE_MEMBERS) {
    seedStatements.push(
      database.prepare(`INSERT OR IGNORE INTO users
        (id, auth_user_id, email, name, initials, color, active, created_at)
        VALUES (?, NULL, NULL, ?, ?, ?, 1, ?)`)
        .bind(member.id, member.name, member.initials, member.color, now),
      database.prepare(`INSERT OR IGNORE INTO workspace_members
        (workspace_id, user_id, access_role, responsibility_title, created_at)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(WORKSPACE_ID, member.id, member.accessRole, member.responsibilityTitle, now),
    );
  }

  for (const project of SEED_PROJECTS) {
    seedStatements.push(
      database.prepare(`INSERT OR IGNORE INTO projects
        (id, workspace_id, project_key, name, short_name, color, health, target_date, next_task_number, version, created_by, updated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'zww', 'zww', ?, ?)`)
        .bind(project.id, WORKSPACE_ID, project.key, project.name, project.shortName, project.color, project.health, project.targetDate, project.nextTaskNumber, now, now),
    );
  }

  SEED_TASKS.forEach((task, index) => {
    const taskNumber = Number(task.key.split('-').at(-1)) || index + 1;
    seedStatements.push(
      database.prepare(`INSERT OR IGNORE INTO tasks
        (id, project_id, task_number, task_key, title, description, type, level, parent_id, owner_id, status, priority, progress, start_date, end_date, baseline_start, baseline_end, critical, locked, sort_order, version, created_by, updated_by, created_at, updated_at)
        VALUES (?, 'base', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'zww', 'zww', ?, ?)`)
        .bind(task.id, taskNumber, task.key, task.title, task.description, task.type, task.level, task.parentId ?? null, task.ownerId, task.status, task.priority, task.progress, task.start, task.end, task.baselineStart, task.baselineEnd, task.critical ? 1 : 0, task.locked ? 1 : 0, index * 10, now, now),
    );
  });

  for (const task of SEED_TASKS) {
    for (const predecessorId of task.dependencies) {
      seedStatements.push(
        database.prepare(`INSERT OR IGNORE INTO task_dependencies
          (task_id, predecessor_id, relation_type, lag_days, created_at)
          VALUES (?, ?, 'FS', 0, ?)`)
          .bind(task.id, predecessorId, now),
      );
    }
  }

  seedStatements.push(
    database.prepare(`INSERT INTO audit_events
      (workspace_id, project_id, task_id, actor_id, action, summary, changed_fields_json, occurred_at)
      SELECT ?, 'base', NULL, 'zww', 'workspace.seeded', '已从验证原型建立共享项目底账', NULL, ?
      WHERE NOT EXISTS (SELECT 1 FROM audit_events WHERE action = 'workspace.seeded')`)
      .bind(WORKSPACE_ID, now),
  );

  await database.batch(seedStatements);
  await database.prepare('PRAGMA optimize').run();
}
