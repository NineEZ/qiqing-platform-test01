'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

type TaskType = 'group' | 'task' | 'milestone';
type TaskStatus = '待开始' | '进行中' | '待评审' | '已完成';
type Zoom = '日' | '周' | '月' | '季';

type Member = {
  id: string;
  name: string;
  short: string;
  role: string;
  color: string;
};

type Project = {
  id: string;
  key: string;
  name: string;
  short: string;
  color: string;
  health: string;
};

type Task = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: TaskType;
  level: number;
  parentId?: string;
  ownerId: string;
  status: TaskStatus;
  priority: '最高' | '高' | '中' | '低';
  progress: number;
  start: string;
  end: string;
  baselineStart: string;
  baselineEnd: string;
  dependencies: string[];
  critical: boolean;
  locked: boolean;
};

type ActivityItem = {
  id: number;
  taskId: string | null;
  actorId: string;
  action: string;
  summary: string;
  occurredAt: string;
  actorName: string;
  actorInitials: string;
};

type CurrentActor = {
  id: string;
  name: string;
  short: string;
  role: string;
  responsibilityTitle: string;
  isAdmin: boolean;
};

type BootstrapPayload = {
  me: CurrentActor;
  projectVersion: number;
  tasks: Task[];
  activity: ActivityItem[];
};

type SyncState = 'loading' | 'saving' | 'saved' | 'conflict' | 'error';

const MEMBERS: Member[] = [
  { id: 'zww', name: '朱巍巍', short: '朱', role: '管理员 · 业务经营与智能体架构', color: '#dbeafe' },
  { id: 'zx', name: '张旭', short: '张', role: '知识工程与数据研究', color: '#dcfce7' },
  { id: 'zpf', name: '朱鹏飞', short: '鹏', role: '软件架构与系统集成', color: '#fef3c7' },
  { id: 'xc', name: '徐驰', short: '徐', role: '行业探索与商务协同', color: '#fae8ff' },
];

const PROJECTS: Project[] = [
  { id: 'base', key: 'QAI', name: '企业智能体底座 V1.0', short: 'AI', color: '#dff6ff', health: '正常' },
  { id: 'cross', key: 'CBE', name: '跨境电商自动化运营', short: '跨', color: '#fef3c7', health: '正常' },
  { id: 'care', key: 'CARE', name: '养护云现场管理', short: '养', color: '#dcfce7', health: '有风险' },
  { id: 'mfg', key: 'MFG', name: '生产制造分析看板', short: '制', color: '#e0e7ff', health: '正常' },
  { id: 'train', key: 'EDU', name: '数字员工训练平台', short: '训', color: '#fae8ff', health: '规划中' },
];

const INITIAL_TASKS: Task[] = [
  { id: 't1', key: 'QAI-1', title: '12 周 POC · 企业智能体底座 V1.0', description: '从真实业务流程切入，完成可运行、可追溯、可验收、可复制的企业智能体场景包。', type: 'group', level: 0, ownerId: 'zww', status: '进行中', priority: '最高', progress: 36, start: '2026-08-24', end: '2026-11-13', baselineStart: '2026-08-24', baselineEnd: '2026-11-13', dependencies: [], critical: false, locked: false },
  { id: 't2', key: 'QAI-2', title: '阶段 1 · 业务诊断与价值基线', description: '输出流程图、责任人、异常清单和价值基线。', type: 'group', level: 1, parentId: 't1', ownerId: 'xc', status: '已完成', priority: '高', progress: 100, start: '2026-08-24', end: '2026-09-04', baselineStart: '2026-08-24', baselineEnd: '2026-09-04', dependencies: [], critical: false, locked: true },
  { id: 't3', key: 'QAI-3', title: '流程、责任人与异常清单', description: '访谈关键岗位，梳理主流程、责任边界与异常回退点。', type: 'task', level: 2, parentId: 't2', ownerId: 'xc', status: '已完成', priority: '高', progress: 100, start: '2026-08-24', end: '2026-08-28', baselineStart: '2026-08-24', baselineEnd: '2026-08-28', dependencies: [], critical: false, locked: true },
  { id: 't4', key: 'QAI-4', title: '数据边界与价值基线确认', description: '确认数据授权范围、验收指标和停止机制。', type: 'task', level: 2, parentId: 't2', ownerId: 'zww', status: '已完成', priority: '高', progress: 100, start: '2026-08-31', end: '2026-09-04', baselineStart: '2026-08-31', baselineEnd: '2026-09-04', dependencies: ['t3'], critical: true, locked: true },
  { id: 't5', key: 'QAI-5', title: '阶段 2 · 知识、接口与原型', description: '完成知识工程、接口清单和首版原型。', type: 'group', level: 1, parentId: 't1', ownerId: 'zx', status: '进行中', priority: '最高', progress: 45, start: '2026-09-07', end: '2026-10-02', baselineStart: '2026-09-07', baselineEnd: '2026-10-02', dependencies: ['t2'], critical: false, locked: false },
  { id: 't6', key: 'QAI-6', title: '文档解析与知识切片', description: '配置文档解析、OCR、切片、向量检索和引用回源。', type: 'task', level: 2, parentId: 't5', ownerId: 'zx', status: '进行中', priority: '最高', progress: 72, start: '2026-09-07', end: '2026-09-16', baselineStart: '2026-09-07', baselineEnd: '2026-09-15', dependencies: ['t4'], critical: true, locked: false },
  { id: 't7', key: 'QAI-7', title: '权限、版本与技术台账', description: '建立最小权限、知识版本和模型/连接器技术台账。', type: 'task', level: 2, parentId: 't5', ownerId: 'zx', status: '进行中', priority: '高', progress: 38, start: '2026-09-14', end: '2026-09-23', baselineStart: '2026-09-14', baselineEnd: '2026-09-22', dependencies: ['t6'], critical: true, locked: false },
  { id: 't8', key: 'QAI-8', title: '企业系统接口与字段映射', description: '形成 ERP、MES、CRM、API 和数据库接口清单与环境隔离方案。', type: 'task', level: 2, parentId: 't5', ownerId: 'zpf', status: '进行中', priority: '高', progress: 31, start: '2026-09-17', end: '2026-09-28', baselineStart: '2026-09-16', baselineEnd: '2026-09-25', dependencies: ['t6'], critical: false, locked: false },
  { id: 't9', key: 'QAI-9', title: '首版智能体原型搭建', description: '完成任务链、工具调用、人工审批和异常分支。', type: 'task', level: 2, parentId: 't5', ownerId: 'zww', status: '待评审', priority: '最高', progress: 22, start: '2026-09-24', end: '2026-10-02', baselineStart: '2026-09-23', baselineEnd: '2026-10-02', dependencies: ['t7', 't8'], critical: true, locked: false },
  { id: 't10', key: 'QAI-10', title: '阶段 3 · 受限试运行与人工验收', description: '在限制权限和人工验收条件下进行 4 周试运行。', type: 'group', level: 1, parentId: 't1', ownerId: 'zpf', status: '待开始', priority: '最高', progress: 8, start: '2026-10-05', end: '2026-10-30', baselineStart: '2026-10-05', baselineEnd: '2026-10-30', dependencies: ['t5'], critical: false, locked: false },
  { id: 't11', key: 'QAI-11', title: '受限权限试运行', description: '使用隔离账号和最小权限执行真实任务。', type: 'task', level: 2, parentId: 't10', ownerId: 'zpf', status: '待开始', priority: '高', progress: 8, start: '2026-10-05', end: '2026-10-16', baselineStart: '2026-10-05', baselineEnd: '2026-10-16', dependencies: ['t9'], critical: true, locked: false },
  { id: 't12', key: 'QAI-12', title: '人工审批与异常回退验证', description: '验证外部系统写入、报价和关键动作的人工确认与回退。', type: 'task', level: 2, parentId: 't10', ownerId: 'zww', status: '待开始', priority: '最高', progress: 0, start: '2026-10-12', end: '2026-10-23', baselineStart: '2026-10-12', baselineEnd: '2026-10-23', dependencies: ['t11'], critical: true, locked: false },
  { id: 't13', key: 'QAI-13', title: '运行日志与验收指标验证', description: '核验运行日志、引用回源、成本、准确率和人工介入率。', type: 'task', level: 2, parentId: 't10', ownerId: 'xc', status: '待开始', priority: '高', progress: 0, start: '2026-10-19', end: '2026-10-30', baselineStart: '2026-10-19', baselineEnd: '2026-10-30', dependencies: ['t12'], critical: true, locked: false },
  { id: 't14', key: 'QAI-14', title: '阶段 4 · 治理验收与复制判断', description: '完成复盘、文档、验收和复制判断。', type: 'group', level: 1, parentId: 't1', ownerId: 'zww', status: '待开始', priority: '最高', progress: 0, start: '2026-11-02', end: '2026-11-13', baselineStart: '2026-11-02', baselineEnd: '2026-11-13', dependencies: ['t10'], critical: false, locked: false },
  { id: 't15', key: 'QAI-15', title: '交付文档、审计与复盘', description: '沉淀验收文档、版本记录、审计台账和持续运营计划。', type: 'task', level: 2, parentId: 't14', ownerId: 'zx', status: '待开始', priority: '高', progress: 0, start: '2026-11-02', end: '2026-11-10', baselineStart: '2026-11-02', baselineEnd: '2026-11-10', dependencies: ['t13'], critical: true, locked: false },
  { id: 't16', key: 'QAI-16', title: 'POC 验收与复制判断', description: '由授权负责人完成验收并确定是否进入标准化复制。', type: 'milestone', level: 2, parentId: 't14', ownerId: 'zww', status: '待开始', priority: '最高', progress: 0, start: '2026-11-13', end: '2026-11-13', baselineStart: '2026-11-13', baselineEnd: '2026-11-13', dependencies: ['t15'], critical: true, locked: true },
];

