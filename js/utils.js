/* ============================================
   Utils Module — Helper Functions
   ============================================ */

// ── Toast Notifications ──
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Date Formatting ──
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(timeStr) {
  return timeStr;
}

function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── CSV Export ──
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showToast('No data to export', 'warning');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(h => {
      let val = row[h] || '';
      // Escape commas and quotes
      val = String(val).replace(/"/g, '""');
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = `"${val}"`;
      }
      return val;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'attendance.csv';
  link.click();

  URL.revokeObjectURL(url);
  showToast('CSV exported successfully!', 'success');
}

// ── Generate Unique ID ──
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ── Debounce ──
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
