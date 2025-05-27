import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { connectToQlik } from '../utils/qlikConnection';
import { customExport } from 'utils/customExport';
import ClippedBrushBarChart, { ClippedBrushBarChartRef } from './BrushedChart';

interface QlikDataPoint {
  dimension: string;
  value: number;
}

interface QlikChartProps {
  appId: string;
  tenantUrl: string;
  webIntegrationId: string;
  objectId: string;
  chartType: 'bar' | 'pie' | 'doughnut';
  title?: string;
}

const QlikEmbed = 'qlik-embed' as any;

const EXPORT_OPTIONS = [
  { label: 'Export as XLSX', type: 'xlsx' },
  { label: 'Export as XLS', type: 'xls' },
  { label: 'Export as JPG', type: 'jpg' },
];

const D3Charts: React.FC<QlikChartProps> = ({
  appId,
  tenantUrl,
  webIntegrationId,
  objectId,
  chartType,
  title = 'Qlik Chart',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const brushedChartRef = useRef<ClippedBrushBarChartRef>(null);
  const [data, setData] = useState<QlikDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | false>(false);
  const [selectedSlice, setSelectedSlice] = useState<QlikDataPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { app } = await connectToQlik(appId, tenantUrl, webIntegrationId);
        const object = await app.getObject(objectId);
        const layout = await object.getLayout();
        const qMatrix = layout.qHyperCube.qDataPages[0].qMatrix;

        const parsed = qMatrix.map((row: any) => ({
          dimension: row[0].qText,
          value: row[1].qNum,
        }));
        setData(parsed);
      } catch (err) {
        console.error(err);
        setError('Error loading chart data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [appId, tenantUrl, webIntegrationId, objectId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (selectedSlice && !svgRef.current?.contains(event.target as Node)) {
        setSelectedSlice(null);
      }
    };

    if (showMenu || selectedSlice) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu, selectedSlice]);

  const handleExport = async (
    e: React.MouseEvent<HTMLButtonElement>,
    type: 'xlsx' | 'xls' | 'jpg',
  ) => {
    e.preventDefault();
    try {
      setExportLoading(type);
      setShowMenu(false);

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      let columns = [];
      let exportData = [];

      if (chartType === 'bar') {
        columns = [
          { key: 'dimension', label: 'Closed MMM-YYYY' },
          { key: 'value', label: 'Closed Complete' },
        ];
        exportData = data;
      } else if (chartType === 'doughnut') {
        columns = [
          { key: 'dimension', label: 'Within/Outside Dates' },
          { key: 'value', label: 'Closed Complete' },
        ];
        exportData = data;
      } else if (chartType === 'pie') {
        columns = [
          { key: 'dimension', label: 'Within/Outside Budgets' },
          { key: 'value', label: 'Closed Complete' },
        ];
        exportData = data;
      } else {
        const keys = Object.keys(data[0]);
        columns = keys.map((key) => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        }));
        exportData = data;
      }

      let refToPass:
        | React.RefObject<HTMLDivElement>
        | React.RefObject<SVGSVGElement>
        | SVGSVGElement
        | undefined;
      if (type === 'jpg') {
        if (chartType === 'bar') {
          const visibleChart = brushedChartRef.current?.getVisibleChart();
          if (visibleChart) {
            refToPass = visibleChart;
          } else {
            refToPass = chartWrapperRef as React.RefObject<HTMLDivElement>;
          }
        } else if (chartType === 'pie' || chartType === 'doughnut') {
          refToPass = svgRef as React.RefObject<SVGSVGElement>;
        }
      }

      let customRef: React.RefObject<HTMLDivElement> | React.RefObject<SVGSVGElement> | undefined;
      if (refToPass instanceof SVGSVGElement) {
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(refToPass.cloneNode(true));
        tempDiv.style.display = 'inline-block';
        document.body.appendChild(tempDiv);

        customRef = { current: tempDiv } as React.RefObject<HTMLDivElement>;

        try {
          await customExport({
            data: exportData,
            columns,
            fileName: title || 'QlikChartExport',
            type,
            chartRef: customRef,
          });
        } finally {
          document.body.removeChild(tempDiv);
        }
      } else {
        await customExport({
          data: exportData,
          columns,
          fileName: title || 'QlikChartExport',
          type,
          chartRef: refToPass as React.RefObject<HTMLDivElement>,
        });
      }
    } catch (error) {
      console.error(`Error exporting chart ${objectId}:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const customColors = [
      'rgb(16, 58, 84)', // --primary-800-base
      'rgb(8, 100, 123)', // --primary-600-base
      'rgb(64, 152, 173)', // --primary-400-base
      'rgb(150, 201, 214)', // --primary-300-base
      'rgb(228, 238, 241)', // --primary-100-base
    ];

    const color = d3
      .scaleOrdinal<string>()
      .domain(data.map((d) => d.dimension))
      .range(customColors);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = svgRef.current?.parentElement?.clientWidth || 500;
    const width = chartType === 'bar' ? containerWidth * 0.95 : 500;
    const fixedChartHeight = chartType === 'pie' || chartType === 'doughnut' ? 500 : 320;
    const barChartContentHeight = Math.max(80 + data.length * 38, fixedChartHeight);
    const height = chartType === 'bar' ? barChartContentHeight : fixedChartHeight;
    const margin = { top: 70, right: 20, bottom: 50, left: 100 };

    svg.attr('width', width).attr('height', height);

    if (chartType === 'pie' || chartType === 'doughnut') {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .style('font-weight', 'bold')
        .text(title);

      const subtitle = chartType === 'pie' ? 'Budget Analysis' : 'Within/Outside Timeline';
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text(subtitle);
    } else {
      svg
        .append('text')
        .attr('x', 0)
        .attr('y', 38)
        .attr('text-anchor', 'start')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(title);
    }

    if (chartType === 'bar') {
      const maxValue = d3.max(data, (d) => d.value) ?? 0;
      const x = d3
        .scaleLinear()
        .domain([0, Math.ceil((maxValue + 1) / 10) * 10])
        .range([margin.left, width - margin.right]);

      const y = d3
        .scaleBand()
        .domain(data.map((d) => d.dimension))
        .range([margin.top, barChartContentHeight - margin.bottom])
        .padding(0.2);

      svg
        .append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${margin.top})`)
        .call(
          d3
            .axisTop(x)
            .tickValues(d3.range(0, x.domain()[1] + 1, 10))
            .tickSize(-(barChartContentHeight - margin.top - margin.bottom))
            .tickFormat((d) => d.toString()),
        )
        .selectAll('.tick line')
        .style('stroke', '#e0e0e0')
        .style('stroke-dasharray', '2,2');

      svg
        .append('g')
        .selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', x(0))
        .attr('y', (d) => y(d.dimension)!)
        .attr('width', (d) => x(d.value) - x(0))
        .attr('height', y.bandwidth())
        .attr('fill', (d) => color(d.dimension))
        .attr('rx', 4)
        .attr('ry', 4)
        .on('mouseover', function () {
          d3.select(this).transition().duration(200).attr('fill', '#2c5a8a');
        })
        .on('mouseout', function (event, d) {
          d3.select(this).transition().duration(200).attr('fill', color(d.dimension));
        });

      svg
        .append('g')
        .attr('transform', `translate(${margin.left - 5},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll('text')
        .style('font-size', '13px');

      svg
        .append('g')
        .attr('transform', `translate(0,${barChartContentHeight - margin.bottom})`)
        .call(d3.axisBottom(x).tickValues(d3.range(0, x.domain()[1] + 1, 10)))
        .selectAll('text')
        .style('font-size', '13px');

      svg
        .append('g')
        .selectAll('text.bar-label')
        .data(data)
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', (d) => x(d.value) + 5)
        .attr('y', (d) => y(d.dimension)! + y.bandwidth() / 2 + 4)
        .attr('text-anchor', 'start')
        .style('font-size', '12px')
        .style('fill', '#333')
        .text((d) => Math.round(d.value));
    } else if (chartType === 'pie' || chartType === 'doughnut') {
      const radius = Math.min(width, height) / 2 - 100;
      const pie = d3.pie<QlikDataPoint>().value((d) => d.value);
      const arc = d3
        .arc<d3.PieArcDatum<QlikDataPoint>>()
        .innerRadius(chartType === 'doughnut' ? radius * 0.6 : 0)
        .outerRadius(radius);

      const pieGroup = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

      const total = d3.sum(data.map((d) => d.value));

      const getStaticLabels = () => {
        if (chartType === 'pie') {
          return ['Within Budget', 'Outside Budget'];
        } else if (chartType === 'doughnut') {
          return ['Within Timeline', 'Outside Timeline'];
        }
        return [];
      };

      const staticLabels = getStaticLabels();

      pieGroup
        .selectAll('path')
        .data(pie(data))
        .join('path')
        .attr('d', arc as any)
        .attr('fill', (d) => color(d.data.dimension))
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('click', function (event: MouseEvent, d: d3.PieArcDatum<QlikDataPoint>) {
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            setTooltipPosition({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
            setSelectedSlice(d.data);
          }
        })
        .on('mouseover', function () {
          d3.select(this).attr('stroke-width', 3);
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke-width', 2);
        });

      if (chartType === 'doughnut') {
        pieGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.2em')
          .style('font-size', '20px')
          .style('font-weight', 'bold')
          .text(`${Math.round(total)}`);

        pieGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1.2em')
          .style('font-size', '14px')
          .style('fill', '#666')
          .text('Total');
      }

      if (staticLabels.length > 0) {
        const leftTopGroup = svg.append('g').attr('class', 'label-left-top');

        leftTopGroup
          .append('line')
          .attr('x1', width / 2 - radius * 0.7)
          .attr('y1', height / 2 - radius * 0.7 + 20)
          .attr('x2', width / 2 - radius * 1.1)
          .attr('y2', height / 2 - radius * 1.1 + 20)
          .style('stroke', '#999')
          .style('stroke-width', 1);

        leftTopGroup
          .append('line')
          .attr('x1', width / 2 - radius * 1.1)
          .attr('y1', height / 2 - radius * 1.1 + 20)
          .attr('x2', 100)
          .attr('y2', height / 2 - radius * 1.1 + 20)
          .style('stroke', '#999')
          .style('stroke-width', 1);

        leftTopGroup
          .append('rect')
          .attr('x', 75)
          .attr('y', height / 2 - radius * 1.1 + 14)
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', customColors[0]);

        leftTopGroup
          .append('text')
          .attr('x', 92)
          .attr('y', height / 2 - radius * 1.1 + 24)
          .attr('text-anchor', 'start')
          .style('font-size', '14px')
          .style('fill', '#333')
          .style('font-weight', '500')
          .text(staticLabels[0]);

        const bottomRightGroup = svg.append('g').attr('class', 'label-bottom-right');

        bottomRightGroup
          .append('line')
          .attr('x1', width / 2 + radius * 0.7)
          .attr('y1', height / 2 + radius * 0.7 + 20)
          .attr('x2', width / 2 + radius * 1.1)
          .attr('y2', height / 2 + radius * 1.1 + 20)
          .style('stroke', '#999')
          .style('stroke-width', 1);

        bottomRightGroup
          .append('line')
          .attr('x1', width / 2 + radius * 1.1)
          .attr('y1', height / 2 + radius * 1.1 + 20)
          .attr('x2', width - 100)
          .attr('y2', height / 2 + radius * 1.1 + 20)
          .style('stroke', '#999')
          .style('stroke-width', 1);

        bottomRightGroup
          .append('rect')
          .attr('x', width - 87)
          .attr('y', height / 2 + radius * 1.1 + 14)
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', customColors[1]);

        bottomRightGroup
          .append('text')
          .attr('x', width - 92)
          .attr('y', height / 2 + radius * 1.1 + 24)
          .attr('text-anchor', 'end')
          .style('font-size', '14px')
          .style('fill', '#333')
          .style('font-weight', '500')
          .text(staticLabels[1]);
      }

      if (chartType === 'pie') {
        pieGroup
          .selectAll('text.percentage-label')
          .data(pie(data))
          .enter()
          .append('text')
          .attr('class', 'percentage-label')
          .attr('transform', (d) => `translate(${arc.centroid(d)})`)
          .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .style('fill', '#fff')
          .style('font-weight', 'bold')
          .style('pointer-events', 'none')
          .text((d) => {
            const percentage = ((d.data.value / total) * 100).toFixed(1);
            return `${percentage}%`;
          });
      }
    }
  }, [data, chartType, title]);

  return (
    <div
      className={`chart-container ${chartType === 'bar' ? 'bar' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        minHeight: 320,
        display: 'flex',
        overflow: chartType === 'doughnut' ? 'hidden' : 'auto',
      }}
    >
      {(isHovered || showMenu) && (
        <div ref={menuRef} className="menu-button">
          <button onClick={() => setShowMenu(!showMenu)} className="menu-trigger-button">
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={(e) => handleExport(e, opt.type as any)}
                  disabled={!!exportLoading}
                  className="export-button"
                  style={{ display: 'block', width: '100%', textAlign: 'left' }}
                >
                  {exportLoading === opt.type ? (
                    <>
                      <span className="loading-spinner"></span> Exporting...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '16px' }}>📥</span> {opt.label}
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSlice && (chartType === 'doughnut' || chartType === 'pie') && (
        <div
          style={{
            position: 'absolute',
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 40,
            background: 'white',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 'bold' }}>{selectedSlice.dimension}</div>
          <div>Value: {Math.round(selectedSlice.value)}</div>
          <div>
            Percentage:{' '}
            {((selectedSlice.value / d3.sum(data.map((d) => d.value))) * 100).toFixed(1)}%
          </div>
        </div>
      )}

      <div style={{ display: 'none' }}>
        <QlikEmbed ui="analytics/chart" app-id={appId} object-id={objectId} />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '50px' }}>Loading chart...</div>}
      {error && <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>}

      {chartType === 'pie' || chartType === 'doughnut' ? (
        <div
          className="pie-layout"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            width: '100%',
          }}
        >
          <svg
            ref={svgRef}
            className="pie-svg"
            style={{ width: '100%', height: '100%', display: 'block' }}
            viewBox="0 0 500 500"
            preserveAspectRatio="xMidYMid meet"
          />
        </div>
      ) : (
        <div ref={chartWrapperRef} className="chart-wrapper">
          {chartType === 'bar' ? (
            <ClippedBrushBarChart
              ref={brushedChartRef}
              data={data.map((d) => ({
                category: d.dimension,
                value: d.value,
              }))}
              title={title}
            />
          ) : (
            <svg ref={svgRef} />
          )}
        </div>
      )}
    </div>
  );
};

export default D3Charts;
