/* ============================================
   Database Module — IndexedDB Operations
   ============================================ */

const DB_NAME = 'FaceAttendanceDB';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Users store
        if (!db.objectStoreNames.contains('users')) {
          const usersStore = db.createObjectStore('users', { keyPath: 'id' });
          usersStore.createIndex('name', 'name', { unique: false });
          usersStore.createIndex('department', 'department', { unique: false });
        }

        // Attendance store
        if (!db.objectStoreNames.contains('attendance')) {
          const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id', autoIncrement: true });
          attendanceStore.createIndex('userId', 'userId', { unique: false });
          attendanceStore.createIndex('date', 'date', { unique: false });
          attendanceStore.createIndex('userId_date', ['userId', 'date'], { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('✅ Database initialized');
        resolve(this.db);
      };
    });
  }

  // ── User Operations ──

  async addUser(user) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      // Convert Float32Array descriptors to regular arrays for storage
      const userToStore = {
        ...user,
        descriptors: user.descriptors.map(d => Array.from(d)),
        registeredAt: new Date().toISOString()
      };
      const request = store.add(userToStore);
      request.onsuccess = () => resolve(userToStore);
      request.onerror = () => reject(request.error);
    });
  }

  async getUser(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.get(id);
      request.onsuccess = () => {
        const user = request.result;
        if (user && user.descriptors) {
          user.descriptors = user.descriptors.map(d => new Float32Array(d));
        }
        resolve(user);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.getAll();
      request.onsuccess = () => {
        const users = request.result.map(user => {
          if (user.descriptors) {
            user.descriptors = user.descriptors.map(d => new Float32Array(d));
          }
          return user;
        });
        resolve(users);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteUser(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateUser(user) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const userToStore = {
        ...user,
        descriptors: user.descriptors.map(d => Array.from(d))
      };
      const request = store.put(userToStore);
      request.onsuccess = () => resolve(userToStore);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserCount() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('users', 'readonly');
      const store = tx.objectStore('users');
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ── Attendance Operations ──

  async markAttendance(userId, userName, department) {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    // Check if already marked today
    const existing = await this.getAttendanceByUserAndDate(userId, dateStr);
    if (existing) {
      return { alreadyMarked: true, record: existing };
    }

    const status = await this.getAttendanceStatus(now);

    const record = {
      userId,
      userName,
      department,
      date: dateStr,
      time: timeStr,
      timestamp: now.toISOString(),
      status
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readwrite');
      const store = tx.objectStore('attendance');
      const request = store.add(record);
      request.onsuccess = () => {
        record.id = request.result;
        resolve({ alreadyMarked: false, record });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAttendanceStatus(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Default: 09:30 (570 minutes)
    const lateTimeStr = await this.getSetting('lateThresholdTime', '09:30');
    const [tHours, tMinutes] = lateTimeStr.split(':').map(Number);
    const lateThreshold = tHours * 60 + tMinutes;
    
    return totalMinutes > lateThreshold ? 'late' : 'present';
  }

  async getAttendanceByUserAndDate(userId, date) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readonly');
      const store = tx.objectStore('attendance');
      const index = store.index('userId_date');
      const request = index.get([userId, date]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAttendanceByDate(date) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readonly');
      const store = tx.objectStore('attendance');
      const index = store.index('date');
      const request = index.getAll(date);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllAttendance() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readonly');
      const store = tx.objectStore('attendance');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getTodayAttendanceCount() {
    const today = new Date().toISOString().split('T')[0];
    const records = await this.getAttendanceByDate(today);
    return records.length;
  }

  async getTodayLateCount() {
    const today = new Date().toISOString().split('T')[0];
    const records = await this.getAttendanceByDate(today);
    return records.filter(r => r.status === 'late').length;
  }

  async deleteAttendanceByUser(userId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readwrite');
      const store = tx.objectStore('attendance');
      const index = store.index('userId');
      const request = index.openCursor(userId);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllAttendance() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('attendance', 'readwrite');
      const store = tx.objectStore('attendance');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ── Settings Operations ──

  async getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ── Backup / Restore ──

  async exportData() {
    const users = await this.getAllUsers();
    const attendance = await this.getAllAttendance();
    // Convert Float32Array back to arrays for JSON serialization
    const usersForExport = users.map(u => ({
      ...u,
      descriptors: u.descriptors.map(d => Array.from(d))
    }));
    return JSON.stringify({ users: usersForExport, attendance }, null, 2);
  }

  async importData(jsonString) {
    const data = JSON.parse(jsonString);

    if (data.users) {
      const tx = this.db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      for (const user of data.users) {
        store.put(user);
      }
    }

    if (data.attendance) {
      const tx = this.db.transaction('attendance', 'readwrite');
      const store = tx.objectStore('attendance');
      for (const record of data.attendance) {
        store.put(record);
      }
    }
  }
}

// Global instance
const db = new Database();
