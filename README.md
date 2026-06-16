# 🎯 Face Attendance System

AI-powered facial recognition attendance system — fully browser-based, no backend needed.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![face-api.js](https://img.shields.io/badge/face--api.js-AI%20Powered-8b5cf6)

## ✨ Features

- **📸 Real-time Face Detection** — Webcam se live face detect kare
- **👤 Face Registration** — 5 angles se face capture karke register kare
- **✅ Auto Attendance** — Face match hone pe automatic attendance mark
- **📊 Dashboard** — Date-wise records, search, filter & CSV export
- **👥 User Management** — Registered users manage kare
- **⚙️ Settings** — Confidence threshold, camera select, data backup/restore
- **🎨 Premium Dark UI** — Glassmorphism design with smooth animations

## 🚀 How to Use

1. Open `index.html` in browser (or deploy to any static hosting)
2. Go to **Register** → Enter name, ID → Capture 5 face photos
3. Go to **Attendance** → Start Camera → Show face → Auto marked!
4. View records on **Dashboard** → Export as CSV

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Face AI**: [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js based)
- **Storage**: IndexedDB (browser-based, no server needed)
- **Camera**: WebRTC API

## 📁 Project Structure

```
face-attendance-system/
├── index.html              # Single Page Application
├── css/
│   └── style.css           # Dark theme, glassmorphism, animations
├── js/
│   ├── app.js              # Main app logic & routing
│   ├── camera.js           # Webcam handling
│   ├── faceRecognition.js  # face-api.js integration
│   ├── database.js         # IndexedDB operations
│   ├── dashboard.js        # Stats & table logic
│   └── utils.js            # Helpers (toast, CSV, etc.)
└── 200.html                # SPA fallback for hosting
```

## 📝 License

MIT License
