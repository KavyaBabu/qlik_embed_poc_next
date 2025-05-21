// components/DashboardLayout.tsx
import { Sidebar, SidebarTemplates, Logo } from "@arqiva-cs/react-component-lib";
import {
  ChartBarIcon,
  ChartPieIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { routes } from "../lib/routes";
import { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const router = useRouter();

  return (
    <Sidebar.Provider>
      <Sidebar.Root collapsible="icon">
        <Sidebar.Header>
          <Logo className="dashboard-logo" /> Meter Insight
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group.Root>
            <Sidebar.Group.Label>Analytics Dashboard</Sidebar.Group.Label>
            <Sidebar.Group.Content>
              <Sidebar.Menu.Root>
                <SidebarTemplates.CollapsibleMenuItem.Root
                  title="Portfolio Summary"
                  url="/dashboard"
                  icon={<ChartBarIcon />}
                >
                  {routes
                    .filter((route) =>
                      ["/dashboard", "/enterprise", "/utilities"].includes(route.path)
                    )
                    .map((route) => {
                      let label = "";
                      switch (route.path) {
                        case "/dashboard":
                          label = "M&B";
                          break;
                        case "/enterprise":
                        case "/utilities":
                          label = route.path
                            .substring(1)
                            .replace(/^\w/, (c) => c.toUpperCase());
                          break;
                      }
                      return (
                        <SidebarTemplates.CollapsibleMenuItem.SubItem
                          key={route.path}
                          url={route.path}
                        >
                          {label}
                        </SidebarTemplates.CollapsibleMenuItem.SubItem>
                      );
                    })}
                </SidebarTemplates.CollapsibleMenuItem.Root>

                {routes
                  .filter((route) => route.path === "/change-request")
                  .map((route) => (
                    <SidebarTemplates.SimpleMenuItem
                      key={route.path}
                      title="Project Change Request"
                      url={route.path}
                      icon={<ArrowPathIcon />}
                    />
                  ))}
                {routes
                  .filter((route) => route.path === "/risk-assessment")
                  .map((route) => (
                    <SidebarTemplates.SimpleMenuItem
                      key={route.path}
                      title="Risk Assessment"
                      url={route.path}
                      icon={<ExclamationTriangleIcon />}
                    />
                  ))}
                {routes
                  .filter((route) => route.path === "/issues")
                  .map((route) => (
                    <SidebarTemplates.SimpleMenuItem
                      key={route.path}
                      title="Issues"
                      url={route.path}
                      icon={<BugAntIcon />}
                    />
                  ))}
                {routes
                  .filter((route) => route.path === "/analytics")
                  .map((route) => (
                    <SidebarTemplates.SimpleMenuItem
                      key={route.path}
                      title="Custom Reports"
                      url={route.path}
                      icon={<ChartPieIcon />}
                    />
                  ))}
              </Sidebar.Menu.Root>
            </Sidebar.Group.Content>
          </Sidebar.Group.Root>
        </Sidebar.Content>
      </Sidebar.Root>
      <Sidebar.Inset>
        <Sidebar.Trigger />
        <main style={{ padding: "2rem" }}>{children}</main>
      </Sidebar.Inset>
    </Sidebar.Provider>
  );
};

export default DashboardLayout;
