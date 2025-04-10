import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Patient from "./pages/Patient";
import Caregiver from "./pages/Caregiver";

function App() {
  return (
    <div>
      <Tabs defaultValue="patient" className="w-full">
        <div className="flex justify-center">
          <TabsList>
            <TabsTrigger value="patient">Patient</TabsTrigger>
            <TabsTrigger value="caregiver">Caregiver</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="patient">
          <Patient />
        </TabsContent>

        <TabsContent value="caregiver">
          <Caregiver />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default App;
