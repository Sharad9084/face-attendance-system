/* ============================================
   Face Recognition Module — face-api.js Integration
   ============================================ */

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

class FaceRecognition {
  constructor() {
    this.isModelLoaded = false;
    this.labeledDescriptors = [];
    this.faceMatcher = null;
    this.detectionInterval = null;
    this.isProcessing = false;
    this.confidenceThreshold = 0.6; // 60% default
  }

  async loadModels(onProgress) {
    try {
      if (onProgress) onProgress('Loading face detection model...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

      if (onProgress) onProgress('Loading face landmark model...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

      if (onProgress) onProgress('Loading face recognition model...');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      if (onProgress) onProgress('Loading face expression model...');
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);

      this.isModelLoaded = true;
      console.log('✅ All face-api.js models loaded');
      return true;
    } catch (error) {
      console.error('❌ Error loading models:', error);
      throw new Error('Failed to load face recognition models. Check internet connection.');
    }
  }

  async detectFace(videoElement) {
    if (!this.isModelLoaded || !videoElement) return null;

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5
    });

    const detection = await faceapi.detectSingleFace(videoElement, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection;
  }

  async detectAllFaces(videoElement) {
    if (!this.isModelLoaded || !videoElement) return [];

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5
    });

    const detections = await faceapi.detectAllFaces(videoElement, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections;
  }

  async extractDescriptor(videoElement) {
    const detection = await this.detectFace(videoElement);
    if (!detection) return null;
    return detection.descriptor;
  }

  async loadRegisteredFaces() {
    const users = await db.getAllUsers();
    this.labeledDescriptors = [];

    for (const user of users) {
      if (user.descriptors && user.descriptors.length > 0) {
        const descriptors = user.descriptors.map(d =>
          d instanceof Float32Array ? d : new Float32Array(d)
        );
        this.labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(user.id, descriptors)
        );
      }
    }

    if (this.labeledDescriptors.length > 0) {
      this.faceMatcher = new faceapi.FaceMatcher(
        this.labeledDescriptors,
        this.confidenceThreshold
      );
    } else {
      this.faceMatcher = null;
    }

    console.log(`📋 Loaded ${this.labeledDescriptors.length} registered faces`);
  }

  recognizeFace(descriptor) {
    if (!this.faceMatcher) return null;

    const result = this.faceMatcher.findBestMatch(descriptor);

    if (result.label === 'unknown') {
      return { matched: false, label: 'unknown', distance: result.distance };
    }

    return {
      matched: true,
      label: result.label, // This is the user ID
      distance: result.distance,
      confidence: Math.round((1 - result.distance) * 100)
    };
  }

  startContinuousDetection(videoElement, canvasElement, onRecognition) {
    if (this.detectionInterval) {
      this.stopContinuousDetection();
    }

    const canvas = canvasElement;
    const displaySize = {
      width: videoElement.videoWidth || 640,
      height: videoElement.videoHeight || 480
    };

    // Match canvas size to video
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;

    this.detectionInterval = setInterval(async () => {
      if (this.isProcessing || !camera.isRunning) return;
      this.isProcessing = true;

      try {
        const detections = await this.detectAllFaces(videoElement);
        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        // Clear and draw
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Scale canvas CSS to match video display
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        for (const detection of resizedDetections) {
          const box = detection.detection.box;
          const result = this.recognizeFace(detection.descriptor);

          // Draw box
          ctx.strokeStyle = result && result.matched ? '#10b981' : '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(box.x, box.y, box.width, box.height);

          // Draw label background
          const label = result && result.matched ? `${result.confidence}%` : 'Unknown';
          ctx.font = 'bold 14px Inter, sans-serif';
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = result && result.matched ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
          ctx.fillRect(box.x, box.y - 28, textWidth + 16, 26);

          // Draw label text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, box.x + 8, box.y - 10);

          // Trigger callback
          if (onRecognition) {
            onRecognition(result, detection);
          }
        }

        if (detections.length === 0) {
          if (onRecognition) {
            onRecognition(null, null);
          }
        }
      } catch (error) {
        console.error('Detection error:', error);
      }

      this.isProcessing = false;
    }, 500); // Run every 500ms
  }

  stopContinuousDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    this.isProcessing = false;
  }

  setConfidenceThreshold(value) {
    this.confidenceThreshold = value;
    // Rebuild matcher with new threshold
    if (this.labeledDescriptors.length > 0) {
      this.faceMatcher = new faceapi.FaceMatcher(
        this.labeledDescriptors,
        this.confidenceThreshold
      );
    }
  }
}

// Global instance
const faceRecognition = new FaceRecognition();
