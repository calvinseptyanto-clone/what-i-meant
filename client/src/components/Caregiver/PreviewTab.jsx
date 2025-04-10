import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowLeft } from "lucide-react";
import VideoPlayer from "./VideoPlayer";

const PreviewTab = ({ categorizedData }) => {
  const [currentView, setCurrentView] = useState("categories");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Organized data structure
  const [organizedData, setOrganizedData] = useState({});

  useEffect(() => {
    // Process data when it's available
    if (
      categorizedData &&
      categorizedData.items &&
      categorizedData.items.length > 0
    ) {
      const processed = {};

      // Process categories/subcategories/items
      categorizedData.items.forEach((item) => {
        if (!processed[item.category]) {
          processed[item.category] = {};
        }

        if (!processed[item.category][item.subcategory]) {
          processed[item.category][item.subcategory] = [];
        }

        processed[item.category][item.subcategory].push(item);
      });

      setOrganizedData(processed);
    }
  }, [categorizedData]);

  const handleBack = () => {
    if (currentView === "subcategories") {
      setCurrentView("categories");
      setSelectedCategory(null);
    } else if (currentView === "items") {
      setCurrentView("subcategories");
      setSelectedSubcategory(null);
    } else if (currentView === "actions") {
      setCurrentView("items");
      setSelectedItem(null);
    }
  };

  // Get the video URL for a specific item and action
  const getVideoUrl = (itemName, action) => {
    if (!categorizedData || !categorizedData.videos) return null;

    const videoKey = `${itemName}-${action}`;
    const videoFilename = categorizedData.videos[videoKey];

    if (videoFilename) {
      return `http://127.0.0.1:5000/api/videos/${videoFilename}`;
    }

    return null;
  };

  // Get the image URL for a category, subcategory, or item
  const getImageUrl = (type, name, subcategory = null) => {
    if (!categorizedData || !categorizedData.images) return null;

    let imageKey;
    if (type === "category") {
      imageKey = `category-${name}`;
    } else if (type === "subcategory") {
      imageKey = `subcategory-${selectedCategory}-${name}`;
    } else if (type === "item") {
      imageKey = `item-${name}`;
    }

    const imageFilename = categorizedData.images[imageKey];

    if (imageFilename) {
      return `http://127.0.0.1:5000/api/images/${imageFilename}`;
    }

    return null;
  };

  const renderContent = () => {
    if (
      !categorizedData ||
      !categorizedData.items ||
      categorizedData.items.length === 0
    ) {
      return (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            No data available. Please create categories first.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => document.querySelector('[value="create"]').click()}
          >
            Go to Create Tab
          </Button>
        </div>
      );
    }

    if (Object.keys(organizedData).length === 0) {
      return (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Processing data...</p>
        </div>
      );
    }

    switch (currentView) {
      case "categories":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(organizedData).map((category) => (
              <Card
                key={category}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentView("subcategories");
                }}
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={getImageUrl("category", category)}
                    alt={category}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src =
                        "https://placehold.co/400x400/e5e7eb/a1a1aa?text=" +
                        category;
                    }}
                  />
                </div>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span className="capitalize">{category}</span>
                    <ChevronRight className="h-5 w-5" />
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        );
      case "subcategories":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(organizedData[selectedCategory]).map((subcategory) => (
              <Card
                key={subcategory}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  setSelectedSubcategory(subcategory);
                  setCurrentView("items");
                }}
              >
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={getImageUrl("subcategory", subcategory)}
                    alt={subcategory}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src =
                        "https://placehold.co/400x400/e5e7eb/a1a1aa?text=" +
                        subcategory;
                    }}
                  />
                </div>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span className="capitalize">{subcategory}</span>
                    <ChevronRight className="h-5 w-5" />
                  </CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
        );
      case "items":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizedData[selectedCategory][selectedSubcategory].map(
              (item) => (
                <Card
                  key={item.name}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedItem(item);
                    setCurrentView("actions");
                  }}
                >
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={getImageUrl("item", item.name)}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src =
                          "https://placehold.co/400x400/e5e7eb/a1a1aa?text=" +
                          item.name;
                      }}
                    />
                  </div>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span className="capitalize">{item.name}</span>
                      <ChevronRight className="h-5 w-5" />
                    </CardTitle>
                  </CardHeader>
                </Card>
              )
            )}
          </div>
        );
      case "actions":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {selectedItem.requests.map((action) => {
              const videoUrl = getVideoUrl(selectedItem.name, action);

              return (
                <Card key={action} className="overflow-hidden">
                  <div className="aspect-video w-full">
                    <VideoPlayer videoUrl={videoUrl} />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-lg capitalize">{action}</h3>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {currentView !== "categories" && (
        <Button onClick={handleBack} variant="outline" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentView === "categories"
              ? "Categories"
              : currentView === "subcategories"
              ? `${selectedCategory} - Subcategories`
              : currentView === "items"
              ? `${selectedSubcategory} - Items`
              : `${selectedItem.name} - Actions`}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
};

export default PreviewTab;
