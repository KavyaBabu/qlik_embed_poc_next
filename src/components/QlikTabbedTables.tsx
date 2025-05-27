import { Tabs } from '@arqiva-cs/react-component-lib';
import React, { useState } from 'react';
import QlikTable from './QlikTable';
import QlikTableRowClickable from './QlikTableRowClickable';

export type TabName = 'Working Projects' | 'Closing Projects' | 'Closed Projects';

interface Tab {
  title: 'Working Projects' | 'Closing Projects' | 'Closed Projects';
  objectId: string;
}

interface QlikTabbedTablesProps {
  appId: string;
  tenantUrl: string;
  webIntegrationId: string;
  tabs: Tab[];
  onSelectionChange?: () => void;
}

const COLUMN_CONFIGS = {
  'Working Projects': [
    { key: 'projectName', label: 'Project Name', width: '200px' },
    { key: 'projectNumber', label: 'Project Number', width: '120px' },
    { key: 'projectManager', label: 'Project Manager', width: '150px' },
    { key: 'rag', label: 'RAG', width: '60px' },
    { key: 'phase', label: 'Phase', width: '100px' },
    { key: 'summary', label: 'Summary', width: '300px' },
    { key: 'investment', label: 'Investment', width: '120px' },
    { key: 'startDate', label: 'Start Date', width: '100px' },
    { key: 'endDate', label: 'End Date', width: '100px' },
  ],
  'Closing Projects': [
    { key: 'projectName', label: 'Project Name', width: '200px' },
    { key: 'projectNumber', label: 'Project Number', width: '120px' },
    { key: 'rag', label: 'RAG', width: '60px' },
    { key: 'plannedEndDate', label: 'Planned End Date', width: '120px' },
    { key: 'summary', label: 'Summary', width: '300px' },
    { key: 'investment', label: 'Investment', width: '120px' },
  ],
  'Closed Projects': [
    { key: 'projectName', label: 'Project Name', width: '200px' },
    { key: 'projectNumber', label: 'Project Number', width: '120px' },
    { key: 'state', label: 'State', width: '100px' },
    { key: 'closingTask', label: 'Closing Task', width: '150px' },
    { key: 'totalBudget', label: 'Total Budget', width: '120px' },
    { key: 'totalActuals', label: 'Total Actuals', width: '120px' },
    { key: 'variance', label: 'Variance', width: '100px' },
    { key: 'actualEndMMMYYY', label: 'Actual End', width: '100px' },
    { key: 'plannedEndMMMYYY', label: 'Planned End', width: '100px' },
    { key: 'closedMMMYYY', label: 'Closed', width: '100px' },
    { key: 'withinOutsideDates', label: 'Within/Outside Dates', width: '120px' },
    { key: 'withinOutsideBudget', label: 'Within/Outside Budget', width: '120px' },
  ],
};

export const QlikTabbedTables: React.FC<QlikTabbedTablesProps> = ({
  appId,
  tenantUrl,
  webIntegrationId,
  tabs,
  onSelectionChange,
}) => {
  const [activeTab, setActiveTab] = useState<TabName>(tabs[0]?.title || 'Working Projects');

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => {
        if (tabs.some((tab) => tab.title === value)) {
          setActiveTab(value as TabName);
        }
      }}
    >
      <Tabs.List>
        {tabs.map(({ title }) => (
          <Tabs.Trigger key={title} value={title}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map(({ title, objectId }) => {
        const CommonProps = {
          appId,
          tenantUrl,
          webIntegrationId,
          objectId,
          columnConfigs: COLUMN_CONFIGS[title],
          activeTab: title,
        };

        return (
          <Tabs.Content key={title} value={title}>
            {onSelectionChange ? (
              <QlikTableRowClickable {...CommonProps} onSelectionChange={onSelectionChange} />
            ) : (
              <QlikTable {...CommonProps} />
            )}
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
};
