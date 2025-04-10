import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
} from "lucide-react";
import VideoPlayer from "./VideoPlayer";

// Import all images
import foodAndDrinksImage from "@/assets/food_and_drinks.png";
import personalCareImage from "@/assets/personal_care.png";
import beveragesImage from "@/assets/beverages.png";
import bakedGoodsImage from "@/assets/baked_goods.png";
import oralHygieneImage from "@/assets/oral_hygiene.png";
import waterImage from "@/assets/water.png";
import teaImage from "@/assets/tea.png";
import breadImage from "@/assets/bread.png";
import toothbrushImage from "@/assets/toothbrush.png";
import clothingImage from "@/assets/clothing.png";
import footwearImage from "@/assets/footwear.png";
import shoesImage from "@/assets/shoes.png";

// Import all videos
import spreadButterBreadVideo from "@/assets/bread/spread_butter_bread.mp4";
import toastBreadVideo from "@/assets/bread/toast_bread.mp4";
import spreadJamBreadVideo from "@/assets/bread/spread_jam_bread.mp4";
import addSugarTeaVideo from "@/assets/tea/add_sugar_tea.mp4";
import addCreamerTeaVideo from "@/assets/tea/add_creamer_tea.mp4";
import needsHeatingTeaVideo from "@/assets/tea/needs_heating_tea.mp4";
import needRefillWaterVideo from "@/assets/water/need_refill_water.mp4";
import makeWarmerWaterVideo from "@/assets/water/make_warmer_water.mp4";
import addIceWaterVideo from "@/assets/water/add_ice_water.mp4";
import needNewToothbrushVideo from "@/assets/toothbrush/need_new_toothbrush.mp4";
import addToothpasteToothbrushVideo from "@/assets/toothbrush/add_toothpaste_toothbrush.mp4";
import helpWithBrushingToothbrushVideo from "@/assets/toothbrush/help_with_brushing_toothbrush.mp4";

// Import audio files
import breadAudio from "@/assets/audio/bread.mp3";
import teaAudio from "@/assets/audio/tea.mp3";
import waterAudio from "@/assets/audio/water.mp3";
import toothbrushAudio from "@/assets/audio/toothbrush.mp3";
import foodAndDrinksAudio from "@/assets/audio/food_and_drinks.mp3";
import personalCareAudio from "@/assets/audio/personal_care.mp3";
import beveragesAudio from "@/assets/audio/beverages.mp3";
import bakedGoodsAudio from "@/assets/audio/baked_goods.mp3";
import oralHygieneAudio from "@/assets/audio/oral_hygiene.mp3";

// Create mappings for images and videos
const CATEGORY_IMAGES = {
  "food and drinks": foodAndDrinksImage,
  "personal care": personalCareImage,
  clothing: clothingImage,
};

const SUBCATEGORY_IMAGES = {
  "food and drinks": {
    beverages: beveragesImage,
    "baked goods": bakedGoodsImage,
  },
  "personal care": {
    "oral hygiene": oralHygieneImage,
  },
  clothing: {
    footwear: footwearImage,
  },
};

const ITEM_IMAGES = {
  water: waterImage,
  tea: teaImage,
  bread: breadImage,
  toothbrush: toothbrushImage,
  shoes: shoesImage,
};

const VIDEOS = {
  bread: {
    "spread butter": spreadButterBreadVideo,
    "make toast": toastBreadVideo,
    "spread jam": spreadJamBreadVideo,
  },
  tea: {
    "add sugar": addSugarTeaVideo,
    "add creamer": addCreamerTeaVideo,
    "needs heating": needsHeatingTeaVideo,
  },
  water: {
    "need refill": needRefillWaterVideo,
    "make warmer": makeWarmerWaterVideo,
    "add ice": addIceWaterVideo,
  },
  toothbrush: {
    "need new one": needNewToothbrushVideo,
    "add toothpaste": addToothpasteToothbrushVideo,
    "help with brushing": helpWithBrushingToothbrushVideo,
  },
};

