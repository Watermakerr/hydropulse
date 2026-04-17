import { useEffect, useMemo, useState } from 'react';
import { Upload, ImagePlus } from 'lucide-react';
import { api, Task, TaskReport, ReportPhoto } from '../services/api';

export default function UploadTest() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [caption, setCaption] = useState('Test upload from frontend');
  const [description, setDescription] = useState('Report generated from FE upload test');
  const [file, setFile] = useState<File | null>(null);

  const [report, setReport] = useState<TaskReport | null>(null);
  const [uploaded, setUploaded] = useState<ReportPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const taskRows = await api.getTasks();
        setTasks(taskRows);
        if (taskRows.length > 0) {
          setSelectedTaskId(taskRows[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tasks');
      } finally {
        setLoadingTasks(false);
      }
    };

    run();
  }, []);

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [tasks, selectedTaskId]);

  const createReport = async () => {
    if (!selectedTaskId) {
      setError('Hay chon task truoc khi tao report');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await api.createReport({
        taskId: selectedTaskId,
        description,
        conditionStatus: 'good',
        locationGeoJSON: { type: 'Point', coordinates: [105.825, 21.005] }
      });
      setReport(created);
      setUploaded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create report failed');
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async () => {
    if (!report?.id) {
      setError('Hay tao report truoc khi upload');
      return;
    }
    if (!file) {
      setError('Hay chon anh truoc khi upload');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.uploadReportPhoto(report.id, file, caption);
      setUploaded(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-primary">Upload anh test</h2>
        <p className="text-on-surface-variant mt-2">Tao report tu task sau do upload anh len Azure Blob qua backend API.</p>
      </header>

      <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm space-y-5">
        {error && <div className="bg-error-container text-error rounded-lg px-4 py-3 text-sm font-medium">{error}</div>}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Task</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
            disabled={loadingTasks || busy}
          >
            {tasks.map((t) => (
              <option value={t.id} key={t.id}>
                {t.title} - {t.reservoir_name}
              </option>
            ))}
          </select>
          {selectedTask && <p className="text-xs text-on-surface-variant mt-2">Task hien tai: {selectedTask.status} | {selectedTask.priority}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Mo ta report</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
            disabled={busy}
          />
        </div>

        <button
          onClick={createReport}
          disabled={busy || !selectedTaskId}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
        >
          Tao report
        </button>

        {report && (
          <div className="rounded-xl bg-surface-container p-4 text-sm">
            <div className="font-bold text-primary mb-1">Report da tao</div>
            <div>ID: {report.id}</div>
            <div>Task ID: {report.task_id}</div>
            <div>Trang thai sync: {report.sync_status}</div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Caption</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
              disabled={busy}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Anh</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
              disabled={busy}
            />
          </div>

          <button
            onClick={uploadPhoto}
            disabled={busy || !report || !file}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload anh
          </button>

          {uploaded && (
            <div className="rounded-xl bg-tertiary-fixed/20 p-4 text-sm space-y-2">
              <div className="font-bold text-primary flex items-center gap-2">
                <ImagePlus className="w-4 h-4" /> Upload thanh cong
              </div>
              <div>Photo ID: {uploaded.id}</div>
              <div>Upload status: {uploaded.upload_status}</div>
              <a href={uploaded.url} target="_blank" rel="noreferrer" className="text-primary underline break-all">
                {uploaded.url}
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