const NAV_ITEMS = [
  ['工作台', '⌂'], ['项目', '▣'], ['我的工作', '✓'], ['客户与经营', '◇'],
  ['知识库', '▤'], ['团队', '◉'], ['报表', '▥'],
] as const;

const TABS = ['概览', '待办池', '看板', '甘特图', '文档', '动态'];
const START_DATE = '2026-08-17';
const TOTAL_DAYS = 98;
const ROW_HEIGHT = 54;
const TASK_PANE_WIDTH = 620;
const DAY_WIDTH: Record<Zoom, number> = { 日: 44, 周: 26, 月: 14, 季: 8 };

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateString(date);
}

function dayDiff(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
}

function formatShort(value: string) {
  const date = parseDate(value);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function statusClass(status: TaskStatus) {
  return status === '已完成' ? 'done' : status === '进行中' ? 'active' : status === '待评审' ? 'review' : 'planned';
}

function memberOf(id: string) {
  return MEMBERS.find((member) => member.id === id) ?? MEMBERS[0];
}

function cloneTasks(tasks: Task[]) {
  return tasks.map((task) => ({ ...task, dependencies: [...task.dependencies] }));
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const tasksRef = useRef<Task[]>(INITIAL_TASKS);
  const [history, setHistory] = useState<Task[][]>([]);
  const [future, setFuture] = useState<Task[][]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [projectVersion, setProjectVersion] = useState(1);
  const [syncState, setSyncState] = useState<SyncState>('loading');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentActor, setCurrentActor] = useState<CurrentActor>({
    id: 'zww',
    name: '朱巍巍',
    short: '朱',
    role: '管理员',
    responsibilityTitle: '业务经营与智能体架构',
    isAdmin: true,
  });
  const [activeArea, setActiveArea] = useState('项目');
  const [activeTab, setActiveTab] = useState('甘特图');
  const [projectId, setProjectId] = useState('base');
  const [zoom, setZoom] = useState<Zoom>('周');
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isTaskPaneCollapsed, setIsTaskPaneCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showCritical, setShowCritical] = useState(false);
  const [showDependencies, setShowDependencies] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState('');
  const [newTask, setNewTask] = useState({ title: '', type: 'task' as TaskType, ownerId: 'zww', parentId: 't5', start: '2026-09-28', end: '2026-10-02' });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectVersionRef = useRef(1);
  const projectIdRef = useRef('base');
  const hydratedRef = useRef(false);
  const serverSnapshotHash = useRef(JSON.stringify(INITIAL_TASKS));
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const draggingRef = useRef(false);
  const loadSequence = useRef(0);
  const dayWidth = DAY_WIDTH[zoom];
  const timelineWidth = TOTAL_DAYS * dayWidth;
  const currentProject = PROJECTS.find((project) => project.id === projectId) ?? PROJECTS[0];

  function applyTaskState(next: Task[]) {
    tasksRef.current = next;
    setTasks(next);
  }

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }

  function commitTasks(updater: Task[] | ((current: Task[]) => Task[]), message?: string) {
    const current = tasksRef.current;
    const next = typeof updater === 'function' ? updater(cloneTasks(current)) : updater;
    setHistory((items) => [...items.slice(-29), cloneTasks(current)]);
    setFuture([]);
    applyTaskState(next);
    if (message) notify(message);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setHistory((items) => items.slice(0, -1));
    setFuture((items) => [cloneTasks(tasksRef.current), ...items].slice(0, 30));
    applyTaskState(cloneTasks(previous));
    notify('已撤销上一步修改');
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setHistory((items) => [...items.slice(-29), cloneTasks(tasksRef.current)]);
    applyTaskState(cloneTasks(next));
    notify('已恢复修改');
  }

  function patchTask(id: string, patch: Partial<Task>, message?: string) {
    commitTasks((items) => items.map((task) => task.id === id ? { ...task, ...patch } : task), message);
  }

  async function persistLatestTasks() {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
      syncTimer.current = null;
    }
    if (!hydratedRef.current || draggingRef.current) {
      saveQueued.current = true;
      return;
    }
    if (saveInFlight.current) {
      saveQueued.current = true;
      return;
    }

    const payloadTasks = cloneTasks(tasksRef.current);
    const payloadHash = JSON.stringify(payloadTasks);
    if (payloadHash === serverSnapshotHash.current) {
      setSyncState('saved');
      return;
    }

    const targetProjectId = projectIdRef.current;
    const expectedVersion = projectVersionRef.current;
    saveInFlight.current = true;
    saveQueued.current = false;
    setSyncState('saving');
    let continueQueuedSave = false;

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(targetProjectId)}/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion, tasks: payloadTasks }),
      });
      const payload = await response.json() as { projectVersion?: number; activity?: ActivityItem[]; message?: string };

      if (!response.ok) {
        if (response.status === 409) {
          setSyncState('conflict');
          notify(payload.message ?? '检测到其他成员的更新，请刷新项目后再继续。');
        } else {
          setSyncState('error');
          notify(payload.message ?? '共享数据保存失败，请稍后重试。');
        }
        return;
      }

      if (targetProjectId !== projectIdRef.current || typeof payload.projectVersion !== 'number') return;
      projectVersionRef.current = payload.projectVersion;
      setProjectVersion(payload.projectVersion);
      serverSnapshotHash.current = payloadHash;
      if (payload.activity) setActivities(payload.activity);

      const currentHash = JSON.stringify(tasksRef.current);
      if (currentHash === payloadHash) {
        setSyncState('saved');
      } else {
        saveQueued.current = true;
        continueQueuedSave = true;
      }
    } catch {
      setSyncState('error');
      notify('无法连接共享数据服务，当前修改尚未保存。');
    } finally {
      saveInFlight.current = false;
      if ((continueQueuedSave || saveQueued.current) && targetProjectId === projectIdRef.current) {
        syncTimer.current = setTimeout(() => void persistLatestTasks(), 120);
      }
    }
  }

  useEffect(() => {
    const sequence = loadSequence.current + 1;
    loadSequence.current = sequence;
    projectIdRef.current = projectId;
    hydratedRef.current = false;
    queueMicrotask(() => {
      if (loadSequence.current !== sequence) return;
      setHydrated(false);
      setSyncState('loading');
      setSelectedId(null);
      setHistory([]);
      setFuture([]);
    });

    void fetch(`/api/bootstrap?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as BootstrapPayload & { message?: string };
        if (!response.ok) throw new Error(payload.message ?? '共享数据读取失败');
        if (loadSequence.current !== sequence) return;
        const nextTasks = cloneTasks(payload.tasks);
        applyTaskState(nextTasks);
        setNewTask((value) => ({ ...value, parentId: nextTasks.find((task) => task.type === 'group')?.id ?? '' }));
        serverSnapshotHash.current = JSON.stringify(nextTasks);
        projectVersionRef.current = payload.projectVersion;
        setProjectVersion(payload.projectVersion);
        setCurrentActor(payload.me);
        setActivities(payload.activity);
        hydratedRef.current = true;
        setHydrated(true);
        setSyncState('saved');
      })
      .catch((error: unknown) => {
        if (loadSequence.current !== sequence) return;
        const fallback = projectId === 'base' ? cloneTasks(INITIAL_TASKS) : [];
        applyTaskState(fallback);
        serverSnapshotHash.current = JSON.stringify(fallback);
        setSyncState('error');
        notify(error instanceof Error ? error.message : '共享数据读取失败');
      });

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    const currentHash = JSON.stringify(tasks);
    if (currentHash === serverSnapshotHash.current) return;
    setSyncState('saving');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void persistLatestTasks(), 700);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  // Persistence is deliberately driven by the task snapshot rather than a
  // function identity that changes on each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, hydrated, projectId, projectVersion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (!typing && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setShowCreate(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!scrollerRef.current || activeTab !== '甘特图') return;
    const todayIndex = dayDiff(START_DATE, '2026-08-23');
    scrollerRef.current.scrollLeft = Math.max(0, todayIndex * dayWidth - 110);
  }, [dayWidth, activeTab]);

  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const visibleTasks = useMemo(() => {
    const matches = new Set<string>();
    const hasFilter = Boolean(query.trim()) || ownerFilter !== 'all' || statusFilter !== 'all';
    tasks.forEach((task) => {
      const searchHit = !query.trim() || `${task.key}${task.title}${memberOf(task.ownerId).name}`.toLowerCase().includes(query.trim().toLowerCase());
      const ownerHit = ownerFilter === 'all' || task.ownerId === ownerFilter;
      const statusHit = statusFilter === 'all' || task.status === statusFilter;
      if (searchHit && ownerHit && statusHit) {
        matches.add(task.id);
        let parentId = task.parentId;
        while (parentId) {
          matches.add(parentId);
          parentId = taskMap.get(parentId)?.parentId;
        }
      }
    });
    return tasks.filter((task) => {
      if (hasFilter && !matches.has(task.id)) return false;
      if (hasFilter) return true;
      let parentId = task.parentId;
      while (parentId) {
        if (collapsed.has(parentId)) return false;
        parentId = taskMap.get(parentId)?.parentId;
      }
      return true;
    });
  }, [tasks, taskMap, collapsed, query, ownerFilter, statusFilter]);

  const monthSegments = useMemo(() => {
    const segments: { label: string; count: number }[] = [];
    for (let i = 0; i < TOTAL_DAYS; i += 1) {
      const value = addDays(START_DATE, i);
      const date = parseDate(value);
      const label = `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
      const last = segments[segments.length - 1];
      if (last?.label === label) last.count += 1;
      else segments.push({ label, count: 1 });
    }
    return segments;
  }, []);

  const weekSegments = useMemo(() => Array.from({ length: Math.ceil(TOTAL_DAYS / 7) }, (_, index) => {
    const value = addDays(START_DATE, index * 7);
    const date = parseDate(value);
    return { label: `${date.getUTCMonth() + 1}/${String(date.getUTCDate()).padStart(2, '0')}`, count: Math.min(7, TOTAL_DAYS - index * 7) };
  }), []);

  const selectedTask = selectedId ? taskMap.get(selectedId) ?? null : null;

  function toggleCollapse(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startDrag(event: ReactPointerEvent, id: string, mode: 'move' | 'start' | 'end') {
    event.preventDefault();
    event.stopPropagation();
    const source = tasksRef.current.find((task) => task.id === id);
    if (!source || source.locked) {
      notify(source?.locked ? '该事项日期已锁定' : '无法调整该事项');
      return;
    }
    const snapshot = cloneTasks(tasksRef.current);
    const startX = event.clientX;
    let lastDelta = 0;
    let moved = false;
    draggingRef.current = true;
    document.body.classList.add('dragging');

    const onMove = (pointer: PointerEvent) => {
      const delta = Math.round((pointer.clientX - startX) / dayWidth);
      if (delta === lastDelta) return;
      lastDelta = delta;
      moved = true;
      const duration = dayDiff(source.start, source.end);
      const next = snapshot.map((task) => {
        if (task.id !== id) return task;
        if (task.type === 'milestone' || mode === 'move') return { ...task, start: addDays(source.start, delta), end: addDays(source.end, delta) };
        if (mode === 'start') {
          const clamped = Math.min(delta, duration);
          return { ...task, start: addDays(source.start, clamped) };
        }
        const clamped = Math.max(delta, -duration);
        return { ...task, end: addDays(source.end, clamped) };
      });
      applyTaskState(next);
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.classList.remove('dragging');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) {
        setHistory((items) => [...items.slice(-29), snapshot]);
        setFuture([]);
        notify(mode === 'move' ? '排期已移动并保存' : '工期已调整并保存');
        void persistLatestTasks();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function locateToday() {
    if (!scrollerRef.current) return;
    const todayIndex = dayDiff(START_DATE, '2026-08-23');
    scrollerRef.current.scrollTo({ left: Math.max(0, todayIndex * dayWidth - 150), behavior: 'smooth' });
    notify('已定位到今天 · 2026年8月23日');
  }

  function autoSchedule() {
    let changed = 0;
    const next = cloneTasks(tasksRef.current);
    const map = new Map(next.map((task) => [task.id, task]));
    next.forEach((task) => {
      if (!task.dependencies.length || task.locked || task.type === 'group') return;
      const predecessorEnds = task.dependencies.map((id) => map.get(id)?.end).filter(Boolean) as string[];
      if (!predecessorEnds.length) return;
      const latest = predecessorEnds.sort().at(-1) as string;
      const requiredStart = addDays(latest, 1);
      if (task.start < requiredStart) {
        const duration = dayDiff(task.start, task.end);
        task.start = requiredStart;
        task.end = addDays(requiredStart, duration);
        changed += 1;
      }
    });
    if (changed) commitTasks(next, `已按 FS 依赖自动调整 ${changed} 个事项`);
    else notify('当前排期已满足全部依赖关系');
  }

  function createTask() {
    if (!newTask.title.trim()) {
      notify('请先填写事项名称');
      return;
    }
    const parent = taskMap.get(newTask.parentId);
    const number = Math.max(...tasks.map((task) => Number(task.key.split('-').at(-1)) || 0)) + 1;
    const task: Task = {
      id: `task-${Date.now()}`,
      key: `${currentProject.key}-${number}`,
      title: newTask.title.trim(),
      description: '新事项已进入共享项目底账，可继续在右侧详情面板中完善。',
      type: newTask.type,
      level: parent ? Math.min(parent.level + 1, 2) : 0,
      parentId: parent?.id,
      ownerId: newTask.ownerId,
      status: '待开始',
      priority: '中',
      progress: 0,
      start: newTask.start,
      end: newTask.type === 'milestone' ? newTask.start : newTask.end,
      baselineStart: newTask.start,
      baselineEnd: newTask.type === 'milestone' ? newTask.start : newTask.end,
      dependencies: [],
      critical: false,
      locked: false,
    };
    commitTasks([...tasksRef.current, task], `${task.key} 已创建`);
    setSelectedId(task.id);
    setShowCreate(false);
    setNewTask((value) => ({ ...value, title: '' }));
  }

  function resetMock() {
    if (!currentActor.isAdmin) {
      notify('只有管理员可以恢复项目模板');
      return;
    }
    commitTasks(cloneTasks(INITIAL_TASKS), '底座项目模板已恢复');
    setCollapsed(new Set());
    setSelectedId(null);
  }

  function deleteTask(id: string) {
    const source = tasksRef.current.find((task) => task.id === id);
    if (!source || !currentActor.isAdmin) {
      notify('只有管理员可以归档事项');
      return;
    }
    if (!window.confirm(`归档 ${source.key}？其全部子事项也将一并归档。`)) return;
    const removedIds = new Set([id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const task of tasksRef.current) {
        if (task.parentId && removedIds.has(task.parentId) && !removedIds.has(task.id)) {
          removedIds.add(task.id);
          foundChild = true;
        }
      }
    }
    commitTasks(
      tasksRef.current
        .filter((task) => !removedIds.has(task.id))
        .map((task) => ({ ...task, dependencies: task.dependencies.filter((dependency) => !removedIds.has(dependency)) })),
      `${source.key} 及 ${removedIds.size - 1} 个子事项已归档`,
    );
    setSelectedId(null);
  }

  function switchArea(area: string) {
    setActiveArea(area);
    if (area !== '项目') setSelectedId(null);
  }

  async function changeProject(nextProjectId: string) {
    if (nextProjectId === projectId) return;
    await persistLatestTasks();
    setProjectId(nextProjectId);
  }

  const syncLabel: Record<SyncState, string> = {
    loading: '正在读取共享数据',
    saving: '正在保存',
    saved: '共享数据已同步',
    conflict: '检测到版本冲突',
    error: '共享服务连接失败',
  };
  const rootProjectTask = tasks.find((task) => task.type === 'group' && task.level === 0);
  const projectProgress = rootProjectTask?.progress ?? (tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0);
  const projectTarget = tasks.length ? [...tasks.map((task) => task.end)].sort().at(-1) : null;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">Q</span><span>企擎协作台</span></div>
        <div className="workspace-label">公司工作区</div>
        <nav>
          {NAV_ITEMS.map(([label, icon]) => (
            <button key={label} className={activeArea === label ? 'active' : ''} onClick={() => switchArea(label)}>
              <b aria-hidden="true">{icon}</b><span>{label}</span>{label === '我的工作' && <i>4</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {currentActor.isAdmin && <button className={activeArea === '管理设置' ? 'active' : ''} onClick={() => switchArea('管理设置')}><b>⚙</b><span>管理设置</span></button>}
          <div className="profile"><span>{currentActor.short}</span><div><strong>{currentActor.name}</strong><small>{currentActor.role}</small></div><em>⌄</em></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="project-switcher" onClick={() => switchArea('项目')}><span style={{ background: currentProject.color }}>{currentProject.short}</span><div><small>当前项目</small><strong>{currentProject.name}</strong></div><b>⌄</b></button>
          <label className="global-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、事项或成员" /><kbd>⌘ K</kbd></label>
          <button className="icon-button" aria-label="通知" onClick={() => notify('暂无新的通知')}>♢<i /></button>
          <div className="team-stack" aria-label="四位团队成员">{MEMBERS.map((member) => <span key={member.id} style={{ background: member.color }} title={`${member.name} · ${member.role}`}>{member.short}</span>)}</div>
          <button className="primary" onClick={() => setShowCreate(true)}>＋ 新建事项</button>
        </header>

        {activeArea === '项目' ? (
          <>
            <div className="project-head">
              <div className="breadcrumb"><span>项目</span><b>/</b><select value={projectId} disabled={syncState === 'saving' || syncState === 'loading'} onChange={(event) => void changeProject(event.target.value)}>{PROJECTS.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></div>
              <div className="title-line">
                <div><span className="project-icon" style={{ background: currentProject.color }}>{currentProject.short}</span><div><h1>{currentProject.name}</h1><p>共享项目底账 · Asia/Shanghai</p></div><span className={`health ${currentProject.health === '有风险' ? 'risk' : ''}`}>{currentProject.health}</span></div>
                <div className="project-stats"><span><b>{projectProgress}%</b>总体进度</span><span><b>{tasks.length}</b>事项</span><span><b>{projectTarget ? formatShort(projectTarget) : '未设定'}</b>目标</span><button onClick={() => notify('项目设置将在下一阶段开放')}>•••</button></div>
              </div>
              <div className="tabs">{TABS.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}{tab === '待办池' && <i>3</i>}</button>)}</div>
            </div>

            {activeTab === '甘特图' ? (
              <section className="gantt-card">
                <div className="gantt-toolbar">
                  <div className="toolbar-left">
                    <button
                      type="button"
                      className={`pane-toggle ${isTaskPaneCollapsed ? 'toggled' : ''}`}
                      aria-controls="gantt-task-pane"
                      aria-expanded={!isTaskPaneCollapsed}
                      title={isTaskPaneCollapsed ? '展开事项栏' : '收起事项栏'}
                      onClick={() => setIsTaskPaneCollapsed((value) => !value)}
                    >
                      <span aria-hidden="true">{isTaskPaneCollapsed ? '›' : '‹'}</span>
                      {isTaskPaneCollapsed ? '显示事项栏' : '隐藏事项栏'}
                    </button>
                    <label className="mini-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选事项…" /></label>
                    <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} aria-label="按负责人筛选"><option value="all">全部负责人</option>{MEMBERS.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="按状态筛选"><option value="all">全部状态</option>{(['待开始', '进行中', '待评审', '已完成'] as TaskStatus[]).map((status) => <option value={status} key={status}>{status}</option>)}</select>
                    <button className={showCritical ? 'toggled critical-toggle' : ''} onClick={() => setShowCritical((value) => !value)}>◆ 关键路径</button>
                    <button className={showBaseline ? 'toggled' : ''} onClick={() => setShowBaseline((value) => !value)}>基线</button>
                    <button className={showDependencies ? 'toggled' : ''} onClick={() => setShowDependencies((value) => !value)}>依赖</button>
                  </div>
                  <div className="toolbar-right">
                    <button onClick={undo} disabled={!history.length} title="撤销 Ctrl/⌘+Z">↶</button>
                    <button onClick={redo} disabled={!future.length} title="重做 Ctrl/⌘+Shift+Z">↷</button>
                    <button className="auto-button" onClick={autoSchedule}>⌁ 自动排期</button>
                    <button onClick={locateToday}>今天</button>
                    <div className="zoom-control">{(['日', '周', '月', '季'] as Zoom[]).map((item) => <button key={item} className={zoom === item ? 'active' : ''} onClick={() => setZoom(item)}>{item}</button>)}</div>
                  </div>
                </div>

                <div className="gantt-scroller" ref={scrollerRef}>
                  <div
                    className="gantt-inner"
                    style={{
                      gridTemplateColumns: isTaskPaneCollapsed ? `${timelineWidth}px` : `${TASK_PANE_WIDTH}px ${timelineWidth}px`,
                      width: timelineWidth + (isTaskPaneCollapsed ? 0 : TASK_PANE_WIDTH),
                    }}
                  >
                    <div id="gantt-task-pane" className="task-pane advanced" hidden={isTaskPaneCollapsed}>
                      <div className="task-header"><span>事项</span><span>负责人</span><span>状态</span><span>开始</span><span>工期</span></div>
                      {visibleTasks.map((task) => {
                        const owner = memberOf(task.ownerId);
                        const duration = dayDiff(task.start, task.end) + 1;
                        return (
                          <button className={`task-row ${selectedId === task.id ? 'selected' : ''} ${task.type}`} key={task.id} onClick={() => setSelectedId(task.id)}>
                            <span className="task-name" style={{ paddingLeft: task.level * 18 }}>
                              {task.type === 'group' ? <i className="collapse" onClick={(event) => { event.stopPropagation(); toggleCollapse(task.id); }}>{collapsed.has(task.id) ? '›' : '⌄'}</i> : <i className={`type-dot ${task.type}`} />}
                              <span><small>{task.key}{task.locked ? ' · 已锁定' : ''}</small><strong>{task.title}</strong></span>
                            </span>
                            <span className="owner-cell"><i style={{ background: owner.color }}>{owner.short}</i><em>{owner.name}</em></span>
                            <span><i className={`status-chip ${statusClass(task.status)}`}>{task.status}</i></span>
                            <span className="date-cell">{formatShort(task.start).replace('月', '/').replace('日', '')}</span>
                            <span className="duration-cell">{task.type === 'milestone' ? '—' : `${duration}天`}</span>
                          </button>
                        );
                      })}
                      <button className="inline-add" onClick={() => setShowCreate(true)}>＋ 添加事项 <kbd>C</kbd></button>
                    </div>

                    <div className="timeline-pane advanced" style={{ width: timelineWidth }}>
                      <div className="timeline-head">
                        <div className="month-row">{monthSegments.map((segment) => <span key={segment.label} style={{ width: segment.count * dayWidth }}>{segment.label}</span>)}</div>
                        <div className="week-row">{weekSegments.map((segment) => <span key={segment.label} style={{ width: segment.count * dayWidth }}>{segment.label}</span>)}</div>
                      </div>
                      <div className="timeline-body" style={{ height: visibleTasks.length * ROW_HEIGHT + 41 }}>
                        {Array.from({ length: TOTAL_DAYS }, (_, index) => {
                          const value = addDays(START_DATE, index);
                          const day = parseDate(value).getUTCDay();
                          return (day === 0 || day === 6) ? <span className="weekend" key={value} style={{ left: index * dayWidth, width: dayWidth, height: visibleTasks.length * ROW_HEIGHT }} /> : null;
                        })}
                        <span className="today-line" style={{ left: (dayDiff(START_DATE, '2026-08-23') + 0.5) * dayWidth, height: visibleTasks.length * ROW_HEIGHT }}><i>今天</i></span>
                        {showDependencies && (
                          <svg className="dependency-layer" width={timelineWidth} height={visibleTasks.length * ROW_HEIGHT} aria-hidden="true">
                            {visibleTasks.flatMap((task, rowIndex) => task.dependencies.map((dependencyId) => {
                              const predecessor = taskMap.get(dependencyId);
                              const predecessorIndex = visibleTasks.findIndex((item) => item.id === dependencyId);
                              if (!predecessor || predecessorIndex < 0) return null;
                              const x1 = (dayDiff(START_DATE, predecessor.end) + 1) * dayWidth - 5;
                              const x2 = dayDiff(START_DATE, task.start) * dayWidth + 4;
                              const y1 = predecessorIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                              const y2 = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                              const middle = Math.max(x1 + 12, x2 - 14);
                              return <g key={`${dependencyId}-${task.id}`} className={task.critical && predecessor.critical ? 'critical' : ''}><path d={`M ${x1} ${y1} H ${middle} V ${y2} H ${x2}`} /><circle cx={x2} cy={y2} r="2.8" /></g>;
                            }))}
                          </svg>
                        )}
                        {visibleTasks.map((task, rowIndex) => {
                          const left = dayDiff(START_DATE, task.start) * dayWidth;
                          const width = Math.max(dayWidth, (dayDiff(task.start, task.end) + 1) * dayWidth);
                          const baselineLeft = dayDiff(START_DATE, task.baselineStart) * dayWidth;
                          const baselineWidth = Math.max(dayWidth, (dayDiff(task.baselineStart, task.baselineEnd) + 1) * dayWidth);
                          const owner = memberOf(task.ownerId);
                          return (
                            <div className="timeline-row" key={task.id} style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}>
                              {showBaseline && task.type !== 'milestone' && <span className="baseline-bar" style={{ left: baselineLeft + 4, width: Math.max(6, baselineWidth - 8) }} />}
                              {task.type === 'milestone' ? (
                                <button className={`milestone ${task.critical && showCritical ? 'critical' : ''} ${selectedId === task.id ? 'selected' : ''}`} style={{ left: left + dayWidth / 2 - 9 }} onPointerDown={(event) => startDrag(event, task.id, 'move')} onDoubleClick={() => setSelectedId(task.id)} title={`${task.key} · ${task.title} · ${formatShort(task.start)}`}><i /></button>
                              ) : (
                                <button className={`gantt-bar ${task.type} ${statusClass(task.status)} ${task.critical ? 'is-critical' : ''} ${showCritical ? 'critical-mode' : ''} ${selectedId === task.id ? 'selected' : ''} ${task.locked ? 'locked' : ''}`} style={{ left: left + 4, width: Math.max(12, width - 8) }} onPointerDown={(event) => startDrag(event, task.id, 'move')} onDoubleClick={() => setSelectedId(task.id)} title={`${task.key} · ${formatShort(task.start)}—${formatShort(task.end)} · ${task.progress}%`}>
                                  {task.type !== 'group' && !task.locked && <span className="resize-handle left" onPointerDown={(event) => startDrag(event, task.id, 'start')} />}
                                  <span className="progress-fill" style={{ width: `${task.progress}%` }} />
                                  <span className="bar-label"><i style={{ background: owner.color }}>{owner.short}</i>{width > 135 && <b>{task.title}</b>}{width > 80 && <em>{task.progress}%</em>}</span>
                                  {task.type !== 'group' && !task.locked && <span className="resize-handle right" onPointerDown={(event) => startDrag(event, task.id, 'end')} />}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="gantt-footer"><span><b>{visibleTasks.length}</b> 个可见事项 · <b>{tasks.filter((task) => task.status === '进行中').length}</b> 个进行中 · <b>{tasks.filter((task) => task.critical).length}</b> 个关键事项</span><span><i className="legend baseline" />基线 <i className="legend critical" />关键路径 <i className="legend milestone-key" />里程碑 <i className={`sync-dot ${syncState}`} />{syncLabel[syncState]}</span></footer>
              </section>
            ) : <ProjectTabPreview tab={activeTab} tasks={tasks} onOpen={(id) => { setSelectedId(id); setActiveTab('甘特图'); }} />}
          </>
        ) : <AreaPreview area={activeArea} tasks={tasks} onOpen={(id) => { setActiveArea('项目'); setActiveTab('甘特图'); setSelectedId(id); }} />}
      </section>

      {selectedTask && activeArea === '项目' && activeTab === '甘特图' && (
        <>
          <button className="drawer-scrim" aria-label="关闭事项详情" onClick={() => setSelectedId(null)} />
          <aside className="detail-drawer">
            <div className="drawer-head"><div><span className={`issue-type ${selectedTask.type}`}>{selectedTask.type === 'group' ? '史诗' : selectedTask.type === 'milestone' ? '里程碑' : '任务'}</span><b>{selectedTask.key}</b></div><button onClick={() => setSelectedId(null)}>×</button></div>
            <div className="drawer-body">
              <input className="title-input" value={selectedTask.title} onChange={(event) => patchTask(selectedTask.id, { title: event.target.value })} />
              <label className="field-label">描述<textarea value={selectedTask.description} onChange={(event) => patchTask(selectedTask.id, { description: event.target.value })} rows={4} /></label>
              <div className="detail-grid">
                <label>状态<select value={selectedTask.status} onChange={(event) => patchTask(selectedTask.id, { status: event.target.value as TaskStatus }, '状态已更新')}>{(['待开始', '进行中', '待评审', '已完成'] as TaskStatus[]).map((status) => <option key={status}>{status}</option>)}</select></label>
                <label>负责人<select value={selectedTask.ownerId} onChange={(event) => patchTask(selectedTask.id, { ownerId: event.target.value }, '负责人已更新')}>{MEMBERS.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
                <label>优先级<select value={selectedTask.priority} onChange={(event) => patchTask(selectedTask.id, { priority: event.target.value as Task['priority'] })}>{['最高', '高', '中', '低'].map((priority) => <option key={priority}>{priority}</option>)}</select></label>
                <label>类型<select value={selectedTask.type} onChange={(event) => patchTask(selectedTask.id, { type: event.target.value as TaskType })}><option value="group">史诗</option><option value="task">任务</option><option value="milestone">里程碑</option></select></label>
                <label>开始日期<input type="date" value={selectedTask.start} disabled={selectedTask.locked} onChange={(event) => patchTask(selectedTask.id, { start: event.target.value })} /></label>
                <label>截止日期<input type="date" value={selectedTask.end} disabled={selectedTask.locked || selectedTask.type === 'milestone'} onChange={(event) => patchTask(selectedTask.id, { end: event.target.value })} /></label>
              </div>
              <label className="progress-field"><span>完成进度 <b>{selectedTask.progress}%</b></span><input type="range" min="0" max="100" step="5" value={selectedTask.progress} onChange={(event) => patchTask(selectedTask.id, { progress: Number(event.target.value) })} /></label>
              <div className="switch-list">
                <label><span><b>关键路径</b><small>高亮可能影响目标日期的事项</small></span><input type="checkbox" checked={selectedTask.critical} onChange={(event) => patchTask(selectedTask.id, { critical: event.target.checked })} /></label>
                <label><span><b>锁定日期</b><small>防止拖拽或自动排期改变日期</small></span><input type="checkbox" checked={selectedTask.locked} onChange={(event) => patchTask(selectedTask.id, { locked: event.target.checked })} /></label>
              </div>
              <section className="dependency-editor"><div className="section-title"><b>前置依赖</b><span>完成-开始（FS）</span></div>{selectedTask.dependencies.length ? selectedTask.dependencies.map((id) => { const dependency = taskMap.get(id); return dependency ? <div className="dependency-item" key={id}><span><small>{dependency.key}</small><b>{dependency.title}</b></span><button onClick={() => patchTask(selectedTask.id, { dependencies: selectedTask.dependencies.filter((item) => item !== id) }, '依赖已移除')}>×</button></div> : null; }) : <p className="empty-note">暂无前置依赖</p>}<select defaultValue="" onChange={(event) => { const id = event.target.value; if (id && !selectedTask.dependencies.includes(id)) patchTask(selectedTask.id, { dependencies: [...selectedTask.dependencies, id] }, '依赖已添加'); event.target.value = ''; }}><option value="">＋ 添加前置事项</option>{tasks.filter((task) => task.id !== selectedTask.id && task.type !== 'group').map((task) => <option value={task.id} key={task.id}>{task.key} · {task.title}</option>)}</select></section>
              <section className="activity"><div className="section-title"><b>最近动态</b><span>{activities.length} 条</span></div>{activities.length ? activities.slice(0, 3).map((item) => <div key={item.id}><i>{item.actorInitials}</i><p><b>{item.actorName}</b>{item.summary}<small>{formatActivityTime(item.occurredAt)}</small></p></div>) : <p className="empty-note">尚无共享操作记录</p>}</section>
            </div>
            <div className="drawer-footer"><button disabled={!currentActor.isAdmin} title={currentActor.isAdmin ? '归档事项' : '仅管理员可归档'} onClick={() => deleteTask(selectedTask.id)}>归档事项</button><button onClick={() => { setSelectedId(null); void persistLatestTasks(); notify('修改正在同步到共享项目底账'); }}>完成</button></div>
          </aside>
        </>
      )}

      {showCreate && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowCreate(false); }}>
          <section className="create-modal" role="dialog" aria-modal="true" aria-label="新建事项">
            <header><div><span>快速创建</span><h2>新建事项</h2></div><button onClick={() => setShowCreate(false)}>×</button></header>
            <div className="modal-body">
              <label className="field-label">事项名称<input autoFocus value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} placeholder="例如：完成知识库权限验收" /></label>
              <div className="detail-grid">
                <label>事项类型<select value={newTask.type} onChange={(event) => setNewTask({ ...newTask, type: event.target.value as TaskType })}><option value="task">任务</option><option value="milestone">里程碑</option><option value="group">史诗 / 阶段</option></select></label>
                <label>负责人<select value={newTask.ownerId} onChange={(event) => setNewTask({ ...newTask, ownerId: event.target.value })}>{MEMBERS.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
                <label>所属阶段<select value={newTask.parentId} onChange={(event) => setNewTask({ ...newTask, parentId: event.target.value })}><option value="">无上级</option>{tasks.filter((task) => task.type === 'group').map((task) => <option value={task.id} key={task.id}>{task.key} · {task.title}</option>)}</select></label>
                <label>开始日期<input type="date" value={newTask.start} onChange={(event) => setNewTask({ ...newTask, start: event.target.value })} /></label>
                {newTask.type !== 'milestone' && <label>截止日期<input type="date" value={newTask.end} onChange={(event) => setNewTask({ ...newTask, end: event.target.value })} /></label>}
              </div>
              <div className="create-hint"><b>提示</b><span>创建后可直接在甘特图上拖动排期，或在详情面板添加依赖关系。</span></div>
            </div>
            <footer><button onClick={() => setShowCreate(false)}>取消</button><button className="primary" onClick={createTask}>创建事项</button></footer>
          </section>
        </div>
      )}

      {activeArea === '管理设置' && currentActor.isAdmin && projectId === 'base' && <button className="reset-fab" onClick={resetMock}>↺ 恢复底座项目模板</button>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function ProjectTabPreview({ tab, tasks, onOpen }: { tab: string; tasks: Task[]; onOpen: (id: string) => void }) {
  if (tab === '概览') return <section className="module-page"><div className="metric-grid"><Metric label="总体进度" value="36%" note="较基线晚 1 天" tone="blue" /><Metric label="进行中" value="4" note="2 个待本周评审" tone="green" /><Metric label="关键事项" value="8" note="关键路径 82 天" tone="rose" /><Metric label="团队负载" value="78%" note="朱鹏飞本周偏高" tone="amber" /></div><div className="overview-grid"><section className="panel"><header><div><small>本周关注</small><h2>需要推进的事项</h2></div><button>查看全部</button></header>{tasks.filter((task) => task.status === '进行中').map((task) => <button className="attention-row" key={task.id} onClick={() => onOpen(task.id)}><i className={`priority ${task.priority === '最高' ? 'high' : ''}`} /><span><small>{task.key}</small><b>{task.title}</b></span><em>{memberOf(task.ownerId).name}</em><strong>{task.progress}%</strong></button>)}</section><section className="panel health-panel"><header><div><small>项目健康</small><h2>12 周 POC</h2></div><span className="health">正常</span></header><div className="health-ring"><b>36%</b><span>已完成</span></div><ul><li><span>计划工期</span><b>82 天</b></li><li><span>已消耗</span><b>29 天</b></li><li><span>预计偏差</span><b className="danger">+1 天</b></li></ul></section></div></section>;
  if (tab === '看板') return <section className="module-page board"><div className="board-toolbar"><h2>交付看板</h2><span>按状态分组 · {tasks.filter((task) => task.type !== 'group').length} 个事项</span></div><div className="board-columns">{(['待开始', '进行中', '待评审', '已完成'] as TaskStatus[]).map((status) => <section key={status}><header><span className={`status-dot ${statusClass(status)}`} />{status}<b>{tasks.filter((task) => task.status === status && task.type !== 'group').length}</b></header>{tasks.filter((task) => task.status === status && task.type !== 'group').map((task) => <button className="board-card" key={task.id} onClick={() => onOpen(task.id)}><small>{task.key} · {task.priority}</small><strong>{task.title}</strong><footer><i style={{ background: memberOf(task.ownerId).color }}>{memberOf(task.ownerId).short}</i><span>{formatShort(task.end)}</span></footer></button>)}</section>)}</div></section>;
  const copy: Record<string, [string, string]> = { '待办池': ['待办池与版本规划', '集中处理未排期事项、优先级和下一版本范围。'], '文档': ['项目文档中心', '沉淀方案、会议纪要、接口清单、验收记录和版本说明。'], '动态': ['项目动态与审计', '完整记录事项、排期、权限和关键决策的变更轨迹。'] };
  const [title, description] = copy[tab] ?? [tab, '该模块已纳入正式产品范围。'];
  return <section className="module-page simple-preview"><span className="preview-icon">▤</span><small>企擎协作台</small><h2>{title}</h2><p>{description}</p><div className="preview-list"><span><i />统一项目资料与版本</span><span><i />四人实时协作与责任追踪</span><span><i />与甘特排期、事项和验收记录关联</span></div><button onClick={() => onOpen('t9')}>返回核心事项</button></section>;
}

function AreaPreview({ area, tasks, onOpen }: { area: string; tasks: Task[]; onOpen: (id: string) => void }) {
  if (area === '工作台') return <section className="area-page"><div className="page-intro"><div><small>2026年8月23日 · 星期日</small><h1>晚上好，朱巍巍</h1><p>企业智能体底座本周有 4 个事项需要关注。</p></div><button onClick={() => onOpen('t9')}>进入项目甘特图 →</button></div><div className="metric-grid"><Metric label="进行中的项目" value="4" note="1 个项目有风险" tone="blue" /><Metric label="我的待办" value="7" note="今天到期 2 项" tone="green" /><Metric label="近期里程碑" value="3" note="最近：POC 验收" tone="rose" /><Metric label="待回款" value="¥ 8.6万" note="Mock 经营数据" tone="amber" /></div><div className="overview-grid"><section className="panel"><header><div><small>优先处理</small><h2>今天需要推进</h2></div></header>{tasks.filter((task) => task.critical && task.type === 'task').slice(0, 5).map((task) => <button className="attention-row" key={task.id} onClick={() => onOpen(task.id)}><i className="priority high" /><span><small>{task.key}</small><b>{task.title}</b></span><em>{memberOf(task.ownerId).name}</em><strong>{task.progress}%</strong></button>)}</section><section className="panel project-list"><header><div><small>项目组合</small><h2>5 个产品与 Demo</h2></div></header>{PROJECTS.map((project, index) => <div key={project.id}><i style={{ background: project.color }}>{project.short}</i><span><b>{project.name}</b><small>{index === 0 ? '36%' : `${12 + index * 9}%`} · {project.health}</small></span><em>{index === 0 ? '11/13' : '规划中'}</em></div>)}</section></div></section>;
  if (area === '团队') return <section className="area-page"><div className="page-intro"><div><small>团队与容量</small><h1>四人核心团队</h1><p>职责清晰、项目共享、朱巍巍拥有管理员权限。</p></div></div><div className="member-grid">{MEMBERS.map((member, index) => <section key={member.id}><header><i style={{ background: member.color }}>{member.short}</i><span><h2>{member.name}</h2><p>{member.id === 'zww' ? '管理员' : '成员'}</p></span><button>•••</button></header><p>{member.role}</p><div className="capacity"><span><b>本周负载</b><em>{[82, 68, 91, 56][index]}%</em></span><i><b style={{ width: `${[82, 68, 91, 56][index]}%` }} /></i></div><footer><span>{tasks.filter((task) => task.ownerId === member.id && task.status !== '已完成').length} 个进行事项</span><b>{index === 2 ? '偏高' : '正常'}</b></footer></section>)}</div></section>;
  if (area === '我的工作') return <section className="area-page"><div className="page-intro"><div><small>朱巍巍 · 我的工作</small><h1>当前待办</h1><p>按优先级和目标日期整理的个人事项。</p></div><button onClick={() => onOpen('t9')}>打开甘特图</button></div><section className="panel personal-list">{tasks.filter((task) => task.ownerId === 'zww' && task.type !== 'group').map((task) => <button key={task.id} onClick={() => onOpen(task.id)}><input type="checkbox" checked={task.status === '已完成'} readOnly /><span><small>{task.key} · {task.priority}</small><b>{task.title}</b></span><i className={`status-chip ${statusClass(task.status)}`}>{task.status}</i><em>{formatShort(task.end)}</em></button>)}</section></section>;
  if (area === '管理设置') return <section className="area-page"><div className="page-intro"><div><small>仅管理员可见</small><h1>工作区管理设置</h1><p>成员、权限、工作流、字段、日历与审计策略。</p></div></div><div className="settings-grid"><section className="panel"><header><div><small>角色权限</small><h2>四人账号</h2></div><span className="admin-badge">朱巍巍 · 管理员</span></header><div className="permission-table"><b>能力</b><b>管理员</b><b>成员</b>{['管理成员与权限', '创建与编辑事项', '删除项目', '查看审计日志', '导出全部数据'].map((item, index) => <span key={item} className="permission-row"><em>{item}</em><i>✓</i><i>{index === 1 ? '✓' : '—'}</i></span>)}</div></section><section className="panel settings-list"><header><div><small>项目规则</small><h2>管理配置</h2></div></header>{['工作流与状态', '自定义字段', '工作日历与节假日', '事项编号规则', '审计与数据导出'].map((item) => <button key={item}><span><b>{item}</b><small>使用企擎默认配置</small></span><i>›</i></button>)}</section></div></section>;
  const copy: Record<string, [string, string, string[]]> = { '客户与经营': ['客户与经营', '从线索、商机到合同、开票和回款的轻量经营协作。', ['客户与联系人', '商机与报价审批', '合同、开票与回款']], '知识库': ['公司知识库', '让方案、制度、会议和交付资产与项目上下文保持关联。', ['企业智能体技术底座', '四类 Demo 场景资产', '项目交付方法与验收规范']], '报表': ['项目组合报表', '从进度、风险、工时和团队容量观察公司的交付状态。', ['项目健康趋势', '关键路径与延期分析', '成员负载与交付效率']] };
  const [title, description, items] = copy[area] ?? [area, '该模块已纳入产品路线图。', ['统一数据', '团队协作', '权限审计']];
  return <section className="area-page feature-area"><div className="page-intro"><div><small>公司运营模块</small><h1>{title}</h1><p>{description}</p></div></div><div className="feature-grid">{items.map((item, index) => <section key={item}><span>{['01', '02', '03'][index]}</span><h2>{item}</h2><p>Mock 已定义入口、权限和与项目事项的关联方式，下一阶段接入真实数据。</p><button>查看设计范围 →</button></section>)}</div></section>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <section className={`metric ${tone}`}><span>{label}</span><b>{value}</b><small>{note}</small><i /></section>;
}
