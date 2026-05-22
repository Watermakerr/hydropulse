import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker as LeafletMarker, Polygon, Popup, TileLayer, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FileText, MapPin, Plus, ShieldCheck, Trash2, Pencil, Search, Waves, Flag, AlertTriangle,
  ChevronRight, Eye, MapPinOff, CircleDot, X, Upload, Clock, CheckCircle2, XCircle,
  Satellite, BarChart3, Navigation, Crosshair, ClipboardCheck, Sliders
} from 'lucide-react';
import L from 'leaflet';
import { useSearchParams } from 'react-router-dom';
import { api, Marker, ReportPhoto, Reservoir, Task, TaskReport, SatelliteHistory, LocationLogRaw, User, ShorelineBoundary, SurveyPlan, FloodExpansion } from '../services/api';

const SENTINEL2_TILE_URL = (import.meta.env.VITE_SENTINEL2_TILE_URL || '').trim();
const SENTINEL2_ATTRIBUTION =
  (import.meta.env.VITE_SENTINEL2_ATTRIBUTION || '').trim() ||
  'Contains modified Copernicus Sentinel data';

const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const healthyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const warningIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

/* ─── Vietnamese localization maps ───────────────────────────────── */
const markerStatusVi: Record<Marker['status'], string> = {
  normal: 'Bình thường',
  damaged: 'Hư hỏng',
  missing: 'Mất',
  needs_inspection: 'Cần kiểm tra'
};

const markerStatusColor: Record<Marker['status'], { bg: string; text: string; dot: string }> = {
  normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  damaged: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  missing: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  needs_inspection: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }
};

const taskStatusVi: Record<string, string> = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy'
};

const taskStatusIcon: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: Navigation,
  completed: CheckCircle2,
  cancelled: XCircle
};

const taskStatusColor: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-500' }
};

const planStatusLabel: Record<SurveyPlanForm['status'], string> = {
  draft: 'Nháp',
  assigned: 'Đã giao',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn thành',
  archived: 'Lưu trữ'
};

const planStatusColor: Record<SurveyPlanForm['status'], { bg: string; text: string }> = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  assigned: { bg: 'bg-blue-50', text: 'text-blue-700' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  archived: { bg: 'bg-slate-200', text: 'text-slate-500' }
};

const taskPriorityVi: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  urgent: 'Khẩn cấp'
};

const taskPriorityColor: Record<string, string> = {
  low: 'border-l-slate-300',
  medium: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500'
};

const conditionStatusVi: Record<string, string> = {
  good: 'Tốt',
  minor_damage: 'Hư nhẹ',
  major_damage: 'Hư nặng',
  destroyed: 'Phá hủy'
};

const conditionStatusColor: Record<string, { bg: string; text: string }> = {
  good: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  minor_damage: { bg: 'bg-amber-50', text: 'text-amber-700' },
  major_damage: { bg: 'bg-orange-50', text: 'text-orange-700' },
  destroyed: { bg: 'bg-red-50', text: 'text-red-700' }
};

const conditionStatusOptions = [
  { value: 'good', label: 'Tốt' },
  { value: 'minor_damage', label: 'Nhẹ' },
  { value: 'major_damage', label: 'Nguy hiểm' },
  { value: 'destroyed', label: 'Khẩn cấp' }
] as const;

const reportFieldLabels: Record<string, string> = {
  template: 'Mẫu biểu',
  crackDetected: 'Có vết nứt',
  crackWidth: 'Độ rộng vết nứt (mm)',
  crackLength: 'Độ dài vết nứt (cm)',
  waterLeak: 'Có thấm nước',
  dangerLevel: 'Mức độ nguy hiểm',
  gateStatus: 'Tình trạng cửa xả',
  motorNoise: 'Có tiếng động lạ',
  rustDetected: 'Có rỉ sét',
  openCloseTest: 'Test đóng/mở',
  waterLevel: 'Mực nước hiện tại (m)',
  flowRate: 'Lưu lượng nước vào (m3/s)',
  rainStatus: 'Tình trạng mưa',
  floodRisk: 'Nguy cơ lũ',
  landslideDetected: 'Có sạt lở',
  affectedArea: 'Diện tích ảnh hưởng (m2)',
  roadBlocked: 'Có chắn đường',
  encroachmentDetected: 'Phát hiện xâm lấn',
  encroachmentType: 'Loại xâm lấn',
  estimatedArea: 'Diện tích xâm lấn (m2)',
  peopleCount: 'Số người liên quan',
  temporaryOrPermanent: 'Mức độ công trình',
  riskLevel: 'Mức độ ảnh hưởng',
  gpsLocation: 'Vị trí GPS',
  note: 'Ghi chú',
  description: 'Mô tả chi tiết',
  recommendation: 'Đề xuất xử lý'
};

type ReservoirForm = {
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'under_review';
  geojsonFile: File | null;
  geojsonFileName: string;
};

const reservoirStatusLabels: Record<ReservoirForm['status'], string> = {
  active: 'Hoạt động',
  inactive: 'Tạm ngưng',
  under_review: 'Đang rà soát'
};

const reservoirStatusColor: Record<ReservoirForm['status'], { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  under_review: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' }
};

const suggestedReservoirNames = [
  'Hồ Thủy điện Hòa Bình',
  'Hồ Thủy điện Sơn La',
  'Hồ Thủy điện Lai Châu',
  'Hồ Trị An',
  'Hồ Dầu Tiếng',
  'Hồ Thác Mơ'
];

type MarkerForm = {
  code: string;
  name: string;
  status: Marker['status'];
  lng: string;
  lat: string;
};

type SurveyPlanForm = {
  title: string;
  area: string;
  markerIds: string[];
  startDate: string;
  endDate: string;
  leadUserId: string;
  checklistText: string;
  status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'archived';
};

type ShorelineLayerState = {
  normal: boolean;
  dry: boolean;
  wet: boolean;
  scan: boolean;
  flood: boolean;
};

/* ─── Utilities ──────────────────────────────────────────────────── */
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function pointInPolygon(point: [number, number], polygon: [number, number][]) {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];

    const intersect =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI + Number.EPSILON) + latI;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function polygonToLatLng(boundary: { type: 'Polygon'; coordinates: number[][][] }): [number, number][] {
  if (!boundary || boundary.type !== 'Polygon' || !boundary.coordinates.length) {
    return [] as [number, number][];
  }

  return boundary.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
}

function MapClickCapture({
  enabled,
  onClick
}: {
  enabled: boolean;
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) {
        return;
      }
      onClick(e.latlng.lat, e.latlng.lng);
    }
  });

  return null;
}

