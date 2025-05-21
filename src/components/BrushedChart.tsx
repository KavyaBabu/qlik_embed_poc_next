import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface DataPoint { category: string; value: number }

const ClippedBrushBarChart: React.FC<{ data: DataPoint[] }> = ({ data }) => {
  // 1) refs for each element
  const detailContainerRef = useRef<HTMLDivElement>(null);
  const detailChartRef     = useRef<SVGSVGElement>(null);
  const detailXAxisRef     = useRef<SVGSVGElement>(null);
  const overviewContainerRef = useRef<HTMLDivElement>(null);
  const overviewChartRef     = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data.length) return;

    // Layout constants
    const N = data.length;
    const margin = { top: 10, right: 10, bottom: 30, left: 80 };
    const detailW = 500;
    const overviewW = 100;
    const barH = 30;
    const visible = 10;
    const fullH = N * barH;
    const clipH = visible * barH;    // 300px
    const contH = margin.top + clipH; // 310px
    const detailTotalW = margin.left + detailW + margin.right;
    const maxVal = d3.max(data, d => d.value) ?? 0;

    // 2) size containers
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

    // 3) Scales
    const cats = data.map(d => d.category);
    const yScale = d3.scaleBand().domain(cats).range([0, fullH]).padding(0.1);
    const xScaleL = d3.scaleLinear().domain([0, maxVal]).nice().range([0, detailW]);
    const yOverview = d3.scaleBand().domain(cats).range([0, clipH]).padding(0.1);
    const xScaleO   = d3.scaleLinear().domain([0, maxVal]).nice().range([0, overviewW]);

    // 4) Draw DETAIL bars & axis
    const detailSvg = d3.select(detailChartRef.current)
      .attr('width', detailTotalW)
      .attr('height', margin.top + fullH + margin.bottom)
      .html('')              // clear old
      .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    detailSvg.selectAll('rect')
      .data(data).enter().append('rect')
        .attr('class','bar')
        .attr('y', d => yScale(d.category)!)
        .attr('height', yScale.bandwidth())
        .attr('width', d => xScaleL(d.value))
        .attr('fill','steelblue');

    detailSvg.selectAll('text.value-label')
      .data(data).enter().append('text')
        .attr('class','value-label')
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
        .attr('fill','steelblue');

    // 6) Brush behavior
    const brush = d3.brushY()
      .extent([[0,0],[overviewW,clipH]])
      .on('brush end', ({selection}) => {
        if (!selection) return;
        const [y0,y1] = selection;
        // dim everything, then highlight the selection
        overviewSvg.selectAll('.bar')
          .classed('dim', true)
          .filter((d: DataPoint) => {
            const y = yOverview(d.category)!;
            return y >= y0 && (y + yOverview.bandwidth()) <= y1;
          })
          .classed('dim', false);

        // scroll detail panel
        detailContainerRef.current?.scrollTo({ top: y0, behavior: 'smooth' });
      });

    overviewSvg.append('g')
      .attr('class','brush')
      .call(brush)
      // initialize selection to first 5 bars, for example:
      .call(brush.move, [0, yOverview(cats[5-1])! + yOverview.bandwidth()!]);

  }, [data]);

  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          ref={detailContainerRef}
          style={{
            overflow: 'hidden',
            border: '1px solid #ddd',
            background: '#fafafa'
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
          marginLeft: -1
        }}
      >
        <svg ref={overviewChartRef} />
      </div>
    </div>
  );
};

export default ClippedBrushBarChart;
