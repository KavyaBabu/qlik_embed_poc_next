import React, { useState } from 'react';
import QlikChart from '../components/QlikChart';
import { QlikTabbedTables } from '../components/QlikTabbedTables';

type ChartType = 'bar' | 'doughnut' | 'pie';

const AnalyticsPage = () => {
  const appId = "3769696e-b88d-4d36-8f08-42f3dccf14f2";
  const tenantUrl = "arqiva.uk.qlikcloud.com";
  const webIntegrationId = "YoBCJI85s1J_cpJWDd4CPTdOzS1hcNhm";

  const chartConfigs: { objectId: string; chartType: ChartType; title: string }[] = [
    {
      objectId: "hpuZcp",
      chartType: "bar",
      title: "Closed Projects per Month",
    },
    {
      objectId: "mMNJj",
      chartType: "doughnut",
      title: "Timeline Adherence",
    },
    {
      objectId: "JWYTmD",
      chartType: "doughnut",
      title: "Budget Adherence",
    }
  ];

  const tableTabs = [
    { title: "Working Projects", objectId: "bcb5925e-0684-429b-a5e3-a8ff65c8b6b3" },
    { title: "Closing Projects", objectId: "c308dc15-46e8-4c03-bc37-ef0b27d76e69" },
    { title: "Closed Projects", objectId: "12bb7c6b-77a4-4915-b238-724ef1c5fa30" },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '1800px', margin: '0 auto', overflowX: 'hidden' }}>
      <h4 style={{ marginBottom: '30px', color: '#333' }}>Custom Reports</h4>

      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '20px', height: '450px'}}>
        {chartConfigs.map((config, index) => (
          <QlikChart
            key={index}
            appId={appId}
            tenantUrl={tenantUrl}
            webIntegrationId={webIntegrationId}
            objectId={config.objectId}
            chartType={config.chartType}
            title={config.title}
          />
        ))}
      </div>

      <div>
        <h4 style={{ marginBottom: '20px', color: '#333' }}>Project Metadata Tables</h4>
        <QlikTabbedTables
          appId={appId}
          tenantUrl={tenantUrl}
          webIntegrationId={webIntegrationId}
          tabs={tableTabs}
        />
      </div>
    </div>
  );
};

export default AnalyticsPage;