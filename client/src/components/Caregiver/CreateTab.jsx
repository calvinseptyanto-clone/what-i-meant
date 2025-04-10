import { useState, useEffect } from "react";
import ItemForm from "./ItemForm";
import CategorizedItems from "./CategorizedItems";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

const CreateTab = ({ setCategorizedData }) => {
  const [localData, setLocalData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load existing data on component mount
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        const response = await fetch("/api/stored-data");
        if (!response.ok) {
          throw new Error("Failed to fetch stored data");
        }
        const data = await response.json();
        setLocalData(data);
        setCategorizedData(data);
      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError("Failed to load existing items. Please try again.");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchStoredData();
  }, [setCategorizedData]);

  const handleSubmitItems = async (items) => {
    setIsLoading(true);
    setError(null);

    try {
      // Send items to backend for categorization
      const response = await fetch("/api/categorize-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to categorize items");
      }

      // Process the categorized data from the backend
      const categorizedData = await response.json();

      // Update local state and parent component state
      setLocalData(categorizedData);
      setCategorizedData(categorizedData);
    } catch (err) {
      setError(
        err.message || "Something went wrong with the categorization process"
      );
      console.error("Categorization error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading existing items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ItemForm onSubmit={handleSubmitItems} isLoading={isLoading} />

      {/* Pass isLoading to CategorizedItems to show loading state */}
      <CategorizedItems data={localData} isLoading={isLoading} />
    </div>
  );
};

export default CreateTab;
