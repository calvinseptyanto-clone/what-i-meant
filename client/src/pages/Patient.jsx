import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PatientCreateTab from "@/components/Patient/CreateTab";
import PreviewTab from "@/components/Patient/PreviewTab";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Patient() {
  const [categorizedData, setCategorizedData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data from MongoDB via Flask backend on component mount
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/stored-data");

        if (!response.ok) {
          throw new Error("Failed to fetch data from server");
        }

        const data = await response.json();
        setCategorizedData(data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(
          "Failed to load items. Please check your connection and try again."
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoredData();
  }, []);

  const handleAddItem = async (itemName) => {
    try {
      // Send request to categorize the new item
      const response = await fetch("/api/categorize-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: itemName }),
      });

      if (!response.ok) {
        throw new Error("Failed to add new item");
      }

      // Get the updated data with the new item
      const updatedData = await response.json();

      // Update state with the new data
      setCategorizedData(updatedData);

      console.log(`${itemName} added to the system`);
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <img src="src/assets/logo.png" alt="Logo" className="h-12 w-auto" />
          </div>

          <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h2 className="text-lg font-medium text-blue-800">
              Zhe Ming's View
            </h2>
            <p className="text-sm text-blue-600">
              Touch the items to show what you need. You can also add new items
              that are important to you.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Loading your items from database...
            </p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="preview">My Items</TabsTrigger>
              <TabsTrigger value="add">Add New</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <PreviewTab categorizedData={categorizedData} />
            </TabsContent>
            <TabsContent value="add">
              <PatientCreateTab onAddItem={handleAddItem} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
