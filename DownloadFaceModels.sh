#!/bin/bash

# Script to download face-api.js models
# Run this in your project root directory

echo "Creating models directory..."
mkdir -p public/models

cd public/models

echo "Downloading SsdMobilenetv1 model (PRIMARY - more accurate)..."
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard2

echo "Downloading TinyFaceDetector model (BACKUP - faster)..."
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/tiny_face_detector_model-shard1

echo "Downloading FaceLandmark68Net model..."
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1

echo "Downloading FaceRecognitionNet model..."
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2

cd ../..

echo ""
echo "✅ Models downloaded successfully!"
echo "Models are now in: public/models/"
echo ""
echo "Files downloaded:"
ls -lh public/models/
echo ""
echo "You should see:"
echo "  - ssd_mobilenetv1_model-weights_manifest.json"
echo "  - ssd_mobilenetv1_model-shard1"
echo "  - ssd_mobilenetv1_model-shard2"
echo "  - tiny_face_detector_model-weights_manifest.json"
echo "  - tiny_face_detector_model-shard1"
echo "  - face_landmark_68_model-weights_manifest.json"
echo "  - face_landmark_68_model-shard1"
echo "  - face_recognition_model-weights_manifest.json"
echo "  - face_recognition_model-shard1"
echo "  - face_recognition_model-shard2"
echo ""
echo "Total: 10 files"