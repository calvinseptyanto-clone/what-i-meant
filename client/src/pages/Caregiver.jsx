import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreateTab from "@/components/Caregiver/CreateTab";
import ManagementTab from "@/components/Caregiver/ManagementTab";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Caregiver() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {/* Load logo from public directory instead of importing */}
            <img src="src/assets/logo.png" alt="Logo" className="h-20 w-auto" />
          </div>

          <div className="mt-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h2 className="text-lg font-medium text-blue-800">
              Yee Hui's Dashboard
            </h2>
            <p className="text-sm text-blue-600">
              Customized communication cards for Dad (Zhe Ming). These help him
              express his needs despite his aphasia. Add new items that are
              meaningful to him.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              Loading items from database...
            </p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create New Items</TabsTrigger>
              <TabsTrigger value="management">Manage Dad's Items</TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <CreateTab setCategorizedData={setCategorizedData} />
            </TabsContent>
            <TabsContent value="management">
              <ManagementTab categorizedData={categorizedData} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
