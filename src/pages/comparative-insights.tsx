import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QlikSelections } from 'components/QlikSelections';
import { QlikTabbedTables } from '../components/QlikTabbedTables';
import { Card } from '@arqiva-cs/react-component-lib';
import { connectToQlik } from '../utils/qlikConnection';

const QlikEmbed = 'qlik-embed' as any;

const QLIK_CONFIG = {
  appId: '3769696e-b88d-4d36-8f08-42f3dccf14f2',
  tenantUrl: 'arqiva.uk.qlikcloud.com',
  webIntegrationId: 'YoBCJI85s1J_cpJWDd4CPTdOzS1hcNhm',
};

const TOP_CHARTS = [
  {
    title: 'Working Projects Chart',
    chartObjectId: 'hpuZcp',
    numberObjectId: 'CFbhg',
  },
  {
    title: 'Closing Projects Chart',
    chartObjectId: 'mMNJj',
    numberObjectId: 'DvBkmPp',
  },
  {
    title: 'Closed Projects Chart',
    chartObjectId: 'JWYTmD',
    numberObjectId: 'ffEppG',
  },
];

const TABBED_TABLES = [
  { title: 'Working Projects' as const, objectId: 'bcb5925e-0684-429b-a5e3-a8ff65c8b6b3' },
  { title: 'Closing Projects' as const, objectId: 'c308dc15-46e8-4c03-bc37-ef0b27d76e69' },
  { title: 'Closed Projects' as const, objectId: '12bb7c6b-77a4-4915-b238-724ef1c5fa30' },
];

interface ChartCardProps {
  title: string;
  chartObjectId: string;
  numberObjectId?: string;
  appId: string;
  onChartClick: (chartId: string, title: string) => void;
  isActive: boolean;
}

const InteractiveChartCard: React.FC<ChartCardProps> = React.memo(
  ({ title, chartObjectId, numberObjectId, appId, onChartClick, isActive }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
      setIsClient(true);
    }, []);

    const handleEmbedClick = useCallback(
      (event: Event) => {
        event.preventDefault();
        onChartClick(chartObjectId, title);
      },
      [chartObjectId, title, onChartClick],
    );

    useEffect(() => {
      if (!isClient || !chartRef.current) return;

      const timer = setTimeout(() => {
        const qlikEmbeds = chartRef.current?.querySelectorAll('qlik-embed');
        qlikEmbeds?.forEach((embed) => {
          embed.removeEventListener('click', handleEmbedClick as EventListener);
          embed.addEventListener('click', handleEmbedClick as EventListener);
        });
      }, 1500);

      return () => clearTimeout(timer);
    }, [isClient, chartObjectId, handleEmbedClick]);

    if (!isClient) return null;

    return (
      <Card
        className="dashboard-card"
        style={{
          border: isActive ? '1px solid rgb(64, 152, 173)' : undefined,
          boxShadow: isActive ? '0 0 4px rgb(64, 152, 173)' : undefined,
        }}
      >
        {numberObjectId && (
          <div className="qlik-number-container" style={{ marginBottom: '12px' }}>
            <QlikEmbed
              ui="analytics/chart"
              app-id={appId}
              object-id={numberObjectId}
              noInteraction="true"
            />
          </div>
        )}

        <div ref={chartRef} className="qlik-chart-container">
          <QlikEmbed
            ui="analytics/chart"
            app-id={appId}
            object-id={chartObjectId}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </Card>
    );
  },
);
InteractiveChartCard.displayName = 'InteractiveChartCard';

interface QlikApp {
  clearAll: () => Promise<void>;
  getObject: (id: string) => Promise<any>;
  getField: (fieldName: string) => Promise<any>;
  on: (event: string, callback: () => void) => void;
  removeAllListeners: () => void;
}

const ComparativeInsightsPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [qlikApp, setQlikApp] = useState<QlikApp | null>(null);
  const [activeChart, setActiveChart] = useState<string | null>(null);
  const [activeChartTitle, setActiveChartTitle] = useState<string | null>(null);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSelectionChange = useCallback(() => {
    setTableRefreshKey((prev) => prev + 1);
  }, []);

  const refreshAllCharts = useCallback(async () => {
    if (!qlikApp) return;

    try {
      await Promise.all(
        TOP_CHARTS.map((chart) =>
          qlikApp
            .getObject(chart.chartObjectId)
            .then((obj) => obj.getLayout())
            .catch((err) => console.error(`Error refreshing chart ${chart.chartObjectId}:`, err)),
        ),
      );
    } catch (error) {
      console.error('Error refreshing charts:', error);
    }
  }, [qlikApp]);

  const clearAllSelections = useCallback(async () => {
    if (!qlikApp) return;

    try {
      setIsLoading(true);
      await qlikApp.clearAll();
    } catch (error) {
      console.error('Failed to clear selections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [qlikApp]);

  const handleChartClick = useCallback(
    async (chartId: string, title: string) => {
      if (!qlikApp) return;

      setIsLoading(true);
      setActiveChart(chartId);
      setActiveChartTitle(title);

      try {
        const chartObject = await qlikApp.getObject(chartId);
        const layout = await chartObject.getLayout();

        if (layout.qHyperCube?.qDataPages?.[0]?.qMatrix?.[0]?.[0]?.qElemNumber !== undefined) {
          await chartObject.selectHyperCubeValues(
            '/qHyperCubeDef',
            0,
            [layout.qHyperCube.qDataPages[0].qMatrix[0][0].qElemNumber],
            false,
          );
        } else {
          const possibleFields = ['ProjectStatus', 'ProjectType', 'RAG', 'Phase'];
          for (const fieldName of possibleFields) {
            try {
              const field = await qlikApp.getField(fieldName);
              const fieldData = await field.getData();

              if (
                fieldData?.qListObject?.qDataPages?.[0]?.qMatrix?.[0]?.[0]?.qElemNumber !==
                undefined
              ) {
                await field.selectValues(
                  [fieldData.qListObject.qDataPages[0].qMatrix[0][0].qElemNumber],
                  true,
                  false,
                );
                break;
              }
            } catch (fieldError) {
              console.log(`Field ${fieldName} not available:`, fieldError);
            }
          }
        }

        await refreshAllCharts();
      } catch (error) {
        console.error('Error handling chart click:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [qlikApp, refreshAllCharts],
  );

  useEffect(() => {
    if (!isClient) return;

    const initializeQlik = async () => {
      try {
        const { app } = await connectToQlik(
          QLIK_CONFIG.appId,
          QLIK_CONFIG.tenantUrl,
          QLIK_CONFIG.webIntegrationId,
        );
        setQlikApp(app);

        const events = [
          'changed',
          'selectionActivated',
          'selectionConfirmed',
          'selectionAborted',
          'selectionCleared',
        ];

        events.forEach((event) => {
          app.on(event, () => {
            if (event === 'selectionCleared') {
              setActiveChart(null);
              setActiveChartTitle(null);
            }
            handleSelectionChange();
          });
        });
      } catch (error) {
        console.error('Failed to initialize Qlik connection:', error);
      }
    };

    initializeQlik();

    return () => {
      if (qlikApp) {
        qlikApp.removeAllListeners();
      }
    };
  }, [isClient, handleSelectionChange, qlikApp]);

  if (!isClient) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h5>QlikSync Insight Dashboard (Qlik vs Custom)</h5>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeChartTitle && (
            <span
              style={{
                padding: '6px 12px',
                backgroundColor: '#e3f2fd',
                color: '#1976d2',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              Active: {activeChartTitle}
            </span>
          )}
          {isLoading && <span style={{ fontSize: '14px', color: '#666' }}>🔄 Updating...</span>}
          <button
            onClick={clearAllSelections}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: '1px solid #1976d2',
              borderRadius: '4px',
              background: '#fff',
              color: '#1976d2',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Clear All Filters
          </button>
        </div>
      </div>

      <QlikSelections appId={QLIK_CONFIG.appId} />

      <div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {TOP_CHARTS.map((chart) => (
            <InteractiveChartCard
              key={chart.chartObjectId}
              title={chart.title}
              chartObjectId={chart.chartObjectId}
              numberObjectId={chart.numberObjectId}
              appId={QLIK_CONFIG.appId}
              onChartClick={handleChartClick}
              isActive={activeChart === chart.chartObjectId}
            />
          ))}
        </div>
      </div>

      <div>
        <QlikTabbedTables
          key={tableRefreshKey}
          appId={QLIK_CONFIG.appId}
          tenantUrl={QLIK_CONFIG.tenantUrl}
          webIntegrationId={QLIK_CONFIG.webIntegrationId}
          tabs={TABBED_TABLES}
        />
      </div>
    </div>
  );
};

export default ComparativeInsightsPage;
