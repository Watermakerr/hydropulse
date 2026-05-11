import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker as LeafletMarker, Polygon, Popup, TileLayer, useMap, useMapEvents, ImageOverlay } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  FileText, MapPin, Plus, ShieldCheck, Trash2, Pencil, Search, Waves, Flag, AlertTriangle,
  ChevronRight, Eye, MapPinOff, CircleDot, X, Upload, Clock, CheckCircle2, XCircle,
  Satellite, BarChart3, Navigation, Crosshair
} from 'lucide-react';
import L from 'leaflet';
import { useSearchParams } from 'react-router-dom';
import { api, Marker, ReportPhoto, Reservoir, Task, TaskReport, SatelliteHistory } from '../services/api';

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
  const [taskLoading, setTaskLoading] = useState(false);
  const [satelliteHistory, setSatelliteHistory] = useState<SatelliteHistory[]>([]);
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

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
  const sentinelEnabled = Boolean(SENTINEL2_TILE_URL);
  const tileUrl = baseLayer === 'sentinel2' && sentinelEnabled ? SENTINEL2_TILE_URL : ESRI_TILE_URL;
  const tileAttribution = baseLayer === 'sentinel2' && sentinelEnabled ? SENTINEL2_ATTRIBUTION : ESRI_ATTRIBUTION;

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
    const picked = preferredId || quickId || activeReservoir || rows[0]?.id || '';
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
      return;
    }

    setTaskLoading(true);
    try {
      const reports = await api.getTaskReports(taskId);
      setTaskReports(reports);

      if (!reports.length) {
        setTaskPhotos([]);
        return;
      }

      const photosByReport = await Promise.all(reports.map((report) => api.getReportPhotos(report.id)));
      setTaskPhotos(photosByReport.flat());
    } catch (e) {
      setTaskReports([]);
      setTaskPhotos([]);
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

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        await loadMarkers(activeReservoir);
        await loadReservoirTasks(activeReservoir);
        await loadSatelliteHistory(activeReservoir);
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
      await api.triggerSatelliteAnalysis(activeReservoir);
      await loadSatelliteHistory(activeReservoir);
    });
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
              {currentBoundary.length > 0 && <Polygon positions={currentBoundary} pathOptions={{ color: '#003358', fillColor: '#004a7c', fillOpacity: 0.2 }} />}
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

            {/* Map Info Overlay */}
            {currentReservoir && (
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-lg max-w-xs">
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
                            return (
                              <div key={report.id} className="border border-slate-100 rounded-xl p-3.5 bg-white hover:shadow-sm transition-shadow">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cColor.bg} ${cColor.text}`}>
                                    {conditionStatusVi[report.condition_status] || report.condition_status}
                                  </span>
                                  <span className="text-[10px] text-on-surface-variant">
                                    {new Date(report.reported_at).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant mt-1">{report.description || 'Không có mô tả'}</p>
                              </div>
                            );
                          })}
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

          {/* ── Satellite Section ─────────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-[0_4px_16px_rgba(0,51,88,0.04)]">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-base font-black text-primary flex items-center gap-2">
                  <Satellite className="w-5 h-5" /> Phân tích vệ tinh PlanetScope
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-1">Lịch sử đánh giá diện tích mặt nước qua ảnh vệ tinh phân giải cao (3m)</p>
              </div>
              <button
                onClick={submitSatelliteAnalysis}
                disabled={working || satelliteLoading}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold disabled:opacity-50 hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center gap-2"
                title="Có thể mất đến 1 phút"
              >
                <Satellite className="w-3.5 h-3.5" />
                {working ? 'Đang phân tích...' : 'Quét vệ tinh mới nhất'}
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
                {satelliteHistory.slice(0, 4).map((record) => (
                  <div key={record.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all card-hover-lift flex flex-col">
                    <div className="h-40 bg-slate-100 relative group overflow-hidden cursor-zoom-in" onClick={() => setSelectedSceneId(record.raw_response.scene_id)}>
                      {record.raw_response?.scene_id ? (
                        <img
                          src={`http://localhost:4000/api/satellite/thumbnail/${record.raw_response.scene_id}`}
                          alt={`Satellite Scene ${record.raw_response.scene_id}`}
                          className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-110"
                          style={{ filter: 'contrast(1.5) saturate(1.4) brightness(1.1)' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; }}
                        />
                      ) : null}
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
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Diện tích</span>
                        <span className="text-xs font-black text-primary">{(record.water_surface_area / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Mây che phủ</span>
                        <span className="text-xs font-bold text-slate-700">{(record.raw_response?.cloud_cover * 100).toFixed(1)}%</span>
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
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══ Modals ══════════════════════════════════════════════════ */}

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
      {selectedSceneId && (
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
                    opacity={1}
                    zIndex={5}
                  />
                )}

                {/* Reservoir boundary on top */}
                {currentBoundary.length > 0 && (
                  <Polygon
                    positions={currentBoundary}
                    pathOptions={{ color: '#0ea5e9', weight: 3, fillOpacity: 0 }}
                  />
                )}
              </MapContainer>
            </div>

            <button
              className="absolute top-6 right-6 text-white hover:text-white/80 bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors z-[1010] flex items-center gap-2"
              onClick={() => setSelectedSceneId(null)}
            >
              <X className="w-4 h-4" /> Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