// Audio mapping
const AUDIO_FILES = {
  // Categories
  "food and drinks": foodAndDrinksAudio,
  "personal care": personalCareAudio,

  // Subcategories
  beverages: beveragesAudio,
  "baked goods": bakedGoodsAudio,
  "oral hygiene": oralHygieneAudio,

  // Items
  bread: breadAudio,
  tea: teaAudio,
  water: waterAudio,
  toothbrush: toothbrushAudio,
};
// Title case function
function toTitleCase(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const PreviewTab = ({ categorizedData }) => {
  const [currentView, setCurrentView] = useState("categories");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const audioRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Reset selected actions when changing item
  useEffect(() => {
    setSelectedActions([]);
  }, [selectedItem]);

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
      setSelectedActions([]);
    }

    // Stop any playing audio
    stopAudio();
  };

  const playAudio = (name) => {
    // Stop current audio if playing
    stopAudio();

    // If we're clicking on the same item that's playing, just stop
    if (playing === name) {
      setPlaying(null);
      return;
    }

    // Get audio file from our mapping
    const audioFile = AUDIO_FILES[name];

    if (!audioFile) {
      console.warn(`No audio file found for: ${name}`);
      return;
    }

    // Create a new audio element and play it
    audioRef.current = new Audio(audioFile);

    audioRef.current.addEventListener("ended", () => {
      setPlaying(null);
    });

    audioRef.current
      .play()
      .then(() => {
        setPlaying(name);
      })
      .catch((error) => {
        console.error("Error playing audio:", error);
      });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(null);
  };

  const toggleActionSelection = (action) => {
    if (selectedActions.includes(action)) {
      setSelectedActions(selectedActions.filter((a) => a !== action));
    } else {
      setSelectedActions([...selectedActions, action]);
    }
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
                className="cursor-pointer hover:shadow-md transition-shadow relative"
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentView("subcategories");
                }}
              >
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                    </svg>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(category);
                    }}
                  >
                    {playing === category ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={CATEGORY_IMAGES[category]}
                    alt={category}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span className="capitalize">{toTitleCase(category)}</span>
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
                className="cursor-pointer hover:shadow-md transition-shadow relative"
                onClick={() => {
                  setSelectedSubcategory(subcategory);
                  setCurrentView("items");
                }}
              >
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                    </svg>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="rounded-full bg-white/80 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      playAudio(subcategory);
                    }}
                  >
                    {playing === subcategory ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="aspect-square w-full overflow-hidden">
                  <img
                    src={SUBCATEGORY_IMAGES[selectedCategory][subcategory]}
                    alt={subcategory}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span className="capitalize">
                      {toTitleCase(subcategory)}
                    </span>
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
                  className="cursor-pointer hover:shadow-md transition-shadow relative"
                  onClick={() => {
                    setSelectedItem(item);
                    setCurrentView("actions");
                  }}
                >
                  <div className="absolute top-2 right-2 z-10">
                    {/* Remove button */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                      </svg>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-full bg-white/80 hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        playAudio(item.name);
                      }}
                    >
                      {playing === item.name ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={ITEM_IMAGES[item.name]}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span className="capitalize">
                        {toTitleCase(item.name)}
                      </span>
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
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedItem.requests.map((action) => {
                const videoSrc = VIDEOS[selectedItem.name][action];
                const isSelected = selectedActions.includes(action);

                return (
                  <Card
                    key={action}
                    className={`overflow-hidden relative cursor-pointer transition-all ${
                      isSelected
                        ? "ring-2 ring-black shadow-lg transform scale-[1.02]"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => toggleActionSelection(action)}
                  >
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      {/* Remove button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                        </svg>
                      </Button>

                      {isSelected && (
                        <div className="bg-black text-white rounded-full p-1">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="aspect-video w-full">
                      <VideoPlayer videoUrl={videoSrc} />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-lg capitalize">
                        {toTitleCase(action)}
                      </h3>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Action Card */}
              <Card
                className="overflow-hidden relative cursor-pointer border-dashed border-2 hover:shadow-md flex flex-col items-center justify-center min-h-[300px]"
                onClick={() => {
                  // Show modal for adding new action
                  setShowAddActionModal(true);
                }}
              >
                <div className="text-4xl text-gray-400 mb-2">+</div>
                <h3 className="font-medium text-lg text-gray-500">
                  Add Action
                </h3>
              </Card>
            </div>

            {/* Add Action Modal */}
            {showAddActionModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4">Add New Action</h2>
                  {isSubmitting ? (
                    <div className="py-8 flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
                      <p className="text-gray-600">
                        Processing your request...
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();

                        // Get the action name from the form input
                        const actionNameInput =
                          document.getElementById("action-name");
                        const actionName = actionNameInput.value.trim();

                        // Only proceed if action name is provided and not already in requests
                        if (
                          actionName &&
                          !selectedItem.requests.includes(actionName)
                        ) {
                          // Show loading state
                          setIsSubmitting(true);

                          const newRequests = [
                            ...selectedItem.requests,
                            actionName,
                          ];

                          // Update the item in the data
                          selectedItem.requests = newRequests;

                          // Set a timeout for closing and processing
                          setTimeout(() => {
                            // Close modal after 2 seconds
                            setShowAddActionModal(false);
                            setIsSubmitting(false);

                            // Add the corresponding video to our VIDEOS mapping
                            if (selectedItem.name === "bread") {
                              // Convert spaces to underscores for the filename
                              const videoFileName = actionName.replace(
                                /\s+/g,
                                "_"
                              );

                              // Use dynamic import for the video
                              import(
                                `@/assets/bread/${videoFileName}_bread.mp4`
                              )
                                .then((videoModule) => {
                                  // Update the VIDEOS mapping with the imported video
                                  if (!VIDEOS.bread) {
                                    VIDEOS.bread = {};
                                  }
                                  VIDEOS.bread[actionName] =
                                    videoModule.default;

                                  // Force a re-render
                                  setSelectedActions([...selectedActions]);
                                })
                                .catch((error) => {
                                  console.error(
                                    `Failed to load video for action "${actionName}":`,
                                    error
                                  );
                                  // Still update the UI even if video loading fails
                                  setSelectedActions([...selectedActions]);
                                });
                            } else {
                              // If not a bread item, just update the UI
                              setSelectedActions([...selectedActions]);
                            }
                          }, 2000); // 2 seconds delay
                        } else {
                          // If no valid action, close immediately
                          setShowAddActionModal(false);
                        }
                      }}
                    >
                      <div className="mb-4">
                        <label
                          className="block text-sm font-medium mb-1"
                          htmlFor="action-name"
                        >
                          Action Name
                        </label>
                        <input
                          id="action-name"
                          type="text"
                          className="w-full p-2 border rounded"
                          placeholder="e.g., cut half"
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            // Show loading for cancel too
                            setIsSubmitting(true);
                            setTimeout(() => {
                              setShowAddActionModal(false);
                              setIsSubmitting(false);
                            }, 2000);
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          Add Action
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
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
              ? `${toTitleCase(selectedCategory)} - Subcategories`
              : currentView === "items"
              ? `${toTitleCase(selectedSubcategory)} - Items`
              : `${toTitleCase(selectedItem.name)} - Actions`}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderContent()}</CardContent>
      </Card>
    </div>
  );
};

export default PreviewTab;