function formatReportLabel(key: string) {
  if (reportFieldLabels[key]) {
    return reportFieldLabels[key];
  }
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatReportValue(item)).join(', ') : 'N/A';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
      return `${obj.lat.toFixed(6)}, ${obj.lng.toFixed(6)}`;
    }
    return JSON.stringify(obj);
  }
  return String(value);
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function Reservoirs() {
  const [searchParams] = useSearchParams();
  const [activeReservoir, setActiveReservoir] = useState('');
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [reservoirTasks, setReservoirTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskReports, setTaskReports] = useState<TaskReport[]>([]);
  const [taskPhotos, setTaskPhotos] = useState<ReportPhoto[]>([]);
  const [taskLocationLogs, setTaskLocationLogs] = useState<LocationLogRaw[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [reportDraft, setReportDraft] = useState({ description: '', conditionStatus: 'good' });
  const [satelliteHistory, setSatelliteHistory] = useState<SatelliteHistory[]>([]);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [shorelines, setShorelines] = useState<ShorelineBoundary[]>([]);
  const [floodExpansion, setFloodExpansion] = useState<FloodExpansion | null>(null);
  const [shorelineLoading, setShorelineLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<string | null>(null);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<SatelliteHistory | null>(null);
  const [comparisonMode, setComparisonMode] = useState<'current' | 'baseline' | 'blend'>('blend');
  const [comparisonBlend, setComparisonBlend] = useState<number>(0.5);
  const [showCorridor, setShowCorridor] = useState<boolean>(true);

  const { scanOpacity, baselineOpacity } = useMemo(() => {
    if (comparisonMode === 'current') return { scanOpacity: 1, baselineOpacity: 0 };
    if (comparisonMode === 'baseline') return { scanOpacity: 0, baselineOpacity: 1 };
    return { scanOpacity: comparisonBlend, baselineOpacity: 1 - comparisonBlend };
  }, [comparisonMode, comparisonBlend]);

  const [surveyPlans, setSurveyPlans] = useState<SurveyPlan[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [planLeads, setPlanLeads] = useState<User[]>([]);

  const [shorelineLayers, setShorelineLayers] = useState<ShorelineLayerState>({
    normal: true,
    dry: true,
    wet: true,
    scan: true,
    flood: true
  });

  const [planForm, setPlanForm] = useState<SurveyPlanForm>({
    title: '',
    area: '',
    markerIds: [],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    leadUserId: '',
    checklistText: '',
    status: 'draft'
  });

  const [reservoirModalOpen, setReservoirModalOpen] = useState(false);
  const [reservoirModalMode, setReservoirModalMode] = useState<'create' | 'edit'>('create');
  const [reservoirForm, setReservoirForm] = useState<ReservoirForm>({
    name: suggestedReservoirNames[0],
    description: '',
    status: 'active',
    geojsonFile: null,
    geojsonFileName: ''
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [markerModalOpen, setMarkerModalOpen] = useState(false);
  const [markerModalMode, setMarkerModalMode] = useState<'create' | 'edit'>('create');
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [quickMarkerMode, setQuickMarkerMode] = useState(false);
  const [baseLayer, setBaseLayer] = useState<'esri' | 'sentinel2'>(SENTINEL2_TILE_URL ? 'sentinel2' : 'esri');
  const [markerForm, setMarkerForm] = useState<MarkerForm>({
    code: '',
    name: '',
    status: 'normal',
    lng: '105.80',
    lat: '21.00'
  });

  // Sidebar search
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<'all' | ReservoirForm['status']>('all');

  const currentReservoir = useMemo(() => reservoirs.find((r) => r.id === activeReservoir), [reservoirs, activeReservoir]);
  const currentTask = useMemo(() => reservoirTasks.find((t) => t.id === selectedTaskId), [reservoirTasks, selectedTaskId]);
  const currentCenter: [number, number] = currentReservoir?.center || [20.825, 105.284];
  const currentBoundary = currentReservoir?.boundary || [];
  const latestNormalBoundary = useMemo(
    () => shorelines.find((b) => b.boundary_type === 'baseline' && b.season === 'normal'),
    [shorelines]
  );
  const latestDryBoundary = useMemo(
    () => shorelines.find((b) => b.boundary_type === 'baseline' && b.season === 'dry'),
    [shorelines]
  );
  const latestWetBoundary = useMemo(
    () => shorelines.find((b) => b.boundary_type === 'baseline' && b.season === 'wet'),
    [shorelines]
  );
  const currentScanBoundary = useMemo(
    () => shorelines.find((b) => b.is_current) || shorelines.find((b) => b.boundary_type === 'scan'),
    [shorelines]
  );
  const highlightedBoundary = useMemo(
    () => shorelines.find((b) => b.id === selectedBoundaryId) || null,
    [shorelines, selectedBoundaryId]
  );
  const sentinelEnabled = Boolean(SENTINEL2_TILE_URL);
  const tileUrl = baseLayer === 'sentinel2' && sentinelEnabled ? SENTINEL2_TILE_URL : ESRI_TILE_URL;
  const tileAttribution = baseLayer === 'sentinel2' && sentinelEnabled ? SENTINEL2_ATTRIBUTION : ESRI_ATTRIBUTION;

  const shorelineLayerOptions: { key: keyof ShorelineLayerState; label: string; color: string }[] = [
    { key: 'normal', label: 'Hiện trạng', color: 'bg-slate-700' },
    { key: 'dry', label: 'Mùa khô', color: 'bg-amber-500' },
    { key: 'wet', label: 'Mùa mưa', color: 'bg-blue-500' },
    { key: 'scan', label: 'Quét mới', color: 'bg-emerald-500' },
    { key: 'flood', label: 'Ngập mở rộng', color: 'bg-cyan-400' }
  ];

  const currentBounds = useMemo(() => {
    if (!currentBoundary || currentBoundary.length === 0) return null;
    const lats = currentBoundary.map(p => p[0]);
    const lngs = currentBoundary.map(p => p[1]);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ] as [number, number][];
  }, [currentBoundary]);

  const filteredReservoirs = useMemo(() => {
    return reservoirs.filter((r) => {
      const matchSearch = !sidebarSearch || r.name.toLowerCase().includes(sidebarSearch.toLowerCase());
      const matchFilter = sidebarFilter === 'all' || r.backend_status === sidebarFilter;
      return matchSearch && matchFilter;
    });
  }, [reservoirs, sidebarSearch, sidebarFilter]);

  // Stats
  const warningMarkers = markers.filter((m) => m.status !== 'normal').length;
  const activeTasks = reservoirTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').length;
  const latestAlert = satelliteHistory[0]?.alert_level || null;

  const loadReservoirs = async (preferredId?: string) => {
    const rows = await api.getReservoirs();
    setReservoirs(rows);

    const quickId = searchParams.get('reservoirId');
    const hoaBinh = rows.find((r) => normalizeText(r.name).includes('hoa binh'));
    const picked = preferredId || quickId || activeReservoir || hoaBinh?.id || rows[0]?.id || '';
    if (picked && rows.some((r) => r.id === picked)) {
      setActiveReservoir(picked);
    } else {
      setActiveReservoir(rows[0]?.id || '');
    }
  };

  const loadMarkers = async (reservoirId: string) => {
    if (!reservoirId) {
      setMarkers([]);
      return;
    }
    const rows = await api.getMarkers(reservoirId);
    setMarkers(rows);
  };

  const loadReservoirTasks = async (reservoirId: string, preferredTaskId?: string) => {
    if (!reservoirId) {
      setReservoirTasks([]);
      setSelectedTaskId('');
      return;
    }

    const rows = await api.getTasks(reservoirId);
    setReservoirTasks(rows);

    const picked = preferredTaskId || selectedTaskId || rows[0]?.id || '';
    if (picked && rows.some((t) => t.id === picked)) {
      setSelectedTaskId(picked);
    } else {
      setSelectedTaskId(rows[0]?.id || '');
    }
  };

  const loadTaskEvidence = async (taskId: string) => {
    if (!taskId) {
      setTaskReports([]);
      setTaskPhotos([]);
      setTaskLocationLogs([]);
      return;
    }

    setTaskLoading(true);
    try {
      const reports = await api.getTaskReports(taskId);
      setTaskReports(reports);

      const locationLogs = await api.getTaskLocationLogs(taskId);
      setTaskLocationLogs(locationLogs);

      if (!reports.length) {
        setTaskPhotos([]);
        return;
      }

      const photosByReport = await Promise.all(reports.map((report) => api.getReportPhotos(report.id)));
      setTaskPhotos(photosByReport.flat());
    } catch (e) {
      setTaskReports([]);
      setTaskPhotos([]);
      setTaskLocationLogs([]);
      setError(e instanceof Error ? e.message : 'Không thể tải thông tin task');
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setError(null);
        await loadReservoirs();
        await loadPlanLeads();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể tải danh sách hồ chứa');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const loadSatelliteHistory = async (reservoirId: string) => {
    if (!reservoirId) {
      setSatelliteHistory([]);
      return;
    }
    setSatelliteLoading(true);
    try {
      const history = await api.getSatelliteHistory(reservoirId);
      setSatelliteHistory(history);
    } catch (e) {
      console.error(e);
      setSatelliteHistory([]);
    } finally {
      setSatelliteLoading(false);
    }
  };

  const loadShorelines = async (reservoirId: string) => {
    if (!reservoirId) {
      setShorelines([]);
      return;
    }

    setShorelineLoading(true);
    try {
      const rows = await api.getShorelines(reservoirId);
      setShorelines(rows);
    } catch (e) {
      console.error(e);
      setShorelines([]);
    } finally {
      setShorelineLoading(false);
    }
  };

  const loadFloodExpansion = async (reservoirId: string) => {
    if (!reservoirId) {
      setFloodExpansion(null);
      return;
    }

    try {
      const expansion = await api.getFloodExpansion(reservoirId);
      setFloodExpansion(expansion);
    } catch (e) {
      setFloodExpansion(null);
    }
  };

  const loadSurveyPlans = async (reservoirId: string) => {
    if (!reservoirId) {
      setSurveyPlans([]);
      return;
    }

    setPlanLoading(true);
    try {
      const rows = await api.getSurveyPlans(reservoirId);
      setSurveyPlans(rows);
    } catch (e) {
      console.error(e);
      setSurveyPlans([]);
    } finally {
      setPlanLoading(false);
    }
  };

  const loadPlanLeads = async () => {
    try {
      const users = await api.getUsers();
      setPlanLeads(users.filter((u) => u.is_active));
    } catch (e) {
      setPlanLeads([]);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        setSelectedSceneId(null);
        setSelectedBoundaryId(null);
        setSelectedHistoryRecord(null);
        await loadMarkers(activeReservoir);
        await loadReservoirTasks(activeReservoir);
        await loadSatelliteHistory(activeReservoir);
        await loadShorelines(activeReservoir);
        await loadFloodExpansion(activeReservoir);
        await loadSurveyPlans(activeReservoir);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể tải chi tiết hồ');
      }
    };
    run();
  }, [activeReservoir]);

  useEffect(() => {
    void loadTaskEvidence(selectedTaskId);
  }, [selectedTaskId]);

  const withAction = async (fn: () => Promise<void>) => {
    setWorking(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setWorking(false);
    }
  };

  const openCreateReservoir = () => {
    setReservoirModalMode('create');
    setReservoirForm({
      name: suggestedReservoirNames[0],
      description: '',
      status: 'active',
      geojsonFile: null,
      geojsonFileName: ''
    });
    setReservoirModalOpen(true);
  };

  const openEditReservoir = () => {
    if (!currentReservoir) {
      return;
    }

    setReservoirModalMode('edit');
    setReservoirForm({
      name: currentReservoir.name,
      description: currentReservoir.description,
      status: currentReservoir.backend_status,
      geojsonFile: null,
      geojsonFileName: ''
    });
    setReservoirModalOpen(true);
  };

  const submitReservoir = async () => {
    await withAction(async () => {
      if (reservoirModalMode === 'create') {
        if (!reservoirForm.geojsonFile) {
          throw new Error('Vui lòng chọn file GeoJSON polygon');
        }

        const created = await api.createReservoir({
          name: reservoirForm.name,
          description: reservoirForm.description,
          status: reservoirForm.status,
          geojsonFile: reservoirForm.geojsonFile
        });
        setReservoirModalOpen(false);
        await loadReservoirs(created.id);
        await loadMarkers(created.id);
        return;
      }

      if (!currentReservoir) {
        throw new Error('Không có hồ để cập nhật');
      }

      await api.updateReservoir(currentReservoir.id, {
        name: reservoirForm.name,
        description: reservoirForm.description,
        status: reservoirForm.status,
        geojsonFile: reservoirForm.geojsonFile || undefined
      });
      setReservoirModalOpen(false);
      await loadReservoirs(currentReservoir.id);
      await loadMarkers(currentReservoir.id);
    });
  };

  const submitReportDraft = async () => {
    if (!currentTask) {
      return;
    }
    if (!reportDraft.description.trim()) {
      setError('Vui long nhap mo ta bao cao');
      return;
    }

    await withAction(async () => {
      await api.createReport({
        taskId: currentTask.id,
        description: reportDraft.description.trim(),
        conditionStatus: reportDraft.conditionStatus as TaskReport['condition_status']
      });
      setReportDraft({ description: '', conditionStatus: 'good' });
      await loadTaskEvidence(currentTask.id);
    });
  };

  const submitDeleteReservoir = async () => {
    if (!currentReservoir) {
      return;
    }

    await withAction(async () => {
      await api.deleteReservoir(currentReservoir.id);
      setDeleteModalOpen(false);
      await loadReservoirs();
    });
  };

  const submitQuickStatusUpdate = async (status: ReservoirForm['status']) => {
    if (!currentReservoir || status === currentReservoir.backend_status) {
      return;
    }

    await withAction(async () => {
      await api.updateReservoir(currentReservoir.id, { status });
      await loadReservoirs(currentReservoir.id);
      await loadMarkers(currentReservoir.id);
    });
  };

  const submitCreateMarker = async () => {
    if (!activeReservoir) {
      return;
    }

    await withAction(async () => {
      const lng = Number(markerForm.lng);
      const lat = Number(markerForm.lat);
      if (Number.isNaN(lng) || Number.isNaN(lat)) {
        throw new Error('Tọa độ không hợp lệ');
      }

      if (currentBoundary.length && !pointInPolygon([lat, lng], currentBoundary)) {
        throw new Error('Cột mốc phải nằm trong ranh giới hồ');
      }

      await api.createMarker(activeReservoir, {
        code: markerForm.code,
        name: markerForm.name || markerForm.code,
        status: markerForm.status,
        locationGeoJSON: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });

      setMarkerModalOpen(false);
      await loadMarkers(activeReservoir);
    });
  };

  const submitUpdateMarker = async () => {
    if (!editingMarkerId || !activeReservoir) {
      return;
    }

    await withAction(async () => {
      const lng = Number(markerForm.lng);
      const lat = Number(markerForm.lat);
      if (Number.isNaN(lng) || Number.isNaN(lat)) {
        throw new Error('Tọa độ không hợp lệ');
      }

      if (currentBoundary.length && !pointInPolygon([lat, lng], currentBoundary)) {
        throw new Error('Cột mốc phải nằm trong ranh giới hồ');
      }

      await api.updateMarker(editingMarkerId, {
        name: markerForm.name || markerForm.code,
        status: markerForm.status,
        locationGeoJSON: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });

      setEditingMarkerId(null);
      setMarkerModalOpen(false);
      await loadMarkers(activeReservoir);
    });
  };

  const submitQuickCreateMarker = async (lat: number, lng: number) => {
    if (!activeReservoir) {
      return;
    }

    await withAction(async () => {
      if (currentBoundary.length && !pointInPolygon([lat, lng], currentBoundary)) {
        throw new Error('Cột mốc phải nằm trong ranh giới hồ');
      }

      const quickCode = `MK-${Date.now().toString().slice(-8)}`;

      await api.createMarker(activeReservoir, {
        code: quickCode,
        name: quickCode,
        status: 'normal',
        locationGeoJSON: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      });

      setQuickMarkerMode(false);
      await loadMarkers(activeReservoir);
    });
  };

  const handleMapPick = (lat: number, lng: number) => {
    if (quickMarkerMode) {
      if (!working) {
        void submitQuickCreateMarker(lat, lng);
      }
      return;
    }

    if (markerModalOpen) {
      setMarkerForm((prev) => ({
        ...prev,
        lat: lat.toFixed(6),
        lng: lng.toFixed(6)
      }));
    }
  };

  const openCustomMarkerModal = () => {
    setQuickMarkerMode(false);
    setMarkerModalMode('create');
    setEditingMarkerId(null);
    setMarkerForm({
      code: '',
      name: '',
      status: 'normal',
      lng: currentCenter[1].toFixed(6),
      lat: currentCenter[0].toFixed(6)
    });
    setMarkerModalOpen(true);
  };

  const openEditMarkerModal = (marker: Marker) => {
    setQuickMarkerMode(false);
    setMarkerModalMode('edit');
    setEditingMarkerId(marker.id);
    setMarkerForm({
      code: marker.code,
      name: marker.name || marker.code,
      status: marker.status,
      lng: String(marker.location_geojson.coordinates[0]),
      lat: String(marker.location_geojson.coordinates[1])
    });
    setMarkerModalOpen(true);
  };

  const handleChangeMarkerStatus = async (markerId: string, status: Marker['status']) => {
    await withAction(async () => {
      await api.updateMarker(markerId, { status });
      await loadMarkers(activeReservoir);
    });
  };

  const handleDeleteMarker = async (markerId: string) => {
    await withAction(async () => {
      await api.deleteMarker(markerId);
      await loadMarkers(activeReservoir);
    });
  };

  const submitSatelliteAnalysis = async () => {
    if (!activeReservoir) return;
    await withAction(async () => {
      await api.triggerSatelliteAnalysis(activeReservoir, undefined, 'gee');
      await loadSatelliteHistory(activeReservoir);
      await loadShorelines(activeReservoir);
      await loadFloodExpansion(activeReservoir);
    });
  };

  const resetPlanForm = () => {
    setPlanForm({
      title: '',
      area: '',
      markerIds: [],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      leadUserId: '',
      checklistText: '',
      status: 'draft'
    });
  };

  const togglePlanMarker = (markerId: string) => {
    setPlanForm((prev) => {
      const exists = prev.markerIds.includes(markerId);
      return {
        ...prev,
        markerIds: exists ? prev.markerIds.filter((id) => id !== markerId) : [...prev.markerIds, markerId]
      };
    });
  };

  const submitSurveyPlan = async () => {
    if (!activeReservoir) {
      return;
    }

    if (!planForm.title.trim()) {
      setError('Vui lòng nhập tên kế hoạch khảo sát');
      return;
    }

    setPlanSubmitting(true);
    setError(null);
    try {
      const checklist = planForm.checklistText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      await api.createSurveyPlan({
        reservoirId: activeReservoir,
        title: planForm.title.trim(),
        area: planForm.area || undefined,
        markerIds: planForm.markerIds.length ? planForm.markerIds : undefined,
        startDate: planForm.startDate || undefined,
        endDate: planForm.endDate || undefined,
        leadUserId: planForm.leadUserId || undefined,
        checklist: checklist.length ? checklist : undefined,
        status: planForm.status
      });

      setPlanModalOpen(false);
      resetPlanForm();
      await loadSurveyPlans(activeReservoir);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo kế hoạch khảo sát');
    } finally {
      setPlanSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-on-surface-variant font-medium">Đang tải dữ liệu hồ chứa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 animate-fade-in-up">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══ Summary Stat Cards ══════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] card-hover-lift">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Waves className="w-4 h-4 text-primary" /></div>
            <span className="text-[10px] font-bold text-primary bg-primary-fixed/40 px-2 py-0.5 rounded-full">{reservoirs.length}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Tổng số hồ</p>
          <p className="text-2xl font-black text-primary mt-0.5 tracking-tight">{reservoirs.length}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] card-hover-lift">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><Flag className="w-4 h-4 text-emerald-600" /></div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{markers.length} mốc</span>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Cột mốc GPS</p>
          <p className="text-2xl font-black text-primary mt-0.5 tracking-tight">{markers.length}</p>
        </div>
        <div className="bg-surface-container-lowest p-5 rounded-xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] card-hover-lift">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 rounded-lg"><BarChart3 className="w-4 h-4 text-blue-600" /></div>
            {activeTasks > 0 && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Đang xử lý</span>}
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Nhiệm vụ</p>
          <p className="text-2xl font-black text-primary mt-0.5 tracking-tight">{activeTasks}<span className="text-sm font-medium text-on-surface-variant">/{reservoirTasks.length}</span></p>
        </div>
        <div className={`p-5 rounded-xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] card-hover-lift ${latestAlert === 'HIGH' ? 'bg-red-50 border border-red-100' :
            latestAlert === 'MEDIUM' ? 'bg-amber-50 border border-amber-100' :
              'bg-surface-container-lowest'
          }`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-lg ${latestAlert === 'HIGH' ? 'bg-red-100' : latestAlert === 'MEDIUM' ? 'bg-amber-100' : 'bg-slate-100'}`}>
              <Satellite className={`w-4 h-4 ${latestAlert === 'HIGH' ? 'text-red-600' : latestAlert === 'MEDIUM' ? 'text-amber-600' : 'text-slate-500'}`} />
            </div>
          </div>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Cảnh báo vệ tinh</p>
          <p className={`text-2xl font-black mt-0.5 tracking-tight ${latestAlert === 'HIGH' ? 'text-red-700' : latestAlert === 'MEDIUM' ? 'text-amber-700' : 'text-primary'
            }`}>{latestAlert || '—'}</p>
        </div>
      </div>

      {/* ═══ Main Layout ═════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6 flex-1">

        {/* ─── Sidebar: Reservoir List ──────────────────────────────── */}
        <section className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-primary">Danh sách hồ chứa</h2>
                <button
                  onClick={openCreateReservoir}
                  disabled={working}
                  className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  title="Thêm hồ chứa mới"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {/* Search */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm hồ..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container text-xs border-none outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                />
              </div>
              {/* Filter Pills */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'active', 'inactive', 'under_review'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSidebarFilter(f)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${sidebarFilter === f
                        ? 'bg-primary text-white'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                  >
                    {f === 'all' ? 'Tất cả' : reservoirStatusLabels[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Reservoir Cards */}
            <div className="max-h-[calc(100vh-440px)] overflow-y-auto custom-scrollbar p-2 space-y-1.5">
              {filteredReservoirs.map((reservoir) => {
                const isActive = activeReservoir === reservoir.id;
                const stColor = reservoirStatusColor[reservoir.backend_status];
                return (
                  <div
                    key={reservoir.id}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all group ${isActive
                        ? 'bg-primary/[0.06] border border-primary/20 shadow-[0_2px_8px_rgba(0,51,88,0.06)]'
                        : 'hover:bg-surface-container-low border border-transparent'
                      }`}
                    onClick={() => setActiveReservoir(reservoir.id)}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h3 className={`font-bold text-sm leading-tight ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {reservoir.name}
                      </h3>
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-primary rotate-0' : 'text-on-surface-variant/40 group-hover:translate-x-0.5'
                        }`} />
                    </div>
                    <p className="text-[11px] text-on-surface-variant mb-2 line-clamp-2">{reservoir.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${stColor.bg} ${stColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${stColor.dot}`}></span>
                        {reservoirStatusLabels[reservoir.backend_status]}
                      </span>
                      {reservoir.area_ha && (
                        <span className="px-2 py-0.5 bg-primary-fixed/30 text-primary text-[10px] rounded-full font-semibold">
                          {reservoir.area_ha.toLocaleString()} ha
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {!filteredReservoirs.length && (
                <div className="py-12 px-4 text-center">
                  <MapPinOff className="w-10 h-10 text-on-surface-variant/20 mx-auto mb-3" />
                  <p className="text-xs text-on-surface-variant font-medium">Không tìm thấy hồ chứa nào</p>
                  <p className="text-[11px] text-on-surface-variant/60 mt-1">Thử thay đổi bộ lọc hoặc tìm kiếm</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-gradient-to-br from-primary to-primary-container text-white p-5 rounded-xl space-y-3 shadow-[0_8px_24px_rgba(0,51,88,0.15)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold opacity-80 uppercase tracking-widest">Thao tác nhanh</span>
              <ShieldCheck className="w-5 h-5 opacity-60" />
            </div>
            <p className="text-white/60 text-[11px]">{currentReservoir?.name || 'Chưa chọn hồ'}</p>
            <div className="flex gap-2">
              <button
                onClick={openEditReservoir}
                disabled={!currentReservoir || working}
                className="flex-1 text-xs font-bold px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
              >
                <Pencil className="w-3.5 h-3.5" /> Sửa
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                disabled={!currentReservoir || working}
                className="flex-1 text-xs font-bold px-3 py-2.5 bg-white/10 hover:bg-red-500/30 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa
              </button>
            </div>
          </div>
        </section>

        {/* ─── Main Content ─────────────────────────────────────────── */}
        <section className="col-span-12 lg:col-span-9 flex flex-col gap-6">

          {/* ── Map ──────────────────────────────────────────────────── */}
          <div className="relative bg-surface-container-highest rounded-2xl overflow-hidden h-[480px] shadow-[0_8px_32px_rgba(0,51,88,0.06)] z-0">
            <MapContainer center={currentCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <MapUpdater center={currentCenter} />
              <MapClickCapture enabled={markerModalOpen || quickMarkerMode} onClick={handleMapPick} />
              <TileLayer
                attribution={tileAttribution}
                url={tileUrl}
              />
              {selectedSceneId && currentBounds && (
                <ImageOverlay
                  url={`http://localhost:4000/api/satellite/thumbnail/${selectedSceneId}?width=1024`}
                  bounds={currentBounds}
                  opacity={0.8}
                  zIndex={10}
                />
              )}
              {currentBoundary.length > 0 && shorelineLayers.normal && (
                <Polygon positions={currentBoundary} pathOptions={{ color: '#003358', fillColor: '#004a7c', fillOpacity: 0.12 }} />
              )}
              {/* Protective Corridor Buffer Zone (Hành lang phân đệm bảo vệ) */}
              {showCorridor && currentBoundary.length > 0 && (
                <>
                  {/* Outer soft glow (100m boundary outer belt) */}
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{
                      color: '#a855f7',
                      fillColor: 'transparent',
                      fillOpacity: 0,
                      weight: 80,
                      opacity: 0.15,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                  />
                  {/* Middle glow (50m boundary belt) */}
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{
                      color: '#d946ef',
                      fillColor: 'transparent',
                      fillOpacity: 0,
                      weight: 40,
                      opacity: 0.25,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                  />
                  {/* Inner neon border */}
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{
                      color: '#f472b6',
                      fillColor: '#a855f7',
                      fillOpacity: 0.04,
                      weight: 16,
                      opacity: 0.45,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                  />
                  {/* Core white edge line */}
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{
                      color: '#ffffff',
                      fillColor: 'transparent',
                      fillOpacity: 0,
                      weight: 3,
                      opacity: 0.8,
                      lineJoin: 'round',
                      lineCap: 'round'
                    }}
                  />
                </>
              )}
              {latestNormalBoundary && shorelineLayers.normal && (
                <Polygon
                  positions={polygonToLatLng(latestNormalBoundary.boundary_geojson)}
                  pathOptions={{ color: '#0f172a', weight: 2, dashArray: '4 6', fillOpacity: 0 }}
                />
              )}
              {latestDryBoundary && shorelineLayers.dry && (
                <Polygon
                  positions={polygonToLatLng(latestDryBoundary.boundary_geojson)}
                  pathOptions={{ color: '#f59e0b', weight: 2.5, fillOpacity: 0.08, fillColor: '#fcd34d' }}
                />
              )}
              {latestWetBoundary && shorelineLayers.wet && (
                <Polygon
                  positions={polygonToLatLng(latestWetBoundary.boundary_geojson)}
                  pathOptions={{ color: '#2563eb', weight: 2.5, fillOpacity: 0.08, fillColor: '#93c5fd' }}
                />
              )}
              {currentScanBoundary && shorelineLayers.scan && (
                <Polygon
                  positions={polygonToLatLng(currentScanBoundary.boundary_geojson)}
                  pathOptions={{ color: '#14b8a6', weight: 3, fillOpacity: 0.05, fillColor: '#5eead4' }}
                />
              )}
              {floodExpansion && shorelineLayers.flood && (
                <Polygon
                  positions={polygonToLatLng(floodExpansion.boundary_geojson)}
                  pathOptions={{ color: '#22d3ee', weight: 2.5, fillOpacity: 0.08, fillColor: '#67e8f9' }}
                />
              )}
              {highlightedBoundary && (
                <Polygon
                  positions={polygonToLatLng(highlightedBoundary.boundary_geojson)}
                  pathOptions={{ color: '#f97316', weight: 4, fillOpacity: 0, dashArray: '2 4' }}
                />
              )}
              {markers.map((marker) => (
                <LeafletMarker
                  key={marker.id}
                  position={[marker.location_geojson.coordinates[1], marker.location_geojson.coordinates[0]]}
                  icon={marker.status === 'normal' ? healthyIcon : warningIcon}
                >
                  <Popup>
                    <div className="min-w-[160px]">
                      <strong className="text-sm">{marker.name}</strong>
                      <br />
                      <span className="text-xs text-slate-500">Mã: {marker.code}</span>
                      <br />
                      <span className="text-xs">Trạng thái: <strong>{markerStatusVi[marker.status]}</strong></span>
                    </div>
                  </Popup>
                </LeafletMarker>
              ))}
            </MapContainer>

            {/* Quick Marker Mode Banner */}
            {quickMarkerMode && (
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-xl text-xs font-bold text-primary shadow-lg flex items-center gap-2 animate-fade-in-up">
                <Crosshair className="w-4 h-4 text-primary animate-pulse" />
                <span>Click vào bản đồ để tạo cột mốc nhanh</span>
                <button onClick={() => setQuickMarkerMode(false)} className="ml-2 p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {shorelineLoading && (
              <div className="absolute top-14 left-3 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold text-on-surface-variant shadow-lg animate-fade-in-up">
                Đang tải lớp ranh giới...
              </div>
            )}

            {/* Map Layer Toggle */}
            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-1.5 py-1.5 rounded-xl text-xs font-bold text-primary shadow-lg flex gap-1">
              <button
                className={`px-3 py-1.5 rounded-lg transition-all ${baseLayer === 'esri' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 text-on-surface-variant'}`}
                onClick={() => setBaseLayer('esri')}
              >
                Vệ tinh
              </button>
              <button
                className={`px-3 py-1.5 rounded-lg transition-all ${baseLayer === 'sentinel2' ? 'bg-primary text-white shadow-sm' : 'hover:bg-slate-100 text-on-surface-variant'} ${!sentinelEnabled ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                onClick={() => {
                  if (sentinelEnabled) {
                    setBaseLayer('sentinel2');
                  }
                }}
                title={
                  sentinelEnabled
                    ? 'Bật lớp ảnh Sentinel-2'
                    : 'Cần cấu hình VITE_SENTINEL2_TILE_URL trong file .env để bật Sentinel-2'
                }
              >
                Sentinel-2
              </button>
            </div>

            <div className="absolute top-14 right-3 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] font-bold text-primary shadow-lg space-y-2 w-40">
              <div className="text-[9px] uppercase tracking-widest text-on-surface-variant">Lớp ranh giới</div>
              <div className="space-y-1">
                {shorelineLayerOptions.map((layer) => (
                  <button
                    key={layer.key}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg transition-colors ${shorelineLayers[layer.key]
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    onClick={() =>
                      setShorelineLayers((prev) => ({
                        ...prev,
                        [layer.key]: !prev[layer.key]
                      }))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${layer.color}`}></span>
                      <span>{layer.label}</span>
                    </div>
                    <span>{shorelineLayers[layer.key] ? 'On' : 'Off'}</span>
                  </button>
                ))}
                
                {/* Hành lang đệm toggle */}
                <button
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg transition-colors border-t border-slate-100/50 mt-1 pt-1.5 ${showCorridor
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  onClick={() => setShowCorridor((prev) => !prev)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                    <span className="font-bold">Hành lang 100m</span>
                  </div>
                  <span>{showCorridor ? 'On' : 'Off'}</span>
                </button>
              </div>
            </div>

            {/* Map Info Overlay */}
            {currentReservoir && (
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg max-w-xs z-[500]">
                <p className="text-xs font-black text-primary">{currentReservoir.name}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-on-surface-variant">
                    {currentReservoir.area_ha ? `${currentReservoir.area_ha.toLocaleString()} ha` : 'N/A'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {markers.length} cột mốc
                  </span>
                </div>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-3.5 py-3 rounded-xl shadow-lg w-48 z-[500] text-[10px] font-sans border border-slate-100/80 flex flex-col gap-2 animate-fade-in">
              <div className="font-bold text-[11px] text-primary border-b border-slate-100 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-primary rounded-full"></span>
                Chú thích bản đồ
              </div>
              <div className="flex flex-col gap-2 mt-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.3)]"></span>
                  <span className="text-on-surface-variant font-semibold">Cột mốc an toàn</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-400 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                  <span className="text-on-surface-variant font-semibold">Cột mốc cảnh báo</span>
                </div>
                
                {shorelineLayers.normal && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <span className="w-4 h-1 border-t-2 border-slate-800"></span>
                    <span className="text-on-surface-variant font-semibold">Ranh giới hiện trạng</span>
                  </div>
                )}
                {shorelineLayers.dry && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <span className="w-4 h-1 border-t-2 border-[#f59e0b]"></span>
                    <span className="text-on-surface-variant font-semibold">Ranh giới mùa khô</span>
                  </div>
                )}
                {shorelineLayers.wet && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <span className="w-4 h-1 border-t-2 border-[#2563eb]"></span>
                    <span className="text-on-surface-variant font-semibold">Ranh giới mùa mưa</span>
                  </div>
                )}
                {shorelineLayers.scan && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <span className="w-4 h-1 border-t-2 border-[#14b8a6]"></span>
                    <span className="text-on-surface-variant font-semibold">Ranh giới quét mới</span>
                  </div>
                )}
                {shorelineLayers.flood && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <span className="w-4 h-1 border-t-2 border-[#22d3ee]"></span>
                    <span className="text-on-surface-variant font-semibold">Ngập mở rộng</span>
                  </div>
                )}
                {showCorridor && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className="w-4 h-2.5 bg-purple-500/20 border border-purple-500/40 rounded-sm shadow-[0_0_4px_rgba(168,85,247,0.2)]"></div>
                    <span className="text-on-surface-variant font-semibold">Hành lang đệm (100m)</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Markers + Detail Panel ────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Marker Table */}
            <div className="md:col-span-2 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_4px_16px_rgba(0,51,88,0.04)]">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-lg font-black text-primary">Tọa độ GPS & Cột mốc</h2>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Quản lý vị trí cột mốc ranh giới</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setMarkerModalOpen(false);
                      setQuickMarkerMode((prev) => !prev);
                    }}
                    disabled={working || !activeReservoir}
                    className={`flex items-center gap-1.5 font-bold text-xs px-3 py-2 rounded-lg transition-all ${quickMarkerMode
                        ? 'bg-primary text-white'
                        : 'text-primary hover:bg-primary-fixed/40 border border-primary/10'
                      }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    {quickMarkerMode ? 'Tắt' : 'Thêm nhanh'}
                  </button>
                  <button
                    onClick={openCustomMarkerModal}
                    disabled={working || !activeReservoir}
                    className="flex items-center gap-1.5 text-white bg-primary font-bold text-xs px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm mốc
                  </button>
                </div>
              </div>

              {markers.length === 0 ? (
                <div className="py-16 text-center">
                  <MapPin className="w-12 h-12 text-on-surface-variant/15 mx-auto mb-3" />
                  <p className="text-sm font-medium text-on-surface-variant">Chưa có cột mốc nào</p>
                  <p className="text-[11px] text-on-surface-variant/60 mt-1">Bấm "Thêm mốc" hoặc "Thêm nhanh" để tạo cột mốc mới</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold border-b border-outline-variant/15">
                      <tr>
                        <th className="pb-3 pl-1">Mã mốc</th>
                        <th className="pb-3">Kinh độ</th>
                        <th className="pb-3">Vĩ độ</th>
                        <th className="pb-3">Trạng thái</th>
                        <th className="pb-3 text-right pr-1">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {markers.map((marker) => {
                        const mColor = markerStatusColor[marker.status];
                        return (
                          <tr key={marker.id} className="group hover:bg-surface-container/50 transition-colors border-b border-slate-50 last:border-0">
                            <td className="py-3.5 pl-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${mColor.dot}`}></div>
                                <span className="font-bold text-on-surface">{marker.code}</span>
                              </div>
                            </td>
                            <td className="py-3.5 font-mono text-on-surface-variant">{marker.location_geojson.coordinates[0].toFixed(6)}</td>
                            <td className="py-3.5 font-mono text-on-surface-variant">{marker.location_geojson.coordinates[1].toFixed(6)}</td>
                            <td className="py-3.5">
                              <select
                                className={`text-[11px] font-bold border-none rounded-full px-2.5 py-1 cursor-pointer ${mColor.bg} ${mColor.text}`}
                                value={marker.status}
                                onChange={(e) => handleChangeMarkerStatus(marker.id, e.target.value as Marker['status'])}
                              >
                                <option value="normal">🟢 Bình thường</option>
                                <option value="damaged">🔴 Hư hỏng</option>
                                <option value="missing">⚫ Mất</option>
                                <option value="needs_inspection">🟡 Cần kiểm tra</option>
                              </select>
                            </td>
                            <td className="py-3.5 pr-1">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => openEditMarkerModal(marker)}
                                  className="p-1.5 hover:bg-primary-fixed rounded-lg text-primary transition-colors"
                                  title="Sửa cột mốc"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMarker(marker.id)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                  title="Xóa cột mốc"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detail Panel */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] flex flex-col overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h4 className="text-xs font-black text-primary uppercase tracking-widest">Chi tiết hồ</h4>
              </div>
              <div className="p-5 space-y-5 flex-1">
                {/* Status */}
                <div>
                  <p className="text-[10px] text-on-surface-variant font-semibold mb-2">Tình trạng hồ</p>
                  <div className="flex items-center gap-2">
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-3 py-2 flex-1 bg-white font-medium"
                      value={currentReservoir?.backend_status || 'active'}
                      disabled={!currentReservoir || working}
                      onChange={(e) => {
                        void submitQuickStatusUpdate(e.target.value as ReservoirForm['status']);
                      }}
                    >
                      <option value="active">🟢 Hoạt động</option>
                      <option value="inactive">⚫ Tạm ngưng</option>
                      <option value="under_review">🟡 Đang rà soát</option>
                    </select>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container rounded-xl p-3.5">
                    <p className="text-[10px] text-on-surface-variant font-semibold">Tổng mốc</p>
                    <p className="text-xl font-black text-primary mt-1">{markers.length}</p>
                  </div>
                  <div className="bg-surface-container rounded-xl p-3.5">
                    <p className="text-[10px] text-on-surface-variant font-semibold">Cảnh báo</p>
                    <p className={`text-xl font-black mt-1 ${warningMarkers > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{warningMarkers}</p>
                  </div>
                </div>

                {/* Area */}
                <div className="bg-gradient-to-br from-primary/5 to-primary/[0.02] rounded-xl p-4">
                  <p className="text-[10px] text-on-surface-variant font-semibold">Diện tích mặt nước</p>
                  <p className="text-2xl font-black text-primary mt-1">
                    {currentReservoir?.area_ha ? (currentReservoir.area_ha / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}{' '}
                    <span className="text-xs font-normal text-on-surface-variant">km²</span>
                  </p>
                  {currentReservoir?.area_ha && (
                    <p className="text-[10px] text-on-surface-variant mt-1">~ {currentReservoir.area_ha.toLocaleString()} ha</p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100">
                <button className="w-full py-3 bg-primary/5 hover:bg-primary hover:text-white text-primary border border-primary/10 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> Xuất báo cáo PDF
                </button>
              </div>
            </div>
          </div>

          {/* ── Tasks + Reports ───────────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_4px_16px_rgba(0,51,88,0.04)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Task List */}
              <div className="lg:col-span-1 border-r border-slate-100">
                <div className="px-5 py-4 border-b border-slate-100 bg-surface-container/50">
                  <h3 className="text-sm font-black text-primary">Nhiệm vụ của hồ</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">Chọn nhiệm vụ để xem chi tiết</p>
                </div>
                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  {reservoirTasks.map((task) => {
                    const isSelected = selectedTaskId === task.id;
                    const sc = taskStatusColor[task.status] || taskStatusColor.pending;
                    const StatusIcon = taskStatusIcon[task.status] || Clock;
                    const priorityBorder = taskPriorityColor[task.priority] || taskPriorityColor.medium;
                    return (
                      <button
                        key={task.id}
                        className={`w-full text-left px-5 py-3.5 border-b border-slate-50 transition-all border-l-[3px] ${priorityBorder} ${isSelected ? 'bg-primary-fixed/30' : 'hover:bg-surface-container/50'
                          }`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex items-start gap-2">
                          <StatusIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${sc.text}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-on-surface truncate">{task.title}</div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                                {taskStatusVi[task.status] || task.status}
                              </span>
                              <span className="text-[10px] text-on-surface-variant font-medium">
                                {taskPriorityVi[task.priority] || task.priority}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {!reservoirTasks.length && (
                    <div className="px-5 py-12 text-center">
                      <CircleDot className="w-10 h-10 text-on-surface-variant/15 mx-auto mb-2" />
                      <p className="text-xs text-on-surface-variant font-medium">Hồ này chưa có nhiệm vụ</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Task Detail */}
              <div className="lg:col-span-2 p-5">
                {!currentTask && (
                  <div className="flex items-center justify-center h-full py-16">
                    <div className="text-center">
                      <Eye className="w-12 h-12 text-on-surface-variant/15 mx-auto mb-3" />
                      <p className="text-sm text-on-surface-variant font-medium">Chọn một nhiệm vụ để xem chi tiết</p>
                    </div>
                  </div>
                )}

                {currentTask && (
                  <div className="space-y-5 animate-fade-in-up">
                    {/* Task Header */}
                    <div>
                      <h3 className="text-lg font-black text-primary">{currentTask.title}</h3>
                      <p className="text-sm text-on-surface-variant mt-1">{currentTask.description || 'Không có mô tả'}</p>
                    </div>

                    {/* Task Meta Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Trạng thái', value: taskStatusVi[currentTask.status] || currentTask.status, color: taskStatusColor[currentTask.status] },
                        { label: 'Độ ưu tiên', value: taskPriorityVi[currentTask.priority] || currentTask.priority },
                        { label: 'Người phụ trách', value: currentTask.assigned_to_name || 'Chưa phân công' },
                        { label: 'Hạn hoàn thành', value: new Date(currentTask.due_date).toLocaleDateString('vi-VN') }
                      ].map((item, i) => (
                        <div key={i} className="bg-surface-container rounded-xl p-3">
                          <div className="text-[10px] text-on-surface-variant font-semibold">{item.label}</div>
                          <div className="text-xs font-bold mt-1 text-on-surface">{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Reports */}
                    <div>
                      <h4 className="text-sm font-black text-primary mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Báo cáo hiện trường
                      </h4>
                      {currentTask && (
                        <div className="bg-surface-container-lowest border border-slate-100 rounded-xl p-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Mô tả báo cáo</label>
                              <textarea
                                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                rows={3}
                                placeholder="Nhập mô tả hiện trường..."
                                value={reportDraft.description}
                                onChange={(e) => setReportDraft({ ...reportDraft, description: e.target.value })}
                                disabled={taskLoading || working}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Tình trạng</label>
                              <select
                                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs outline-none focus:ring-2 focus:ring-primary/10"
                                value={reportDraft.conditionStatus}
                                onChange={(e) => setReportDraft({ ...reportDraft, conditionStatus: e.target.value })}
                                disabled={taskLoading || working}
                              >
                                {conditionStatusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="mt-3 w-full px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                                onClick={submitReportDraft}
                                disabled={taskLoading || working || !reportDraft.description.trim()}
                              >
                                Lưu báo cáo
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {taskLoading && (
                        <div className="space-y-2">
                          {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl shimmer"></div>)}
                        </div>
                      )}
                      {!taskLoading && !taskReports.length && (
                        <p className="text-xs text-on-surface-variant bg-surface-container rounded-xl p-4 text-center">Chưa có báo cáo nào cho nhiệm vụ này</p>
                      )}
                      {!taskLoading && taskReports.length > 0 && (
                        <div className="space-y-2">
                          {taskReports.map((report) => {
                            const cColor = conditionStatusColor[report.condition_status] || conditionStatusColor.good;
                            const formEntries = report.form_data
                              ? Object.entries(report.form_data).filter(([key]) => !['photos', 'template', 'conditionStatus'].includes(key))
                              : [];
                            const hasLegacyDetails = Boolean(report.weather || report.damage_type || report.water_level !== null);
                            return (
                              <div key={report.id} className="border border-slate-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cColor.bg} ${cColor.text}`}>
                                    {conditionStatusVi[report.condition_status] || report.condition_status}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant">
                                    {new Date(report.reported_at).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div className="bg-surface-container rounded-lg p-2">
                                    <div className="text-[10px] text-on-surface-variant font-semibold">Mô tả</div>
                                    <div className="text-[11px] text-on-surface mt-1">
                                        {report.description || 'Chưa có mô tả'}
                                    </div>
                                  </div>
                                  {hasLegacyDetails && (
                                    <>
                                      <div className="bg-surface-container rounded-lg p-2">
                                          <div className="text-[10px] text-on-surface-variant font-semibold">Thời tiết</div>
                                          <div className="text-[11px] text-on-surface mt-1">{report.weather || 'N/A'}</div>
                                      </div>
                                      <div className="bg-surface-container rounded-lg p-2">
                                          <div className="text-[10px] text-on-surface-variant font-semibold">Mực nước</div>
                                        <div className="text-[11px] text-on-surface mt-1">
                                          {report.water_level ?? 'N/A'}
                                        </div>
                                      </div>
                                      <div className="bg-surface-container rounded-lg p-2">
                                          <div className="text-[10px] text-on-surface-variant font-semibold">Loại hư hỏng</div>
                                        <div className="text-[11px] text-on-surface mt-1">{report.damage_type || 'N/A'}</div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                {formEntries.length > 0 && (
                                  <div className="mt-3">
                                      <div className="text-[10px] font-semibold text-on-surface-variant mb-2">Dữ liệu form</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {formEntries.map(([key, value]) => (
                                        <div key={key} className="bg-surface-container rounded-lg p-2">
                                          <div className="text-[10px] text-on-surface-variant font-semibold">
                                            {formatReportLabel(key)}
                                          </div>
                                          <div className="text-[11px] text-on-surface mt-1 break-words">
                                            {formatReportValue(value)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Location Trail */}
                    <div>
                      <h4 className="text-sm font-black text-primary mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Lịch sử vị trí
                      </h4>
                      {!taskLoading && !taskLocationLogs.length && (
                        <p className="text-xs text-on-surface-variant bg-surface-container rounded-xl p-4 text-center">Chưa có dữ liệu vị trí nào</p>
                      )}
                      {taskLocationLogs.length > 0 && (
                        <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                          {taskLocationLogs.map((log, idx) => (
                            <div key={log.id} className="border border-slate-100 rounded-xl p-3 bg-white hover:shadow-sm transition-shadow">
                              <div className="flex items-start justify-between mb-1.5">
                                <span className="text-[10px] font-bold bg-primary-fixed text-primary px-2 py-1 rounded-full">#{idx + 1}</span>
                                <span className="text-[10px] text-on-surface-variant">{new Date(log.recorded_at).toLocaleString('vi-VN')}</span>
                              </div>
                              <p className="text-[11px] font-mono text-on-surface-variant">
                                📍 {log.location_geojson.coordinates[1].toFixed(6)}, {log.location_geojson.coordinates[0].toFixed(6)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Photos */}
                    <div>
                      <h4 className="text-sm font-black text-primary mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Ảnh đính kèm
                      </h4>
                      {!taskLoading && !taskPhotos.length && (
                        <p className="text-xs text-on-surface-variant bg-surface-container rounded-xl p-4 text-center">Chưa có ảnh đính kèm nào</p>
                      )}
                      {taskPhotos.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {taskPhotos.map((photo) => (
                            <a
                              key={photo.id}
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block rounded-xl overflow-hidden border border-slate-100 group relative card-hover-lift"
                            >
                              <img src={photo.url} alt={photo.caption || 'Ảnh báo cáo'} className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              {photo.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-2 truncate backdrop-blur-sm">
                                  {photo.caption}
                                </div>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Survey Plans ─────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,51,88,0.04)]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-black text-primary flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5" /> Kế hoạch khảo sát
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-1">Lập kế hoạch điều tra cột mốc, theo dõi tiến độ triển khai.</p>
              </div>
              <button
                onClick={() => {
                  resetPlanForm();
                  setPlanModalOpen(true);
                }}
                disabled={!activeReservoir || planSubmitting}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Tạo kế hoạch
              </button>
            </div>

            {planLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-28 rounded-xl shimmer" />
                ))}
              </div>
            )}

            {!planLoading && surveyPlans.length === 0 && (
              <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <ClipboardCheck className="w-10 h-10 text-on-surface-variant/15 mx-auto mb-3" />
                <p className="text-sm font-medium text-on-surface-variant">Chưa có kế hoạch khảo sát</p>
                <p className="text-[11px] text-on-surface-variant/60 mt-1">Bấm "Tạo kế hoạch" để bắt đầu quy trình điều tra</p>
              </div>
            )}

            {!planLoading && surveyPlans.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {surveyPlans.map((plan) => {
                  const pColor = planStatusColor[plan.status];
                  const planRange = plan.start_date || plan.end_date
                    ? `${plan.start_date ? new Date(plan.start_date).toLocaleDateString('vi-VN') : 'N/A'} - ${plan.end_date ? new Date(plan.end_date).toLocaleDateString('vi-VN') : 'N/A'}`
                    : 'Chưa đặt lịch';

                  return (
                    <div key={plan.id} className="border border-slate-100 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-primary">{plan.title}</p>
                          <p className="text-[11px] text-on-surface-variant mt-1">{plan.area || 'Chưa ghi khu vực'}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${pColor.bg} ${pColor.text}`}>
                          {planStatusLabel[plan.status]}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4 text-[11px] text-on-surface-variant">
                        <div>
                          <p className="font-semibold text-[10px] uppercase tracking-widest">Thời gian</p>
                          <p className="mt-1 text-xs text-on-surface">{planRange}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[10px] uppercase tracking-widest">Phụ trách</p>
                          <p className="mt-1 text-xs text-on-surface">{plan.lead_name || 'Chưa phân công'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[10px] uppercase tracking-widest">Cột mốc</p>
                          <p className="mt-1 text-xs text-on-surface">{plan.marker_ids.length}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-[10px] uppercase tracking-widest">Checklist</p>
                          <p className="mt-1 text-xs text-on-surface">{plan.checklist.length}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Satellite Section ─────────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,51,88,0.04)]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-black text-primary flex items-center gap-2">
                    <Satellite className="w-5 h-5" /> Phân tích vệ tinh GEE
                </h3>
                  <p className="text-[11px] text-on-surface-variant mt-1">Lịch sử quét ảnh theo mùa (mưa/khô) và so sánh với baseline phù hợp</p>
              </div>
              <button
                onClick={submitSatelliteAnalysis}
                disabled={working || satelliteLoading}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center gap-2"
                title="Có thể mất đến 1 phút"
              >
                <Satellite className="w-3.5 h-3.5" />
                  {working ? 'Đang phân tích...' : 'Quét GEE mới nhất'}
              </button>
            </div>

            {satelliteLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-64 rounded-xl shimmer"></div>)}
              </div>
            )}
            {!satelliteLoading && (!satelliteHistory || !satelliteHistory.length) && (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <Satellite className="w-12 h-12 text-on-surface-variant/15 mx-auto mb-3" />
                <p className="text-sm font-medium text-on-surface-variant">Chưa có dữ liệu phân tích vệ tinh</p>
                <p className="text-[11px] text-on-surface-variant/60 mt-1">Bấm "Quét vệ tinh mới nhất" để bắt đầu phân tích</p>
              </div>
            )}

            {!satelliteLoading && satelliteHistory && satelliteHistory.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {satelliteHistory.slice(0, 4).map((record) => {
                  const seasonLabel = record.season === 'wet'
                    ? 'Mùa mưa'
                    : record.season === 'dry'
                      ? 'Mùa khô'
                      : record.season === 'normal'
                        ? 'Bình thường'
                        : 'Chuyển mùa';
                  const compareLabel = record.compare_mode === 'seasonal'
                    ? 'So với baseline'
                    : record.compare_mode === 'previous'
                      ? 'So với lần trước'
                      : 'Chưa có baseline';
                  const changeValue = Number(record.change_percentage || 0);

                  return (
                    <div key={record.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all card-hover-lift flex flex-col">
                      <div
                        className="h-40 bg-slate-100 relative group overflow-hidden cursor-pointer"
                        onClick={() => {
                          setSelectedHistoryRecord(record);
                          if (record.boundary_id) {
                            setSelectedBoundaryId(record.boundary_id);
                          } else {
                            setSelectedBoundaryId(null);
                          }
                          if (record.raw_response?.scene_id) {
                            setSelectedSceneId(record.raw_response.scene_id);
                          } else {
                            setSelectedSceneId(null);
                          }
                        }}
                      >
                      {!record.raw_response?.scene_id ? (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative flex flex-col items-center justify-center text-center p-4 select-none">
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
                          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse pointer-events-none" style={{ animationDuration: '3s' }}></div>
                          <div className="relative mb-2">
                            <Satellite className="w-10 h-10 text-cyan-400 opacity-80 animate-pulse" />
                            <div className="absolute -inset-1 rounded-full bg-cyan-400/20 blur animate-ping" style={{ animationDuration: '4s' }}></div>
                          </div>
                          <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-black">GEE Sentinel-2</span>
                          <span className="text-[9px] text-white/50 mt-1">Trích xuất NDWI Tự động</span>
                          <div className="absolute bottom-2 left-2 bg-cyan-500/25 border border-cyan-400/30 text-cyan-300 px-2 py-0.5 rounded text-[9px] font-bold backdrop-blur-md">
                            Ảnh GEE / Sentinel-2
                          </div>
                        </div>
                      ) : (
                        <img
                          src={`http://localhost:4000/api/satellite/thumbnail/${record.raw_response.scene_id}`}
                          alt={`Satellite Scene ${record.raw_response.scene_id}`}
                          className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                          style={{ filter: 'contrast(1.5) saturate(1.4) brightness(1.1)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; }}
                        />
                      )}
                      <div className="absolute inset-0 items-center justify-center text-xs text-slate-400 hidden z-0">
                        Không có ảnh
                      </div>
                      <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-lg text-[10px] font-mono z-20 backdrop-blur-sm">
                        {new Date(record.capture_date).toLocaleDateString('vi-VN')}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                    <div className="px-3.5 pt-3.5 pb-3 flex-1 flex flex-col">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Mùa</span>
                        <span className="text-xs font-bold text-slate-700">{seasonLabel}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Diện tích</span>
                        <span className="text-xs font-black text-primary">{(record.water_surface_area / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Mây che phủ</span>
                        <span className="text-xs font-bold text-slate-700">
                          {record.raw_response?.cloud_cover !== undefined
                            ? `${(record.raw_response.cloud_cover * 100).toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">{compareLabel}</span>
                        <span className={`text-xs font-black ${changeValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {changeValue.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-auto border-t border-slate-50 pt-2.5">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Cảnh báo</span>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${record.alert_level === 'HIGH' ? 'bg-red-50 text-red-700' :
                            record.alert_level === 'MEDIUM' ? 'bg-amber-50 text-amber-700' :
                              'bg-emerald-50 text-emerald-700'
                          }`}>
                          {record.alert_level === 'HIGH' ? 'Cao' : record.alert_level === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                        </span>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══ Modals ══════════════════════════════════════════════════ */}

      {/* Survey Plan Modal */}
      {planModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-overlay-in">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl animate-modal-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-primary text-lg">Tạo kế hoạch khảo sát</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Thiết lập khu vực, mốc kiểm tra và checklist cho worker.</p>
              </div>
              <button onClick={() => setPlanModalOpen(false)} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Tên kế hoạch</label>
                  <input
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="VD: Điều tra mốc bờ Tây"
                    value={planForm.title}
                    onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Trạng thái</label>
                  <select
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    value={planForm.status}
                    onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as SurveyPlanForm['status'] })}
                  >
                    {(Object.keys(planStatusLabel) as SurveyPlanForm['status'][]).map((status) => (
                      <option key={status} value={status}>
                        {planStatusLabel[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Khu vực khảo sát</label>
                <input
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="VD: Bờ Bắc - tràn xả"
                  value={planForm.area}
                  onChange={(e) => setPlanForm({ ...planForm, area: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Bắt đầu</label>
                  <input
                    type="date"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    value={planForm.startDate}
                    onChange={(e) => setPlanForm({ ...planForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Kết thúc</label>
                  <input
                    type="date"
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    value={planForm.endDate}
                    onChange={(e) => setPlanForm({ ...planForm, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Phụ trách</label>
                  <select
                    className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    value={planForm.leadUserId}
                    onChange={(e) => setPlanForm({ ...planForm, leadUserId: e.target.value })}
                  >
                    <option value="">Chưa phân công</option>
                    {planLeads.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Checklist (mỗi dòng 1 mục)</label>
                <textarea
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none"
                  rows={4}
                  placeholder="Ví dụ:\n- Kiểm tra mốc A1\n- Chụp ảnh hiện trạng"
                  value={planForm.checklistText}
                  onChange={(e) => setPlanForm({ ...planForm, checklistText: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Chọn cột mốc khảo sát</label>
                <div className="border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-2">
                  {markers.length === 0 && (
                    <p className="text-xs text-on-surface-variant">Chưa có cột mốc cho hồ này.</p>
                  )}
                  {markers.map((marker) => (
                    <label key={marker.id} className="flex items-center gap-2 text-xs text-on-surface">
                      <input
                        type="checkbox"
                        checked={planForm.markerIds.includes(marker.id)}
                        onChange={() => togglePlanMarker(marker.id)}
                      />
                      <span className="font-semibold">{marker.code}</span>
                      <span className="text-on-surface-variant">{marker.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPlanModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface text-sm font-bold hover:bg-surface-container-high transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={submitSurveyPlan}
                  disabled={planSubmitting}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {planSubmitting ? 'Đang tạo...' : 'Tạo kế hoạch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reservoir Create/Edit Modal */}
      {reservoirModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-overlay-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl animate-modal-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-primary text-lg">{reservoirModalMode === 'create' ? 'Thêm hồ chứa mới' : 'Cập nhật hồ chứa'}</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {reservoirModalMode === 'create' ? 'Điền thông tin để tạo hồ chứa mới trong hệ thống' : 'Chỉnh sửa thông tin hồ chứa'}
                </p>
              </div>
              <button onClick={() => setReservoirModalOpen(false)} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Tên hồ chứa</label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  value={reservoirForm.name}
                  onChange={(e) => setReservoirForm({ ...reservoirForm, name: e.target.value })}
                >
                  {Array.from(new Set([...suggestedReservoirNames, ...reservoirs.map((r) => r.name)])).map((name) => (
                    <option value={name} key={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Mô tả</label>
                <textarea
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Nhập mô tả hồ chứa..."
                  value={reservoirForm.description}
                  onChange={(e) => setReservoirForm({ ...reservoirForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Trạng thái</label>
                <div className="flex gap-2">
                  {(['active', 'inactive', 'under_review'] as const).map((s) => {
                    const sc = reservoirStatusColor[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReservoirForm({ ...reservoirForm, status: s })}
                        className={`flex-1 text-xs font-bold px-4 py-2.5 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${reservoirForm.status === s
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 hover:border-slate-300 text-on-surface-variant'
                          }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${sc.dot}`}></span>
                        {reservoirStatusLabels[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">File GeoJSON (Polygon)</label>
                <label
                  className="file-drop-zone rounded-xl p-6 cursor-pointer flex flex-col items-center justify-center gap-2 text-center"
                >
                  <Upload className="w-8 h-8 text-on-surface-variant/30" />
                  <span className="text-xs font-medium text-on-surface-variant">
                    {reservoirForm.geojsonFileName ? reservoirForm.geojsonFileName : 'Kéo thả hoặc nhấp để chọn file'}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/60">
                    {reservoirModalMode === 'edit' && !reservoirForm.geojsonFileName ? 'Không chọn file = giữ polygon hiện tại' : 'Chấp nhận .geojson, .json'}
                  </span>
                  <input
                    type="file"
                    accept=".geojson,.json,application/geo+json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setReservoirForm({
                        ...reservoirForm,
                        geojsonFile: file,
                        geojsonFileName: file?.name || ''
                      });
                    }}
                  />
                </label>
              </div>
              <button
                onClick={submitReservoir}
                disabled={working}
                className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
              >
                {working ? 'Đang xử lý...' : reservoirModalMode === 'create' ? 'Tạo hồ chứa' : 'Cập nhật hồ chứa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && currentReservoir && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-overlay-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-modal-in">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-black text-primary text-center text-lg">Xác nhận xoá hồ</h3>
            <p className="text-sm text-on-surface-variant text-center">
              Bạn có chắc muốn xoá hồ <strong className="text-on-surface">{currentReservoir.name}</strong>?<br />
              <span className="text-[11px] text-red-500 font-medium">Dữ liệu task, markers và báo cáo liên quan sẽ bị xoá vĩnh viễn.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container text-on-surface text-sm font-bold hover:bg-surface-container-high transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={submitDeleteReservoir}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors"
              >
                Xác nhận xoá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marker Create/Edit Modal */}
      {markerModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-overlay-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-modal-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-primary text-lg">{markerModalMode === 'create' ? 'Thêm cột mốc' : 'Sửa cột mốc'}</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  💡 Mẹo: Click lên bản đồ để lấy tọa độ tự động
                </p>
              </div>
              <button onClick={() => setMarkerModalOpen(false)} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Mã cột mốc</label>
                <input
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all disabled:bg-slate-50 disabled:text-on-surface-variant"
                  placeholder="VD: MK-001"
                  value={markerForm.code}
                  disabled={markerModalMode === 'edit'}
                  onChange={(e) => setMarkerForm({ ...markerForm, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Tên cột mốc</label>
                <input
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                  placeholder="VD: Mốc bờ Tây"
                  value={markerForm.name}
                  onChange={(e) => setMarkerForm({ ...markerForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Kinh độ (Lng)</label>
                  <input
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="105.80"
                    value={markerForm.lng}
                    onChange={(e) => setMarkerForm({ ...markerForm, lng: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-on-surface">Vĩ độ (Lat)</label>
                  <input
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm font-mono focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                    placeholder="21.00"
                    value={markerForm.lat}
                    onChange={(e) => setMarkerForm({ ...markerForm, lat: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 text-on-surface">Trạng thái</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['normal', 'damaged', 'missing', 'needs_inspection'] as const).map((s) => {
                    const mc = markerStatusColor[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMarkerForm({ ...markerForm, status: s })}
                        className={`text-[11px] font-bold px-3 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${markerForm.status === s
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-slate-200 hover:border-slate-300 text-on-surface-variant'
                          }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${mc.dot}`}></span>
                        {markerStatusVi[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={markerModalMode === 'create' ? submitCreateMarker : submitUpdateMarker}
                disabled={working}
                className="w-full bg-primary text-white py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
              >
                {working ? 'Đang xử lý...' : markerModalMode === 'create' ? 'Tạo cột mốc' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Satellite Fullscreen Viewer */}
      {selectedHistoryRecord && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-[1000] flex items-center justify-center cursor-auto animate-overlay-in"
        >
          <div className="w-full h-full p-12 relative flex items-center justify-center">
            <div className="w-full h-full max-w-6xl relative rounded-xl overflow-hidden shadow-2xl border border-white/20">
              <MapContainer
                center={currentCenter}
                zoom={14}
                style={{ height: '100%', width: '100%', background: '#000' }}
                zoomControl={true}
              >
                {/* Standard background map */}
                <TileLayer
                  url={ESRI_TILE_URL}
                  attribution={ESRI_ATTRIBUTION}
                />
                
                {/* High-res satellite thumbnail overlay */}
                {selectedSceneId && currentBounds && (
                  <ImageOverlay
                    url={`http://localhost:4000/api/satellite/thumbnail/${selectedSceneId}?width=1536`}
                    bounds={currentBounds}
                    opacity={scanOpacity}
                    zIndex={5}
                  />
                )}

                {/* If it's a GEE/Sentinel-2 scan (no scene_id but has highlighted boundary), we render the extracted water polygon */}
                {highlightedBoundary && (
                  <Polygon
                    positions={polygonToLatLng(highlightedBoundary.boundary_geojson)}
                    pathOptions={{
                      color: '#06b6d4',
                      fillColor: '#22d3ee',
                      fillOpacity: scanOpacity * 0.4,
                      weight: 3,
                      opacity: scanOpacity
                    }}
                  />
                )}

                {/* Also render the seasonal baseline boundary for comparison in GEE mode */}
                {selectedHistoryRecord.season === 'wet' && latestWetBoundary && (
                  <Polygon
                    positions={polygonToLatLng(latestWetBoundary.boundary_geojson)}
                    pathOptions={{
                      color: '#2563eb',
                      fillColor: '#1d4ed8',
                      fillOpacity: baselineOpacity * 0.45,
                      weight: 2.5,
                      opacity: baselineOpacity,
                      dashArray: comparisonMode === 'blend' ? '5 5' : undefined
                    }}
                  />
                )}
                {selectedHistoryRecord.season === 'dry' && latestDryBoundary && (
                  <Polygon
                    positions={polygonToLatLng(latestDryBoundary.boundary_geojson)}
                    pathOptions={{
                      color: '#f59e0b',
                      fillColor: '#d97706',
                      fillOpacity: baselineOpacity * 0.45,
                      weight: 2.5,
                      opacity: baselineOpacity,
                      dashArray: comparisonMode === 'blend' ? '5 5' : undefined
                    }}
                  />
                )}

                {/* Glowing Corridor Buffer Zone (Hành lang phân đệm bảo vệ) */}
                {showCorridor && currentBoundary.length > 0 && (
                  <>
                    {/* Outer soft glow (100m boundary outer belt) */}
                    <Polygon
                      positions={currentBoundary}
                      pathOptions={{
                        color: '#a855f7',
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: 80,
                        opacity: 0.15,
                        lineJoin: 'round',
                        lineCap: 'round'
                      }}
                    />
                    {/* Middle glow (50m boundary belt) */}
                    <Polygon
                      positions={currentBoundary}
                      pathOptions={{
                        color: '#d946ef',
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: 40,
                        opacity: 0.25,
                        lineJoin: 'round',
                        lineCap: 'round'
                      }}
                    />
                    {/* Inner neon border */}
                    <Polygon
                      positions={currentBoundary}
                      pathOptions={{
                        color: '#f472b6',
                        fillColor: '#a855f7',
                        fillOpacity: 0.04,
                        weight: 16,
                        opacity: 0.45,
                        lineJoin: 'round',
                        lineCap: 'round'
                      }}
                    />
                    {/* Core white edge line */}
                    <Polygon
                      positions={currentBoundary}
                      pathOptions={{
                        color: '#ffffff',
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        weight: 3,
                        opacity: 0.8,
                        lineJoin: 'round',
                        lineCap: 'round'
                      }}
                    />
                  </>
                )}

                {/* Reservoir boundary on top */}
                {currentBoundary.length > 0 && (
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{ color: '#0ea5e9', weight: 2, fillOpacity: 0, dashArray: '2 4', opacity: 0.8 }}
                  />
                )}
              </MapContainer>

              {/* Floating Comparison Control Panel */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-white z-[1010] flex flex-col items-center gap-3 shadow-2xl min-w-[340px] animate-fade-in">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-black uppercase">
                    So sánh ảnh vệ tinh & baseline
                  </span>
                </div>
                
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full">
                  <button
                    onClick={() => setComparisonMode('baseline')}
                    className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
                      comparisonMode === 'baseline'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Mẫu Baseline
                  </button>
                  <button
                    onClick={() => setComparisonMode('blend')}
                    className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
                      comparisonMode === 'blend'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Chập ảnh
                  </button>
                  <button
                    onClick={() => setComparisonMode('current')}
                    className={`flex-1 text-[11px] font-bold py-2 rounded-lg transition-all ${
                      comparisonMode === 'current'
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Ảnh quét mới
                  </button>
                </div>

                {comparisonMode === 'blend' && (
                  <div className="w-full space-y-2 mt-1 px-1">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-white/50">
                      <span>Baseline ({(100 - comparisonBlend * 100).toFixed(0)}%)</span>
                      <span>Quét mới ({(comparisonBlend * 100).toFixed(0)}%)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={comparisonBlend}
                      onChange={(e) => setComparisonBlend(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}

                {/* Corridor Switch */}
                <div className="w-full border-t border-white/10 pt-3 mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-200">Hành lang bảo vệ (100m)</span>
                  </div>
                  <button
                    onClick={() => setShowCorridor(prev => !prev)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      showCorridor ? 'bg-purple-500' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        showCorridor ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Information Panel */}
            <div className="absolute bottom-16 left-16 bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-white/10 text-white z-[1010] max-w-sm space-y-4 shadow-2xl">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-black">
                  {selectedSceneId ? 'Planet API Satellite Scan' : 'GEE Sentinel-2 Analysis'}
                </span>
                <h4 className="text-lg font-black text-white mt-1">
                  {currentReservoir?.name || 'Hồ chứa'}
                </h4>
                <p className="text-xs text-white/60 mt-0.5">
                  Ngày quét: {new Date(selectedHistoryRecord.capture_date).toLocaleDateString('vi-VN')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 font-sans">
                <div>
                  <span className="text-[9px] font-semibold text-white/50 uppercase">Diện tích trích xuất</span>
                  <p className="text-base font-black text-cyan-400 mt-0.5">
                    {(selectedHistoryRecord.water_surface_area / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-white/50 uppercase">Chênh lệch</span>
                  <p className={`text-base font-black mt-0.5 ${Number(selectedHistoryRecord.change_percentage) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {Number(selectedHistoryRecord.change_percentage) >= 0 ? '+' : ''}{Number(selectedHistoryRecord.change_percentage).toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-white/50 uppercase">Phân loại mùa</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {selectedHistoryRecord.season === 'wet' ? '🟢 Mùa mưa' : selectedHistoryRecord.season === 'dry' ? '🟡 Mùa khô' : '🔵 Bình thường'}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold text-white/50 uppercase">Mức độ cảnh báo</span>
                  <p className={`text-xs font-black uppercase mt-0.5 ${selectedHistoryRecord.alert_level === 'HIGH' ? 'text-red-400' : selectedHistoryRecord.alert_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedHistoryRecord.alert_level === 'HIGH' ? 'Cao' : selectedHistoryRecord.alert_level === 'MEDIUM' ? 'Trung bình' : 'Thấp'}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating Satellite Scan Legend */}
            <div className="absolute bottom-16 right-16 bg-slate-900/90 backdrop-blur-md p-5 rounded-2xl border border-white/10 text-white z-[1010] w-56 shadow-2xl space-y-3 animate-fade-in font-sans">
              <div className="font-black text-[10px] text-cyan-400 border-b border-white/10 pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-3 bg-cyan-400 rounded-full"></span>
                Chú thích ranh giới
              </div>
              <div className="flex flex-col gap-2.5 text-[10px]">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-[#0ea5e9]"></span>
                  <span className="text-white/80 font-semibold">Ranh giới hồ pháp lý</span>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <div className="w-4 h-2.5 bg-[#22d3ee]/25 border border-[#06b6d4] rounded-sm"></div>
                  <span className="text-white/80 font-semibold">Vùng nước NDWI (Quét mới)</span>
                </div>
                
                {selectedHistoryRecord?.season === 'wet' && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className="w-4 h-2.5 bg-[#1d4ed8]/45 border border-[#2563eb] rounded-sm"></div>
                    <span className="text-white/80 font-semibold">Baseline mùa mưa</span>
                  </div>
                )}
                {selectedHistoryRecord?.season === 'dry' && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className="w-4 h-2.5 bg-[#d97706]/45 border border-[#f59e0b] rounded-sm"></div>
                    <span className="text-white/80 font-semibold">Baseline mùa khô</span>
                  </div>
                )}
                
                {showCorridor && (
                  <div className="flex items-center gap-2.5 animate-fade-in">
                    <div className="w-4 h-2.5 bg-purple-500/20 border border-purple-500/40 rounded-sm shadow-[0_0_6px_rgba(168,85,247,0.3)]"></div>
                    <span className="text-white/80 font-semibold">Hành lang bảo vệ (100m)</span>
                  </div>
                )}
              </div>
            </div>

            <button
              className="absolute top-6 right-6 text-white hover:text-white/80 bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors z-[1010] flex items-center gap-2"
              onClick={() => {
                setSelectedHistoryRecord(null);
                setSelectedSceneId(null);
                setSelectedBoundaryId(null);
                setComparisonMode('blend');
                setComparisonBlend(0.5);
              }}
            >
              <X className="w-4 h-4" /> Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
