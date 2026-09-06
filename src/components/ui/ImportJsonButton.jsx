import { useRef } from "react";
import { Upload } from "lucide-react";
import Button from "./Button.jsx";

export default function ImportJsonButton({ onImport, children, size = "sm" }) {
  const inputRef = useRef(null);

  return (
    <>
      <Button variant="ghost" size={size} onClick={() => inputRef.current?.click()}>
        <Upload size={14} /> {children ?? "Importer un JSON"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onerror = () => onImport(null, file.name);
          reader.onload = () => onImport(String(reader.result || ""), file.name);
          reader.readAsText(file);
          e.target.value = "";
        }}
      />
    </>
  );
}