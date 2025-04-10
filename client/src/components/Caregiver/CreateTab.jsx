import { useState, useEffect } from "react";
import ItemForm from "./ItemForm";
import CategorizedItems from "./CategorizedItems";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const CreateTab = ({ setCategorizedData, initialData }) => {
  const [localData, setLocalData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize local data from initialData
  useEffect(() => {
    if (initialData) {
      setLocalData(initialData);
    }
  }, [initialData]);

  const handleSubmitItems = async (items) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://127.0.0.1:5000/categorize-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        throw new Error("Failed to categorize items");
      }

      const data = await response.json();
      setLocalData(data);
      setCategorizedData(data);
    } catch (err) {
      setError(err.message);
      console.error("Error categorizing items:", err);
    } finally {
      setIsLoading(false);
    }
  };

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

      <CategorizedItems data={localData} />
    </div>
  );
};

export default CreateTab;
