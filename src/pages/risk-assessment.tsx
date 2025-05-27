import { QlikSelections } from 'components/QlikSelections';
import { QlikChartCard } from '../components/QlikChartCard';
import { QlikTabbedCharts } from '../components/QlikTabbedCharts';

const appId = '3769696e-b88d-4d36-8f08-42f3dccf14f2';

const summaryCards = [
  {
    title: 'Open Risks',
    numberObjectId: '889762ad-4f66-4d48-a928-4a85dd3a1c18',
    chartObjectId: '40ce5a21-e6ff-4b04-8034-66123022952a',
  },
  { title: 'Closing Projects', numberObjectId: 'SRmJfp', chartObjectId: 'fjDf' },
  { title: 'Closed Projects', numberObjectId: 'PurXNbL', chartObjectId: 'GCwfmD' },
];

const tabbedCharts = [
  { title: 'Open Risks', chartObjectId: '852dd4ec-44e8-4139-bdcf-87f205168331' },
];

const RiskAssessment = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <h4>Risk Assessment</h4>
    <QlikSelections appId={appId} />
    <div style={{ display: 'flex', gap: '24px' }}>
      {summaryCards.map((card) => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default RiskAssessment;
