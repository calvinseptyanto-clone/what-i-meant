import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const CreateTab = ({ onAddItem }) => {
  const [activeTab, setActiveTab] = useState("camera");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObject, setDetectedObject] = useState(null);
  const [processingComplete, setProcessingComplete] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const { toast } = useToast();

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError(
        "Could not access camera. Please check permissions or try uploading an image instead."
      );
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Handle tab change
  const handleTabChange = (value) => {
    setActiveTab(value);

    if (value === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-capture.jpg", {
          type: "image/jpeg",
        });
        handleImageSelected(file);
      }
    }, "image/jpeg");
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelected(file);
    }
  };

  // Process the selected image
  const handleImageSelected = (file) => {
    setImage(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Reset states
    setDetectedObject(null);
    setProcessingComplete(false);
    setProcessingStage(null);
    setError(null);
  };

  // Process the image with the backend
  const processImage = async () => {
    setIsProcessing(true);
    setProcessingStage("detecting");

    try {
      // Create form data to send the image
      const formData = new FormData();
      formData.append("image", image);

      // Call the object detection endpoint using Qwen-VL
      const response = await fetch("/api/detect-object", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to detect object in image");
      }

      const data = await response.json();
      const detectedItem = data.detected_item;

      setDetectedObject(detectedItem);
      setProcessingStage("categorizing");

      // Now, add the detected item to our categorization system
      const categorizationResponse = await fetch("/api/categorize-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: detectedItem,
        }),
      });

      if (!categorizationResponse.ok) {
        throw new Error("Failed to categorize item");
      }

      // Update processing stage for generating media
      setProcessingStage("generating");

      // Simulate the time it takes to generate images and videos with Wan2.1 models
      setTimeout(() => {
        setProcessingComplete(true);
        setIsProcessing(false);

        // Call the parent callback with the categorized item
        if (onAddItem) {
          onAddItem(detectedItem);
        }

        toast({
          title: "Item Added Successfully",
          description: `${detectedItem} has been detected, categorized, and all media has been generated.`,
          variant: "default",
        });
      }, 4000); // Simulating the time it takes for Wan2.1 to generate media
    } catch (err) {
      console.error("Error processing image:", err);
      setError(`Failed to process image: ${err.message}`);
      setIsProcessing(false);
    }
  };

  // Reset the form
  const handleReset = () => {
    setImage(null);
    setImagePreview(null);
    setDetectedObject(null);
    setProcessingComplete(false);
    setProcessingStage(null);
    setError(null);

    if (activeTab === "camera") {
      startCamera();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add New Item</CardTitle>
          <CardDescription>
            Take a photo or upload an image to add a new item
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!image ? (
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="camera">Take Photo</TabsTrigger>
                <TabsTrigger value="upload">Upload Image</TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="space-y-4">
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    onPlay={() => {
                      if (!streamRef.current) {
                        startCamera();
                      }
                    }}
                  />
                </div>
                <Button className="w-full" size="lg" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photo
                </Button>
                <canvas ref={canvasRef} style={{ display: "none" }} />
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-4 text-sm text-gray-600">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG or GIF up to 10MB
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <div className="space-y-4">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                </div>

                {!detectedObject && !isProcessing && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleReset}>
                      Try Another
                    </Button>
                    <Button onClick={processImage}>Process Image</Button>
                  </div>
                )}

                {isProcessing && (
                  <div className="text-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-2 text-gray-600">
                      {processingStage === "detecting" &&
                        "Analyzing image with Qwen-VL..."}
                      {processingStage === "categorizing" &&
                        "Categorizing with Qwen Max..."}
                      {processingStage === "generating" &&
                        "Generating media with Wan2.1 models..."}
                      {!processingStage && "Processing..."}
                    </p>
                  </div>
                )}

                {detectedObject && !processingComplete && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Object Detected</AlertTitle>
                    <AlertDescription>
                      We have detected an image of {detectedObject}. Our AI is
                      now generating categories with Qwen Max and creating media
                      assets with Wan2.1 models.
                    </AlertDescription>
                  </Alert>
                )}

                {processingComplete && (
                  <Alert className="bg-green-50 text-green-800 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Processing Complete</AlertTitle>
                    <AlertDescription>
                      Item has been added to MongoDB and all media assets have
                      been generated and stored in OSS. You can view{" "}
                      {detectedObject} in the Management tab.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {detectedObject && processingComplete && (
                <div className="flex justify-end mt-4">
                  <Button onClick={handleReset}>Add Another Item</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default CreateTab;
