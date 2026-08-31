export type TaskType = 'group' | 'task' | 'milestone';
export type TaskStatus = '待开始' | '进行中' | '待评审' | '已完成';
export type TaskPriority = '最高' | '高' | '中' | '低';

export type SharedTask = {
  id: string;
  key: string;
  title: string;
  description: string;
  type: TaskType;
  level: number;
  parentId?: string;
  ownerId: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  start: string;
  end: string;
  baselineStart: string;
  baselineEnd: string;
  dependencies: string[];
  critical: boolean;
  locked: boolean;
};

export const WORKSPACE_ID = 'xeng';

export const WORKSPACE_MEMBERS = [
  { id: 'zww', name: '朱巍巍', initials: '朱', color: '#dbeafe', accessRole: 'ADMIN', responsibilityTitle: '业务经营与智能体架构' },
  { id: 'zx', name: '张旭', initials: '张', color: '#dcfce7', accessRole: 'MEMBER', responsibilityTitle: '知识工程与数据研究' },
  { id: 'zpf', name: '朱鹏飞', initials: '鹏', color: '#fef3c7', accessRole: 'MEMBER', responsibilityTitle: '软件架构与系统集成' },
  { id: 'xc', name: '徐驰', initials: '徐', color: '#fae8ff', accessRole: 'MEMBER', responsibilityTitle: '行业探索与商务协同' },
] as const;

export const SEED_PROJECTS = [
  { id: 'base', key: 'QAI', name: '企业智能体底座 V1.0', shortName: 'AI', color: '#dff6ff', health: '正常', targetDate: '2026-11-13', nextTaskNumber: 17 },
  { id: 'cross', key: 'CBE', name: '跨境电商自动化运营', shortName: '跨', color: '#fef3c7', health: '正常', targetDate: null, nextTaskNumber: 1 },
  { id: 'care', key: 'CARE', name: '养护云现场管理', shortName: '养', color: '#dcfce7', health: '有风险', targetDate: null, nextTaskNumber: 1 },
  { id: 'mfg', key: 'MFG', name: '生产制造分析看板', shortName: '制', color: '#e0e7ff', health: '正常', targetDate: null, nextTaskNumber: 1 },
  { id: 'train', key: 'EDU', name: '数字员工训练平台', shortName: '训', color: '#fae8ff', health: '规划中', targetDate: null, nextTaskNumber: 1 },
] as const;

export const SEED_TASKS: SharedTask[] = [
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
