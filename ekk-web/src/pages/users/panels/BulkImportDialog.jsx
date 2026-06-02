import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkImportUsers, downloadBulkImportTemplate, getApiErrorMessage } from '../../../services/apiService';

export default function BulkImportDialog({ onClose, onSuccess }) {
  const [file, setFile]       = useState(null);
  const [dryRun, setDryRun]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const onDrop = useCallback(async (accepted) => {
    const f = accepted[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const res = await bulkImportUsers(f, true);
      setDryRun(res);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to parse file'));
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
  });

  async function doImport() {
    setImporting(true);
    try {
      const res = await bulkImportUsers(file, false);
      toast.success(`Imported ${res.inserted} users`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Import failed'));
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    try {
      const blob = await downloadBulkImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'user_import_template.xlsx'; a.click();
    } catch {
      toast.error('Template not available');
    }
  }

  const hasErrors = dryRun && dryRun.errors?.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Bulk import users</h3>
          <button onClick={onClose} type="button" className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        {!file ? (
          <div>
            <div {...getRootProps()}
              className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition
                ${isDragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}`}>
              <input {...getInputProps()} />
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm font-medium text-gray-700">Drop CSV or XLSX here, or click to browse</p>
              <p className="mt-1 text-xs text-gray-400">Accepts .csv and .xlsx files</p>
            </div>
            <button onClick={downloadTemplate} type="button" className="mt-3 text-xs text-primary-600 hover:underline">
              ↓ Download import template
            </button>
          </div>
        ) : loading ? (
          <div className="mt-6 text-center text-sm text-gray-500">Analysing file...</div>
        ) : dryRun ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-800">{file.name}</span>
              <button onClick={() => { setFile(null); setDryRun(null); }} type="button" className="ml-auto text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 space-y-1 text-sm">
              <p className="text-green-700">✓ {dryRun.inserted ?? 0} users ready to import</p>
              {dryRun.errors?.length > 0 && <p className="text-red-600">✗ {dryRun.errors.length} rows have errors</p>}
              {dryRun.skipped > 0 && <p className="text-amber-600">⚠ {dryRun.skipped} rows skipped</p>}
            </div>
            {dryRun.errors?.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="mb-1 text-xs font-semibold text-red-700">Error rows:</p>
                {dryRun.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600">Row {e.row || i + 2}: {e.error}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
              <button type="button" onClick={doImport} disabled={hasErrors || importing}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {importing ? 'Importing...' : `Import ${dryRun.inserted ?? 0} users`}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
