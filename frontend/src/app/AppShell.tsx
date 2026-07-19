import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BookOpenText,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  ClipboardCheck,
  Compass,
  FileClock,
  Gauge,
  GraduationCap,
  LibraryBig,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { useApp } from "./AppContext";
import { navigate, routeTitles, type RouteId } from "./router";
import type { RoleSpace } from "../types";
import { Button, DemoBadge, IconButton, StatusBadge } from "../shared/ui";

const roleItems: Record<
  RoleSpace,
  Array<{ id: RouteId; label: string; icon: typeof Compass }>
> = {
  advisor: [
    { id: "today", label: "今日机会", icon: Compass },
    { id: "followup", label: "客户沟通", icon: Activity },
    { id: "studio", label: "内容作战台", icon: Sparkles },
    { id: "promises", label: "跟进与承诺", icon: FileClock },
    { id: "customers", label: "客户档案", icon: UsersRound },
  ],
  manager: [
    { id: "manager-radar", label: "门店雷达", icon: Gauge },
    { id: "review", label: "审核队列", icon: ClipboardCheck },
    { id: "customer-risks", label: "客户风险", icon: ShieldAlert },
    { id: "quality", label: "质量与辅导", icon: GraduationCap },
    { id: "promises", label: "承诺履约", icon: FileClock },
    { id: "campaigns", label: "活动执行", icon: CalendarRange },
  ],
  hq: [
    { id: "hotspots", label: "热点与洞察", icon: Target },
    { id: "knowledge", label: "知识中心", icon: LibraryBig },
    { id: "policies", label: "政策与权益", icon: FileClock },
    { id: "campaigns", label: "活动编排", icon: CalendarRange },
    { id: "best-practices", label: "优秀案例", icon: BookOpenText },
    { id: "experiments", label: "效果验证", icon: Gauge },
    { id: "governance", label: "系统治理", icon: Settings2 },
  ],
};

const utilityItems: Array<{
  id: RouteId;
  label: string;
  icon: typeof Settings2;
}> = [
  { id: "advisors", label: "顾问与门店", icon: Building2 },
  { id: "settings", label: "系统设置", icon: Settings2 },
  { id: "about", label: "方案说明", icon: BookOpenText },
];

const roleLabel: Record<RoleSpace, string> = {
  advisor: "顾问空间",
  manager: "门店经理空间",
  hq: "总部运营空间",
};

const roleHome: Record<RoleSpace, RouteId> = {
  advisor: "today",
  manager: "manager-radar",
  hq: "hotspots",
};

const collapseKey = "weijian:navigation-collapsed";

