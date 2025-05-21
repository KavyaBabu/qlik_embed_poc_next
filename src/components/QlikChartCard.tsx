import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { Card } from "@arqiva-cs/react-component-lib";
import { exportQlikObjectToExcel } from "../utils/qlikExport";
import "../app/global.css";

const QlikEmbed = 'qlik-embed' as any;

export const QlikChartCard = ({
  title,
  numberObjectId,
  chartObjectId,
  appId,
}: {
  title: string;
  numberObjectId?: string;
  chartObjectId: string;
  appId: string;
}) => {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleExport = async () => {
    try {
      setLoading(true);
      setShowMenu(false);
      await exportQlikObjectToExcel(appId, chartObjectId);
    } catch (error) {
      console.error(`Error exporting chart ${chartObjectId}:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setShowMenu(false);
    }
  };

  useEffect(() => {
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (!isClient) return null; // Prevent SSR rendering

  return (
    <Card className="dashboard-card">
      {numberObjectId && (
        <div className="qlik-number-container">
          <QlikEmbed
            ui="analytics/chart"
            app-id={appId}
            object-id={numberObjectId}
            noInteraction="true"
          />
        </div>
      )}
      <div 
        className="qlik-chart-container"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <QlikEmbed ui="analytics/chart" app-id={appId} object-id={chartObjectId} />
        
        {(isHovered || showMenu) && (
          <div ref={menuRef} className="menu-trigger-container">
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
                  disabled={loading}
                  className="export-button"
                >
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span> Exporting...
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '16px' }}>📥</span> Export
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
