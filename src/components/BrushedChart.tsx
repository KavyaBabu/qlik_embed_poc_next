import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint { category: string; value: number }

const ClippedBrushBarChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  const detailContainerRef = useRef<HTMLDivElement>(null);
  const detailChartRef     = useRef<SVGSVGElement>(null);
  const detailXAxisRef     = useRef<SVGSVGElement>(null);
  const overviewContainerRef = useRef<HTMLDivElement>(null);
  const overviewChartRef     = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data.length) return;

    const N = data.length;
    const margin = { top: 15, right: 30, bottom: 30, left: 70 };
    const detailW = 250;
    const overviewW = 50;
    const barH = 20;
    const visible = 15;
    const fullH = N * barH;
    const clipH = visible * barH;    
    const contH = margin.top + clipH; 
    const detailTotalW = margin.left + detailW + margin.right;
    const maxVal = d3.max(data, d => d.value) ?? 0;

    if (detailContainerRef.current) {
      detailContainerRef.current.style.width = `${detailTotalW}px`;
      detailContainerRef.current.style.height = `${contH}px`;
    }
    if (detailXAxisRef.current) {
      detailXAxisRef.current.setAttribute('width', `${detailTotalW}`);
      detailXAxisRef.current.setAttribute('height', `${margin.bottom}`);
    }
    if (overviewContainerRef.current) {
      overviewContainerRef.current.style.width = `${overviewW}px`;
      overviewContainerRef.current.style.height = `${contH}px`;
    }

    const cats = data.map(d => d.category);
    const yScale = d3.scaleBand().domain(cats).range([0, fullH]).padding(0.2);
    const xScaleL = d3.scaleLinear().domain([0, maxVal]).nice().range([0, detailW]);
    const yOverview = d3.scaleBand().domain(cats).range([0, clipH]).padding(0.1);
    const xScaleO   = d3.scaleLinear().domain([0, maxVal + 20]).nice().range([0, overviewW]);

    const customColors = [
        'rgb(16, 58, 84)',    // --primary-800-base
        'rgb(8, 100, 123)',   // --primary-600-base
        'rgb(64, 152, 173)',  // --primary-400-base
        'rgb(150, 201, 214)', // --primary-300-base
      ];
      
    const detailSvg = d3.select(detailChartRef.current)
      .attr('width', detailTotalW)
      .attr('height', margin.top + fullH + margin.bottom)
      .html('')              
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    detailSvg.selectAll('rect')
      .data(data).enter().append('rect')
        .attr('class','bar')
        .attr('y', d => yScale(d.category)!)
        .attr('height', yScale.bandwidth())
        .attr('width', d => xScaleL(d.value))
        .attr('fill', (_, i) => customColors[i % customColors.length]); 


    detailSvg.selectAll('text.value-label')
      .data(data).enter().append('text')
        .attr('class','value-label')
        .style('font-size','10px')
        .attr('x', d => xScaleL(d.value) + 3)
        .attr('y', d => yScale(d.category)! + yScale.bandwidth()/2)
        .attr('dy','0.35em')
        .text(d => d.value);

    detailSvg.append('g')
      .attr('class','axis axis--y')
      .call(d3.axisLeft(yScale).tickSize(0).tickPadding(6));

    d3.select(detailXAxisRef.current)
      .html('')
      .append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisBottom(xScaleL).ticks(5));

    // 5) Draw OVERVIEW bars
    const overviewSvg = d3.select(overviewChartRef.current)
      .attr('width', overviewW)
      .attr('height', contH)
      .html('')
      .append('g')
        .attr('transform', `translate(0,${margin.top})`);

    overviewSvg.selectAll('rect')
      .data(data).enter().append('rect')
        .attr('class','bar')
        .attr('y', d => yOverview(d.category)!)
        .attr('height', yOverview.bandwidth())
        .attr('width', d => xScaleO(d.value))
        .attr('fill', (_, i) => customColors[i % customColors.length]); 


    const brush = d3.brushY()
      .extent([[0,0],[overviewW,clipH]])
      .on('brush end', ({selection}) => {
        if (!selection) return;
        const [y0,y1] = selection;
        overviewSvg.selectAll('.bar')
          .classed('dim', true)
          .filter((d) => {
            const dataPoint = d as DataPoint;
            const y = yOverview(dataPoint.category)!;
            return y >= y0 && (y + yOverview.bandwidth()) <= y1;
          })
          .classed('dim', false);

        detailContainerRef.current?.scrollTo({ top: y0, behavior: 'smooth' });
      });

    overviewSvg.append('g')
      .attr('class','brush')
      .call(brush)
      .call(brush.move, [0, yOverview(cats[visible-1])! + yOverview.bandwidth()!]);

  }, [data]);

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          ref={detailContainerRef}
          style={{
            overflow: 'hidden',
            background: 'transparent',
          }}
        >
          <svg ref={detailChartRef} />
        </div>
        <svg ref={detailXAxisRef} />
      </div>
      <div
        ref={overviewContainerRef}
        style={{
          overflow: 'hidden',
          border: '1px solid #ddd',
          background: '#fafafa',
          marginLeft: 0
        }}
      >
        <svg ref={overviewChartRef} />
      </div>
    </div>
  );
};

export default ClippedBrushBarChart;
