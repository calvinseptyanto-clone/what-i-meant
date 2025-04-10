import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ItemForm = ({ onSubmit, isLoading }) => {
  const [items, setItems] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const { toast } = useToast();

  // Examples based on common categorizable items
  const examples = [
    "bread, water, apple",
    "toothbrush, soap, towel",
    "notebook, pen, glasses",
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!items.trim()) {
      toast({
        title: "No items provided",
        description: "Please enter at least one item to categorize",
        variant: "destructive",
      });
      return;
    }

    // Pass items to parent component for processing by the backend
    onSubmit(items);
  };

  const handleExampleClick = (example) => {
    setItems(example);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Add New Items</CardTitle>
        <CardDescription>
          Enter items to categorize and generate common requests. Previously
          added items will be preserved and updated with the Qwen model.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="items" className="text-sm font-medium">
              Enter items separated by commas
            </label>
            <Input
              id="items"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="bread, water, ..."
              className="h-12"
              required
            />

            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-2">Examples:</p>
              <div className="flex flex-wrap gap-2">
                {examples.map((example, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleExampleClick(example)}
                    className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full h-12">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {/* Show more detailed status during processing */}
                Categorizing with Qwen AI...
              </>
            ) : (
              "Categorize Items"
            )}
          </Button>

          {isLoading && (
            <p className="text-xs text-center text-muted-foreground">
              Generating images and videos using Wan2.1 models. This may take a
              moment...
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default ItemForm;
