import { QlikSelections } from 'components/QlikSelections';
import { QlikChartCard } from '../components/QlikChartCard';
import { QlikTabbedCharts } from '../components/QlikTabbedCharts';

const appId = '3769696e-b88d-4d36-8f08-42f3dccf14f2';

const summaryCards = [
  {
    title: 'Working Projects',
    numberObjectId: '07fed73e-8e2f-41cc-98d5-af5f33840366',
    chartObjectId: '91fe54de-3b50-4534-ad74-9405446622c6',
  },
  {
    title: 'Closing Projects',
    numberObjectId: 'eaede755-e345-4659-b513-61cb44d6d7f1',
    chartObjectId: '0f8e607c-b988-4f8b-a819-2ccbdcc3705c',
  },
  {
    title: 'Closed Projects',
    numberObjectId: 'dd14b902-104f-4eab-b087-4feea9e23f7c',
    chartObjectId: '36021229-4c10-4a70-97f0-75c3fe544487',
  },
];

const tabbedCharts = [
  { title: 'Open Risks', chartObjectId: 'ee06bf20-8eba-4f4e-a15f-f334317a2b26' },
];

const Issues = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <h4>Issues</h4>
    <QlikSelections appId={appId} />
    <div style={{ display: 'flex', gap: '24px' }}>
      {summaryCards.map((card) => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default Issues;
