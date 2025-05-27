import { QlikSelections } from 'components/QlikSelections';
import { QlikChartCard } from '../components/QlikChartCard';
import { QlikTabbedCharts } from '../components/QlikTabbedCharts';

const appId = '3769696e-b88d-4d36-8f08-42f3dccf14f2';

const summaryCards = [
  {
    title: 'Working Projects',
    numberObjectId: '5d9b8250-070c-4f2e-95c9-0995025dea84',
    chartObjectId: '1c41561d-c9b4-428f-b3b7-26ebe9583aab',
  },
  {
    title: 'Closing Projects',
    numberObjectId: '9eb5a34b-c487-455d-9540-50e67ede72e5',
    chartObjectId: '525da35d-cfa4-4301-909e-9456cffd6d95',
  },
  {
    title: 'Closed Projects',
    numberObjectId: 'b72b5de3-132e-40f7-99b7-f2eebdbb61e9',
    chartObjectId: '986276cc-00be-4a9f-bf74-98faf587b937',
  },
];

const tabbedCharts = [
  { title: 'Working Projects', chartObjectId: 'b889a555-54a9-414a-9757-880a5635fb8b' },
  { title: 'Closing Projects', chartObjectId: '5c433e26-613c-4302-9d17-d74863da3275' },
  { title: 'Closed Projects', chartObjectId: 'ad972675-5ccc-41d3-8337-502e7487145b' },
];

const UtilitiesPage = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <h4>Portfolio Summary - Utilities</h4>
    <QlikSelections appId={appId} />
    <div style={{ display: 'flex', gap: '24px' }}>
      {summaryCards.map((card) => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default UtilitiesPage;
