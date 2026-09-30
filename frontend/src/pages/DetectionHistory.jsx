import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SheetBar from '../components/SheetBar';
import ViewToggle from '../components/ViewToggle';
import DetectionFilters from '../components/DetectionFilters';
import DetectionTable from '../components/DetectionTable';
import LogInsight from '../components/LogInsight';
import Pagination from '../components/Pagination';
import ErrorAlert from '../components/ErrorAlert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useApi, useAutoReload } from '../hooks/useApi';
import { useMonitoring } from '../context/MonitoringContext';
import { deleteDetection, listDetections, updateDetectionStatus } from '../services/detectionService';
import { getErrorMessage } from '../services/apiClient';
import { getClasses } from '../services/monitoringService';
import { getStats } from '../services/dashboardService';
import { localDayRange } from '../utils/format';

const PAGE_SIZE = 10;
const EMPTY_FILTERS = { objectClass: '', date: '', minConfidence: '' };
const VIEWS = [
  { value: 'table', label: 'Table' },
  { value: 'insight', label: 'Insight' },
];

function LogTable({ filters, onFiltersChange, page, onPageChange, toggle }) {
  const { isMonitoring } = useMonitoring();
  const classes = useApi(getClasses, []);
  const query = useMemo(
    () => ({ objectClass: filters.objectClass, minConfidence: filters.minConfidence, ...localDayRange(filters.date), page, limit: PAGE_SIZE }),
    [filters, page]
  );
  const detections = useApi(() => listDetections(query), [query]);
  useAutoReload(detections.reload, isMonitoring);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const data = detections.data;

  async function runRowAction(id, action) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  function handleStatusChange(id, status) {
    runRowAction(id, async () => {
      const updated = await updateDetectionStatus(id, status);
      detections.setData({ ...data, items: data.items.map((item) => (item.id === id ? updated : item)) });
    });
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this detection event and its snapshot? This cannot be undone.')) return;
    runRowAction(id, async () => {
      await deleteDetection(id);
      detections.reload();
    });
  }

  return (
    <>
      <SheetBar
        left={
          <>
            <span className="pill font-mono">
              {data ? `${data.items.length}/${data.pagination.total}` : '–'} Rows
            </span>
            <DetectionFilters
              classes={classes.data ?? []}
              filters={filters}
              onChange={onFiltersChange}
              onReset={() => onFiltersChange(EMPTY_FILTERS)}
            />
          </>
        }
        right={toggle}
      />

      <ErrorAlert message={detections.error} onRetry={detections.reload} />
      <ErrorAlert message={actionError} />
      {detections.isLoading && !data && <LoadingSpinner label="Loading events…" />}
      {data && data.items.length === 0 && (
        <p className="cell py-8 text-center text-muted">No detection events match these filters.</p>
      )}
      {data && data.items.length > 0 && (
        <>
          <DetectionTable
            detections={data.items}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            busyId={busyId}
          />
          <Pagination page={data.pagination.page} pages={data.pagination.pages} onPageChange={onPageChange} />
        </>
      )}
    </>
  );
}

function LogInsightView({ toggle }) {
  const { isMonitoring } = useMonitoring();
  const stats = useApi(getStats, []);
  useAutoReload(stats.reload, isMonitoring);

  return (
    <>
      <SheetBar left={<span className="pill">All events</span>} right={toggle} />
      <ErrorAlert message={stats.error} onRetry={stats.reload} />
      {stats.isLoading && !stats.data && <LoadingSpinner label="Crunching numbers…" />}
      {stats.data && <LogInsight stats={stats.data} />}
    </>
  );
}

// The "Detection Log" folder tab: Table (history) and Insight (statistics).
export default function DetectionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'insight' ? 'insight' : 'table';
  // Kept here so filters survive switching Table -> Insight -> Table.
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const toggle = (
    <ViewToggle
      value={view}
      options={VIEWS}
      onChange={(next) => setSearchParams(next === 'insight' ? { view: 'insight' } : {})}
    />
  );

  function handleFiltersChange(next) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div key={view} className="rise-in">
      {view === 'table' ? (
        <LogTable filters={filters} onFiltersChange={handleFiltersChange} page={page} onPageChange={setPage} toggle={toggle} />
      ) : (
        <LogInsightView toggle={toggle} />
      )}
    </div>
  );
}
