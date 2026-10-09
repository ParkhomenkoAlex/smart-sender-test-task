import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./app/App.tsx";
import { queryClient } from "./app/queryClient.ts";

async function bootstrap() {
  const { worker } = await import("./mocks/browser.ts");

  await worker.start({
    onUnhandledFrame: "bypass",
  });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
