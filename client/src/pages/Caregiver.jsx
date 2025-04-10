import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateTab from "@/components/Caregiver/CreateTab";
import PreviewTab from "@/components/Caregiver/PreviewTab";

export default function Caregiver() {
  const [categorizedData, setCategorizedData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load stored data when the component mounts
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5000/api/stored-data");

        if (!response.ok) {
          throw new Error("Failed to fetch stored data");
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
          setCategorizedData(data);
        }
      } catch (err) {
        console.error("Error fetching stored data:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoredData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Visual Communication Assistant
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Helping caregivers and patients communicate more effectively
          </p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">
              Loading saved data...
            </span>
          </div>
        ) : (
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <CreateTab
                setCategorizedData={setCategorizedData}
                initialData={categorizedData}
              />
            </TabsContent>
            <TabsContent value="preview">
              <PreviewTab categorizedData={categorizedData} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
