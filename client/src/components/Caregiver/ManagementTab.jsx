import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  Loader2,
} from "lucide-react";
import VideoPlayer from "./VideoPlayer";
import { useToast } from "@/components/ui/use-toast";

// Title case function
function toTitleCase(str) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const ManagementTab = ({ categorizedData }) => {
  const [currentView, setCurrentView] = useState("categories");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [showAddActionModal, setShowAddActionModal] = useState(false);
  const audioRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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

      // Add media mappings from the categorizedData
      if (categorizedData.images) {
        processed.images = categorizedData.images;
      }

      if (categorizedData.videos) {
        processed.videos = categorizedData.videos;
      }

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

    // Stop any playing audio and release resources
    stopAudio();
  };

  const playAudio = async (name) => {
    // Stop current audio if playing
    stopAudio();

    // If we're clicking on the same item that's playing, just stop
    if (playing === name) {
      setPlaying(null);
      return;
    }

    try {
      // Request audio URL from backend
      const response = await fetch(`/api/audio/${name.replace(/ /g, "_")}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio for ${name}`);
      }

      const data = await response.json();

      if (!data.url) {
        toast({
          title: "Audio Unavailable",
          description: `No audio available for ${name}`,
          variant: "destructive",
        });
        return;
      }

      // Create a new audio element and play it
      audioRef.current = new Audio(data.url);

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
          toast({
            title: "Playback Error",
            description: "Could not play audio. Please try again.",
            variant: "destructive",
          });
        });
    } catch (error) {
      console.error(`Error fetching audio for ${name}:`, error);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Remove the audio element to free up resources
      audioRef.current = null;
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
    // Check for data availability
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
          <p className="text-muted-foreground">
            Processing data from MongoDB...
          </p>
        </div>
      );
    }

    switch (currentView) {
      case "categories":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(organizedData).map((category) => {
              // Skip non-category keys (like 'images' and 'videos')
              if (category === "images" || category === "videos") return null;

              return (
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
                    {/* Fetch image from the backend OSS storage */}
                    {organizedData.images &&
                    organizedData.images[`category-${category}`] ? (
                      <img
                        src={`/api/images/${organizedData.images[
                          `category-${category}`
                        ]
                          .split("/")
                          .pop()}`}
                        alt={category}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          e.target.onerror = null;
                          e.target.src =
                            "/placeholders/category_placeholder.png";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary/70 capitalize">
                          {category}
                        </span>
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span className="capitalize">
                        {toTitleCase(category)}
                      </span>
                      <ChevronRight className="h-5 w-5" />
                    </CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
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
                  {/* Fetch subcategory image from OSS storage */}
                  {organizedData.images &&
                  organizedData.images[
                    `subcategory-${selectedCategory}-${subcategory}`
                  ] ? (
                    <img
                      src={`/api/images/${organizedData.images[
                        `subcategory-${selectedCategory}-${subcategory}`
                      ]
                        .split("/")
                        .pop()}`}
                      alt={subcategory}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder on error
                        e.target.onerror = null;
                        e.target.src =
                          "/placeholders/subcategory_placeholder.png";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary/70 capitalize">
                        {subcategory}
                      </span>
                    </div>
                  )}
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
                    {/* Fetch item image from OSS storage */}
                    {organizedData.images &&
                    organizedData.images[`item-${item.name}`] ? (
                      <img
                        src={`/api/images/${organizedData.images[
                          `item-${item.name}`
                        ]
                          .split("/")
                          .pop()}`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder on error
                          e.target.onerror = null;
                          e.target.src = "/placeholders/item_placeholder.png";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary/70 capitalize">
                          {item.name}
                        </span>
                      </div>
                    )}
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
                // Get video key from data structure
                const videoKey = `${selectedItem.name}-${action}`;
                // Get OSS path from videos mapping
                const videoPath =
                  organizedData.videos && organizedData.videos[videoKey];
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
                      {/* Pass the OSS path to VideoPlayer instead of direct video URL */}
                      {videoPath ? (
                        <VideoPlayer videoKey={videoPath} />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                          <p className="text-gray-400">Video not available</p>
                        </div>
                      )}
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
                      <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
                      <p className="text-gray-600">
                        Generating video with Wan2.1 I2V model...
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
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

                          try {
                            // Send request to generate new action video
                            const response = await fetch(
                              "/api/generate-action-video",
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                  itemName: selectedItem.name,
                                  action: actionName,
                                }),
                              }
                            );

                            if (!response.ok) {
                              throw new Error("Failed to generate video");
                            }

                            const result = await response.json();

                            // Add new action to the item's requests
                            const newRequests = [
                              ...selectedItem.requests,
                              actionName,
                            ];

                            // Update the item in MongoDB
                            await fetch("/api/update-item-requests", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                itemName: selectedItem.name,
                                requests: newRequests,
                                videoPath: result.videoPath,
                              }),
                            });

                            // Update local state
                            selectedItem.requests = newRequests;

                            // Update the videos mapping with the new video path
                            if (organizedData.videos) {
                              organizedData.videos[
                                `${selectedItem.name}-${actionName}`
                              ] = result.videoPath;
                            }

                            // Close modal
                            setShowAddActionModal(false);

                            toast({
                              title: "Action Added",
                              description: `Successfully added "${actionName}" to ${selectedItem.name}`,
                              variant: "default",
                            });

                            // Force a re-render
                            setSelectedActions([...selectedActions]);
                          } catch (error) {
                            console.error("Failed to add action:", error);
                            toast({
                              title: "Error",
                              description:
                                "Failed to add new action. Please try again.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsSubmitting(false);
                          }
                        } else {
                          // If no valid action, close immediately
                          setShowAddActionModal(false);

                          if (selectedItem.requests.includes(actionName)) {
                            toast({
                              title: "Action Exists",
                              description: `"${actionName}" already exists for this item`,
                              variant: "destructive",
                            });
                          }
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
                            setShowAddActionModal(false);
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

export default ManagementTab;
