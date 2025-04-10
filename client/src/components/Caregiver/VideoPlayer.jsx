import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

const VideoPlayer = ({ videoKey }) => {
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset state when video key changes
    setIsLoading(true);
    setError(null);

    const fetchVideoUrl = async () => {
      if (!videoKey) {
        setIsLoading(false);
        return;
      }

      try {
        // Extract filename from the OSS path (videos/filename.mp4)
        const filename = videoKey.split("/").pop();

        // Fetch the signed URL from the backend API
        const response = await fetch(`/api/videos/${filename}`);

        if (!response.ok) {
          throw new Error("Failed to fetch video URL");
        }

        const data = await response.json();

        if (data.url) {
          setVideoUrl(data.url);
        } else {
          throw new Error("Invalid video URL received");
        }
      } catch (err) {
        console.error("Error fetching video:", err);
        setError("Failed to load video");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoUrl();
  }, [videoKey]);

  // Handle video load events
  const handleVideoLoaded = () => {
    setIsLoading(false);
  };

  const handleVideoError = () => {
    setError("Error playing video");
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
        <p className="text-sm">No video available</p>
      </div>
    );
  }
  if (!videoUrl && !error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className="w-full h-full object-cover"
      onLoadedData={handleVideoLoaded}
      onError={handleVideoError}
    >
      <source src={videoUrl} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
};

export default VideoPlayer;
