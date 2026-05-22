type UserRole = 'admin' | 'worker';
type ReservoirBackendStatus = 'active' | 'inactive' | 'under_review';
type ReservoirUiStatus = 'stable' | 'warning' | 'maintenance';
type MarkerStatus = 'normal' | 'damaged' | 'missing' | 'needs_inspection';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type ConditionStatus = 'good' | 'minor_damage' | 'major_damage' | 'destroyed';
type ShorelineSeason = 'dry' | 'wet' | 'normal' | 'transition' | 'unknown';
type ShorelineBoundaryType = 'baseline' | 'scan' | 'survey';
type ShorelineSource = 'gee' | 'planet' | 'manual' | 'survey' | 'import';
type SurveyPlanStatus = 'draft' | 'assigned' | 'in_progress' | 'completed' | 'archived';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
  };
}

interface UserRaw {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

interface ReservoirRaw {
  id: string;
  name: string;
  description: string | null;
  area_ha: number | null;
  status: ReservoirBackendStatus;
  created_by: string;
  created_at: string;
  boundary_geojson: {
    type: 'Polygon';
    coordinates: number[][][];
  } | null;
}

interface MarkerRaw {
  id: string;
  reservoir_id: string;
  code: string;
  name: string | null;
  order_index: number;
  status: MarkerStatus;
  created_at: string;
  location_geojson: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface TaskRaw {
  id: string;
  reservoir_id: string;
  reservoir_name?: string;
  marker_id?: string | null;
  marker_code?: string | null;
  plan_id?: string | null;
  plan_title?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  title: string;
  description: string | null;
  template?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at?: string;
}

interface TaskReportRaw {
  id: string;
  task_id: string;
  worker_id: string;
  description: string | null;
  condition_status: ConditionStatus;
  weather?: string | null;
  water_level?: number | null;
  damage_type?: string | null;
  template?: string | null;
  form_data?: Record<string, unknown> | null;
  sync_status: 'pending' | 'synced' | 'failed';
  reported_at: string;
  location_geojson: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
}

export interface LocationLogRaw {
  id: string;
  task_id: string;
  worker_id: string;
  recorded_at: string;
  location_geojson: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface ReportPhotoRaw {
  id: string;
  report_id: string;
  url: string;
  caption: string | null;
  storage_provider: string;
  blob_path: string;
  upload_status: 'pending' | 'uploaded' | 'failed';
  upload_error: string | null;
  metadata: {
    originalName?: string;
    mimeType?: string;
    size?: number;
  } | null;
  taken_at: string;
}

interface ShorelineBoundaryRaw {
  id: string;
  reservoir_id: string;
  boundary_type: ShorelineBoundaryType;
  season: ShorelineSeason;
  source: ShorelineSource;
  capture_date: string | null;
  area_m2: number | null;
  is_current: boolean;
  metadata?: Record<string, unknown> | null;
  boundary_geojson: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  created_at: string;
}

interface SurveyPlanRaw {
  id: string;
  reservoir_id: string;
  reservoir_name?: string;
  title: string;
  area: string | null;
  marker_ids: string[] | null;
  start_date: string | null;
  end_date: string | null;
  lead_user_id: string | null;
  lead_name?: string | null;
  checklist: string[] | null;
  status: SurveyPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
  // Aliases for current UI components.
  name: string;
  status: 'active' | 'inactive';
  last_login: string;
}

export interface Reservoir {
  id: string;
  name: string;
  description: string;
  status: ReservoirUiStatus;
  backend_status: ReservoirBackendStatus;
  area_ha?: number;
  region: string;
  water_level: number;
  last_updated: string;
  center: [number, number];
  boundary: [number, number][];
}

export interface Marker {
  id: string;
  reservoir_id: string;
  code: string;
  name: string;
  order_index: number;
  status: MarkerStatus;
  location_geojson: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface Task {
  id: string;
  reservoir_id: string;
  reservoir_name?: string;
  marker_id?: string;
  marker_code?: string;
  plan_id?: string;
  plan_title?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  title: string;
  description: string;
  template?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  created_at?: string;
}

export interface DashboardSummary {
  active_reservoirs: number;
  total_markers: number;
  tasks_pending: number;
  tasks_in_progress: number;
  tasks_completed: number;
  active_workers: number;
  generated_at: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  source: string;
}

export interface SatelliteHistory {
  id: string;
  capture_date: string;
  water_surface_area: number;
  change_percentage: number;
  alert_level: string;
  season?: ShorelineSeason;
  baseline_area_m2?: number | null;
  delta_previous_percent?: number | null;
  compare_mode?: string | null;
  boundary_id?: string | null;
  raw_response: {
    scene_id?: string;
    cloud_cover?: number;
    clear_percent?: number;
    acquired?: string;
    pixel_resolution?: number;
    scenes_found?: number;
    image_id?: string;
  };
  created_at: string;
}

export interface ShorelineBoundary {
  id: string;
  reservoir_id: string;
  boundary_type: ShorelineBoundaryType;
  season: ShorelineSeason;
  source: ShorelineSource;
  capture_date: string | null;
  area_m2: number | null;
  is_current: boolean;
  metadata?: Record<string, unknown> | null;
  boundary_geojson: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  created_at: string;
}

export interface FloodExpansion {
  boundary_geojson: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  area_m2: number;
}

export interface SurveyPlan {
  id: string;
  reservoir_id: string;
  reservoir_name?: string;
  title: string;
  area: string | null;
  marker_ids: string[];
  start_date: string | null;
  end_date: string | null;
  lead_user_id: string | null;
  lead_name?: string | null;
  checklist: string[];
  status: SurveyPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface ReservoirOverview {
  id: string;
  name: string;
  area_ha: number | null;
  status: ReservoirBackendStatus;
  markers_total: number;
  markers_warning: number;
  tasks_total: number;
  tasks_pending: number;
  tasks_in_progress: number;
  tasks_completed: number;
  plans_total: number;
  latest_scan: SatelliteHistory | null;
  current_boundary: ShorelineBoundary | null;
}

export interface TaskReport {
  id: string;
  task_id: string;
  worker_id: string;
  description: string | null;
  condition_status: ConditionStatus;
  weather?: string | null;
  water_level?: number | null;
  damage_type?: string | null;
  template?: string | null;
  form_data?: Record<string, unknown> | null;
  sync_status: 'pending' | 'synced' | 'failed';
  reported_at: string;
  location_geojson: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
}

export interface ReportPhoto {
  id: string;
  report_id: string;
  url: string;
  caption: string | null;
  storage_provider: string;
  blob_path: string;
  upload_status: 'pending' | 'uploaded' | 'failed';
  upload_error: string | null;
  metadata: {
    originalName: string;
    mimeType: string;
    size: number;
  };
  taken_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL || 'admin@hydropulse.vn';
const DEV_PASSWORD = import.meta.env.VITE_DEV_PASSWORD || 'Admin@123456';
const AUTO_LOGIN = import.meta.env.VITE_AUTO_LOGIN === 'true';
const TOKEN_KEY = 'hydropulse.accessToken';

let loginPromise: Promise<string> | null = null;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function mapBackendReservoirStatus(status: ReservoirBackendStatus): ReservoirUiStatus {
  if (status === 'under_review') {
    return 'warning';
  }
  if (status === 'inactive') {
    return 'maintenance';
  }
  return 'stable';
}

function polygonToLatLng(boundaryGeoJson: ReservoirRaw['boundary_geojson']): [number, number][] {
  if (!boundaryGeoJson || boundaryGeoJson.type !== 'Polygon' || !boundaryGeoJson.coordinates.length) {
    return [];
  }

  return boundaryGeoJson.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

function getPolygonCenter(points: [number, number][]): [number, number] {
  if (!points.length) {
    return [20.825, 105.284];
  }

  const sum = points.reduce(
    (acc, point) => {
      acc[0] += point[0];
      acc[1] += point[1];
      return acc;
    },
    [0, 0]
  );

  return [sum[0] / points.length, sum[1] / points.length];
}

function mapReservoir(row: ReservoirRaw): Reservoir {
  const boundary = polygonToLatLng(row.boundary_geojson);
  const center = getPolygonCenter(boundary);

  return {
    id: row.id,
    name: row.name,
    description: row.description || 'Chua co mo ta',
    status: mapBackendReservoirStatus(row.status),
    backend_status: row.status,
    area_ha: row.area_ha ?? undefined,
    region: 'Mien Bac',
    water_level: Number((Math.random() * 300 + 50).toFixed(1)),
    last_updated: row.created_at,
    center,
    boundary
  };
}

function mapMarker(row: MarkerRaw): Marker {
  return {
    id: row.id,
    reservoir_id: row.reservoir_id,
    code: row.code,
    name: row.name || row.code,
    order_index: row.order_index,
    status: row.status,
    location_geojson: row.location_geojson
  };
}

function mapTask(row: TaskRaw): Task {
  return {
    id: row.id,
    reservoir_id: row.reservoir_id,
    reservoir_name: row.reservoir_name || 'N/A',
    marker_id: row.marker_id || undefined,
    marker_code: row.marker_code || undefined,
    plan_id: row.plan_id || undefined,
    plan_title: row.plan_title || undefined,
    assigned_to: row.assigned_to || undefined,
    assigned_to_name: row.assigned_to_name || 'Chua phan cong',
    title: row.title,
    description: row.description || '',
    template: row.template || undefined,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date || new Date().toISOString(),
    created_at: row.created_at
  };
}

function mapTaskReport(row: TaskReportRaw): TaskReport {
  return {
    id: row.id,
    task_id: row.task_id,
    worker_id: row.worker_id,
    description: row.description,
    condition_status: row.condition_status,
    weather: row.weather ?? null,
    water_level: row.water_level ?? null,
    damage_type: row.damage_type ?? null,
    template: row.template ?? null,
    form_data: row.form_data ?? null,
    sync_status: row.sync_status,
    reported_at: row.reported_at,
    location_geojson: row.location_geojson
  };
}

function mapReportPhoto(row: ReportPhotoRaw): ReportPhoto {
  return {
    id: row.id,
    report_id: row.report_id,
    url: row.url,
    caption: row.caption,
    storage_provider: row.storage_provider,
    blob_path: row.blob_path,
    upload_status: row.upload_status,
    upload_error: row.upload_error,
    metadata: {
      originalName: row.metadata?.originalName || '',
      mimeType: row.metadata?.mimeType || '',
      size: row.metadata?.size || 0
    },
    taken_at: row.taken_at
  };
}

function mapSurveyPlan(row: SurveyPlanRaw): SurveyPlan {
  return {
    id: row.id,
    reservoir_id: row.reservoir_id,
    reservoir_name: row.reservoir_name,
    title: row.title,
    area: row.area,
    marker_ids: row.marker_ids || [],
    start_date: row.start_date,
    end_date: row.end_date,
    lead_user_id: row.lead_user_id,
    lead_name: row.lead_name || null,
    checklist: row.checklist || [],
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function loginForDevIfNeeded() {
  const existing = getToken();
  if (existing) {
    return existing;
  }

  if (!loginPromise) {
    loginPromise = api
      .login(DEV_EMAIL, DEV_PASSWORD, 'web')
      .then((res) => {
        setToken(res.accessToken);
        return res.accessToken;
      })
      .finally(() => {
        loginPromise = null;
      });
  }

  return loginPromise;
}

async function request<T>(path: string, init: RequestInit = {}, useAuth = true): Promise<T> {
  const headers = new Headers(init.headers || {});

  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (useAuth) {
    let token = getToken();
    if (!token && AUTO_LOGIN) {
      token = await loginForDevIfNeeded();
    }

    if (!token) {
      throw new Error('UNAUTHENTICATED');
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && useAuth) {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (!response.ok || data.success === false) {
    const validationDetails = Array.isArray(data?.errors)
      ? data.errors
          .map((e: { path?: string; msg?: string }) => `${e.path || 'field'}: ${e.msg || 'invalid'}`)
          .join(' | ')
      : '';
    const msg = validationDetails || data?.message || `Request failed: ${response.status}`;
    throw new Error(msg);
  }

  return data.data as T;
}

const fallbackLogs: SystemLog[] = [
  { id: 'log-1', timestamp: new Date().toISOString(), level: 'info', message: 'System backup completed successfully.', source: 'Backup Service' },
  { id: 'log-2', timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'warning', message: 'High CPU usage detected on Node 3.', source: 'Monitoring Agent' },
  { id: 'log-3', timestamp: new Date(Date.now() - 7200000).toISOString(), level: 'error', message: 'Failed to connect to database replica.', source: 'Database Service' }
];

export const api = {
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
  },

  setAuthToken: (token: string) => {
    setToken(token);
  },

  isAuthenticated: () => {
    return Boolean(getToken());
  },

  login: async (email: string, password: string, platform: 'web' | 'mobile' = 'web') => {
    return request<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, platform })
      },
      false
    );
  },

  getUsers: async (): Promise<User[]> => {
    const rows = await request<UserRaw[]>('/api/users');
    return rows.map((row) => ({
      ...row,
      name: row.full_name,
      status: row.is_active ? 'active' : 'inactive',
      last_login: row.last_login_at || row.created_at,
      last_login_at: row.last_login_at || row.created_at
    }));
  },

  createUser: async (payload: {
    fullName: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<User> => {
    const row = await request<UserRaw>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      ...row,
      name: row.full_name,
      status: row.is_active ? 'active' : 'inactive',
      last_login: row.last_login_at || row.created_at,
      last_login_at: row.last_login_at || row.created_at
    };
  },

  updateUser: async (
    id: string,
    payload: {
      fullName?: string;
      role?: UserRole;
      isActive?: boolean;
    }
  ): Promise<User> => {
    const row = await request<UserRaw>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });

    return {
      ...row,
      name: row.full_name,
      status: row.is_active ? 'active' : 'inactive',
      last_login: row.last_login_at || row.created_at,
      last_login_at: row.last_login_at || row.created_at
    };
  },

