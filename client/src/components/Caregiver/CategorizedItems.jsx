import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

const CategorizedItems = ({ data }) => {
  if (!data || !data.items || data.items.length === 0) {
    return null;
  }

  // Group items by category
  const categorizedItems = data.items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = {};
    }

    if (!acc[item.category][item.subcategory]) {
      acc[item.category][item.subcategory] = [];
    }

    acc[item.category][item.subcategory].push(item);
    return acc;
  }, {});

  // Get the image URL for a category, subcategory, or item
  const getImageUrl = (type, name, category = null, subcategory = null) => {
    if (!data || !data.images) return null;

    let imageKey;
    if (type === "category") {
      imageKey = `category-${name}`;
    } else if (type === "subcategory") {
      imageKey = `subcategory-${category}-${name}`;
    } else if (type === "item") {
      imageKey = `item-${name}`;
    }

    const imageFilename = data.images[imageKey];

    if (imageFilename) {
      return `http://127.0.0.1:5000/api/images/${imageFilename}`;
    }

    return null;
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle className="text-2xl">Categorized Items</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(categorizedItems).map(
            ([category, subcategories], idx) => (
              <AccordionItem value={`category-${idx}`} key={idx}>
                <AccordionTrigger className="text-lg font-medium py-4 hover:no-underline">
                  <div className="flex items-center">
                    {getImageUrl("category", category) && (
                      <div className="w-8 h-8 mr-3 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={getImageUrl("category", category)}
                          alt={category}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src =
                              "https://placehold.co/32x32/e5e7eb/a1a1aa?text=C";
                          }}
                        />
                      </div>
                    )}
                    <span className="capitalize">{category}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-4 space-y-4">
                    {Object.entries(subcategories).map(
                      ([subcategory, items], subIdx) => (
                        <div key={subIdx} className="mt-2">
                          <h4 className="text-md font-medium capitalize text-gray-600 mb-2 flex items-center">
                            {getImageUrl(
                              "subcategory",
                              subcategory,
                              category
                            ) && (
                              <div className="w-6 h-6 mr-2 rounded-full overflow-hidden flex-shrink-0">
                                <img
                                  src={getImageUrl(
                                    "subcategory",
                                    subcategory,
                                    category
                                  )}
                                  alt={subcategory}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.src =
                                      "https://placehold.co/24x24/e5e7eb/a1a1aa?text=S";
                                  }}
                                />
                              </div>
                            )}
                            {subcategory}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item, itemIdx) => (
                              <ItemCard
                                key={itemIdx}
                                item={item}
                                imageUrl={getImageUrl("item", item.name)}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
};

const ItemCard = ({ item, imageUrl }) => {
  const [selectedRequests, setSelectedRequests] = useState([]);

  const toggleRequest = (request) => {
    if (selectedRequests.includes(request)) {
      setSelectedRequests((prev) => prev.filter((r) => r !== request));
    } else {
      setSelectedRequests((prev) => [...prev, request]);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-primary/10 p-4 flex items-center">
        {imageUrl && (
          <div className="w-10 h-10 mr-3 rounded-full overflow-hidden flex-shrink-0">
            <img
              src={imageUrl}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src =
                  "https://placehold.co/40x40/e5e7eb/a1a1aa?text=I";
              }}
            />
          </div>
        )}
        <div>
          <h3 className="text-lg font-semibold capitalize">{item.name}</h3>
          <Badge variant="outline" className="mt-1">
            {item.subcategory}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-2">Common Requests:</h4>
        <ul className="space-y-2">
          {item.requests.map((request, idx) => (
            <li
              key={idx}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                selectedRequests.includes(request)
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => toggleRequest(request)}
            >
              {selectedRequests.includes(request) && (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              )}
              <span
                className={
                  selectedRequests.includes(request) ? "font-medium" : ""
                }
              >
                {request.charAt(0).toUpperCase() + request.slice(1)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default CategorizedItems;
