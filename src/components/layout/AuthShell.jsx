export default function AuthShell({ children, maxWidth = 400 }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-cream px-4 py-7 font-sans">
      <div style={{ width: "100%", maxWidth, margin: "auto 0" }}>{children}</div>
    </div>
  );
}