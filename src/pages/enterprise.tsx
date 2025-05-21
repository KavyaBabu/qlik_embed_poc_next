import { QlikChartCard } from "../components/QlikChartCard";
import { QlikTabbedCharts } from "../components/QlikTabbedCharts";

const appId = "3769696e-b88d-4d36-8f08-42f3dccf14f2";

const summaryCards = [
  { title: "Working Projects", numberObjectId: "280387f7-8e56-4dd7-9701-d1ab70cb531e", chartObjectId: "4de31f98-b42d-41ce-90cf-3fb522d5539e"},
  { title: "Closing Projects", numberObjectId: "6dc710d8-8dd8-4cbb-b18c-c5e62cb10647", chartObjectId: "d0c1acd6-6a82-4f69-9017-30d4e9c1db80"},
  { title: "Closed Projects", numberObjectId: "48fa0b36-24d4-426f-b201-29a0b19bf05c", chartObjectId: "9703bc65-150e-47d2-bfe0-0ba8b5c99c64"},
];

const tabbedCharts = [
  { title: "Working Projects", chartObjectId: "582a0c07-d481-40d2-8227-1061a9fa31b1" },
  { title: "Closing Projects", chartObjectId: "ce5355d1-78e9-4e15-85ac-eaa281beb9f2" },
  { title: "Closed Projects", chartObjectId: "47ebbc38-d2f4-452f-92ae-2bbd63238635" },
];

const EnterprisePage = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
    <h4>Portfolio Summary - Enterprise</h4>

    <div style={{ display: "flex", gap: "24px" }}>
      {summaryCards.map(card => (
        <QlikChartCard key={card.title} {...card} appId={appId} />
      ))}
    </div>

    <QlikTabbedCharts tabs={tabbedCharts} appId={appId} />
  </div>
);

export default EnterprisePage;
