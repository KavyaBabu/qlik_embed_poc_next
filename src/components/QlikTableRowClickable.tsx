import React, { useEffect, useState, useRef } from 'react';
import { connectToQlik } from '../utils/qlikConnection';
import { Table, Button, SearchInput } from '@arqiva-cs/react-component-lib';
import { customExport } from '../utils/customExport';

interface QlikTableProps {
  appId: string;
  tenantUrl: string;
  webIntegrationId: string;
  objectId: string;
  columnConfigs: any[];
  activeTab: string;
  onSelectionChange?: () => void;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc' | undefined;
}

const PAGE_SIZE = 10;

const EXPORT_OPTIONS = [
  { label: 'Export as XLSX', type: 'xlsx' },
  { label: 'Export as XLS', type: 'xls' },
  { label: 'Export as CSV', type: 'csv' },
];

const SELECTABLE_FIELDS = {
  'Working Projects': ['projectName', 'projectNumber', 'projectManager', 'rag', 'phase'],
  'Closing Projects': ['projectName', 'projectNumber', 'rag'],
  'Closed Projects': ['projectName', 'projectNumber', 'state'],
};

const QlikTableRowClickable: React.FC<QlikTableProps> = ({
  appId,
  tenantUrl,
  webIntegrationId,
  objectId,
  columnConfigs,
  activeTab,
  onSelectionChange,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [rawQlikData, setRawQlikData] = useState<any[]>([]);
  const [qlikApp, setQlikApp] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState<string | false>(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: undefined });
  const menuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const parseRowData = (row: any[], tab: string) => {
    if (tab === 'Working Projects') {
      return {
        projectName: row[0]?.qText ?? '',
        projectNumber: row[1]?.qText ?? '',
        projectManager: row[2]?.qText ?? '',
        rag: row[3]?.qText ?? '',
        phase: row[4]?.qText ?? '',
        summary: row[5]?.qText ?? '',
        investment: row[6]?.qText ?? '',
        startDate: row[7]?.qText ?? '',
        endDate: row[8]?.qText ?? '',
      };
    } else if (tab === 'Closing Projects') {
      return {
        projectName: row[0]?.qText ?? '',
        projectNumber: row[1]?.qText ?? '',
        rag: row[2]?.qText ?? '',
        plannedEndDate: row[3]?.qText ?? '',
        summary: row[4]?.qText ?? '',
        investment: row[5]?.qText ?? '',
      };
    } else if (tab === 'Closed Projects') {
      return {
        projectName: row[0]?.qText ?? '',
        projectNumber: row[1]?.qText ?? '',
        state: row[2]?.qText ?? '',
        closingTask: row[3]?.qText ?? '',
        totalBudget: row[4]?.qText ?? '',
        totalActuals: row[5]?.qText ?? '',
        variance: row[6]?.qText ?? '',
        actualEndMMMYYY: row[7]?.qText ?? '',
        plannedEndMMMYYY: row[8]?.qText ?? '',
        closedMMMYYY: row[9]?.qText ?? '',
        withinOutsideDates: row[10]?.qText ?? '',
        withinOutsideBudget: row[11]?.qText ?? '',
      };
    }
    return {};
  };

  const getFieldColumnIndex = (fieldKey: string, tab: string): number => {
    const fieldMappings = {
      'Working Projects': {
        projectName: 0,
        projectNumber: 1,
        projectManager: 2,
        rag: 3,
        phase: 4,
      },
      'Closing Projects': {
        projectName: 0,
        projectNumber: 1,
        rag: 2,
      },
      'Closed Projects': {
        projectName: 0,
        projectNumber: 1,
        state: 2,
      },
    };

    return (
      fieldMappings[tab as keyof typeof fieldMappings]?.[
        fieldKey as keyof (typeof fieldMappings)[keyof typeof fieldMappings]
      ] ?? -1
    );
  };

  const handleCellClick = async (rowIndex: number, fieldKey: string) => {
    if (
      !qlikApp ||
      !SELECTABLE_FIELDS[activeTab as keyof typeof SELECTABLE_FIELDS]?.includes(fieldKey)
    ) {
      return;
    }

    try {
      const columnIndex = getFieldColumnIndex(fieldKey, activeTab);
      if (columnIndex === -1) return;

      const globalRowIndex = (currentPage - 1) * PAGE_SIZE + rowIndex;
      const rawRow = rawQlikData[globalRowIndex];

      if (rawRow && rawRow[columnIndex]?.qElemNumber !== undefined) {
        const object = await qlikApp.getObject(objectId);

        await object.selectHyperCubeValues(
          '/qHyperCubeDef',
          columnIndex,
          [rawRow[columnIndex].qElemNumber],
          false,
        );

        if (onSelectionChange) {
          onSelectionChange();
        }
      }
    } catch (error) {
      console.error('Error making table selection:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { app } = await connectToQlik(appId, tenantUrl, webIntegrationId);
        setQlikApp(app);
        const object = await app.getObject(objectId);

        let allRows: any[] = [];
        let currentPage = 0;
        let moreData = true;

        while (moreData) {
          const pages = await object.getHyperCubeData('/qHyperCubeDef', [
            {
              qTop: currentPage * PAGE_SIZE,
              qLeft: 0,
              qHeight: PAGE_SIZE,
              qWidth: 12,
            },
          ]);

          const qMatrix = pages?.[0]?.qMatrix;
          if (qMatrix && qMatrix.length > 0) {
            allRows = [...allRows, ...qMatrix];
            currentPage += 1;
          } else {
            moreData = false;
          }
        }

        setRawQlikData(allRows);
        const parsed = allRows.map((row: any[]) => parseRowData(row, activeTab));
        setRows(parsed);
      } catch (err) {
        console.error(err);
        setError('Error loading table data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [appId, tenantUrl, webIntegrationId, objectId, columnConfigs, activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, sortConfig]);

  const handleExport = async (type: 'xlsx' | 'xls' | 'csv') => {
    try {
      setExportLoading(type);
      setShowMenu(false);
      await customExport({
        data: sortedRows,
        columns: columnConfigs,
        fileName: 'ExcelExport',
        type,
      });
    } catch (error) {
      console.error(`Error exporting table ${objectId}:`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handlePrevious = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(idx)) {
        newSet.delete(idx);
      } else {
        newSet.add(idx);
      }
      return newSet;
    });
  };

  const handleSortAsc = (key: string) => {
    setSortConfig({ key, direction: 'asc' });
  };

  const handleSortDesc = (key: string) => {
    setSortConfig({ key, direction: 'desc' });
  };

  const filteredRows = rows.filter((row) =>
    Object.values(row).some(
      (value) =>
        typeof value === 'string' && value.toLowerCase().includes(searchValue.toLowerCase()),
    ),
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key || sortConfig.direction === undefined) return 0;

    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';

    const aNum = Number(aValue);
    const bNum = Number(bValue);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    }

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const paginatedRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const isFieldSelectable = (fieldKey: string): boolean => {
    return (
      SELECTABLE_FIELDS[activeTab as keyof typeof SELECTABLE_FIELDS]?.includes(fieldKey) || false
    );
  };

  if (loading) return <div>Loading Data...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative' }}
    >
      {(isHovered || showMenu) && (
        <div
          ref={menuRef}
          className="menu-button"
          style={{ position: 'absolute', top: '10px', right: '10px' }}
        >
          <button onClick={() => setShowMenu(!showMenu)} className="menu-trigger-button">
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleExport(opt.type as any)}
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

      <div style={{ marginBottom: '16px', maxWidth: '300px' }}>
        <SearchInput
          placeholder="Search projects..."
          value={searchValue}
          onChange={(value: string) => setSearchValue(value)}
        />
      </div>
      <div ref={tableRef}>
        <Table.Wrapper>
          <Table.Root className="qlik-table-wrapper">
            <Table.Header>
              <Table.Row>
                {columnConfigs.map((config) => {
                  const showSortOption = [
                    'projectName',
                    'projectNumber',
                    'startDate',
                    'endDate',
                    'plannedEndDate',
                    'actualEndMMMYYY',
                    'plannedEndMMMYYY',
                    'closedMMMYYY',
                  ].includes(config.key);

                  return (
                    <Table.Head key={config.key} style={{ width: config.width || 'auto' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {config.label}
                        {isFieldSelectable(config.key) && (
                          <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>
                            ⚡
                          </span>
                        )}
                        {showSortOption && (
                          <Table.SortBy
                            asc={() => handleSortAsc(config.key)}
                            desc={() => handleSortDesc(config.key)}
                            selected={
                              sortConfig.key === config.key && sortConfig.direction
                                ? sortConfig.direction
                                : undefined
                            }
                          />
                        )}
                      </div>
                    </Table.Head>
                  );
                })}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {paginatedRows.map((row, idx) => {
                const globalIndex = (currentPage - 1) * PAGE_SIZE + idx;
                const isExpanded = expandedRows.has(globalIndex);

                return (
                  <Table.Row key={idx}>
                    {columnConfigs.map((config, colIndex) => {
                      const cellValue = row[config.key] ?? '';
                      const isSelectable = isFieldSelectable(config.key);

                      if (config.key === 'rag') {
                        const ragClass = cellValue?.toLowerCase();
                        return (
                          <Table.Cell
                            key={colIndex}
                            className={`qlik-table-cell qlik-rag ${ragClass} ${isSelectable ? 'selectable' : ''}`}
                            onClick={
                              isSelectable ? () => handleCellClick(idx, config.key) : undefined
                            }
                            style={{
                              cursor: isSelectable ? 'pointer' : 'default',
                              ...(isSelectable && {
                                ':hover': {
                                  backgroundColor: '#f0f8ff',
                                  boxShadow: '0 0 2px rgba(64, 152, 173, 0.5)',
                                },
                              }),
                            }}
                          />
                        );
                      }

                      if (config.key === 'summary') {
                        return (
                          <Table.Cell key={colIndex} className="qlik-table-cell">
                            <div className={`qlik-summary ${!isExpanded ? 'clamped' : ''}`}>
                              {cellValue}
                            </div>
                            {cellValue && cellValue.length > 100 && (
                              <div style={{ marginTop: '4px' }}>
                                <Button
                                  variant="text"
                                  onClick={() => toggleExpand(globalIndex)}
                                  size="sm"
                                >
                                  {isExpanded ? 'Show Less' : 'Show More'}
                                </Button>
                              </div>
                            )}
                          </Table.Cell>
                        );
                      }

                      return (
                        <Table.Cell
                          key={colIndex}
                          className={`qlik-table-cell ${isSelectable ? 'selectable' : ''}`}
                          onClick={
                            isSelectable ? () => handleCellClick(idx, config.key) : undefined
                          }
                          style={{
                            cursor: isSelectable ? 'pointer' : 'default',
                            ...(isSelectable && {
                              ':hover': {
                                backgroundColor: '#f0f8ff',
                                boxShadow: '0 0 2px rgba(64, 152, 173, 0.5)',
                              },
                            }),
                          }}
                        >
                          {cellValue}
                        </Table.Cell>
                      );
                    })}
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>

          <Table.Pagination.Root>
            <Table.Pagination.Count>
              Page {currentPage} of {totalPages}
            </Table.Pagination.Count>
            <Table.Pagination.Previous previous={handlePrevious} />
            <Table.Pagination.Next next={handleNext} />
          </Table.Pagination.Root>
        </Table.Wrapper>
      </div>
    </div>
  );
};

export default QlikTableRowClickable;
