import { Navigate, Route, Routes } from "react-router-dom";
import { hasDeviceSessionToken } from "../api/auth";
import { LoginPage } from "../features/auth/LoginPage";
import { ProtectedRoute, PublicOnlyRoute } from "../features/auth/AuthRoute";
import { WebhooksPage } from "../features/webhooks/WebhooksPage";

function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/webhooks" element={<WebhooksPage />} />
      </Route>
      <Route
        path="/"
        element={
          <Navigate
            to={hasDeviceSessionToken() ? "/webhooks" : "/login"}
            replace
          />
        }
      />
      <Route
        path="*"
        element={
          <Navigate
            to={hasDeviceSessionToken() ? "/webhooks" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
