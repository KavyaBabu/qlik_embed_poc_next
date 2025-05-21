import { Tabs } from "@arqiva-cs/react-component-lib";
import QlikTable from "./QlikTable";
import { useState } from "react";

interface TabbedTableProps {
  appId: string;
  tenantUrl: string;
  webIntegrationId: string;
  tabs: { title: string; objectId: string }[];
}

export const QlikTabbedTables = ({
  appId,
  tenantUrl,
  webIntegrationId,
  tabs,
}: TabbedTableProps) => {
  const [activeTab, setActiveTab] = useState(tabs[0].title);

  const columnConfigsMap = {
    'Working Projects': [
      { key: 'projectName', label: 'Project Name' },
      { key: 'projectNumber', label: 'Project Number' },
      { key: 'projectManager', label: 'Project Manager' },
      { key: 'rag', label: 'RAG' },
      { key: 'phase', label: 'Phase' },
      { key: 'summary', label: 'Summary' },
      { key: 'investment', label: 'Investment Type' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
    ],
    'Closing Projects': [
      { key: 'projectName', label: 'Project Name' },
      { key: 'projectNumber', label: 'Project Number' },
      { key: 'rag', label: 'RAG' },
      { key: 'plannedEndDate', label: 'Planned End Date' },
      { key: 'summary', label: 'Summary' },
      { key: 'investment', label: 'Investment Type' },
    ],
    'Closed Projects': [
      { key: 'projectName', label: 'Project Name' },
      { key: 'projectNumber', label: 'Project Number' },
      { key: 'state', label: 'State' },
      { key: 'closingTask', label: 'Closing Task' },
      { key: 'totalBudget', label: 'Total Budget' },
      { key: 'totalActuals', label: 'Total Actuals' },
      { key: 'variance', label: 'Variance' },
      { key: 'actualEndMMMYYY', label: 'Actual End MMM-YYYY' },
      { key: 'plannedEndMMMYYY', label: 'Planned End MMM-YYYY' },
      { key: 'closedMMMYYY', label: 'Closed MMM-YYYY' },
      { key: 'withinOutsideDates', label: 'Within/Outside Dates' },
      { key: 'withinOutsideBudget', label: 'Within/Outside Budget' },
    ],
  };

  const currentTabConfigs = columnConfigsMap[activeTab] || [];

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List>
        {tabs.map(({ title }) => (
          <Tabs.Trigger key={title} value={title}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map(({ title, objectId }) => (
        <Tabs.Content key={title} value={title}>
          <QlikTable
            appId={appId}
            tenantUrl={tenantUrl}
            webIntegrationId={webIntegrationId}
            objectId={objectId}
            columnConfigs={currentTabConfigs} 
            activeTab={title}
          />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};