  resetUserPassword: async (id: string, newPassword: string): Promise<void> => {
    await request(`/api/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    });
  },

  deleteUser: async (id: string): Promise<void> => {
    await request(`/api/users/${id}`, {
      method: 'DELETE'
    });
  },

  getReservoirs: async (): Promise<Reservoir[]> => {
    const rows = await request<ReservoirRaw[]>('/api/reservoirs');
    return rows.map(mapReservoir);
  },

  createReservoir: async (payload: {
    name: string;
    description?: string;
    status?: ReservoirBackendStatus;
    boundaryGeoJSON?: { type: 'Polygon'; coordinates: number[][][] };
    geojsonFile?: File;
  }): Promise<Reservoir> => {
    let row;
    if (payload.geojsonFile) {
      const form = new FormData();
      form.append('name', payload.name);
      form.append('description', payload.description || '');
      form.append('status', payload.status || 'active');
      form.append('geojsonFile', payload.geojsonFile);
      row = await request<ReservoirRaw>(
        '/api/reservoirs',
        {
          method: 'POST',
          body: form
        },
        true
      );
    } else {
      row = await request<ReservoirRaw>('/api/reservoirs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    return mapReservoir(row);
  },

  updateReservoir: async (
    id: string,
    payload: {
      name?: string;
      description?: string;
      status?: ReservoirBackendStatus;
      boundaryGeoJSON?: { type: 'Polygon'; coordinates: number[][][] };
      geojsonFile?: File;
    }
  ): Promise<Reservoir> => {
    let row;
    if (payload.geojsonFile) {
      const form = new FormData();
      if (payload.name !== undefined) {
        form.append('name', payload.name);
      }
      if (payload.description !== undefined) {
        form.append('description', payload.description);
      }
      if (payload.status !== undefined) {
        form.append('status', payload.status);
      }
      form.append('geojsonFile', payload.geojsonFile);
      row = await request<ReservoirRaw>(
        `/api/reservoirs/${id}`,
        {
          method: 'PATCH',
          body: form
        },
        true
      );
    } else {
      row = await request<ReservoirRaw>(`/api/reservoirs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }
    return mapReservoir(row);
  },

