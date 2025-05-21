import { Tabs } from "@arqiva-cs/react-component-lib";
import { QlikChartCard } from "./QlikChartCard";
import { useState } from "react";

export const QlikTabbedCharts = ({
  tabs,
  appId,
}: {
  appId: string;
  tabs: { title: string; chartObjectId: string }[];
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0].title);

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List>
        {tabs.map(({ title }) => (
          <Tabs.Trigger key={title} value={title}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {tabs.map(({ title, chartObjectId }) => (
        <Tabs.Content key={title} value={title}>
          <QlikChartCard chartObjectId={chartObjectId} appId={appId} title={title} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};
