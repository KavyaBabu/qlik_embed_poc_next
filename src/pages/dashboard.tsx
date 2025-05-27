import { QlikSelections } from 'components/QlikSelections';
import { QlikChartCard } from '../components/QlikChartCard';
import { QlikTabbedCharts } from '../components/QlikTabbedCharts';

const appId = '3769696e-b88d-4d36-8f08-42f3dccf14f2';

const summaryCards = [
  { title: 'Working Projects', numberObjectId: 'CFbhg', chartObjectId: 'hpuZcp' },
  { title: 'Closing Projects', numberObjectId: 'DvBkmPp', chartObjectId: 'mMNJj' },
  { title: 'Closed Projects', numberObjectId: 'ffEppG', chartObjectId: 'JWYTmD' },
];

const tabbedCharts = [
  { title: 'Working Projects', chartObjectId: 'bcb5925e-0684-429b-a5e3-a8ff65c8b6b3' },
  { title: 'Closing Projects', chartObjectId: 'c308dc15-46e8-4c03-bc37-ef0b27d76e69' },
  { title: 'Closed Projects', chartObjectId: '12bb7c6b-77a4-4915-b238-724ef1c5fa30' },
];

const DashboardPage = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <h4>Portfolio Summary - M&B</h4>
    <QlikSelections appId={appId} />
    <div style={{ display: 'flex', gap: '24px' }}>
      {summaryCards.map((card) => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default DashboardPage;
