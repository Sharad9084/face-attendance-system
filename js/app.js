/* ============================================
   App Module — Main Application Logic
   ============================================ */

class App {
  constructor() {
    this.currentPage = 'home';
    this.registrationData = {
      name: '',
      id: '',
      department: '',
      capturedDescriptors: [],
      capturedImages: []
    };
    this.isAttendanceRunning = false;
    this.lastRecognizedId = null;
    this.lastRecognitionTime = 0;
    this.recognitionCooldown = 3000; // 3 seconds cooldown
  }

  async init() {
    try {
      this.showLoading('Initializing system...');

      // Init database
      this.updateLoadingText('Connecting to database...');
      await db.init();

      // Load face-api.js models
      await faceRecognition.loadModels((msg) => {
        this.updateLoadingText(msg);
      });

      // Load settings
      const threshold = await db.getSetting('confidenceThreshold', 0.6);
      faceRecognition.setConfidenceThreshold(threshold);
      const thresholdSlider = document.getElementById('setting-threshold');
      if (thresholdSlider) {
        thresholdSlider.value = threshold * 100;
        document.getElementById('threshold-value').textContent = Math.round(threshold * 100) + '%';
      }

      // Load registered faces
      await faceRecognition.loadRegisteredFaces();

      // Setup navigation
      this.setupNavigation();
      this.setupEventListeners();

      // Show home page
      this.hideLoading();
      this.navigateTo('home');

      console.log('✅ App initialized successfully');

    } catch (error) {
      console.error('❌ App init error:', error);
      this.hideLoading();
      showToast('Initialization failed: ' + error.message, 'error');
    }
  }

  // ── Loading Screen ──

