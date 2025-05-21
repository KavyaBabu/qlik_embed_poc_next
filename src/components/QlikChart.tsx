import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { connectToQlik } from '../utils/qlikConnection';
import { customExport } from 'utils/customExport';

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

const D3Charts: React.FC<QlikChartProps> = ({
  appId,
  tenantUrl,
  webIntegrationId,
  objectId,
  chartType,
  title = 'Qlik Chart'
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<QlikDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
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
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);


  const handleExport = async () => {
    try {
      setExportLoading(true);
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
          { key: 'value', label: 'Closed Complete' }
        ];
        exportData = data;
      } else if (chartType === 'doughnut') {
        columns = [
          { key: 'dimension', label: 'Within/Outside Dates' },
          { key: 'value', label: 'Closed Complete' }
        ];
        exportData = data;
      } else if (chartType === 'pie') {
        columns = [
          { key: 'dimension', label: 'Within/Outside Budgets' },
          { key: 'value', label: 'Closed Complete' }
        ];
        exportData = data;
      } else {
        const keys = Object.keys(data[0]);
        columns = keys.map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }));
        exportData = data;
      }

      await customExport({
        data: exportData,
        columns,
        fileName: title || 'QlikChartExport'
      });
    } catch (error) {
      console.error(`Error exporting chart ${objectId}:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExportLoading(false);
    }
  };



  const customColors = [
    'rgb(16, 58, 84)',    // --primary-800-base
    'rgb(8, 100, 123)',    // --primary-600-base
    'rgb(64, 152, 173)',  // --primary-400-base
    'rgb(150, 201, 214)', // --primary-300-base
    'rgb(228, 238, 241)'  // --primary-100-base
  ];


  const color = d3.scaleOrdinal<string>()
    .domain(data.map(d => d.dimension))
    .range(customColors);


  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const customColors = [
      'rgb(16, 58, 84)',    // --primary-800-base
      'rgb(8, 100, 123)',    // --primary-600-base
      'rgb(64, 152, 173)',  // --primary-400-base
      'rgb(150, 201, 214)', // --primary-300-base
      'rgb(228, 238, 241)'  // --primary-100-base
    ];


    const color = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.dimension))
      .range(customColors);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = svgRef.current?.parentElement?.clientWidth || 500;
    const width = chartType === 'bar' ? containerWidth * 0.95 : 320;
    const fixedChartHeight = 320; 
    const barChartContentHeight = Math.max(80 + data.length * 38, fixedChartHeight);
    const height = chartType === 'bar' ? barChartContentHeight : fixedChartHeight;
    const margin = { top: 70, right: 20, bottom: 50, left: 100 };

    svg.attr('width', width).attr('height', height);
    svg.append('text')
      .attr('x', 0)
      .attr('y', 38)
      .attr('text-anchor', 'start')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(title);

    if (chartType === 'bar') {
      const maxValue = d3.max(data, d => d.value) ?? 0;
      const x = d3.scaleLinear()
        .domain([0, Math.ceil((maxValue + 1) / 10) * 10])
        .range([margin.left, width - margin.right]);

      const y = d3.scaleBand()
        .domain(data.map(d => d.dimension))
        .range([margin.top, barChartContentHeight - margin.bottom]) 
        .padding(0.2);

      svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${margin.top})`)
        .call(d3.axisTop(x)
          .tickValues(d3.range(0, x.domain()[1] + 1, 10))
          .tickSize(-(barChartContentHeight - margin.top - margin.bottom)) 
          .tickFormat(d => d.toString()))
        .selectAll('.tick line')
        .style('stroke', '#e0e0e0')
        .style('stroke-dasharray', '2,2');

      svg.append('g')
        .selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', x(0))
        .attr('y', d => y(d.dimension)!)
        .attr('width', d => x(d.value) - x(0))
        .attr('height', y.bandwidth())
        .attr('fill', d => color(d.dimension))
        .attr('rx', 4)
        .attr('ry', 4)
        .on('mouseover', function () {
          d3.select(this).transition().duration(200).attr('fill', '#2c5a8a');
        })
        .on('mouseout', function (event, d) {
          d3.select(this).transition().duration(200).attr('fill', color(d.dimension));
        });

      svg.append('g')
        .attr('transform', `translate(${margin.left - 5},0)`)
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll('text')
        .style('font-size', '13px');

      svg.append('g')
        .attr('transform', `translate(0,${barChartContentHeight - margin.bottom})`) 
        .call(d3.axisBottom(x).tickValues(d3.range(0, x.domain()[1] + 1, 10)))
        .selectAll('text')
        .style('font-size', '13px');

      svg.append('g')
        .selectAll('text.bar-label')
        .data(data)
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', d => x(d.value) + 5)
        .attr('y', d => (y(d.dimension)! + y.bandwidth() / 2) + 4)
        .attr('text-anchor', 'start')
        .style('font-size', '12px')
        .style('fill', '#333')
        .text(d => Math.round(d.value));
    } else if (chartType === 'pie' || chartType === 'doughnut') {
      const radius = Math.min(width, height) / 2 - 50;
      const pie = d3.pie<QlikDataPoint>().value(d => d.value);
      const arc = d3.arc<d3.PieArcDatum<QlikDataPoint>>()
        .innerRadius(chartType === 'doughnut' ? radius * 0.6 : 0)
        .outerRadius(radius);

      const pieGroup = svg.append('g')
        .attr('transform', `translate(${radius + 10},${height / 2 + 10})`);

      const total = d3.sum(data.map(d => d.value));

      const tooltip = d3.select(svgRef.current?.parentNode as HTMLElement)
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('background', 'white')
        .style('padding', '5px 10px')
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('font-size', '12px')
        .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)');

      pieGroup.selectAll('path')
        .data(pie(data))
        .join('path')
        .attr('d', arc as any)
        .attr('fill', d => color(d.data.dimension))
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .on('mouseover', function (event: MouseEvent, d: d3.PieArcDatum<QlikDataPoint>) {
          d3.select(this).attr('stroke-width', 2);
          tooltip
            .style('opacity', 1)
            .style('left', event.pageX + 10 + 'px')
            .style('top', event.pageY - 30 + 'px')
            .html(`<strong>${d.data.dimension}</strong><br/>Value: ${Math.round(d.data.value)}`);
        })
        .on('mouseout', function () {
          d3.select(this).attr('stroke-width', 1);
          tooltip.style('opacity', 0);
        });

      if (chartType === 'doughnut') {
        pieGroup.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text(`${Math.round(total)} Total`);
      }

      pieGroup.selectAll('text.label')
        .data(pie(data))
        .enter()
        .append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#fff')
        .style('pointer-events', 'none')
        .text(d => {
          const percentage = ((d.data.value / total) * 100).toFixed(1);
          return `${percentage}%`;
        });
    }
  }, [data, chartType, title]);


  return (
    <div
      className={`chart-container ${chartType === 'bar' ? 'bar' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ flexShrink: 0, width: chartType === 'bar' ? '50%' : '33%', position: 'relative' }} 
    >
      {(isHovered || showMenu) && (
        <div ref={menuRef} className="menu-button">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="menu-trigger-button"
          >
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="export-button"
              >
                {exportLoading ? (
                  <>
                    <span className="loading-spinner" style={{ marginRight: 8 }} /> Exporting...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '16px', marginRight: 6 }}>📥</span> Export
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'none' }}>
        <QlikEmbed ui="analytics/chart" app-id={appId} object-id={objectId} />
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '50px' }}>Loading chart...</div>}
      {error && <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>}

      {chartType === 'pie' || chartType === 'doughnut' ? (
        <div className="pie-layout">
          <svg ref={svgRef} className="pie-svg" />
          <div className="legend-container">
            {data.map((d) => (
              <div key={d.dimension} className="legend-item">
                <span
                  className="legend-color-box"
                  style={{ background: color(d.dimension) }}
                />
                <span style={{ fontSize: 13, color: '#333' }}>{d.dimension}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div ref={chartWrapperRef} style={{ maxHeight: 'calc(100% - 70px)', overflowY: 'auto', overflowX: 'hidden' }}> 
          <svg ref={svgRef} className="bar-svg" />
        </div>
      )}
    </div>

  );

};

export default D3Charts;