  deleteReservoir: async (id: string): Promise<void> => {
    await request(`/api/reservoirs/${id}`, {
      method: 'DELETE'
    });
  },

  getMarkers: async (reservoirId?: string): Promise<Marker[]> => {
    if (!reservoirId) {
      return [];
    }

    const rows = await request<MarkerRaw[]>(`/api/reservoirs/${reservoirId}/markers`);
    return rows.map(mapMarker);
  },

  createMarker: async (
    reservoirId: string,
    payload: {
      code: string;
      name?: string;
      orderIndex?: number;
      status?: MarkerStatus;
      locationGeoJSON: { type: 'Point'; coordinates: [number, number] };
    }
  ): Promise<Marker> => {
    const row = await request<MarkerRaw>(`/api/reservoirs/${reservoirId}/markers`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapMarker(row);
  },

  updateMarker: async (
    markerId: string,
    payload: {
      name?: string;
      orderIndex?: number;
      status?: MarkerStatus;
      locationGeoJSON?: { type: 'Point'; coordinates: [number, number] };
    }
  ): Promise<Marker> => {
    const row = await request<MarkerRaw>(`/api/reservoirs/markers/${markerId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return mapMarker(row);
  },

  deleteMarker: async (markerId: string): Promise<void> => {
    await request(`/api/reservoirs/markers/${markerId}`, {
      method: 'DELETE'
    });
  },

  getTasks: async (reservoirId?: string): Promise<Task[]> => {
    const query = reservoirId ? `?reservoirId=${encodeURIComponent(reservoirId)}` : '';
    const rows = await request<TaskRaw[]>(`/api/tasks${query}`);
    return rows.map(mapTask);
  },

  createTask: async (payload: {
    reservoirId: string;
    markerId?: string;
    planId?: string;
    assignedTo?: string;
    title: string;
    description?: string;
    template?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
  }): Promise<Task> => {
    const row = await request<TaskRaw>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapTask(row);
  },

  updateTask: async (
    id: string,
    payload: {
      title?: string;
      description?: string;
      template?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assignedTo?: string;
      markerId?: string;
      dueDate?: string;
    }
  ): Promise<Task> => {
    const row = await request<TaskRaw>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return mapTask(row);
  },

  updateTaskStatus: async (id: string, status: TaskStatus): Promise<Task> => {
    const row = await request<TaskRaw>(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return mapTask(row);
  },

  getDashboardSummary: async (): Promise<DashboardSummary> => {
    return request<DashboardSummary>('/api/dashboard/summary');
  },

  getSystemLogs: async (): Promise<SystemLog[]> => {
    return fallbackLogs;
  },

  createReport: async (payload: {
    taskId: string;
    description?: string;
    conditionStatus?: ConditionStatus;
    locationGeoJSON?: { type: 'Point'; coordinates: [number, number] };
  }): Promise<TaskReport> => {
    const row = await request<TaskReportRaw>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapTaskReport(row);
  },

  getTaskReports: async (taskId: string): Promise<TaskReport[]> => {
    const rows = await request<TaskReportRaw[]>(`/api/reports/task/${taskId}`);
    return rows.map(mapTaskReport);
  },

  getTaskLocationLogs: async (taskId: string): Promise<LocationLogRaw[]> => {
    return request<LocationLogRaw[]>(`/api/tasks/${taskId}/location-logs`);
  },

  uploadReportPhoto: async (reportId: string, file: File, caption?: string): Promise<ReportPhoto> => {
    const form = new FormData();
    form.append('photo', file);
    if (caption) {
      form.append('caption', caption);
    }

    const row = await request<ReportPhotoRaw>(
      `/api/reports/${reportId}/photos`,
      {
        method: 'POST',
        body: form
      },
      true
    );
    return mapReportPhoto(row);
  },

  getReportPhotos: async (reportId: string): Promise<ReportPhoto[]> => {
    const rows = await request<ReportPhotoRaw[]>(`/api/reports/${reportId}/photos`);
    return rows.map(mapReportPhoto);
  },

  getSatelliteHistory: async (reservoirId: string): Promise<SatelliteHistory[]> => {
    return request<SatelliteHistory[]>(`/api/satellite/history/${reservoirId}`);
  },

  triggerSatelliteAnalysis: async (
    reservoirId: string,
    date?: string,
    mode?: 'auto' | 'gee' | 'planet'
  ): Promise<any> => {
    const payload: Record<string, unknown> = {};
    if (date) {
      payload.date = date;
    }
    if (mode) {
      payload.mode = mode;
    }
    return request(`/api/satellite/analyze/${reservoirId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getShorelines: async (
    reservoirId: string,
    params?: { season?: ShorelineSeason; type?: ShorelineBoundaryType; current?: boolean }
  ): Promise<ShorelineBoundary[]> => {
    const query = new URLSearchParams();
    if (params?.season) query.set('season', params.season);
    if (params?.type) query.set('type', params.type);
    if (params?.current !== undefined) query.set('current', String(params.current));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<ShorelineBoundaryRaw[]>(`/api/reservoirs/${reservoirId}/shorelines${suffix}`);
  },

  createShoreline: async (
    reservoirId: string,
    payload: {
      boundaryGeoJSON: { type: 'Polygon'; coordinates: number[][][] };
      boundaryType?: ShorelineBoundaryType;
      season?: ShorelineSeason;
      source?: ShorelineSource;
      captureDate?: string;
      isCurrent?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ShorelineBoundary> => {
    return request<ShorelineBoundaryRaw>(`/api/reservoirs/${reservoirId}/shorelines`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getFloodExpansion: async (reservoirId: string): Promise<FloodExpansion> => {
    return request<FloodExpansion>(`/api/reservoirs/${reservoirId}/shorelines/flood-expansion`);
  },

  getSurveyPlans: async (reservoirId?: string): Promise<SurveyPlan[]> => {
    const query = reservoirId ? `?reservoirId=${encodeURIComponent(reservoirId)}` : '';
    const rows = await request<SurveyPlanRaw[]>(`/api/survey-plans${query}`);
    return rows.map(mapSurveyPlan);
  },

  createSurveyPlan: async (payload: {
    reservoirId: string;
    title: string;
    area?: string;
    markerIds?: string[];
    startDate?: string;
    endDate?: string;
    leadUserId?: string;
    checklist?: string[];
    status?: SurveyPlanStatus;
  }): Promise<SurveyPlan> => {
    const row = await request<SurveyPlanRaw>('/api/survey-plans', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return mapSurveyPlan(row);
  },

  updateSurveyPlan: async (
    id: string,
    payload: {
      title?: string;
      area?: string;
      markerIds?: string[];
      startDate?: string;
      endDate?: string;
      leadUserId?: string | null;
      checklist?: string[];
      status?: SurveyPlanStatus;
    }
  ): Promise<SurveyPlan> => {
    const row = await request<SurveyPlanRaw>(`/api/survey-plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    return mapSurveyPlan(row);
  },

  getReservoirOverview: async (reservoirId: string): Promise<ReservoirOverview> => {
    return request<ReservoirOverview>(`/api/dashboard/reservoir/${reservoirId}`);
  }
};
