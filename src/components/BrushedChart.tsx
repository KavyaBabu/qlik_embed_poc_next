import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import * as d3 from 'd3';

interface DataPoint {
  category: string;
  value: number;
}

interface ClippedBrushBarChartProps {
  data: DataPoint[];
  title?: string;
}

export interface ClippedBrushBarChartRef {
  getVisibleChart: () => SVGSVGElement | null;
  getCurrentBrushSelection: () => [number, number] | null;
}

const ClippedBrushBarChart = forwardRef<ClippedBrushBarChartRef, ClippedBrushBarChartProps>(
  ({ data, title }, ref) => {
    const detailContainerRef = useRef<HTMLDivElement>(null);
    const detailChartRef = useRef<SVGSVGElement>(null);
    const detailXAxisRef = useRef<SVGSVGElement>(null);
    const overviewContainerRef = useRef<HTMLDivElement>(null);
    const overviewChartRef = useRef<SVGSVGElement>(null);
    const lastBrushSelection = useRef<[number, number] | null>(null);
    const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null);
    const brushGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const isInitialized = useRef<boolean>(false);
    const yScaleRef = useRef<d3.ScaleBand<string> | null>(null);
    const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
    const marginRef = useRef({ top: 15, right: 30, bottom: 30, left: 70 });
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    useEffect(() => {
      const hideTooltip = () => setTooltip(null);
      if (tooltip) {
        document.addEventListener('click', hideTooltip);
        return () => document.removeEventListener('click', hideTooltip);
      }
    }, [tooltip]);

    const getVisibleChart = useCallback((): SVGSVGElement | null => {
      if (!data.length || !lastBrushSelection.current || !yScaleRef.current || !xScaleRef.current) {
        return detailChartRef.current;
      }

      const [y0, y1] = lastBrushSelection.current;
      const yScale = yScaleRef.current;
      // const xScale = xScaleRef.current;
      const margin = marginRef.current;

      const visibleData = data.filter((d) => {
        const yPos = yScale(d.category)!;
        const bandHeight = yScale.bandwidth();
        return yPos >= y0 && yPos + bandHeight <= y1;
      });

      if (visibleData.length === 0) return detailChartRef.current;

      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const detailW = 250;
      const barH = 19;
      const clipH = visibleData.length * barH + yScale.padding() * barH;
      const detailTotalW = margin.left + detailW + margin.right;
      const totalHeight = margin.top + clipH + margin.bottom + 50;

      exportSvg.setAttribute('width', detailTotalW.toString());
      exportSvg.setAttribute('height', totalHeight.toString());

      const customColors = [
        'rgb(16, 58, 84)',
        'rgb(8, 100, 123)',
        'rgb(64, 152, 173)',
        'rgb(150, 201, 214)',
      ];

      const visibleYScale = d3
        .scaleBand()
        .domain(visibleData.map((d) => d.category))
        .range([0, clipH])
        .padding(0.2);

      const maxVal = d3.max(visibleData, (d) => d.value) ?? 0;
      const visibleXScale = d3.scaleLinear().domain([0, maxVal]).nice().range([0, detailW]);

      if (title) {
        const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleElement.setAttribute('x', (detailTotalW / 2).toString());
        titleElement.setAttribute('y', '25');
        titleElement.setAttribute('text-anchor', 'middle');
        titleElement.setAttribute('font-size', '16px');
        titleElement.setAttribute('font-weight', 'bold');
        titleElement.setAttribute('fill', '#333');
        titleElement.textContent = title;
        exportSvg.appendChild(titleElement);
      }

      const mainGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      mainGroup.setAttribute(
        'transform',
        `translate(${margin.left},${margin.top + (title ? 30 : 0)})`,
      );

      visibleData.forEach((d, i) => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('y', visibleYScale(d.category)!.toString());
        rect.setAttribute('height', visibleYScale.bandwidth().toString());
        rect.setAttribute('width', visibleXScale(d.value).toString());
        rect.setAttribute('fill', customColors[i % customColors.length]);
        rect.setAttribute('x', '0');
        mainGroup.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', (visibleXScale(d.value) + 3).toString());
        text.setAttribute(
          'y',
          (visibleYScale(d.category)! + visibleYScale.bandwidth() / 2).toString(),
        );
        text.setAttribute('dy', '0.35em');
        text.setAttribute('font-size', '10px');
        text.setAttribute('fill', '#333');
        text.textContent = d.value.toString();
        mainGroup.appendChild(text);
      });

      const yAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      yAxisGroup.setAttribute('class', 'axis axis--y');

      visibleData.forEach((d) => {
        const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tickLine.setAttribute('x1', '-6');
        tickLine.setAttribute('x2', '0');
        tickLine.setAttribute(
          'y1',
          (visibleYScale(d.category)! + visibleYScale.bandwidth() / 2).toString(),
        );
        tickLine.setAttribute(
          'y2',
          (visibleYScale(d.category)! + visibleYScale.bandwidth() / 2).toString(),
        );
        tickLine.setAttribute('stroke', '#000');
        yAxisGroup.appendChild(tickLine);

        const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tickText.setAttribute('x', '-9');
        tickText.setAttribute(
          'y',
          (visibleYScale(d.category)! + visibleYScale.bandwidth() / 2).toString(),
        );
        tickText.setAttribute('dy', '0.32em');
        tickText.setAttribute('text-anchor', 'end');
        tickText.setAttribute('font-size', '13px');
        tickText.setAttribute('fill', '#000');
        tickText.textContent = d.category;
        yAxisGroup.appendChild(tickText);
      });

      const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      yAxisLine.setAttribute('x1', '0');
      yAxisLine.setAttribute('x2', '0');
      yAxisLine.setAttribute('y1', '0');
      yAxisLine.setAttribute('y2', clipH.toString());
      yAxisLine.setAttribute('stroke', '#000');
      yAxisGroup.appendChild(yAxisLine);

      mainGroup.appendChild(yAxisGroup);

      const xAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      xAxisGroup.setAttribute('transform', `translate(0,${clipH})`);

      const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      xAxisLine.setAttribute('x1', '0');
      xAxisLine.setAttribute('x2', detailW.toString());
      xAxisLine.setAttribute('y1', '0');
      xAxisLine.setAttribute('y2', '0');
      xAxisLine.setAttribute('stroke', '#000');
      xAxisGroup.appendChild(xAxisLine);

      const xTicks = visibleXScale.ticks(5);
      xTicks.forEach((tick) => {
        const tickLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tickLine.setAttribute('x1', visibleXScale(tick).toString());
        tickLine.setAttribute('x2', visibleXScale(tick).toString());
        tickLine.setAttribute('y1', '0');
        tickLine.setAttribute('y2', '6');
        tickLine.setAttribute('stroke', '#000');
        xAxisGroup.appendChild(tickLine);

        const tickText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tickText.setAttribute('x', visibleXScale(tick).toString());
        tickText.setAttribute('y', '18');
        tickText.setAttribute('text-anchor', 'middle');
        tickText.setAttribute('font-size', '13px');
        tickText.setAttribute('fill', '#000');
        tickText.textContent = tick.toString();
        xAxisGroup.appendChild(tickText);
      });

      mainGroup.appendChild(xAxisGroup);
      exportSvg.appendChild(mainGroup);

      return exportSvg;
    }, [data, title]);

    const getCurrentBrushSelection = useCallback(() => {
      return lastBrushSelection.current;
    }, []);

    useImperativeHandle(ref, () => ({
      getVisibleChart,
      getCurrentBrushSelection,
    }));

    const createChart = useCallback(() => {
      if (!data.length) return;

      const N = data.length;
      const margin = { top: 15, right: 30, bottom: 30, left: 70 };
      marginRef.current = margin;
      const detailW = 250;
      const overviewW = 60;
      const barH = 19;
      const visible = 15;
      const fullH = N * barH;
      const clipH = visible * barH;
      const contH = margin.top + clipH;
      const detailTotalW = margin.left + detailW + margin.right;
      const maxVal = d3.max(data, (d) => d.value) ?? 0;

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

      const cats = data.map((d) => d.category);
      const yScale = d3.scaleBand().domain(cats).range([0, fullH]).padding(0.2);
      const xScaleL = d3.scaleLinear().domain([0, maxVal]).nice().range([0, detailW]);
      const yOverview = d3.scaleBand().domain(cats).range([0, clipH]).padding(0.1);
      const xScaleO = d3
        .scaleLinear()
        .domain([0, maxVal + 20])
        .nice()
        .range([0, overviewW]);

      yScaleRef.current = yOverview;
      xScaleRef.current = xScaleL;

      const customColors = [
        'rgb(16, 58, 84)',
        'rgb(8, 100, 123)',
        'rgb(64, 152, 173)',
        'rgb(150, 201, 214)',
      ];

      const detailSvg = d3
        .select(detailChartRef.current)
        .attr('width', detailTotalW)
        .attr('height', margin.top + fullH + margin.bottom)
        .html('')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      detailSvg
        .selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', (d) => yScale(d.category)!)
        .attr('height', yScale.bandwidth())
        .attr('width', (d) => xScaleL(d.value))
        .attr('fill', (_, i) => customColors[i % customColors.length]);

      detailSvg
        .selectAll('text.value-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'value-label')
        .style('font-size', '10px')
        .attr('x', (d) => xScaleL(d.value) + 3)
        .attr('y', (d) => yScale(d.category)! + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .text((d) => d.value);

      detailSvg
        .append('g')
        .attr('class', 'axis axis--y')
        .call(d3.axisLeft(yScale).tickSize(0).tickPadding(6));

      detailSvg
        .selectAll('rect')
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
          const [x, y] = d3.pointer(event, detailChartRef.current);
          setTooltip({
            x,
            y,
            content: `${(d as DataPoint).category}\nClosed Complete: ${(d as DataPoint).value}`,
          });
          event.stopPropagation();
        });
      d3.select(detailXAxisRef.current)
        .html('')
        .append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisBottom(xScaleL).ticks(5));

      const overviewSvg = d3
        .select(overviewChartRef.current)
        .attr('width', overviewW)
        .attr('height', contH)
        .html('')
        .append('g')
        .attr('transform', `translate(0,${margin.top})`);

      overviewSvg
        .selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('y', (d) => yOverview(d.category)!)
        .attr('height', yOverview.bandwidth())
        .attr('width', (d) => xScaleO(d.value))
        .attr('fill', (_, i) => customColors[i % customColors.length]);

      const brush = d3
        .brushY()
        .extent([
          [0, 0],
          [overviewW, clipH],
        ])
        .on('start brush end', function (event) {
          const selection = event.selection;
          if (!selection) return;

          lastBrushSelection.current = selection;

          const [y0, y1] = selection;
          overviewSvg
            .selectAll('.bar')
            .classed('dim', true)
            .filter((d) => {
              const y = yOverview((d as DataPoint).category)!;
              return y >= y0 && y + yOverview.bandwidth() <= y1;
            })
            .classed('dim', false);

          detailContainerRef.current?.scrollTo({ top: y0, behavior: 'smooth' });
        });

      const brushG = overviewSvg.append('g').attr('class', 'brush').call(brush);
      brushG.select('.overlay').style('pointer-events', 'none');

      brushRef.current = brush;
      brushGroupRef.current = brushG;

      const initialSelection = lastBrushSelection.current || [
        0,
        yOverview(cats[Math.min(visible - 1, cats.length - 1)])! + yOverview.bandwidth(),
      ];

      setTimeout(() => {
        if (brushGroupRef.current && brushRef.current) {
          brushGroupRef.current.call(brushRef.current.move, initialSelection);
          lastBrushSelection.current = initialSelection;
        }
      }, 0);

      isInitialized.current = true;
    }, [data]);

    useEffect(() => {
      createChart();
    }, [createChart]);

    useEffect(() => {
      if (
        isInitialized.current &&
        lastBrushSelection.current &&
        brushGroupRef.current &&
        brushRef.current
      ) {
        setTimeout(() => {
          if (brushGroupRef.current && brushRef.current && lastBrushSelection.current) {
            brushGroupRef.current.call(brushRef.current.move, lastBrushSelection.current);
          }
        }, 50);
      }
    });

    return (
      <div>
        {title && (
          <h5
            style={{
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            {title}
          </h5>
        )}
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
              marginLeft: 0,
            }}
          >
            <svg ref={overviewChartRef} />
          </div>
          {tooltip && (
            <div
              style={{
                position: 'absolute',
                left: tooltip.x + 20,
                top: tooltip.y + 20,
                background: 'white',
                border: '1px solid #333',
                padding: '2px 8px',
                borderRadius: 3,
                pointerEvents: 'none',
                zIndex: 100,
                whiteSpace: 'pre-line',
                fontSize: '11px',
                minWidth: 0,
                maxWidth: 160,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              }}
            >
              {tooltip.content}
            </div>
          )}
        </div>
      </div>
    );
  },
);

ClippedBrushBarChart.displayName = 'ClippedBrushBarChart';

export default ClippedBrushBarChart;
