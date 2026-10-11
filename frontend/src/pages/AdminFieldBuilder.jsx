import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, ArrowLeft, CheckCircle2, Wand2 } from 'lucide-react';
import { getMyCommunities, getRequiredFields, updateRequiredFields } from '../api/admin';
import { LoadingSpinner, EmptyState, ErrorAlert } from '../components/FeedbackComponents';
import { formatApiError } from '../utils/formatError';

const FIELD_TYPES = [
  { value: 'text', label: 'Plain Text' },
  { value: 'name', label: 'Person Name' },
  { value: 'number', label: 'Number / Count' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'address', label: 'Physical Address' },
  { value: 'bank_account', label: 'Bank Account Number' },
  { value: 'upi_id', label: 'UPI VPA ID' },
  { value: 'id_number', label: 'Government ID / Ration / Aadhaar' },
  { value: 'photo', label: 'Damage Photo (Image File)' },
  { value: 'document', label: 'Document Proof (PDF/Image)' },
];

const STANDARD_TEMPLATE = [
  { label: 'Head of Household Name', field_type: 'name', is_required: true, order: 0 },
  { label: 'Mobile Phone Number', field_type: 'phone', is_required: true, order: 1 },
  { label: 'Residential Address', field_type: 'address', is_required: true, order: 2 },
  { label: 'Government ID / Aadhaar / Ration Card', field_type: 'id_number', is_required: true, order: 3 },
  { label: 'Bank Account Number / IFSC', field_type: 'bank_account', is_required: false, order: 4 },
  { label: 'Disaster Damage Photograph', field_type: 'photo', is_required: true, order: 5 },
];

export default function AdminFieldBuilder() {
  const [searchParams] = useSearchParams();
  const commParam = searchParams.get('comm');

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState(null);
  const [fields, setFields] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const loadCommunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyCommunities(1, 100);
      const list = res?.items || [];
      setCommunities(list);

      if (list.length > 0) {
        const initialId = commParam ? Number(commParam) : list[0].id;
        setSelectedCommunityId(initialId);
      }
    } catch (err) {
      setError(formatApiError(err, 'Failed to load communities.'));
    } finally {
      setLoading(false);
    }
  }, [commParam]);

  // 1. Load communities
  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const loadFields = useCallback(async (commId) => {
    try {
      setError(null);
      setSuccessMsg('');
      const data = await getRequiredFields(commId);
      setFields(data || []);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load fields for this community.'));
    }
  }, []);

  // 2. Load fields when community selected
  useEffect(() => {
    if (selectedCommunityId) {
      loadFields(selectedCommunityId);
    }
  }, [selectedCommunityId, loadFields]);

  const handleAddField = () => {
    setFields([
      ...fields,
      {
        label: '',
        field_type: 'text',
        is_required: true,
        order: fields.length,
      },
    ]);
  };

  const handleFieldChange = (index, key, val) => {
    const updated = [...fields];
    updated[index][key] = val;
    setFields(updated);
  };

  const handleRemoveField = (index) => {
    const updated = fields.filter((_, i) => i !== index);
    // re-index order
    updated.forEach((f, i) => {
      f.order = i;
    });
    setFields(updated);
  };

  const handleMove = (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === fields.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    updated.forEach((f, i) => {
      f.order = i;
    });
    setFields(updated);
  };

  const handleApplyTemplate = () => {
    setFields(STANDARD_TEMPLATE.map((f, i) => ({ ...f, order: i })));
  };

  const handleSave = async () => {
    if (!selectedCommunityId) return;

    // Validate that all fields have non-empty labels
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        setError(`Field #${i + 1} has an empty label.`);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg('');
      const payload = fields.map((f, idx) => ({
        label: f.label.trim(),
        field_type: f.field_type,
        is_required: f.is_required,
        order: idx,
      }));
      const saved = await updateRequiredFields(selectedCommunityId, payload);
      setFields(saved);
      setSuccessMsg('Field schema successfully saved and updated for this relief community.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(formatApiError(err, 'Failed to save required fields.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading dynamic field builder..." />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/admin/communities" className="text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Schema Configuration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Dynamic Form Field Builder
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure the exact household details required from applicants. AidNexus runs real-time deduplication across these specific field types.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="comm-select-fb" className="text-xs text-slate-400 font-medium">Program:</label>
          <select
            id="comm-select-fb"
            value={selectedCommunityId || ''}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setSelectedCommunityId(newId);
              setSearchParams({ comm: newId });
            }}
            className="bg-slate-800 text-white text-sm rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          >
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}
      {successMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Builder Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Configured Fields ({fields.length})</h2>
            <p className="text-xs text-slate-400">
              Drag, order, and customize inputs. Normalization and clue detection automatically align with each field type.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
              title="Apply Standard Indian Relief Form"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400" />
              Standard Relief Template
            </button>
            <button
              onClick={handleAddField}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Field
            </button>
          </div>
        </div>

        {fields.length === 0 ? (
          <EmptyState
            title="No Fields Configured"
            description="Add custom fields or click 'Standard Relief Template' to configure the household claim questionnaire."
            actionText="Apply Standard Template"
            onAction={handleApplyTemplate}
          />
        ) : (
          <div className="space-y-3">
            {fields.map((f, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>

                  {/* Label Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Field Label (e.g. Mobile Phone, Ration Card)"
                      value={f.label}
                      onChange={(e) => handleFieldChange(idx, 'label', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  {/* Type Selector */}
                  <div className="w-48">
                    <select
                      value={f.field_type}
                      onChange={(e) => handleFieldChange(idx, 'field_type', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Options & Order Controls */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-900">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={f.is_required}
                      onChange={(e) => handleFieldChange(idx, 'is_required', e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    Required
                  </label>

                  <div className="flex items-center gap-1 border-l border-slate-800 pl-3">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                      title="Move Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === fields.length - 1}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800"
                      title="Move Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveField(idx)}
                      className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/30 ml-1"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Save Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleAddField}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <Plus className="w-4 h-4" />
            Add Another Field
          </button>

          <button
            onClick={handleSave}
            disabled={saving || fields.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950 transition"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Schema...' : 'Save & Publish Schema'}
          </button>
        </div>
      </div>
    </div>
  );
}
