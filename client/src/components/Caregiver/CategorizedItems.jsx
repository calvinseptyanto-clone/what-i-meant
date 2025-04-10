import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const CategorizedItems = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="w-full flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading categorized items...</span>
      </div>
    );
  }

  if (!data || !data.items || data.items.length === 0) {
    return (
      <Card className="w-full mt-6">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <p className="text-gray-500">No items have been categorized yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Group items by category
  const categorizedItems = data.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {};
    }

    if (!acc[item.category][item.subcategory]) {
      acc[item.category][item.subcategory] = [];
    }

    acc[item.category][item.subcategory].push(item);
    return acc;
  }, {});

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle className="text-2xl">Categorized Items</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="multiple" collapsible className="w-full">
          {Object.entries(categorizedItems).map(
            ([category, subcategories], idx) => (
              <AccordionItem value={`category-${idx}`} key={idx}>
                <AccordionTrigger className="text-lg font-medium py-4 hover:no-underline">
                  <div className="flex items-center">
                    <div className="w-12 h-12 mr-3 rounded-md overflow-hidden">
                      <CategoryImage category={category} images={data.images} />
                    </div>
                    <span className="capitalize">{category}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-4 space-y-4">
                    {Object.entries(subcategories).map(
                      ([subcategory, items], subIdx) => (
                        <div key={subIdx} className="mt-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 mr-2 rounded-md overflow-hidden">
                              <SubcategoryImage
                                category={category}
                                subcategory={subcategory}
                                images={data.images}
                              />
                            </div>
                            <h4 className="text-md font-medium capitalize text-gray-600 mb-2">
                              {subcategory}
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                            {items.map((item, itemIdx) => (
                              <ItemCard
                                key={itemIdx}
                                item={item}
                                images={data.images}
                                videos={data.videos}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};

const CategoryImage = ({ category, images }) => {
  const imageKey = `category-${category}`;
  const imagePath = images && images[imageKey];

  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (imagePath) {
      // Convert OSS path to signed URL
      fetch(`/api/images/${imagePath.split("/").pop()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setImageUrl(data.url);
          }
        })
        .catch((err) => {
          console.error("Error fetching image URL:", err);
          setError(true);
        });
    }
  }, [imagePath]);

  if (error || !imageUrl) {
    return (
      <div className="bg-primary/20 w-full h-full flex items-center justify-center">
        <span className="text-xs text-primary/70 capitalize">{category}</span>
      </div>
    );
  }

  return (
    <img src={imageUrl} alt={category} className="w-full h-full object-cover" />
  );
};

const SubcategoryImage = ({ category, subcategory, images }) => {
  const imageKey = `subcategory-${category}-${subcategory}`;
  const imagePath = images && images[imageKey];

  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (imagePath) {
      // Convert OSS path to signed URL
      fetch(`/api/images/${imagePath.split("/").pop()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setImageUrl(data.url);
          }
        })
        .catch((err) => {
          console.error("Error fetching subcategory image URL:", err);
          setError(true);
        });
    }
  }, [imagePath]);

  if (error || !imageUrl) {
    return (
      <div className="bg-primary/10 w-full h-full flex items-center justify-center">
        <span className="text-xs text-primary/70 capitalize">
          {subcategory}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={subcategory}
      className="w-full h-full object-cover"
    />
  );
};

const ItemCard = ({ item, images, videos }) => {
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [itemImageUrl, setItemImageUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Fetch item image
  useEffect(() => {
    const imageKey = `item-${item.name}`;
    const imagePath = images && images[imageKey];

    if (imagePath) {
      fetch(`/api/images/${imagePath.split("/").pop()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setItemImageUrl(data.url);
          }
        })
        .catch((err) => {
          console.error("Error fetching item image URL:", err);
        });
    }
  }, [item.name, images]);

  // Fetch video when a request is selected
  useEffect(() => {
    if (activeVideo) {
      setLoadingVideo(true);
      const videoKey = `${item.name}-${activeVideo}`;
      const videoPath = videos && videos[videoKey];

      if (videoPath) {
        fetch(`/api/videos/${videoPath.split("/").pop()}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.url) {
              setVideoUrl(data.url);
            }
          })
          .catch((err) => {
            console.error("Error fetching video URL:", err);
            toast({
              title: "Video Error",
              description: "Could not load the requested video",
              variant: "destructive",
            });
          })
          .finally(() => {
            setLoadingVideo(false);
          });
      } else {
        setLoadingVideo(false);
        toast({
          title: "Video Not Available",
          description: "This request doesn't have an associated video yet",
          variant: "default",
        });
      }
    }
  }, [activeVideo, videos, item.name]);

  const toggleRequest = (request) => {
    if (selectedRequests.includes(request)) {
      setSelectedRequests((prev) => prev.filter((r) => r !== request));
      if (activeVideo === request) {
        setActiveVideo(null);
        setVideoUrl(null);
      }
    } else {
      setSelectedRequests((prev) => [...prev, request]);
      setActiveVideo(request);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-36 overflow-hidden relative">
        {loadingVideo && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {videoUrl && activeVideo ? (
          <video
            src={videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            controls
            loop
          />
        ) : itemImageUrl ? (
          <img
            src={itemImageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="bg-primary/10 w-full h-full flex items-center justify-center">
            <span className="text-lg font-medium capitalize">{item.name}</span>
          </div>
        )}
      </div>

      <div className="bg-primary/10 p-4">
        <h3 className="text-lg font-semibold capitalize">{item.name}</h3>
        <Badge variant="outline" className="mt-1">
          {item.subcategory}
        </Badge>
      </div>

      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-2">Common Requests:</h4>
        <ul className="space-y-2">
          {item.requests.map((request, idx) => (
            <li
              key={idx}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                selectedRequests.includes(request)
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => toggleRequest(request)}
            >
              {selectedRequests.includes(request) && (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              <span
                className={
                  selectedRequests.includes(request) ? "font-medium" : ""
                }
              >
                {request.charAt(0).toUpperCase() + request.slice(1)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default CategorizedItems;
