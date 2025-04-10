import { useState } from "react";
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

const ItemForm = ({ onSubmit, isLoading }) => {
  const [items, setItems] = useState("");

  const examples = [
    "bread, water, apple",
    "toothbrush, soap, towel",
    "notebook, pen, glasses",
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
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
          added items will be preserved.
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
              placeholder="bread, water, apple, toothpaste"
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
                Processing...
              </>
            ) : (
              "Categorize Items"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ItemForm;