  showLoading(text) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      this.updateLoadingText(text);
    }
  }

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  updateLoadingText(text) {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = text;
  }

  // ── Navigation ──

  setupNavigation() {
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        this.navigateTo(page);
        // Close mobile menu
        document.querySelector('.nav-links').classList.remove('open');
      });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.toggle('open');
      });
    }
  }

  navigateTo(page) {
    // Stop camera if leaving attendance/register page
    if (this.currentPage === 'attendance' || this.currentPage === 'register') {
      this.stopAttendance();
      camera.stop();
    }

    this.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-page') === page);
    });

    // Show/hide sections
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.toggle('active', section.id === `page-${page}`);
    });

    // Page-specific init
    switch (page) {
      case 'home':
        dashboard.refreshStats();
        break;
      case 'attendance':
        dashboard.loadRecentAttendance();
        break;
      case 'dashboard':
        dashboard.refreshStats();
        document.getElementById('filter-date').value = getTodayDateStr();
        dashboard.loadAttendanceTable();
        break;
      case 'users':
        dashboard.loadUsersGrid();
        break;
      case 'settings':
        this.loadSettings();
        break;
    }
  }

  // ── Event Listeners ──

  setupEventListeners() {
    // ── Attendance Page ──
    document.getElementById('btn-start-attendance')?.addEventListener('click', () => this.startAttendance());
    document.getElementById('btn-stop-attendance')?.addEventListener('click', () => this.stopAttendance());

    // ── Register Page ──
    document.getElementById('btn-start-register')?.addEventListener('click', () => this.startRegistration());
    document.getElementById('btn-capture-face')?.addEventListener('click', () => this.captureFaceForRegistration());
    document.getElementById('btn-save-registration')?.addEventListener('click', () => this.saveRegistration());
    document.getElementById('btn-reset-registration')?.addEventListener('click', () => this.resetRegistration());

    // ── Dashboard Filters ──
    document.getElementById('filter-date')?.addEventListener('change', (e) => {
      dashboard.loadAttendanceTable(e.target.value, document.getElementById('filter-search')?.value || '');
    });

    document.getElementById('filter-search')?.addEventListener('input', debounce((e) => {
      dashboard.loadAttendanceTable(null, e.target.value);
    }, 300));

    document.getElementById('btn-export-csv')?.addEventListener('click', () => dashboard.exportAttendance());

    // ── Settings ──
    document.getElementById('setting-threshold')?.addEventListener('input', (e) => {
      const val = e.target.value;
      document.getElementById('threshold-value').textContent = val + '%';
      faceRecognition.setConfidenceThreshold(val / 100);
      db.setSetting('confidenceThreshold', val / 100);
    });

    document.getElementById('btn-export-data')?.addEventListener('click', () => this.exportBackup());
    document.getElementById('btn-import-data')?.addEventListener('click', () => document.getElementById('import-file-input').click());
    document.getElementById('import-file-input')?.addEventListener('change', (e) => this.importBackup(e));
    document.getElementById('btn-clear-attendance')?.addEventListener('click', () => this.clearAllAttendance());

    // ── Home Feature Cards ──
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('click', () => {
        const page = card.getAttribute('data-navigate');
        if (page) this.navigateTo(page);
      });
    });
  }

  // ── Attendance Functions ──

  async startAttendance() {
    try {
      const videoEl = document.getElementById('attendance-video');
      const canvasEl = document.getElementById('attendance-canvas');

      await camera.start(videoEl);

      // Update UI
      document.getElementById('btn-start-attendance').style.display = 'none';
      document.getElementById('btn-stop-attendance').style.display = 'inline-flex';
      document.getElementById('camera-status-attendance').className = 'camera-status active';
      document.getElementById('camera-status-attendance').innerHTML = '<span class="status-dot"></span> LIVE';
      document.getElementById('attendance-placeholder').style.display = 'none';

      // Start continuous detection
      await faceRecognition.loadRegisteredFaces();

      faceRecognition.startContinuousDetection(videoEl, canvasEl, async (result, detection) => {
        this.handleRecognitionResult(result, detection);
      });

      this.isAttendanceRunning = true;
      showToast('Camera started. Face detection active.', 'success');

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  stopAttendance() {
    faceRecognition.stopContinuousDetection();
    camera.stop();

    const startBtn = document.getElementById('btn-start-attendance');
    const stopBtn = document.getElementById('btn-stop-attendance');
    const status = document.getElementById('camera-status-attendance');
    const placeholder = document.getElementById('attendance-placeholder');

    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (status) {
      status.className = 'camera-status inactive';
      status.innerHTML = '<span class="status-dot"></span> OFF';
    }
    if (placeholder) placeholder.style.display = 'flex';

    // Clear canvas
    const canvas = document.getElementById('attendance-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Reset result panel
    this.updateResultPanel(null);

    this.isAttendanceRunning = false;
  }

  async handleRecognitionResult(result, detection) {
    const now = Date.now();

    if (!result || !result.matched) {
      // Only update UI if no cooldown active
      if (now - this.lastRecognitionTime > this.recognitionCooldown) {
        this.updateResultPanel(result ? 'unknown' : null);
      }
      return;
    }

    // Avoid rapid-fire recognition for same person
    if (result.label === this.lastRecognizedId && now - this.lastRecognitionTime < this.recognitionCooldown) {
      return;
    }

    this.lastRecognizedId = result.label;
    this.lastRecognitionTime = now;

    try {
      const user = await db.getUser(result.label);
      if (!user) return;

      const attendanceResult = await db.markAttendance(user.id, user.name, user.department);

      if (attendanceResult.alreadyMarked) {
        this.updateResultPanel('already', user, result.confidence);
        showToast(`${user.name} — Already marked today ✓`, 'info');
      } else {
        this.updateResultPanel('success', user, result.confidence);
        showToast(`${user.name} — Attendance marked! ✅`, 'success');
        dashboard.loadRecentAttendance();
      }
    } catch (error) {
      console.error('Attendance error:', error);
    }
  }

  updateResultPanel(status, user = null, confidence = 0) {
    const panel = document.getElementById('recognition-result');
    if (!panel) return;

    if (!status) {
      panel.innerHTML = `
        <div class="result-card">
          <div class="result-icon">👀</div>
          <h3>Waiting for Face</h3>
          <p class="result-detail">Position your face in front of the camera</p>
        </div>
      `;
      return;
    }

    if (status === 'unknown') {
      panel.innerHTML = `
        <div class="result-card error">
          <div class="result-icon">❓</div>
          <h3>Unknown Face</h3>
          <p class="result-detail">This face is not registered in the system</p>
        </div>
      `;
      return;
    }

    if (status === 'success') {
      panel.innerHTML = `
        <div class="result-card success">
          <div class="result-icon">✅</div>
          <h3>${user.name}</h3>
          <p class="result-detail">${user.department || 'No Department'} • ID: ${user.id}</p>
          <p class="result-detail" style="margin-top:0.5rem;color:var(--accent-green);font-weight:600;">Attendance Marked!</p>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${confidence}%"></div></div>
          <p class="result-detail" style="margin-top:0.5rem;">Confidence: ${confidence}%</p>
        </div>
      `;
      return;
    }

    if (status === 'already') {
      panel.innerHTML = `
        <div class="result-card" style="border-color:rgba(59,130,246,0.3);background:rgba(59,130,246,0.05);">
          <div class="result-icon">ℹ️</div>
          <h3>${user.name}</h3>
          <p class="result-detail">${user.department || 'No Department'} • ID: ${user.id}</p>
          <p class="result-detail" style="margin-top:0.5rem;color:var(--accent-blue);font-weight:600;">Already Marked Today</p>
          <div class="confidence-bar"><div class="confidence-fill" style="width:${confidence}%"></div></div>
          <p class="result-detail" style="margin-top:0.5rem;">Confidence: ${confidence}%</p>
        </div>
      `;
    }
  }

  // ── Registration Functions ──

  async startRegistration() {
    const name = document.getElementById('reg-name').value.trim();
    const id = document.getElementById('reg-id').value.trim();
    const dept = document.getElementById('reg-department').value.trim();

    if (!name || !id) {
      showToast('Please enter Name and ID', 'warning');
      return;
    }

    // Check if ID already exists
    const existing = await db.getUser(id);
    if (existing) {
      showToast('This ID is already registered!', 'error');
      return;
    }

    this.registrationData = {
      name, id, department: dept,
      capturedDescriptors: [],
      capturedImages: []
    };

    try {
      const videoEl = document.getElementById('register-video');
      await camera.start(videoEl);

      document.getElementById('register-placeholder').style.display = 'none';
      document.getElementById('camera-status-register').className = 'camera-status active';
      document.getElementById('camera-status-register').innerHTML = '<span class="status-dot"></span> LIVE';

      // Enable capture button
      document.getElementById('btn-capture-face').disabled = false;
      document.getElementById('btn-start-register').disabled = true;

      showToast('Camera ready! Capture 5 face photos from different angles.', 'info');

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async captureFaceForRegistration() {
    if (this.registrationData.capturedDescriptors.length >= 5) {
      showToast('Already captured 5 photos!', 'warning');
      return;
    }

    const videoEl = document.getElementById('register-video');

    try {
      const descriptor = await faceRecognition.extractDescriptor(videoEl);

      if (!descriptor) {
        showToast('No face detected! Please position your face clearly.', 'error');
        return;
      }

      const imageData = camera.captureImage();
      this.registrationData.capturedDescriptors.push(descriptor);
      this.registrationData.capturedImages.push(imageData);

      const count = this.registrationData.capturedDescriptors.length;

      // Update capture slots
      const slot = document.getElementById(`capture-slot-${count}`);
      if (slot) {
        slot.classList.add('filled');
        slot.innerHTML = `<img src="${imageData}" alt="Capture ${count}">`;
      }

      // Update progress
      const progressFill = document.getElementById('capture-progress-fill');
      const progressText = document.getElementById('capture-progress-text');
      if (progressFill) progressFill.style.width = `${(count / 5) * 100}%`;
      if (progressText) progressText.textContent = `${count}/5`;

      showToast(`Photo ${count}/5 captured! ${count < 5 ? 'Turn your face slightly for next.' : 'All photos captured!'}`, 'success');

      if (count >= 5) {
        document.getElementById('btn-capture-face').disabled = true;
        document.getElementById('btn-save-registration').disabled = false;
      }

    } catch (error) {
      showToast('Capture failed: ' + error.message, 'error');
    }
  }

  async saveRegistration() {
    if (this.registrationData.capturedDescriptors.length < 5) {
      showToast('Please capture 5 photos first', 'warning');
      return;
    }

    try {
      const user = {
        id: this.registrationData.id,
        name: this.registrationData.name,
        department: this.registrationData.department,
        descriptors: this.registrationData.capturedDescriptors,
        thumbnail: this.registrationData.capturedImages[0]
      };

      await db.addUser(user);
      await faceRecognition.loadRegisteredFaces();

      showToast(`${user.name} registered successfully! 🎉`, 'success');
      this.resetRegistration();

    } catch (error) {
      console.error('Registration error:', error);
      showToast('Registration failed: ' + error.message, 'error');
    }
  }

  resetRegistration() {
    camera.stop();

    this.registrationData = {
      name: '', id: '', department: '',
      capturedDescriptors: [],
      capturedImages: []
    };

    // Reset form
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-id').value = '';
    document.getElementById('reg-department').value = '';

    // Reset UI
    document.getElementById('register-placeholder').style.display = 'flex';
    document.getElementById('camera-status-register').className = 'camera-status inactive';
    document.getElementById('camera-status-register').innerHTML = '<span class="status-dot"></span> OFF';

    document.getElementById('btn-capture-face').disabled = true;
    document.getElementById('btn-save-registration').disabled = true;
    document.getElementById('btn-start-register').disabled = false;

    // Reset capture slots
    for (let i = 1; i <= 5; i++) {
      const slot = document.getElementById(`capture-slot-${i}`);
      if (slot) {
        slot.classList.remove('filled');
        slot.innerHTML = `<span class="slot-number">${i}</span>`;
      }
    }

    // Reset progress
    const progressFill = document.getElementById('capture-progress-fill');
    const progressText = document.getElementById('capture-progress-text');
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = '0/5';
  }

  // ── User Management ──

  async deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      await db.deleteUser(userId);
      await db.deleteAttendanceByUser(userId);
      await faceRecognition.loadRegisteredFaces();
      dashboard.loadUsersGrid();
      showToast('User deleted successfully', 'success');
    } catch (error) {
      showToast('Delete failed: ' + error.message, 'error');
    }
  }

  // ── Settings ──

  async loadSettings() {
    const threshold = await db.getSetting('confidenceThreshold', 0.6);
    const slider = document.getElementById('setting-threshold');
    if (slider) {
      slider.value = threshold * 100;
      document.getElementById('threshold-value').textContent = Math.round(threshold * 100) + '%';
    }

    // Load camera list
    const cameras = await camera.getAvailableCameras();
    const cameraSelect = document.getElementById('setting-camera');
    if (cameraSelect) {
      cameraSelect.innerHTML = cameras.map((cam, i) =>
        `<option value="${cam.deviceId}">${cam.label || `Camera ${i + 1}`}</option>`
      ).join('');
    }

    // Show stats
    const totalUsers = await db.getUserCount();
    const allAttendance = await db.getAllAttendance();
    document.getElementById('settings-total-users').textContent = totalUsers;
    document.getElementById('settings-total-records').textContent = allAttendance.length;
  }

  async exportBackup() {
    try {
      const data = await db.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `face_attendance_backup_${getTodayDateStr()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported successfully!', 'success');
    } catch (error) {
      showToast('Export failed: ' + error.message, 'error');
    }
  }

  async importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      await db.importData(text);
      await faceRecognition.loadRegisteredFaces();
      showToast('Data imported successfully! Refresh pages to see changes.', 'success');
    } catch (error) {
      showToast('Import failed: ' + error.message, 'error');
    }

    event.target.value = '';
  }

  async clearAllAttendance() {
    if (!confirm('Are you sure you want to clear ALL attendance records? This cannot be undone.')) return;

    try {
      await db.clearAllAttendance();
      dashboard.loadAttendanceTable();
      dashboard.refreshStats();
      showToast('All attendance records cleared', 'success');
    } catch (error) {
      showToast('Clear failed: ' + error.message, 'error');
    }
  }
}

// ── Initialize ──
const app = new App();

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
