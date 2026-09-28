import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "../../context/theme-hooks.js";

export default function Toaster(props) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        duration: 3500,
      }}
      {...props}
    />
  );
}