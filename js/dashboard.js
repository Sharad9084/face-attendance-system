/* ============================================
   Dashboard Module — Stats, Filtering, Charts
   ============================================ */

class Dashboard {
  constructor() {
    this.currentFilter = {
      date: getTodayDateStr(),
      search: ''
    };
  }

  async refreshStats() {
    try {
      const totalUsers = await db.getUserCount();
      const todayPresent = await db.getTodayAttendanceCount();
      const todayLate = await db.getTodayLateCount();
      const todayOnTime = todayPresent - todayLate;

      // Home page stats
      const el1 = document.getElementById('stat-total-users');
      const el2 = document.getElementById('stat-today-present');
      const el3 = document.getElementById('stat-on-time');
      const el4 = document.getElementById('stat-late');
      if (el1) el1.textContent = totalUsers;
      if (el2) el2.textContent = todayPresent;
      if (el3) el3.textContent = todayOnTime;
      if (el4) el4.textContent = todayLate;

      // Dashboard page stats
      const d1 = document.getElementById('dash-total-users');
      const d2 = document.getElementById('dash-today-present');
      const d3 = document.getElementById('dash-on-time');
      const d4 = document.getElementById('dash-late');
      if (d1) d1.textContent = totalUsers;
      if (d2) d2.textContent = todayPresent;
      if (d3) d3.textContent = todayOnTime;
      if (d4) d4.textContent = todayLate;
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }

  async loadAttendanceTable(date = null, searchTerm = '') {
    try {
      const filterDate = date || this.currentFilter.date;
      this.currentFilter.date = filterDate;
      this.currentFilter.search = searchTerm;

      let records = await db.getAttendanceByDate(filterDate);

      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        records = records.filter(r =>
          r.userName.toLowerCase().includes(term) ||
          r.userId.toLowerCase().includes(term) ||
          r.department.toLowerCase().includes(term)
        );
      }

      // Sort by time (latest first)
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const tbody = document.getElementById('attendance-table-body');
      const emptyState = document.getElementById('attendance-empty');

      if (records.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      tbody.innerHTML = records.map((record, index) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="recent-avatar" style="width:36px;height:36px;font-size:0.75rem;">${getInitials(record.userName)}</div>
              <div>
                <div style="font-weight:600;">${record.userName}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">${record.userId}</div>
              </div>
            </div>
          </td>
          <td>${record.department || '—'}</td>
          <td>${record.time}</td>
          <td>
            <span class="badge ${record.status === 'late' ? 'badge-warning' : 'badge-success'}">
              ${record.status === 'late' ? '⏰ Late' : '✅ On Time'}
            </span>
          </td>
        </tr>
      `).join('');

    } catch (error) {
      console.error('Error loading attendance table:', error);
    }
  }

  async loadUsersGrid() {
    try {
      const users = await db.getAllUsers();
      const grid = document.getElementById('users-grid');
      const emptyState = document.getElementById('users-empty');

      if (users.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      grid.innerHTML = users.map(user => `
        <div class="user-card" data-user-id="${user.id}">
          <div class="user-avatar">${getInitials(user.name)}</div>
          <h3>${user.name}</h3>
          <p class="user-id">ID: ${user.id}</p>
          ${user.department ? `<span class="user-dept">${user.department}</span>` : ''}
          <div class="user-actions">
            <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${user.id}')">
              🗑️ Delete
            </button>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading users grid:', error);
    }
  }

  async exportAttendance() {
    try {
      const date = this.currentFilter.date;
      let records = await db.getAttendanceByDate(date);

      if (records.length === 0) {
        showToast('No attendance records to export for this date', 'warning');
        return;
      }

      const exportData = records.map(r => ({
        'Name': r.userName,
        'ID': r.userId,
        'Department': r.department || '',
        'Date': r.date,
        'Time': r.time,
        'Status': r.status
      }));

      exportToCSV(exportData, `attendance_${date}.csv`);
    } catch (error) {
      console.error('Error exporting attendance:', error);
      showToast('Export failed', 'error');
    }
  }

  async loadRecentAttendance() {
    try {
      const today = getTodayDateStr();
      const records = await db.getAttendanceByDate(today);
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const container = document.getElementById('recent-attendance-list');
      if (!container) return;

      if (records.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding:1.5rem;">
            <p style="color:var(--text-muted);font-size:0.85rem;">No attendance marked yet today</p>
          </div>
        `;
        return;
      }

      container.innerHTML = records.slice(0, 10).map(record => `
        <div class="recent-item">
          <div class="recent-avatar">${getInitials(record.userName)}</div>
          <div class="recent-info">
            <h4>${record.userName}</h4>
            <p>${record.department || 'No Dept'}</p>
          </div>
          <span class="recent-time">${record.time}</span>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading recent attendance:', error);
    }
  }
}

// Global instance
const dashboard = new Dashboard();
