/* ============================================
   Camera Module — Webcam Handling
   ============================================ */

class Camera {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.isRunning = false;
    this.currentDeviceId = null;
  }

  async start(videoElement, deviceId = null) {
    try {
      this.videoElement = videoElement;

      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
        this.currentDeviceId = deviceId;
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;

      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          this.isRunning = true;
          console.log('📷 Camera started');
          resolve(true);
        };
      });
    } catch (error) {
      console.error('❌ Camera error:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera permission denied. Please allow camera access.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No camera found. Please connect a camera.');
      } else {
        throw new Error('Unable to access camera: ' + error.message);
      }
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.isRunning = false;
    console.log('📷 Camera stopped');
  }

  captureFrame() {
    if (!this.videoElement || !this.isRunning) return null;

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);
    return canvas;
  }

  captureImage() {
    const canvas = this.captureFrame();
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Error listing cameras:', error);
      return [];
    }
  }

  async switchCamera(deviceId) {
    this.stop();
    return this.start(this.videoElement, deviceId);
  }

  getVideoElement() {
    return this.videoElement;
  }
}

// Global instance
const camera = new Camera();