export function AppShell({
  route,
  children,
}: {
  route: RouteId;
  children: ReactNode;
}) {
  const {
    boot,
    health,
    workspace,
    dataMode,
    refreshing,
    connectionError,
    switchingRole,
    roleSyncError,
    refreshAll,
    switchRole,
    retryRoleSync,
    enterLocalDemo,
    toast,
  } = useApp();
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [environmentOpen, setEnvironmentOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(collapseKey) === "true",
  );

  const page = routeTitles[route];
  const role = workspace.enterprise?.enterprise_meta?.current_role || "advisor";
  const actorId = workspace.enterprise?.enterprise_meta?.current_actor_id;
  const advisor =
    boot.advisors.find((item) => item.id === actorId) ||
    boot.advisors.find((item) => item.id === "advisor-hz-02") ||
    boot.advisors[0];
  const identity =
    role === "advisor"
      ? {
          name: advisor?.name || "顾问演示用户",
          detail: `${advisor?.store || "演示门店"} · 顾问`,
        }
      : role === "manager"
        ? { name: "门店经理 Demo", detail: "杭州城西体验店 · 经理演示" }
        : { name: "总部运营 Demo", detail: "总部运营空间 · 角色演示" };
  const navItems = useMemo(() => roleItems[role], [role]);

  useEffect(() => {
    setUtilityOpen(false);
    setAccountOpen(false);
    setSpaceOpen(false);
    setEnvironmentOpen(false);
  }, [route]);

  useEffect(() => {
    window.localStorage.setItem(collapseKey, String(collapsed));
  }, [collapsed]);

  function changeRole(next: RoleSpace) {
    if (switchingRole || next === role) return;
    switchRole(next);
    navigate(roleHome[next]);
    setSpaceOpen(false);
  }

  const environmentLabel =
    dataMode === "live"
      ? "在线演示"
      : dataMode === "stale_online"
        ? "在线数据暂时陈旧"
        : "本地演示";

  return (
    <div className={collapsed ? "app-shell nav-collapsed" : "app-shell"}>
      <aside className="side-rail" aria-label="主导航">
        <button
          className="brand"
          onClick={() => navigate(roleHome[role])}
          aria-label="返回当前空间首页"
        >
          <span className="brand-mark">蔚</span>
          <span className="brand-copy">
            <strong>蔚见</strong>
            <small>客户经营与销售质量中枢</small>
          </span>
        </button>

        <div className="space-switcher-wrap">
          <button
            className="space-switcher role-space-label"
            data-testid="space-switcher"
            aria-expanded={spaceOpen}
            disabled={switchingRole}
            onClick={() => setSpaceOpen((value) => !value)}
          >
            <span>
              <strong>{roleLabel[role]}</strong>
              <small>
                {role === "advisor"
                  ? `${advisor?.name || "顾问"} · ${advisor?.store || "演示门店"}`
                  : identity.detail}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
          {spaceOpen ? (
            <div className="space-popover" role="menu">
              <p>切换角色演示空间</p>
              {(["advisor", "manager", "hq"] as RoleSpace[]).map((value) => (
                <button
                  key={value}
                  data-testid={`switch-role-${value}`}
                  className={role === value ? "active" : ""}
                  disabled={switchingRole}
                  onClick={() => changeRole(value)}
                >
                  <strong>{roleLabel[value]}</strong>
                  <small>
                    {value === "advisor"
                      ? "机会、沟通与客户经营"
                      : value === "manager"
                        ? "审核、风险与辅导"
                        : "知识、热点与系统治理"}
                  </small>
                </button>
              ))}
              <DemoBadge>角色演示，未接入企业 RBAC</DemoBadge>
            </div>
          ) : null}
        </div>

        <nav className="primary-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={item.id === route ? "nav-item active" : "nav-item"}
                aria-current={item.id === route ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            className={
              utilityItems.some((item) => item.id === route)
                ? "nav-item active"
                : "nav-item"
            }
            title={collapsed ? "管理与设置" : undefined}
            onClick={() => setUtilityOpen((value) => !value)}
          >
            <Settings2 size={19} />
            <span>管理与设置</span>
            <ChevronDown size={15} className={utilityOpen ? "rotate" : ""} />
          </button>
        </nav>

        <div className="rail-footer">
          <button className="rail-help" onClick={() => navigate("about")}>
            <CircleHelp size={17} />
            <span>数据边界与帮助</span>
          </button>
          <button
            className="rail-environment"
            onClick={() => setEnvironmentOpen((value) => !value)}
          >
            <span className={`mode-dot mode-${dataMode}`} />
            <span>{environmentLabel}</span>
          </button>
          <IconButton
            label={collapsed ? "展开导航" : "收起导航"}
            className="rail-collapse"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </IconButton>
          {environmentOpen ? (
            <div className="environment-popover">
              <StatusBadge
                tone={
                  dataMode === "live"
                    ? "success"
                    : dataMode === "stale_online"
                      ? "warning"
                      : "demo"
                }
              >
                {environmentLabel}
              </StatusBadge>
              <strong>
                {dataMode === "live"
                  ? "API 已连接"
                  : dataMode === "stale_online"
                    ? "继续使用最近成功数据"
                    : "未连接生产系统"}
              </strong>
              <p>
                API {health?.app_version || health?.version || "唤醒中"} ·
                Schema {health?.api_schema_version || "待确认"}
              </p>
              <button onClick={() => navigate("about")}>查看完整边界</button>
            </div>
          ) : null}
        </div>
      </aside>

      {utilityOpen ? (
        <div className="manage-layer" onClick={() => setUtilityOpen(false)}>
          <aside
            className="manage-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="manage-heading">
              <div>
                <strong>管理与设置</strong>
                <p>维护画像、服务诊断与方案边界</p>
              </div>
              <IconButton
                label="关闭管理面板"
                onClick={() => setUtilityOpen(false)}
              >
                <X size={18} />
              </IconButton>
            </div>
            <div className="manage-list">
              {utilityItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    className={
                      route === item.id ? "manage-item active" : "manage-item"
                    }
                  >
                    <Icon size={19} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{routeTitles[item.id].subtitle}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="page-heading">
            <h1>{page.title}</h1>
            <p>{page.subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button
              className="environment-chip demo-label"
              onClick={() => setEnvironmentOpen((value) => !value)}
            >
              <span className={`mode-dot mode-${dataMode}`} />
              {environmentLabel}
            </button>
            <IconButton
              label="刷新数据"
              onClick={() => void refreshAll()}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "spin" : ""} size={18} />
            </IconButton>
            <div className="account-menu">
              <button
                className="account-button"
                data-testid="account-menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((value) => !value)}
              >
                <CircleUserRound size={20} />
                <span>
                  <strong>{identity.name}</strong>
                  <small>{identity.detail}</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {accountOpen ? (
                <div className="account-popover role-popover">
                  <strong>{identity.name}</strong>
                  <p>{identity.detail}</p>
                  <DemoBadge>角色演示，不代表已接入企业 RBAC</DemoBadge>
                  <button onClick={() => navigate("about")}>
                    数据边界与帮助
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {connectionError && dataMode === "stale_online" ? (
          <div className="connection-banner" data-testid="stale-online-banner">
            <span>
              后端正在唤醒或部分请求失败，当前保留最近成功数据：
              {connectionError}
            </span>
            <div>
              <Button variant="secondary" onClick={() => void refreshAll()}>
                重新连接
              </Button>
              <Button variant="ghost" onClick={enterLocalDemo}>
                进入本地演示
              </Button>
            </div>
          </div>
        ) : null}

        {roleSyncError ? (
          <div
            className="connection-banner role-sync-banner"
            data-testid="role-sync-error"
          >
            <span>角色已在本地切换，但审计同步失败：{roleSyncError}</span>
            <Button
              variant="secondary"
              loading={switchingRole}
              onClick={() => void retryRoleSync()}
            >
              重试审计同步
            </Button>
          </div>
        ) : null}

        <main className="page-content">{children}</main>
      </div>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
