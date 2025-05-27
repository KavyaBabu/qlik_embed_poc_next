import { QlikSelections } from 'components/QlikSelections';
import { QlikChartCard } from '../components/QlikChartCard';
import { QlikTabbedCharts } from '../components/QlikTabbedCharts';

const appId = '3769696e-b88d-4d36-8f08-42f3dccf14f2';

const summaryCards = [
  {
    title: "Open PCR's",
    numberObjectId: 'GvxHap',
    chartObjectId: 'KwqwnPy',
  },
  { title: "Closed PCR's", numberObjectId: 'kYYZ', chartObjectId: 'scxYNt' },
  { title: 'Closed Projects', numberObjectId: 'QTDmmV', chartObjectId: 'fdnhXx' },
];

const tabbedCharts = [
  { title: "Open PCR's", chartObjectId: '82da3494-7e49-41ae-89f7-40db3057c2c7' },
  { title: "Closed PCR's", chartObjectId: 'eeead0d2-2e39-4ebb-b3af-eb094b3c24c1' },
];

const ChangeRequest = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <h4>Project change request</h4>
    <QlikSelections appId={appId} />

    <div style={{ display: 'flex', gap: '24px' }}>
      {summaryCards.map((card) => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default ChangeRequest;
